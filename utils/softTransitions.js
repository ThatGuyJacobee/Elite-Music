const { StreamType } = require("discord-player");
const { SoftTransitionStream } = require("./softTransitionStream");

const states = new Map();

const RAMP_INTERVAL_MS = 25;
const MONITOR_INTERVAL_MS = 100;
const PLAYBACK_SYNC_INTERVAL_MS = 20;
const PLAYBACK_SYNC_TIMEOUT_BUFFER_MS = 5000;
const MIN_FADE_MS = 250;
const TRACK_FADE_FRACTION = 0.25;

function getState(queue) {
    const guildId = queue.guild.id;
    if (!states.has(guildId)) {
        states.set(guildId, {
            intendedVolume: queue.node.volume,
            monitor: null,
            ramp: null,
            rampToken: 0,
            transitioning: false,
            pendingFadeIn: false,
            pendingFadeInMs: null,
            fadingOut: false,
            fadeStartRemainingMs: null,
            fadeTrackKey: null,
            streamFader: null,
            streamFadeWait: null,
            streamFadeToken: 0,
            pendingPcmFadeInEndMs: null,
        });
    }

    return states.get(guildId);
}

function getTrackKey(queue) {
    const track = queue.currentTrack;
    if (!track) return null;
    return track.id ?? track.url ?? track.title ?? null;
}

function isEnabled() {
    return Boolean(client.config.enableSoftTransitions);
}

function getTransitionMs() {
    return client.config.softTransitionMs;
}

function getPlaybackTiming(queue) {
    let timestamp;
    try {
        timestamp = queue.node.getTimestamp();
    } catch {
        return null;
    }

    const total = timestamp?.total?.value;
    const current = timestamp?.current?.value;
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(current) || current < 0) {
        return null;
    }

    return {
        current,
        remaining: Math.max(0, total - current),
        total,
    };
}

function getTrackDurationMs(queue, track) {
    const selectedTrack = track === undefined ? queue.currentTrack : track;
    const duration = Number(selectedTrack?.durationMS);
    if (Number.isFinite(duration) && duration > 0) return duration;
    if (track !== undefined) return null;
    return getPlaybackTiming(queue)?.total ?? null;
}

function getEffectiveFadeMs(queue, requestedMs, { capToRemaining = false, track } = {}) {
    let fadeMs = requestedMs;
    const trackDurationMs = getTrackDurationMs(queue, track);

    if (trackDurationMs != null) {
        fadeMs = Math.min(fadeMs, Math.floor(trackDurationMs * TRACK_FADE_FRACTION));
    }

    if (capToRemaining) {
        const remaining = getPlaybackTiming(queue)?.remaining;
        if (remaining != null) fadeMs = Math.min(fadeMs, remaining);
    }

    return fadeMs >= MIN_FADE_MS ? Math.round(fadeMs) : 0;
}

function getAvailableStreamMs(queue, fader) {
    if (!fader) return null;
    const timing = getPlaybackTiming(queue);
    if (!timing) return null;
    return Math.max(0, timing.total - fader.processedMs);
}

function capFadeToAvailableStream(queue, fadeMs, fader) {
    const availableStreamMs = getAvailableStreamMs(queue, fader);
    if (availableStreamMs == null) return fadeMs;

    const capped = Math.min(fadeMs, Math.round(availableStreamMs));
    return capped >= MIN_FADE_MS ? capped : 0;
}

function stopRamp(state) {
    state.rampToken += 1;
    if (state.ramp) clearInterval(state.ramp);
    state.ramp = null;
}

function stopMonitor(state) {
    if (state.monitor) clearInterval(state.monitor);
    state.monitor = null;
}

function cancelStreamFadeWait(state) {
    state.streamFadeToken += 1;
    state.pendingPcmFadeInEndMs = null;
    if (state.streamFadeWait) {
        clearInterval(state.streamFadeWait.interval);
        state.streamFadeWait.resolve(false);
        state.streamFadeWait = null;
    }
}

