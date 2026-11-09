const { Readable } = require("node:stream");

const USER_AGENT = "Elite-Music (https://github.com/ThatGuyJacobee/Elite-Music)";
const HEADER_TIMEOUT_MS = 10000;

async function createDirectStream(track) {
    if (track?.raw?.eliteDirectStream !== true || !track.raw.engine || track.raw.isFile) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEADER_TIMEOUT_MS);
    let response;

    try {
        response = await fetch(track.raw.engine, {
            signal: controller.signal,
            headers: { "User-Agent": USER_AGENT },
        });
    } catch (error) {
        console.log(`[ELITE_PLAYBACK] Direct stream request failed: ${error.message}`);
        return null;
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok || !response.body) {
        await response.body?.cancel().catch(() => null);
        return null;
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType.startsWith("text/") || contentType.includes("json") || contentType.includes("xml")) {
        await response.body.cancel().catch(() => null);
        return null;
    }

    return Readable.fromWeb(response.body);
}

module.exports = {
    createDirectStream,
};
