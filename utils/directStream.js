const { Readable } = require("node:stream");
const { isPublicHttpUrl } = require("./urlPlayback");

const USER_AGENT = "Elite-Music (https://github.com/ThatGuyJacobee/Elite-Music)";
const HEADER_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

async function fetchDirectResponse(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEADER_TIMEOUT_MS);
    let target = url;

    try {
        for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
            if (!(await isPublicHttpUrl(target))) throw new Error("URL is not publicly reachable");

            const response = await fetch(target, {
                signal: controller.signal,
                redirect: "manual",
                headers: { "User-Agent": USER_AGENT },
            });

            if (!REDIRECT_STATUS_CODES.has(response.status)) return response;

            const location = response.headers.get("location");
            await response.body?.cancel().catch(() => null);
            if (!location) throw new Error("Redirect response without a location");

            target = new URL(location, target).href;
        }

        throw new Error("Too many redirects");
    } finally {
        clearTimeout(timer);
    }
}

async function createDirectStream(track) {
    if (track?.raw?.eliteDirectStream !== true || !track.raw.engine || track.raw.isFile) return null;

    let response;
    try {
        response = await fetchDirectResponse(track.raw.engine);
    } catch (error) {
        console.log(`[ELITE_PLAYBACK] Direct stream request failed: ${error.message}`);
        return null;
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
