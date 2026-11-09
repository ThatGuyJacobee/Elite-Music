const { Readable } = require("node:stream");

let mediaplex = null;
try {
    mediaplex = require("mediaplex");
} catch {
    mediaplex = null;
}

const DEFAULT_PROBE_SIZE = 2 * 1024 * 1024;
const DEFAULT_PROBE_TIMEOUT_MS = 3000;

async function probeMediaResponse(response, options = {}) {
    if (!mediaplex || !response?.body) return null;

    const probeSize = options.probeSize ?? DEFAULT_PROBE_SIZE;
    const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
    let source;
    let timer;

    try {
        source = Readable.fromWeb(response.body);
        const probe = mediaplex.probeStream(source, { probeSize });
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("Media probe timed out")), timeoutMs);
        });
        const { result, stream } = await Promise.race([probe, timeout]);
        stream?.destroy?.();

        const duration = Number(result?.duration);
        if (!Number.isFinite(duration) || duration <= 0) return null;

        const metadata = mediaplex.readMetadata(result);
        return {
            durationMs: Math.round(duration * 1000),
            metadata: {
                title: metadata?.title || "",
                author: metadata?.author || "",
            },
        };
    } catch {
        source?.destroy();
        return null;
    } finally {
        clearTimeout(timer);
    }
}

if (!mediaplex) {
    console.log("[ELITE_PLAYBACK] mediaplex is unavailable; direct streams will not report durations.");
}

module.exports = {
    probeMediaResponse,
};
