const NOISE_PATTERN =
    /\b(?:official(?:\s+music)?\s+(?:video|audio)|lyrics?|lyric\s+video|visuali[sz]er|remaster(?:ed)?|release|explicit|clean|hq|hd|4k)\b/i;
const FEATURE_PATTERN = /\b(?:feat(?:uring)?|ft)\.?\s+/i;

const MINIMUM_MATCH_SCORE = 0.75;

function normalizeText(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " and ")
        .replace(/\(([^)]+)\)|\[([^\]]+)\]/g, (match, parentheses, brackets) => {
            const contents = parentheses || brackets;
            return NOISE_PATTERN.test(contents) || FEATURE_PATTERN.test(contents) ? " " : match;
        })
        .replace(/\s+(?:feat(?:uring)?|ft)\.?\s+.+$/i, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

function normalizeArtist(value) {
    const normalized = normalizeText(value)
        .replace(/(?:\s+)?vevo$/, "")
        .replace(/(?:\s+-?\s*)?topic$/, "")
        .replace(/(?:\s+)?official$/, "")
        .trim();
    return ["unknown artist", "various artists"].includes(normalized) ? "" : normalized;
}

function normalizeTitle(title, artist) {
    const normalizedTitle = normalizeText(title);
    const normalizedArtist = normalizeArtist(artist);

    return removeArtistPrefix(normalizedTitle, normalizedArtist);
}

function removeArtistPrefix(title, artist) {
    const artistPrefix = `${artist} `;
    return artist && title.startsWith(artistPrefix) ? title.slice(artistPrefix.length).trim() : title;
}

function parseDurationMs(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string" || value.trim() === "") return null;
    if (!value.includes(":")) {
        const milliseconds = Number(value);
        return Number.isFinite(milliseconds) ? milliseconds : null;
    }

    const parts = value.split(":").map(Number);
    if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part))) return null;
    return parts.reduce((total, part) => total * 60 + part, 0) * 1000;
}

function createTrackIdentity(track) {
    const originalArtist = track?.grandparentTitle || track?.artist || track?.author;
    const artist = normalizeArtist(originalArtist);
    const title = normalizeTitle(track?.title, originalArtist);

    return {
        title,
        artist,
        durationMs: parseDurationMs(track?.rawDuration ?? track?.duration),
        searchQuery: [artist, title].filter(Boolean).join(" ").trim(),
    };
}

function tokenSimilarity(left, right) {
    if (!left || !right) return 0;
    if (left === right) return 1;

    const leftTokens = new Set(left.split(" "));
    const rightTokens = new Set(right.split(" "));
    let intersection = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) intersection++;
    }
    return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

function calculateMatchScore(extractedTrack, providerItem) {
    const expected = createTrackIdentity(extractedTrack);
    const candidate = createTrackIdentity(providerItem);
    candidate.title = removeArtistPrefix(candidate.title, expected.artist);
    const titleScore = tokenSimilarity(expected.title, candidate.title);
    const artistScore = tokenSimilarity(expected.artist, candidate.artist);
    const hasArtist = Boolean(expected.artist && candidate.artist);

    if (titleScore < 0.65 || (hasArtist && artistScore < 0.5)) return 0;

    let score = hasArtist ? titleScore * 0.7 + artistScore * 0.3 : titleScore;
    if (expected.durationMs && candidate.durationMs) {
        const differenceSeconds = Math.abs(expected.durationMs - candidate.durationMs) / 1000;
        const durationScore =
            differenceSeconds <= 3 ? 1 : differenceSeconds <= 8 ? 0.8 : differenceSeconds <= 15 ? 0.4 : 0;
        score = score * 0.9 + durationScore * 0.1;
    }
    return score;
}

module.exports = {
    MINIMUM_MATCH_SCORE,
    calculateMatchScore,
    createTrackIdentity,
    normalizeArtist,
    normalizeText,
    normalizeTitle,
    parseDurationMs,
    removeArtistPrefix,
    tokenSimilarity,
};
