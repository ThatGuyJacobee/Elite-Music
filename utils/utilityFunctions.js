const { AttachmentBuilder } = require("discord.js");
const crypto = require("crypto");
const fs = require("fs");
const { version: BOT_VERSION } = require("../package.json");

function normalizeReleaseTag(tag) {
    if (!tag || typeof tag !== "string") return "";
    return tag.replace(/^v/i, "");
}

function formatReleaseTag(version) {
    const normalized = normalizeReleaseTag(version);
    return normalized ? `v${normalized}` : "";
}

function parseSemver(version) {
    const normalized = normalizeReleaseTag(version);
    const match = normalized.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
    if (!match) return null;

    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3] ?? 0),
    };
}

function compareSemver(a, b) {
    const versionA = parseSemver(a);
    const versionB = parseSemver(b);
    if (!versionA || !versionB) return null;

    if (versionA.major !== versionB.major) return versionA.major - versionB.major;
    if (versionA.minor !== versionB.minor) return versionA.minor - versionB.minor;
    return versionA.patch - versionB.patch;
}

function isReleaseOutdated(currentVersion, latestTag) {
    const comparison = compareSemver(currentVersion, latestTag);
    if (comparison == null) {
        return formatReleaseTag(currentVersion) !== String(latestTag);
    }

    return comparison < 0;
}

function isReleaseUpToDate(currentVersion, latestTag) {
    const comparison = compareSemver(currentVersion, latestTag);
    if (comparison == null) {
        return formatReleaseTag(currentVersion) === String(latestTag);
    }

    return comparison === 0;
}

// Configuration secrets that should not be logged into console during startup
const CONFIG_SECRET_KEYS = ["plexAuthtoken", "subsonicPass", "jellyfinApiKey"];

function normalizeBaseUrl(server) {
    if (!server || typeof server !== "string") return "";
    return server.replace(/\/+$/, "");
}

function toArray(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}

function randomSalt(byteLength = 8) {
    return crypto.randomBytes(byteLength).toString("hex");
}

function md5Utf8Hex(value) {
    return crypto.createHash("md5").update(value, "utf8").digest("hex");
}

function formatDurationMs(durationMilliseconds) {
    const durationAsNumber = Number(durationMilliseconds);
    if (!Number.isFinite(durationAsNumber) || durationAsNumber < 0) {
        return "--:--";
    }

    const totalSeconds = Math.floor(durationAsNumber / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
}

function redactConfigSecrets(config, options = {}) {
    const { revealSecrets = false } = options;
    const out = { ...config };
    if (revealSecrets) return out;
    for (const key of CONFIG_SECRET_KEYS) {
        const v = out[key];
        if (v != null && String(v).length > 0) {
            out[key] = "********";
        }
    }
    return out;
}

const { translate } = require("./botText");

async function getImageSize(url) {
    let request = await fetch(url);
    if (request.ok) {
        return request.headers.get("content-length") || 0;
    }
}

async function buildImageAttachment(url, metadata = {}) {
    const { source, ...attachmentMeta } = metadata;
    const placeholderDescription = source ? translate(source, "common.coverImageNotFound") : "Cover Image Not Found";

    try {
        // Get the file size of the thumbnail
        let imgSize = await getImageSize(url);

        // If the item's thumbnail is >10mb, instead display a placeholder image
        let coverImage;
        if (imgSize < 10000000) {
            coverImage = new AttachmentBuilder(url, attachmentMeta);
        } else {
            let defaultImg = fs.readFileSync("./assets/default-thumbnail.png");
            coverImage = new AttachmentBuilder(defaultImg, {
                name: attachmentMeta.name ?? "coverimage.jpg",
                description: placeholderDescription,
            });
        }

        return coverImage;
    } catch (error) {
        console.log("Error building image attachment from source. Defaulting to placeholder image...");
        let defaultImg = fs.readFileSync("./assets/default-thumbnail.png");
        return new AttachmentBuilder(defaultImg, {
            name: attachmentMeta.name ?? "coverimage.jpg",
            description: placeholderDescription,
        });
    }
}

async function checkLatestRelease() {
    let checkGitHub = await fetch("https://api.github.com/repos/ThatGuyJacobee/Elite-Music/releases/latest", {
        method: "GET",
        headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    });

    if (checkGitHub.ok) {
        let response = await checkGitHub.json();
        return response;
    } else {
        return false;
    }
}

module.exports = {
    BOT_VERSION,
    CONFIG_SECRET_KEYS,
    normalizeBaseUrl,
    toArray,
    randomSalt,
    md5Utf8Hex,
    formatDurationMs,
    formatReleaseTag,
    isReleaseOutdated,
    isReleaseUpToDate,
    redactConfigSecrets,
    getImageSize,
    buildImageAttachment,
    checkLatestRelease,
};
