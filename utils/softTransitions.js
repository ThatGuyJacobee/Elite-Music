const states = new Map();

const RAMP_INTERVAL_MS = 25;
const MIN_MANUAL_FADE_MS = 100;
const MAX_MANUAL_FADE_MS = 300;

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
        });
    }

    return states.get(guildId);
}

function isEnabled(queue) {
    return Boolean(client.config.enableSoftTransitions);
}

function getTransitionMs() {
    return client.config.softTransitionMs;
}

function getManualTransitionMs() {
    return Math.max(MIN_MANUAL_FADE_MS, Math.min(MAX_MANUAL_FADE_MS, Math.round(getTransitionMs() / 3)));
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
    queue.node.setVolume(Math.round(Math.max(0, Math.min(100, volume))));
}

function rampVolume(queue, target, duration) {
    const state = getState(queue);
    stopRamp(state);

    const start = queue.node.volume;
    const token = state.rampToken;
    const startedAt = Date.now();

    return new Promise((resolve) => {
        const finish = () => {
            if (token !== state.rampToken) return resolve(false);
            setOutputVolume(queue, target);
            state.ramp = null;
            resolve(true);
        };

        if (duration <= 0 || start === target) return finish();

        state.ramp = setInterval(() => {
            if (token !== state.rampToken) return resolve(false);

            const progress = Math.min(1, (Date.now() - startedAt) / duration);
            const easedProgress = progress * progress * (3 - 2 * progress);
            setOutputVolume(queue, start + (target - start) * easedProgress);

            if (progress === 1) {
                clearInterval(state.ramp);
                finish();
            }
        }, RAMP_INTERVAL_MS);
    });
}

function canNaturallyTransition(queue) {
    const hasNextTrack = queue.tracks.size > 0;
    const repeatsCurrentTrack = queue.repeatMode === 1;
    return hasNextTrack || repeatsCurrentTrack;
}

function stopNaturalMonitor(queue) {
    stopMonitor(getState(queue));
}

function startNaturalMonitor(queue) {
    const state = getState(queue);
    stopMonitor(state);
    if (!isEnabled(queue) || !canNaturallyTransition(queue)) return;

    state.monitor = setInterval(async () => {
        if (state.transitioning || queue.node.isPaused() || !canNaturallyTransition(queue)) return;

        const timestamp = queue.node.getTimestamp();
        if (!timestamp?.total?.value || !timestamp.current?.value) return;

        const remaining = timestamp.total.value - timestamp.current.value;
        if (remaining > getTransitionMs()) return;

        state.transitioning = true;
        state.pendingFadeIn = true;
        stopNaturalMonitor(queue);
        const completed = await rampVolume(queue, 0, Math.max(0, remaining));
        if (!completed) {
            state.transitioning = false;
            state.pendingFadeIn = false;
        }
    }, 250);
}

async function startInitialPlayback(queue, track) {
    const state = getState(queue);
    state.intendedVolume = client.config.defaultVolume;
    state.pendingFadeIn = false;
    await queue.node.play(track);
    setOutputVolume(queue, state.intendedVolume);
}

async function transition(queue, changeTrack) {
    const state = getState(queue);
    if (!isEnabled(queue)) return changeTrack();
    if (state.transitioning) return false;

    state.transitioning = true;
    state.pendingFadeIn = true;
    stopNaturalMonitor(queue);

    const completed = await rampVolume(queue, 0, getManualTransitionMs());
    if (!completed) return false;

    try {
        const result = await changeTrack();
        if (result === false) {
            state.transitioning = false;
            state.pendingFadeIn = false;
            setOutputVolume(queue, state.intendedVolume);
        }
        return result;
    } catch (error) {
        state.transitioning = false;
        state.pendingFadeIn = false;
        setOutputVolume(queue, state.intendedVolume);
        throw error;
    }
}

function handlePlayerStart(queue) {
    const state = getState(queue);
    stopNaturalMonitor(queue);

    if (state.pendingFadeIn && isEnabled(queue)) {
        state.pendingFadeIn = false;
        state.transitioning = false;
        setOutputVolume(queue, 0);
        rampVolume(queue, state.intendedVolume, getTransitionMs());
    } else {
        setOutputVolume(queue, state.intendedVolume);
    }

    startNaturalMonitor(queue);
}

function cancel(queue, { restoreVolume = true } = {}) {
    const state = getState(queue);
    stopRamp(state);
    stopNaturalMonitor(queue);
    state.transitioning = false;
    state.pendingFadeIn = false;
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
