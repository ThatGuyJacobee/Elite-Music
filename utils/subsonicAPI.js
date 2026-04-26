const { normalizeBaseUrl, toArray, randomSalt, md5Utf8Hex } = require("./utilityFunctions");
const DEFAULT_API_VERSION = "1.16.0";

function buildQueryParams(config, extra = {}) {
    const salt = randomSalt(6);
    const token = md5Utf8Hex(config.subsonicPass + salt);
    const params = new URLSearchParams({
        u: config.subsonicUser,
        t: token,
        s: salt,
        v: config.subsonicApiVersion || DEFAULT_API_VERSION,
        c: config.subsonicAppName || "Elite-Music-Bot",
        f: "json",
    });

    for (const [k, v] of Object.entries(extra)) {
        if (v !== undefined && v !== null) params.set(k, String(v));
    }

    return params;
}

function restUrl(config, method, extra = {}) {
    const base = normalizeBaseUrl(config.subsonicServer);
    const params = buildQueryParams(config, extra);

    return `${base}/rest/${method}?${params.toString()}`;
}

function parseSubsonicJson(data) {
    const root = data && data["subsonic-response"];

    if (!root) {
        const err = new Error("Invalid Subsonic response: missing subsonic-response");
        err.code = "INVALID_JSON";
        throw err;
    }

    if (root.status !== "ok") {
        const err = new Error(root.error && root.error.message ? root.error.message : "Subsonic request failed");
        err.code = root.error && root.error.code != null ? String(root.error.code) : "SUBSONIC_FAILED";
        err.subsonic = root.error;
        throw err;
    }

    return root;
}

async function subsonicRequest(config, method, extraParams = {}, init = {}) {
    const url = restUrl(config, method, extraParams);
    const res = await fetch(url, { method: "GET", ...init });
    const text = await res.text();
    let data;

    try {
        data = JSON.parse(text);
    } catch {
        const err = new Error("Subsonic response was not JSON");
        err.code = "NOT_JSON";
        throw err;
    }

    return parseSubsonicJson(data);
}

async function ping(config, init = {}) {
    return subsonicRequest(config, "ping", {}, init);
}

async function search2(config, query, options = {}) {
    const { songCount = 10, artistCount = 0, albumCount = 0, songOffset = 0 } = options;
    const root = await subsonicRequest(config, "search2", {
        query,
        songCount,
        songOffset,
        artistCount,
        albumCount,
    });
    const block = root.searchResult2 || {};

    return {
        songs: toArray(block.song),
        albums: toArray(block.album),
        artists: toArray(block.artist),
    };
}

async function getPlaylists(config) {
    const root = await subsonicRequest(config, "getPlaylists");
    const block = root.playlists || {};

    return toArray(block.playlist);
}

async function getPlaylist(config, id) {
    const root = await subsonicRequest(config, "getPlaylist", { id });
    const pl = root.playlist || {};
    const entries = toArray(pl.entry);

    return { playlist: pl, entries };
}

async function getSong(config, id) {
    const root = await subsonicRequest(config, "getSong", { id });
    const s = root.song;

    return Array.isArray(s) ? s[0] : s;
}

async function getAlbum(config, id) {
    const root = await subsonicRequest(config, "getAlbum", { id });
    const album = root.album || {};
    const songs = toArray(album.song);

    return { album, songs };
}

function streamUrl(config, songId) {
    return restUrl(config, "stream", { id: songId, format: "raw" });
}

function coverArtUrl(config, coverArtId, size) {
    if (coverArtId == null || coverArtId === "") return null;

    const extra = { id: coverArtId };
    if (size != null) extra.size = size;

    return restUrl(config, "getCoverArt", extra);
}

module.exports = {
    subsonicRequest,
    ping,
    search2,
    getPlaylists,
    getPlaylist,
    getSong,
    getAlbum,
    streamUrl,
    coverArtUrl,
    DEFAULT_API_VERSION,
};
