const NOISE_PATTERN =
    /\b(?:official(?:\s+music)?\s+(?:video|audio)|lyrics?|lyric\s+video|visuali[sz]er|remaster(?:ed)?|release|explicit|clean|hq|hd|4k)\b/i;
const FEATURE_PATTERN = /\b(?:feat(?:uring)?|ft)\.?\s+/i;
const VERSION_WORDS = new Set([
    "remix",
    "mix",
    "edit",
    "live",
    "version",
    "instrumental",
    "acoustic",
    "extended",
    "radio",
    "bootleg",
    "rework",
    "remaster",
    "remastered",
    "mono",
    "stereo",
    "demo",
    "preview",
    "vip",
    "cut",
    "sped",
    "slowed",
    "reverb",
    "original",
]);

const PICKER_SCORE = 0.55;
const EXACT_TITLE_SCORE = 0.995;
const MAX_PROVIDER_QUERIES = 4;

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

function words(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[*`]/g, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9\u0400-\u04ff]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

function tokenSimilarity(left, right) {
    const leftTokens = new Set(words(left));
    const rightTokens = new Set(words(right));
    if (!leftTokens.size || !rightTokens.size) return 0;
    if (leftTokens.size === rightTokens.size && [...leftTokens].every((token) => rightTokens.has(token))) return 1;

    let intersection = 0;
    for (const token of leftTokens) {
        if (rightTokens.has(token)) intersection++;
    }
    return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

function characterBigrams(value) {
    const text = words(value).join(" ");
    const bigrams = new Set();
    for (let index = 0; index < text.length - 1; index++) {
        bigrams.add(text.slice(index, index + 2));
    }
    return bigrams;
}

function characterSimilarity(left, right) {
    const leftBigrams = characterBigrams(left);
    const rightBigrams = characterBigrams(right);
    if (!leftBigrams.size || !rightBigrams.size) return 0;

    let intersection = 0;
    for (const bigram of leftBigrams) {
        if (rightBigrams.has(bigram)) intersection++;
    }
    return (2 * intersection) / (leftBigrams.size + rightBigrams.size);
}

function isTokenSubset(left, right) {
    const leftTokens = new Set(words(left));
    const rightTokens = new Set(words(right));
    if (!leftTokens.size || leftTokens.size > rightTokens.size) return false;

    for (const token of leftTokens) {
        if (!rightTokens.has(token)) return false;
    }
    return true;
}

function extraTokensAreVersion(left, right) {
    const leftTokens = words(left);
    const rightTokens = words(right);
    const smaller = leftTokens.length <= rightTokens.length ? leftTokens : rightTokens;
    const larger = leftTokens.length <= rightTokens.length ? rightTokens : leftTokens;
    const largerSet = new Set(larger);
    const smallerSet = new Set(smaller);

    if (!smaller.every((token) => largerSet.has(token))) return false;

    const extra = larger.filter((token) => !smallerSet.has(token));
    return extra.length > 0 && extra.every((token) => VERSION_WORDS.has(token) || /^\d+$/.test(token));
}

function titleSimilarity(extracted, candidate) {
    let score = Math.max(tokenSimilarity(extracted, candidate), characterSimilarity(extracted, candidate) * 0.92);
    if (extraTokensAreVersion(extracted, candidate)) score = Math.max(score, 0.9);
    return Math.min(1, score);
}

function artistSimilarity(extracted, candidate) {
    let score = Math.max(tokenSimilarity(extracted, candidate), characterSimilarity(extracted, candidate) * 0.9);
    if (isTokenSubset(extracted, candidate) || isTokenSubset(candidate, extracted)) {
        const smaller = words(extracted).length <= words(candidate).length ? extracted : candidate;
        if (words(smaller).length >= 2) score = Math.max(score, 0.85);
    }
    return Math.min(1, score);
}

function durationSimilarity(extractedMs, candidateMs) {
    if (!extractedMs || !candidateMs) return null;

    const differenceSeconds = Math.abs(extractedMs - candidateMs) / 1000;
    if (differenceSeconds <= 2) return 1;
    if (differenceSeconds <= 5) return 0.9;
    if (differenceSeconds <= 10) return 0.7;
    if (differenceSeconds <= 20) return 0.4;
    if (differenceSeconds <= 40) return 0.15;
    return 0;
}

function cleanTitle(value) {
    let text = String(value || "");
    text = text.replace(
        /\((?:[^)]*(?:official|lyrics?|audio|video|visuali[sz]er|\bhd\b|\bhq\b|\b4k\b|explicit|clean|remaster)[^)]*)\)/gi,
        " ",
    );
    text = text.replace(
        /\[(?:[^\]]*(?:official|lyrics?|audio|video|visuali[sz]er|\bhd\b|\bhq\b|\b4k\b|explicit|clean|remaster|monstercat|ncs|release)[^\]]*)\]/gi,
        " ",
    );
    text = text.replace(/\((?:feat|ft)\.?\s+[^)]*\)/gi, " ");
    text = text.replace(/\[(?:feat|ft)\.?\s+[^\]]*\]/gi, " ");
    text = text.replace(/\s+(?:feat(?:uring)?|ft)\.?\s+.+$/i, "");
    text = text.replace(/\s+\|\s+.*$/, " ");
    text = text.replace(/^\s*\d{1,3}[.)]\s+/, " ");
    return text.replace(/\s+/g, " ").trim();
}

function stripBrackets(value) {
    return String(value || "")
        .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function splitArtistTitle(value) {
    const text = String(value || "");
    let depth = 0;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (character === "(" || character === "[") depth++;
        else if (character === ")" || character === "]") depth = Math.max(0, depth - 1);
        else if (depth === 0 && character === " ") {
            const rest = text.slice(index + 1);
            const separator = /^[-\u2013\u2014]\s+/.exec(rest);
            if (!separator) continue;

            const artist = text.slice(0, index).trim();
            const title = rest.slice(separator[0].length).trim();
            if (artist.length >= 2 && artist.length <= 60 && title.length > 0) return { artist, title };
            return null;
        }
    }

    return null;
}

function cleanArtistName(value) {
    return String(value || "")
        .replace(/\s*[-\u2013\u2014]\s*topic$/i, "")
        .replace(/\s*(?:vevo|official)$/i, "")
        .trim();
}

function parseExtractedTracks(track) {
    const rawTitle = String(track?.title || "");
    const parsed = splitArtistTitle(rawTitle);
    const durationMs = parseDurationMs(track?.rawDuration ?? track?.duration);
    const variants = [];

    if (parsed) {
        variants.push({ title: cleanTitle(parsed.title), artist: cleanArtistName(parsed.artist), durationMs });
        variants.push({ title: cleanTitle(parsed.artist), artist: cleanArtistName(parsed.title), durationMs });
    } else {
        variants.push({
            title: cleanTitle(rawTitle),
            artist: cleanArtistName(track?.author || track?.artist || ""),
            durationMs,
        });
    }

    return variants;
}

function parseExtractedTrack(track) {
    const [primary] = parseExtractedTracks(track);

    return {
        rawTitle: String(track?.title || ""),
        title: primary.title,
        artist: primary.artist,
        durationMs: parseDurationMs(track?.rawDuration ?? track?.duration),
    };
}

function buildProviderQueries(track) {
    const parsed = parseExtractedTrack(track);
    const split = splitArtistTitle(parsed.rawTitle);
    const queries = [];

    if (split) {
        const left = cleanTitle(split.artist);
        const right = cleanTitle(split.title);
        queries.push(`${left} ${right}`, right, left, stripBrackets(right), stripBrackets(left));
    } else {
        queries.push(parsed.title, stripBrackets(parsed.title));
    }

    const unique = [];
    const seen = new Set();

    for (const query of queries) {
        const trimmed = String(query || "").trim();
        const key = trimmed.toLowerCase();
        if (!trimmed || seen.has(key)) continue;
        seen.add(key);
        unique.push(trimmed);
        if (unique.length >= MAX_PROVIDER_QUERIES) break;
    }

    return unique;
}

function choosePlaybackTier({ score, title, artist, duration, titleWords }) {
    const exactTitle = title >= EXACT_TITLE_SCORE;

    if (exactTitle && artist >= 0.85) return "auto";
    if (score >= 0.74 && exactTitle && (artist >= 0.3 || titleWords >= 3)) return "auto";
    if (score >= 0.78 && !exactTitle && title >= 0.9 && artist >= 0.4 && duration !== null && duration >= 0.9) {
        return "auto";
    }

    return score >= PICKER_SCORE ? "picker" : "none";
}

function prepareCandidate(item) {
    return {
        item,
        title: cleanTitle(item?.title),
        artist: cleanArtistName(item?.grandparentTitle || item?.artist || item?.author),
        durationMs: parseDurationMs(item?.rawDuration ?? item?.duration),
    };
}

function scoreVariant(variant, candidate) {
    const title = titleSimilarity(variant.title, candidate.title);
    const artist = artistSimilarity(variant.artist, candidate.artist);
    const duration = durationSimilarity(variant.durationMs, candidate.durationMs);
    const score = duration === null ? 0.75 * title + 0.25 * artist : 0.55 * title + 0.3 * duration + 0.15 * artist;
    const tier = choosePlaybackTier({ score, title, artist, duration, titleWords: words(variant.title).length });

    return { score, tier, title, artist, duration };
}

function chooseOrientation(track, candidates) {
    const variants = parseExtractedTracks(track);
    if (variants.length === 1) return variants[0];

    let best = variants[0];
    let bestAffinity = -1;

    for (const variant of variants) {
        let affinity = 0;
        for (const candidate of candidates) {
            affinity = Math.max(affinity, artistSimilarity(variant.artist, candidate.artist));
        }
        if (affinity > bestAffinity) {
            bestAffinity = affinity;
            best = variant;
        }
    }

    return best;
}

function scoreCandidate(extractedTrack, providerItem) {
    const candidate = prepareCandidate(providerItem);
    return scoreVariant(chooseOrientation(extractedTrack, [candidate]), candidate);
}

function rankProviderItems(items, extractedTracks) {
    const tracks = (extractedTracks || []).filter(Boolean);
    const candidates = items.map(prepareCandidate);
    const preparedTracks = tracks.map((track) => ({ track, variant: chooseOrientation(track, candidates) }));
    const matches = [];

    for (const candidate of candidates) {
        let best = null;

        for (const prepared of preparedTracks) {
            const scored = scoreVariant(prepared.variant, candidate);
            if (!best || scored.score > best.score) best = { ...scored, extractedTrack: prepared.track };
        }

        if (best && best.tier !== "none") {
            matches.push({
                item: candidate.item,
                extractedTrack: best.extractedTrack,
                score: best.score,
                tier: best.tier,
            });
        }
    }

    return matches.sort((left, right) => right.score - left.score);
}

module.exports = {
    PICKER_SCORE,
    buildProviderQueries,
    cleanArtistName,
    cleanTitle,
    normalizeArtist,
    normalizeText,
    normalizeTitle,
    parseDurationMs,
    parseExtractedTrack,
    rankProviderItems,
    removeArtistPrefix,
    scoreCandidate,
    splitArtistTitle,
    stripBrackets,
};
