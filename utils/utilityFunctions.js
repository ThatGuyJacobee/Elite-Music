const { AttachmentBuilder } = require("discord.js");
const crypto = require("crypto");
const fs = require("fs");

// Configuration secrets that should not be logged into console during startup
const CONFIG_SECRET_KEYS = ["plexAuthtoken", "subsonicPass"];

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

async function getImageSize(url) {
    let request = await fetch(url);
    if (request.ok) {
        return request.headers.get("content-length") || 0;
    }
}

async function buildImageAttachment(url, metadata) {
    try {
        // Get the file size of the thumbnail
        let imgSize = await getImageSize(url);

        // If the item's thumbnail is >10mb, instead display a placeholder image
        let coverImage;
        if (imgSize < 10000000) {
            coverImage = new AttachmentBuilder(url, metadata);
        } else {
            let defaultImg = fs.readFileSync("./assets/default-thumbnail.png");
            coverImage = new AttachmentBuilder(defaultImg, {
                name: "coverimage.jpg",
                description: `Cover Image Not Found`,
            });
        }

        return coverImage;
    } catch (error) {
        console.log("Error building image attachment from source. Defaulting to placeholder image...");
        let defaultImg = fs.readFileSync("./assets/default-thumbnail.png");
        return new AttachmentBuilder(defaultImg, { name: "coverimage.jpg", description: `Cover Image Not Found` });
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
    CONFIG_SECRET_KEYS,
    normalizeBaseUrl,
    toArray,
    randomSalt,
    md5Utf8Hex,
    redactConfigSecrets,
    getImageSize,
    buildImageAttachment,
    checkLatestRelease,
};
