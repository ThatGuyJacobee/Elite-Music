const states = new Map();

const RAMP_INTERVAL_MS = 25;
const MONITOR_INTERVAL_MS = 100;
const MIN_MANUAL_FADE_MS = 250;

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
            fadingOut: false,
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
    const transitionMs = getTransitionMs();
    return Math.max(MIN_MANUAL_FADE_MS, Math.round(transitionMs / 3));
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
            if (token !== state.rampToken) return finish(false);

            const progress = Math.min(1, (Date.now() - startedAt) / duration);
            setOutputVolume(queue, start + (target - start) * progress);

            if (progress >= 1) {
                clearInterval(state.ramp);
                finish(true);
            }
        }, RAMP_INTERVAL_MS);
    });
}

function canNaturallyTransition(queue) {
    const hasNextTrack = queue.tracks.size > 0;
    const repeatsCurrentTrack = queue.repeatMode === 1;
    return hasNextTrack || repeatsCurrentTrack;
}

function getPlaybackRemainingMs(queue) {
    const timestamp = queue.node.getTimestamp();
    const total = timestamp?.total?.value;
    const current = timestamp?.current?.value;

    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(current) || current < 0) {
        return null;
    }

    return Math.max(0, total - current);
}

function stopNaturalMonitor(queue) {
    stopMonitor(getState(queue));
}

function startNaturalMonitor(queue) {
    const state = getState(queue);
    stopMonitor(state);
    if (!isEnabled() || !canNaturallyTransition(queue)) return;

    // Drive fade-out from remaining playback time so volume hits 0 as the track ends,
    // instead of a separate wall-clock timer that can finish early and leave silence.
    state.monitor = setInterval(() => {
        if (queue.node.isPaused() || !canNaturallyTransition(queue)) return;
        if (state.ramp) return;

        const trackKey = getTrackKey(queue);
        // A new track can become current before playerStart runs. Ignore the old fade-out
        // against the new track's remaining time or we wipe pendingFadeIn and jump to full volume.
        if (state.fadingOut && state.fadeTrackKey && trackKey !== state.fadeTrackKey) {
            return;
        }

        const remaining = getPlaybackRemainingMs(queue);
        if (remaining == null) return;

        const fadeMs = getTransitionMs();
        if (remaining > fadeMs) return;

        if (!state.fadingOut) {
            state.fadingOut = true;
            state.transitioning = true;
            state.pendingFadeIn = true;
            state.fadeTrackKey = trackKey;
        }

        const gain = Math.max(0, Math.min(1, remaining / fadeMs));
        const nextVolume = state.intendedVolume * gain;
        setOutputVolume(queue, nextVolume);
    }, MONITOR_INTERVAL_MS);
}

async function startInitialPlayback(queue, track) {
    const state = getState(queue);
    state.intendedVolume = client.config.defaultVolume;
    state.pendingFadeIn = false;
    state.fadingOut = false;
    state.fadeTrackKey = null;
    await queue.node.play(track);
    setOutputVolume(queue, state.intendedVolume);
}

async function transition(queue, changeTrack) {
    const state = getState(queue);
    if (!isEnabled()) return changeTrack();
    if (state.transitioning) return false;

    state.transitioning = true;
    state.pendingFadeIn = true;
    state.fadingOut = false;
    state.fadeTrackKey = getTrackKey(queue);
    stopNaturalMonitor(queue);

    const completed = await rampVolume(queue, 0, getManualTransitionMs());
    if (!completed) return false;

    try {
        const result = await changeTrack();
        if (result === false) {
            state.transitioning = false;
            state.pendingFadeIn = false;
            state.fadeTrackKey = null;
            setOutputVolume(queue, state.intendedVolume);
        }
        return result;
    } catch (error) {
        state.transitioning = false;
        state.pendingFadeIn = false;
        state.fadeTrackKey = null;
        setOutputVolume(queue, state.intendedVolume);
        throw error;
    }
}

function handlePlayerStart(queue) {
    const state = getState(queue);
    stopNaturalMonitor(queue);
    stopRamp(state);
    state.fadingOut = false;
    state.fadeTrackKey = null;

    if (state.pendingFadeIn && isEnabled()) {
        state.pendingFadeIn = false;
        state.transitioning = false;
        setOutputVolume(queue, 0);
        // Wait until fade-in finishes before arming the natural end monitor,
        // so a short/incorrect remaining time cannot cancel the fade-in early.
        rampVolume(queue, state.intendedVolume, getTransitionMs()).then((completed) => {
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
    state.fadingOut = false;
    state.fadeTrackKey = null;
    if (restoreVolume) setOutputVolume(queue, state.intendedVolume);
}

function setIntendedVolume(queue, volume) {
    const state = getState(queue);
    cancel(queue, { restoreVolume: false });
    state.intendedVolume = volume;
    setOutputVolume(queue, volume);
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
