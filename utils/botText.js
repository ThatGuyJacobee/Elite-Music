const { FALLBACK_LOCALE } = require("./i18n");

const COVER_IMAGE_KEYS = {
    song: "common.songCoverImage",
    playlist: "common.playlistCoverImage",
    album: "common.albumCoverImage",
};

const SEARCH_MEDIA_TYPE_KEYS = {
    track: "search.track",
    song: "search.track",
    playlist: "search.playlist",
    album: "search.album",
};

function getDisplayName(user, source = null) {
    if (!user) return source ? translate(source, "common.unknownUser") : "Unknown User";
    return user.discriminator != 0 ? user.tag : user.username;
}

function getClientFromSource(source) {
    return source?.client ?? source?.guild?.client ?? source?.metadata?.channel?.client ?? global.client;
}

function getLocaleFromSource(source) {
    const clientInstance = getClientFromSource(source);
    return clientInstance?.config?.defaultLocale ?? FALLBACK_LOCALE;
}

function translate(source, key, variables = {}) {
    const clientInstance = getClientFromSource(source);
    const locale = variables.locale ?? getLocaleFromSource(source);

    if (clientInstance?.t) {
        return clientInstance.t(key, variables, locale);
    }

    return key;
}

function getRequestedByText(source, user) {
    return translate(source, "footer.requestedBy", { user: getDisplayName(user, source) });
}

function buildRequestedByFooter(source, user) {
    return {
        text: getRequestedByText(source, user),
    };
}

function buildRequestedByPageFooter(source, user, page) {
    return {
        text: translate(source, "footer.requestedByPage", { user: getDisplayName(user, source), page }),
    };
}

function buildTrackLinkText(track, source = null) {
    if (!track || track.queryType == "arbitrary" || !track.url) {
        return "";
    }

    const label = source ? translate(source, "common.link") : "Link";
    return `([${label}](${track.url}))`;
}

function buildUrlLinkText(source, url) {
    if (!url) {
        return "";
    }

    return `([${translate(source, "common.link")}](${url}))`;
}

function buildCoverImageDescription(source, mediaType, title) {
    const key = COVER_IMAGE_KEYS[mediaType] ?? COVER_IMAGE_KEYS.song;
    return translate(source, key, { title });
}

function translateGenericAction(source, actionKey) {
    return translate(source, "errors.genericAction", {
        action: translate(source, `errors.actions.${actionKey}`),
    });
}

function translateHelpCategory(source, categoryKey) {
    const normalized = categoryKey?.toLowerCase();
    const key = `help.categories.${normalized}`;
    const localized = translate(source, key);

    if (localized === key) {
        return categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1).toLowerCase();
    }

    return localized;
}

function translateSearchMediaType(source, mediaType) {
    const key = SEARCH_MEDIA_TYPE_KEYS[mediaType?.toLowerCase()];

    if (key) {
        return translate(source, key);
    }

    return mediaType ? mediaType.charAt(0).toUpperCase() + mediaType.slice(1) : mediaType;
}

function translateAudioFilter(source, filterId) {
    const key = `audiofilter.filters.${filterId}`;
    const localized = translate(source, key);

    if (localized === key) {
        return filterId;
    }

    return localized;
}

module.exports = {
    buildCoverImageDescription,
    buildRequestedByFooter,
    buildRequestedByPageFooter,
    buildTrackLinkText,
    buildUrlLinkText,
    getDisplayName,
    getLocaleFromSource,
    getRequestedByText,
    translate,
    translateAudioFilter,
    translateGenericAction,
    translateHelpCategory,
    translateSearchMediaType,
};