function cancelStreamFade(state) {
    cancelStreamFadeWait(state);
    state.streamFader?.cancelFade();
}

function setOutputVolume(queue, volume) {
    const nextVolume = Math.round(Math.max(0, Math.min(100, volume)));
    queue.node.setVolume(nextVolume);
}

async function createSoftTransitionStream(stream, queue) {
    const state = getState(queue);
    cancelStreamFade(state);

    const fader = new SoftTransitionStream();
    state.streamFader = fader;

    // Schedule before any PCM is processed so the track cannot start at full gain.
    if (state.pendingFadeIn && isEnabled()) {
        const requestedFadeInMs = state.pendingFadeInMs ?? getTransitionMs();
        const fadeInMs = getEffectiveFadeMs(queue, requestedFadeInMs);
        const scheduledFade = fadeInMs > 0 ? fader.scheduleFadeIn(fadeInMs) : null;
        if (scheduledFade) {
            state.pendingPcmFadeInEndMs = scheduledFade.endMs;
            try {
                setOutputVolume(queue, state.intendedVolume);
            } catch {}
        }
    }

    stream.pipe(fader);
    return { stream: fader, type: StreamType.Raw };
}

// Wait until Discord has actually consumed the faded audio (not just until PCM was written).
function waitForFadePlayback(queue, state, fader, fadeEndMs) {
    const token = state.streamFadeToken;
    const startedAt = Date.now();
    const expectedWaitMs = Math.max(0, fadeEndMs - queue.node.streamTime);

    return new Promise((resolve) => {
        const finish = (completed) => {
            if (state.streamFadeWait?.token === token) {
                clearInterval(state.streamFadeWait.interval);
                state.streamFadeWait = null;
            }
            resolve(completed);
        };

        const interval = setInterval(() => {
            if (token !== state.streamFadeToken || state.streamFader !== fader || !queue.dispatcher) {
                return finish(false);
            }

            if (queue.node.streamTime >= fadeEndMs) return finish(true);

            if (Date.now() - startedAt > expectedWaitMs + PLAYBACK_SYNC_TIMEOUT_BUFFER_MS) {
                return finish(false);
            }
        }, PLAYBACK_SYNC_INTERVAL_MS);

        state.streamFadeWait = { interval, resolve: finish, token };
    });
}

function rampVolume(queue, target, duration) {
    const state = getState(queue);
    stopRamp(state);

    const start = queue.node.volume;
    const token = state.rampToken;
    const startedAt = Date.now();

    return new Promise((resolve) => {
        const finish = (completed) => {
            if (token !== state.rampToken) return resolve(false);
            setOutputVolume(queue, target);
            state.ramp = null;
            resolve(completed);
        };

        if (duration <= 0 || start === target) return finish(true);

        state.ramp = setInterval(() => {
            try {
                if (token !== state.rampToken) return finish(false);

                const progress = Math.min(1, (Date.now() - startedAt) / duration);
                setOutputVolume(queue, start + (target - start) * progress);

                if (progress >= 1) {
                    clearInterval(state.ramp);
                    finish(true);
                }
            } catch {
                clearInterval(state.ramp);
                state.ramp = null;
                resolve(false);
            }
        }, RAMP_INTERVAL_MS);
    });
}

function canNaturallyTransition(queue) {
    const hasNextTrack = queue.tracks.size > 0;
    const repeatsCurrentTrack = queue.repeatMode === 1;
    return hasNextTrack || repeatsCurrentTrack;
}

function resetNaturalFade(state) {
    state.transitioning = false;
    state.pendingFadeIn = false;
    state.pendingFadeInMs = null;
    state.fadingOut = false;
    state.fadeStartRemainingMs = null;
    state.fadeTrackKey = null;
}

function restoreIntendedVolume(queue, state) {
    try {
        setOutputVolume(queue, state.intendedVolume);
    } catch {}
}

