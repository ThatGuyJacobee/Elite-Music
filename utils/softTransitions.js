const states = new Map();

const RAMP_INTERVAL_MS = 25;
const MONITOR_INTERVAL_MS = 100;
const MIN_MANUAL_FADE_MS = 250;
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
            fadeStartVolume: null,
            fadeTrackKey: null,
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

function getManualTransitionMs() {
    return getTransitionMs();
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

    return fadeMs >= MIN_MANUAL_FADE_MS ? Math.round(fadeMs) : 0;
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

function setOutputVolume(queue, volume) {
    const nextVolume = Math.round(Math.max(0, Math.min(100, volume)));
    queue.node.setVolume(nextVolume);
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
    state.fadeStartVolume = null;
    state.fadeTrackKey = null;
}

function stopNaturalMonitor(queue) {
    stopMonitor(getState(queue));
}

function startNaturalMonitor(queue) {
    const state = getState(queue);
    stopMonitor(state);
    if (!isEnabled()) return;

    // Drive fade-out from remaining playback time so volume hits 0 as the track ends,
    // instead of a separate wall-clock timer that can finish early and leave silence.
    state.monitor = setInterval(() => {
        try {
            if (queue.node.isPaused()) return;
            if (state.ramp) return;

            const trackKey = getTrackKey(queue);
            // A new track can become current before playerStart runs. Ignore the old fade-out
            // against the new track's remaining time or we wipe pendingFadeIn and jump to full volume.
            if (state.fadingOut && state.fadeTrackKey && trackKey !== state.fadeTrackKey) {
                return;
            }

            const timing = getPlaybackTiming(queue);
            if (timing == null) return;

            if (
                state.fadingOut &&
                state.fadeStartRemainingMs != null &&
                timing.remaining > state.fadeStartRemainingMs + MONITOR_INTERVAL_MS * 2
            ) {
                resetNaturalFade(state);
                setOutputVolume(queue, state.intendedVolume);
                return;
            }

            const requestedFadeMs = canNaturallyTransition(queue) ? getTransitionMs() : getManualTransitionMs();
            const effectiveFadeMs = getEffectiveFadeMs(queue, requestedFadeMs);
            if (!state.fadingOut && (effectiveFadeMs === 0 || timing.remaining > effectiveFadeMs)) return;

            if (!state.fadingOut) {
                const fadeDurationMs = Math.min(effectiveFadeMs, timing.remaining);
                if (fadeDurationMs < MIN_MANUAL_FADE_MS) return;

                const transitionsToNextTrack = canNaturallyTransition(queue);
                state.fadingOut = true;
                state.transitioning = transitionsToNextTrack;
                state.pendingFadeIn = transitionsToNextTrack;
                state.pendingFadeInMs = transitionsToNextTrack ? getTransitionMs() : null;
                state.fadeStartRemainingMs = timing.remaining;
                state.fadeStartVolume = queue.node.volume;
                state.fadeTrackKey = trackKey;
            } else if (!state.pendingFadeIn && canNaturallyTransition(queue)) {
                // A track may be queued after the final-track fade has already begun.
                state.transitioning = true;
                state.pendingFadeIn = true;
                state.pendingFadeInMs = getTransitionMs();
            }

            const gain = Math.max(0, Math.min(1, timing.remaining / state.fadeStartRemainingMs));
            setOutputVolume(queue, state.fadeStartVolume * gain);
        } catch {
            stopMonitor(state);
            resetNaturalFade(state);
            try {
                setOutputVolume(queue, state.intendedVolume);
            } catch {}
        }
    }, MONITOR_INTERVAL_MS);
}

async function startInitialPlayback(queue, track) {
    const state = getState(queue);
    state.intendedVolume = client.config.defaultVolume;
    const initialFadeMs = getEffectiveFadeMs(queue, getManualTransitionMs(), { track });
    state.pendingFadeIn = isEnabled() && initialFadeMs > 0;
    state.pendingFadeInMs = state.pendingFadeIn ? initialFadeMs : null;
    state.fadingOut = false;
    state.fadeStartRemainingMs = null;
    state.fadeStartVolume = null;
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
    state.fadeStartVolume = null;
    state.fadeTrackKey = getTrackKey(queue);
    stopNaturalMonitor(queue);

    const manualFadeMs = getEffectiveFadeMs(queue, getManualTransitionMs(), { capToRemaining: true });
    const completed = manualFadeMs === 0 ? true : await rampVolume(queue, 0, manualFadeMs);
    if (!completed) {
        resetNaturalFade(state);
        try {
            setOutputVolume(queue, state.intendedVolume);
        } catch {}
        return false;
    }

    try {
        const result = await changeTrack();
        if (result === false) {
            state.transitioning = false;
            state.pendingFadeIn = false;
            state.pendingFadeInMs = null;
            state.fadeTrackKey = null;
            setOutputVolume(queue, state.intendedVolume);
        }
        return result;
    } catch (error) {
        state.transitioning = false;
        state.pendingFadeIn = false;
        state.pendingFadeInMs = null;
        state.fadeTrackKey = null;
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
    state.fadeStartVolume = null;
    state.fadeTrackKey = null;
    const shouldFadeIn = state.pendingFadeIn && isEnabled() && fadeInMs > 0;
    state.pendingFadeIn = false;
    state.pendingFadeInMs = null;
    state.transitioning = false;

    if (shouldFadeIn) {
        setOutputVolume(queue, 0);
        // Wait until fade-in finishes before arming the natural end monitor,
        // so a short/incorrect remaining time cannot cancel the fade-in early.
        rampVolume(queue, state.intendedVolume, fadeInMs).then((completed) => {
            if (completed) startNaturalMonitor(queue);
        });
        return;
    }

    setOutputVolume(queue, state.intendedVolume);
    startNaturalMonitor(queue);
}

function cancel(queue, { restoreVolume = true } = {}) {
    const state = getState(queue);
    stopRamp(state);
    stopNaturalMonitor(queue);
    state.transitioning = false;
    state.pendingFadeIn = false;
    state.pendingFadeInMs = null;
    state.fadingOut = false;
    state.fadeStartRemainingMs = null;
    state.fadeStartVolume = null;
    state.fadeTrackKey = null;
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
    getIntendedVolume,
    handlePlayerStart,
    isTransitioning,
    setIntendedVolume,
    startInitialPlayback,
    startNaturalMonitor,
    stopNaturalMonitor,
    transition,
};
