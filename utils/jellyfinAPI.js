const { normalizeBaseUrl, toArray } = require("./utilityFunctions");

function buildAuthHeaders(config) {
    const token = config.jellyfinApiKey || "";
    return {
        Authorization: `MediaBrowser Token="${token}"`,
    };
}

function apiUrl(config, path, params = {}) {
    const base = normalizeBaseUrl(config.jellyfinServer);
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${base}${normalizedPath}`);

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
        }
    }

    return url.toString();
}

function includeItemTypesForScope(scope) {
    if (scope === "track") return "Audio";
    if (scope === "album") return "MusicAlbum";
    if (scope === "playlist") return "Playlist";
    return "Audio,MusicAlbum,Playlist";
}

function ticksToMs(runTimeTicks) {
    const ticks = Number(runTimeTicks);
    if (!Number.isFinite(ticks) || ticks <= 0) return 0;
    return Math.floor(ticks / 10000);
}

async function jellyfinRequest(config, path, params = {}, init = {}) {
    const url = apiUrl(config, path, params);
    const response = await fetch(url, {
        method: "GET",
        headers: {
            ...buildAuthHeaders(config),
            Accept: "application/json",
        },
        ...init,
    });

    if (!response.ok) {
        const err = new Error(`Jellyfin request failed (${path}): ${response.status}`);
        err.status = response.status;
        throw err;
    }

    const text = await response.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

async function ping(config, init = {}) {
    const url = apiUrl(config, "/System/Ping");
    const response = await fetch(url, {
        method: "GET",
        headers: buildAuthHeaders(config),
        ...init,
    });

    if (!response.ok) {
        const err = new Error(`Jellyfin ping failed with status ${response.status}`);
        err.status = response.status;
        throw err;
    }

    return true;
}

async function resolveUserId(config, init = {}) {
    const username = String(config.jellyfinUser || "").trim();
    if (!username) {
        const err = new Error("JELLYFIN_USER is not configured");
        err.code = "MISSING_USER";
        throw err;
    }

    const users = toArray(await jellyfinRequest(config, "/Users", {}, init));
    const match = users.find((user) => String(user.Name || "").toLowerCase() === username.toLowerCase());

    if (!match || !match.Id) {
        const err = new Error(`Jellyfin user "${username}" was not found`);
        err.code = "USER_NOT_FOUND";
        throw err;
    }

    return match.Id;
}

function requireUserId(config) {
    const userId = config.jellyfinUserId;
    if (!userId) {
        const err = new Error("Jellyfin user ID is not configured");
        err.code = "MISSING_USER_ID";
        throw err;
    }

    return userId;
}

const JELLYFIN_ITEM_FIELDS = "ItemCounts,PrimaryImageAspectRatio,ParentId";

async function searchItems(config, query, options = {}, init = {}) {
    const scope = options.scope ?? "auto";
    const limit = options.limit ?? 10;
    const userId = requireUserId(config);

    const data = await jellyfinRequest(
        config,
        "/Items",
        {
            UserId: userId,
            SearchTerm: query,
            Recursive: "true",
            Limit: limit,
            IncludeItemTypes: includeItemTypesForScope(scope),
            Fields: JELLYFIN_ITEM_FIELDS,
        },
        init,
    );

    return toArray(data && data.Items);
}

async function getItem(config, itemId, init = {}) {
    const userId = requireUserId(config);

    return jellyfinRequest(
        config,
        `/Users/${userId}/Items/${itemId}`,
        {
            Fields: JELLYFIN_ITEM_FIELDS,
        },
        init,
    );
}

async function getAlbumTracks(config, albumId, init = {}) {
    const userId = requireUserId(config);

    const data = await jellyfinRequest(
        config,
        "/Items",
        {
            UserId: userId,
            ParentId: albumId,
            IncludeItemTypes: "Audio",
            Recursive: "true",
            SortBy: "ParentIndexNumber,IndexNumber",
            Fields: JELLYFIN_ITEM_FIELDS,
        },
        init,
    );

    return toArray(data && data.Items);
}

async function getPlaylistItems(config, playlistId, init = {}) {
    const userId = requireUserId(config);

    const data = await jellyfinRequest(
        config,
        `/Playlists/${playlistId}/Items`,
        {
            UserId: userId,
            Fields: JELLYFIN_ITEM_FIELDS,
        },
        init,
    );

    return toArray(data && data.Items).filter((item) => item.Type === "Audio");
}

function streamUrl(config, itemId) {
    const base = normalizeBaseUrl(config.jellyfinServer);
    const params = new URLSearchParams({
        static: "true",
        ApiKey: config.jellyfinApiKey || "",
    });

    return `${base}/Audio/${itemId}/stream.mp3?${params.toString()}`;
}

function imageUrl(config, itemId, maxHeight = 500) {
    if (itemId == null || itemId === "") return null;

    const base = normalizeBaseUrl(config.jellyfinServer);
    const params = new URLSearchParams({
        maxHeight: String(maxHeight),
        quality: "90",
        ApiKey: config.jellyfinApiKey || "",
    });

    return `${base}/Items/${itemId}/Images/Primary?${params.toString()}`;
}

module.exports = {
    buildAuthHeaders,
    ticksToMs,
    ping,
    resolveUserId,
    searchItems,
    getItem,
    getAlbumTracks,
    getPlaylistItems,
    streamUrl,
    imageUrl,
};