function stopNaturalMonitor(queue) {
    stopMonitor(getState(queue));
}

function startNaturalMonitor(queue) {
    const state = getState(queue);
    stopMonitor(state);
    if (!isEnabled()) return;

    state.monitor = setInterval(() => {
        try {
            if (queue.node.isPaused()) return;
            if (state.ramp) return;
            if (state.streamFadeWait) return;

            const trackKey = getTrackKey(queue);
            // New track can become current before playerStart — don't treat that as this fade ending.
            if (state.fadingOut && state.fadeTrackKey && trackKey !== state.fadeTrackKey) {
                return;
            }

            const timing = getPlaybackTiming(queue);
            if (timing == null) return;

            // Seek jumped us back out of the fade window.
            if (
                state.fadingOut &&
                state.fadeStartRemainingMs != null &&
                timing.remaining > state.fadeStartRemainingMs + MONITOR_INTERVAL_MS * 2
            ) {
                state.streamFader?.cancelFade();
                resetNaturalFade(state);
                setOutputVolume(queue, state.intendedVolume);
                return;
            }

            if (state.fadingOut) {
                // Track queued after a final-track fade already started.
                if (!state.pendingFadeIn && canNaturallyTransition(queue)) {
                    state.transitioning = true;
                    state.pendingFadeIn = true;
                    state.pendingFadeInMs = getTransitionMs();
                }
                return;
            }

            const effectiveFadeMs = getEffectiveFadeMs(queue, getTransitionMs());
            if (effectiveFadeMs === 0 || timing.remaining > effectiveFadeMs) return;

            const fader = state.streamFader;
            const fadeDurationMs = capFadeToAvailableStream(queue, Math.min(effectiveFadeMs, timing.remaining), fader);
            if (fadeDurationMs === 0) return;

            const transitionsToNextTrack = canNaturallyTransition(queue);
            state.fadingOut = true;
            state.transitioning = transitionsToNextTrack;
            state.pendingFadeIn = transitionsToNextTrack;
            state.pendingFadeInMs = transitionsToNextTrack ? getTransitionMs() : null;
            state.fadeStartRemainingMs = timing.remaining;
            state.fadeTrackKey = trackKey;

            setOutputVolume(queue, state.intendedVolume);
            if (!fader?.scheduleFadeOut(fadeDurationMs)) {
                rampVolume(queue, 0, fadeDurationMs);
            }
        } catch {
            stopMonitor(state);
            state.streamFader?.cancelFade();
            resetNaturalFade(state);
            restoreIntendedVolume(queue, state);
        }
    }, MONITOR_INTERVAL_MS);
}

async function startInitialPlayback(queue, track) {
    const state = getState(queue);
    state.intendedVolume = client.config.defaultVolume;
    const initialFadeMs = getEffectiveFadeMs(queue, getTransitionMs(), { track });
    state.pendingFadeIn = isEnabled() && initialFadeMs > 0;
    state.pendingFadeInMs = state.pendingFadeIn ? initialFadeMs : null;
    state.fadingOut = false;
    state.fadeStartRemainingMs = null;
    state.fadeTrackKey = null;
    setOutputVolume(queue, state.pendingFadeIn ? 0 : state.intendedVolume);
    await queue.node.play(track);
}

