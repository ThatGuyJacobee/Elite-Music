const { FALLBACK_LOCALE } = require("./i18n");

function getDisplayName(user) {
    if (!user) return "Unknown User";
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
    return translate(source, "footer.requestedBy", { user: getDisplayName(user) });
}

function buildRequestedByFooter(source, user) {
    return {
        text: getRequestedByText(source, user),
    };
}

function buildRequestedByPageFooter(source, user, page) {
    return {
        text: translate(source, "footer.requestedByPage", { user: getDisplayName(user), page }),
    };
}

function buildTrackLinkText(track, label = "Link") {
    if (!track || track.queryType == "arbitrary" || !track.url) {
        return "";
    }

    return `([${label}](${track.url}))`;
}

module.exports = {
    buildTrackLinkText,
    buildRequestedByFooter,
    buildRequestedByPageFooter,
    getDisplayName,
    getLocaleFromSource,
    getRequestedByText,
    translate,
};
