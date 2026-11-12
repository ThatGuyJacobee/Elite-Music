const { spawn } = require("node:child_process");
const { StringDecoder } = require("node:string_decoder");

let ffmpegPath = null;
try {
    ffmpegPath = require("ffmpeg-static");
} catch {
    ffmpegPath = null;
}

const FFMPEG_PROBE_TIMEOUT_MS = 5000;
const FFMPEG_OUTPUT_LIMIT = 64 * 1024;
const DURATION_CACHE_TTL_MS = 60 * 60 * 1000;
const DURATION_CACHE_LIMIT = 200;
const MAX_CONCURRENT_PROBES = 2;
const FFMPEG_USER_AGENT = "Elite-Music (https://github.com/ThatGuyJacobee/Elite-Music)";
const FFMPEG_DURATION_PATTERN = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/;
const FFMPEG_NO_DURATION_PATTERN = /Duration:\s*N\/A/;
const FFMPEG_ESTIMATE_PATTERN = /Estimating duration from bitrate/;
const FFMPEG_ICY_PATTERN = /^[ \t]*icy-[a-z0-9]+[ \t]*:/im;
const FFMPEG_STREAM_PATTERN = /Input #0,\s*(?:hls|dash)\b/i;
const FFMPEG_METADATA_KEYS = new Set(["title", "artist", "album", "icy-name"]);
const FFMPEG_METADATA_LINE = /^[ \t]+([a-z0-9-]+)[ \t]*:[ \t]*(.+)$/i;

const durationCache = new Map();
const probeQueue = [];
let activeProbes = 0;

function parseFfmpegDuration(output) {
    const match = FFMPEG_DURATION_PATTERN.exec(String(output || ""));
    if (!match) return null;

    const [, hours, minutes, seconds] = match;
    const durationMs = Math.round((Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000);

    return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : null;
}

function parseFfmpegOutput(output) {
    const durationMs = parseFfmpegDuration(output);
    const metadata = parseFfmpegMetadata(output);

    if (durationMs == null) {
        return isLiveStreamOutput(output) ? { durationMs: null, estimated: false, live: true, metadata } : null;
    }

    return {
        durationMs,
        estimated: FFMPEG_ESTIMATE_PATTERN.test(output),
        live: false,
        metadata,
    };
}

function parseFfmpegMetadata(output) {
    const metadata = {};

    for (const line of String(output || "").split(/\r?\n/)) {
        const match = FFMPEG_METADATA_LINE.exec(line);
        if (!match) continue;

        const key = match[1].toLowerCase();
        const value = match[2].trim();
        if (value && FFMPEG_METADATA_KEYS.has(key) && !metadata[key]) metadata[key] = value;
    }

    return metadata;
}

// Icecast/Shoutcast streams carry ICY metadata, and HLS/DASH live manifests report no
// duration. A plain file with no length and no headers stays unknown rather than live.
function isLiveStreamOutput(output) {
    return FFMPEG_ICY_PATTERN.test(output) || FFMPEG_STREAM_PATTERN.test(output);
}

function readCachedDuration(url) {
    const cached = durationCache.get(url);
    if (!cached) return null;

    if (cached.expiresAt <= Date.now()) {
        durationCache.delete(url);
        return null;
    }

    return {
        durationMs: cached.durationMs ?? null,
        estimated: Boolean(cached.estimated),
        live: Boolean(cached.live),
        metadata: cached.metadata ?? {},
    };
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
        const decoder = new StringDecoder("utf8");
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
            const text = decoder.write(chunk);
            if (output.length < FFMPEG_OUTPUT_LIMIT) output += text;
            if (FFMPEG_NO_DURATION_PATTERN.test(output)) return finish(parseFfmpegOutput(output));

            const probe = parseFfmpegOutput(output);
            if (probe) finish(probe);
        });
        child.once("close", () => finish(parseFfmpegOutput(output + decoder.end())));
    });
}

async function probeMediaDuration(url, options = {}) {
    if (!ffmpegPath || typeof url !== "string" || url === "") return null;

    const cached = readCachedDuration(url);
    if (cached) return cached;

    const timeoutMs = options.timeoutMs ?? FFMPEG_PROBE_TIMEOUT_MS;
    const probe = await runProbeWithSlot(() => spawnDurationProbe(url, timeoutMs));
    if (probe) writeCachedDuration(url, probe);

    return probe;
}

if (!ffmpegPath) {
    console.log("[ELITE_PLAYBACK] ffmpeg-static is unavailable; direct streams will not report durations.");
}

module.exports = {
    probeMediaDuration,
};