async function transition(queue, changeTrack) {
    const state = getState(queue);
    if (!isEnabled()) return changeTrack();
    if (state.transitioning) return false;

    state.transitioning = true;
    state.pendingFadeIn = true;
    state.pendingFadeInMs = getTransitionMs();
    state.fadingOut = false;
    state.fadeStartRemainingMs = null;
    state.fadeTrackKey = getTrackKey(queue);
    stopNaturalMonitor(queue);

    const fader = state.streamFader;
    let fadeMs = getEffectiveFadeMs(queue, getTransitionMs(), { capToRemaining: true });
    fadeMs = capFadeToAvailableStream(queue, fadeMs, fader);

    cancelStreamFadeWait(state);
    const scheduledFade = fadeMs > 0 ? fader?.scheduleFadeOut(fadeMs) : null;
    if (!scheduledFade && fader) fader.cancelFade();

    const completed =
        fadeMs === 0
            ? true
            : scheduledFade
              ? await waitForFadePlayback(queue, state, fader, scheduledFade.endMs)
              : await rampVolume(queue, 0, fadeMs);
    if (completed) setOutputVolume(queue, 0);

    if (!completed) {
        cancelStreamFade(state);
        resetNaturalFade(state);
        restoreIntendedVolume(queue, state);
        return false;
    }

    try {
        const result = await changeTrack();
        if (result === false) {
            cancelStreamFade(state);
            resetNaturalFade(state);
            setOutputVolume(queue, state.intendedVolume);
        }
        return result;
    } catch (error) {
        cancelStreamFade(state);
        resetNaturalFade(state);
        setOutputVolume(queue, state.intendedVolume);
        throw error;
    }
}

function handlePlayerStart(queue) {
    const state = getState(queue);
    const requestedFadeInMs = state.pendingFadeInMs ?? getTransitionMs();
    const fadeInMs = getEffectiveFadeMs(queue, requestedFadeInMs);
    stopNaturalMonitor(queue);
    stopRamp(state);
    state.fadingOut = false;
    state.fadeStartRemainingMs = null;
    state.fadeTrackKey = null;

    const shouldFadeIn = state.pendingFadeIn && isEnabled() && fadeInMs > 0;
    state.pendingFadeIn = false;
    state.pendingFadeInMs = null;
    state.transitioning = false;

    if (shouldFadeIn) {
        const fader = state.streamFader;
        const pcmFadeEndMs = state.pendingPcmFadeInEndMs;
        state.pendingPcmFadeInEndMs = null;

        if (fader && pcmFadeEndMs != null) {
            const fadeToken = state.streamFadeToken;
            setOutputVolume(queue, state.intendedVolume);
            waitForFadePlayback(queue, state, fader, pcmFadeEndMs).then((completed) => {
                if (fadeToken !== state.streamFadeToken || state.streamFader !== fader) return;
                fader.cancelFade();
                if (!completed) setOutputVolume(queue, state.intendedVolume);
                startNaturalMonitor(queue);
            });
            return;
        }

        // Volume-ramp fallback when the stream fader was unavailable.
        cancelStreamFade(state);
        setOutputVolume(queue, 0);
        rampVolume(queue, state.intendedVolume, fadeInMs).then((completed) => {
            if (completed) startNaturalMonitor(queue);
        });
        return;
    }

    state.pendingPcmFadeInEndMs = null;
    setOutputVolume(queue, state.intendedVolume);
    startNaturalMonitor(queue);
}

function cancel(queue, { restoreVolume = true } = {}) {
    const state = getState(queue);
    cancelStreamFade(state);
    stopRamp(state);
    stopNaturalMonitor(queue);
    resetNaturalFade(state);
    if (restoreVolume) setOutputVolume(queue, state.intendedVolume);
}

function setIntendedVolume(queue, volume) {
    const state = getState(queue);
    cancel(queue, { restoreVolume: false });
    state.intendedVolume = volume;
    setOutputVolume(queue, volume);
    startNaturalMonitor(queue);
}

function getIntendedVolume(queue) {
    return getState(queue).intendedVolume;
}

function isTransitioning(queue) {
    return getState(queue).transitioning;
}

function clear(queue) {
    cancel(queue, { restoreVolume: false });
    states.delete(queue.guild.id);
}

module.exports = {
    cancel,
    clear,
    createSoftTransitionStream,
    getIntendedVolume,
    handlePlayerStart,
    isTransitioning,
    setIntendedVolume,
    startInitialPlayback,
    startNaturalMonitor,
    stopNaturalMonitor,
    transition,
};
