const { Readable } = require("node:stream");
const { spawn } = require("node:child_process");

let mediaplex = null;
try {
    mediaplex = require("mediaplex");
} catch {
    mediaplex = null;
}

let ffmpegPath = null;
try {
    ffmpegPath = require("ffmpeg-static");
} catch {
    ffmpegPath = null;
}

const DEFAULT_PROBE_SIZE = 2 * 1024 * 1024;
const DEFAULT_PROBE_TIMEOUT_MS = 3000;
const FFMPEG_PROBE_TIMEOUT_MS = 5000;
const FFMPEG_OUTPUT_LIMIT = 64 * 1024;
const DURATION_CACHE_TTL_MS = 60 * 60 * 1000;
const DURATION_CACHE_LIMIT = 200;
const MAX_CONCURRENT_PROBES = 2;
const FFMPEG_USER_AGENT = "Elite-Music (https://github.com/ThatGuyJacobee/Elite-Music)";
const FFMPEG_DURATION_PATTERN = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/;
const FFMPEG_NO_DURATION_PATTERN = /Duration:\s*N\/A/;
const FFMPEG_ESTIMATE_PATTERN = /Estimating duration from bitrate/;

const durationCache = new Map();
const probeQueue = [];
let activeProbes = 0;

// Reads the tags out of the first part of a response. The duration is intentionally not
// derived from this buffer: for most files it only covers the first few minutes (or less),
// so probing a truncated stream reports the length of the buffer, not the file.
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
        if (!result) return null;

        const metadata = mediaplex.readMetadata(result);
        return {
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

function parseFfmpegDuration(output) {
    const match = FFMPEG_DURATION_PATTERN.exec(String(output || ""));
    if (!match) return null;

    const [, hours, minutes, seconds] = match;
    const durationMs = Math.round((Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000);

    return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : null;
}

function parseFfmpegOutput(output) {
    const durationMs = parseFfmpegDuration(output);
    if (durationMs == null) return null;

    return {
        durationMs,
        estimated: FFMPEG_ESTIMATE_PATTERN.test(output),
    };
}

function readCachedDuration(url) {
    const cached = durationCache.get(url);
    if (!cached) return null;

    if (cached.expiresAt <= Date.now()) {
        durationCache.delete(url);
        return null;
    }

    return { durationMs: cached.durationMs, estimated: cached.estimated };
}

function writeCachedDuration(url, probe) {
    durationCache.delete(url);
    durationCache.set(url, { ...probe, expiresAt: Date.now() + DURATION_CACHE_TTL_MS });

    while (durationCache.size > DURATION_CACHE_LIMIT) {
        const oldest = durationCache.keys().next().value;
        if (oldest === undefined) break;
        durationCache.delete(oldest);
    }
}

function runProbeWithSlot(task) {
    return new Promise((resolve) => {
        const start = () => {
            activeProbes += 1;
            Promise.resolve()
                .then(task)
                .then(resolve, () => resolve(null))
                .finally(() => {
                    activeProbes -= 1;
                    const next = probeQueue.shift();
                    if (next) next();
                });
        };

        if (activeProbes < MAX_CONCURRENT_PROBES) start();
        else probeQueue.push(start);
    });
}

// Asks FFmpeg (the same libavformat that decodes the track) for the length of the real
// URL. FFmpeg uses the content length and bitrate for CBR files, the Xing/VBRI header for
// VBR files and the container metadata for everything else, without downloading the file.
function spawnDurationProbe(url, timeoutMs) {
    return new Promise((resolve) => {
        let child = null;
        let output = "";
        let settled = false;
        let timer;

        const finish = (probe) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            child?.kill("SIGKILL");
            resolve(probe);
        };

        try {
            child = spawn(
                ffmpegPath,
                [
                    "-hide_banner",
                    "-nostdin",
                    "-loglevel",
                    "info",
                    "-protocol_whitelist",
                    "http,https,tcp,tls",
                    "-user_agent",
                    FFMPEG_USER_AGENT,
                    "-i",
                    url,
                ],
                { stdio: ["ignore", "ignore", "pipe"] },
            );
        } catch {
            resolve(null);
            return;
        }

        timer = setTimeout(() => finish(null), timeoutMs);

        child.once("error", () => finish(null));
        child.stderr.on("data", (chunk) => {
            if (output.length < FFMPEG_OUTPUT_LIMIT) output += chunk.toString();
            if (FFMPEG_NO_DURATION_PATTERN.test(output)) return finish(null);

            const probe = parseFfmpegOutput(output);
            if (probe) finish(probe);
        });
        child.once("close", () => finish(parseFfmpegOutput(output)));
    });
}

async function probeMediaDuration(url, options = {}) {
    if (!ffmpegPath || typeof url !== "string" || url === "") return null;

    const cached = readCachedDuration(url);
    if (cached) return cached;

    const timeoutMs = options.timeoutMs ?? FFMPEG_PROBE_TIMEOUT_MS;
    const probe = await runProbeWithSlot(() => spawnDurationProbe(url, timeoutMs));
    if (probe?.durationMs) writeCachedDuration(url, probe);

    return probe;
}

if (!mediaplex) {
    console.log("[ELITE_PLAYBACK] mediaplex is unavailable; direct streams will not report media tags.");
}

if (!ffmpegPath) {
    console.log("[ELITE_PLAYBACK] ffmpeg-static is unavailable; direct streams will not report durations.");
}

module.exports = {
    parseFfmpegDuration,
    probeMediaDuration,
    probeMediaResponse,
};
