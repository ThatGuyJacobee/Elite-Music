const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require("discord.js");
const { QueryType, useMainPlayer } = require("discord-player");
const musicFuncs = require("./sharedFunctions");
const plexFuncs = require("./plexFunctions");
const subsonicFuncs = require("./subsonicFunctions");
const jellyfinFuncs = require("./jellyfinFunctions");
const { buildPlaybackSourceField, buildRequestedByFooter, translate } = require("./botText");
const { formatDurationMs } = require("./utilityFunctions");

const SOURCE_SEARCH_TIMEOUT_MS = 3000;
const MINIMUM_MATCH_SCORE = 0.75;
const PICKER_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

const playbackProviders = {
    plex: {
        enabled: (config) => config.enablePlex,
        search: async (query) => (await plexFuncs.plexSearchQuery(query, { scope: "track" }))?.songs || [],
        add: plexFuncs.plexAddTrack,
        identifier: (item) => item.key,
        itemFromIdentifier: (key) => ({ key }),
    },
    subsonic: {
        enabled: (config) => config.enableSubsonic,
        search: async (query) => (await subsonicFuncs.subsonicSearchQuery(query, { scope: "track" }))?.songs || [],
        add: subsonicFuncs.subsonicAddTrack,
        identifier: (item) => item.id,
        itemFromIdentifier: (id) => ({ id }),
    },
    jellyfin: {
        enabled: (config) => config.enableJellyfin,
        search: async (query) => (await jellyfinFuncs.jellyfinSearchQuery(query, { scope: "track" }))?.songs || [],
        add: jellyfinFuncs.jellyfinAddTrack,
        identifier: (item) => item.id,
        itemFromIdentifier: (id) => ({ id }),
    },
};

const VALID_SOURCES = [...Object.keys(playbackProviders), "default"];
const NOISE_PATTERN =
    /\b(?:official(?:\s+music)?\s+(?:video|audio)|lyrics?|lyric\s+video|visuali[sz]er|remaster(?:ed)?|release|explicit|clean|hq|hd|4k)\b/i;
const FEATURE_PATTERN = /\b(?:feat(?:uring)?|ft)\.?\s+/i;

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

function parseSourceOrder(value, { fallback = ["default"], onInvalid } = {}) {
    const entries = Array.isArray(value) ? value : String(value || "").split(",");
    const sourceOrder = [];

    for (const entry of entries) {
        const source = String(entry).trim().toLowerCase();
        if (!source) continue;
        if (!VALID_SOURCES.includes(source)) {
            onInvalid?.(source);
        } else if (!sourceOrder.includes(source)) {
            sourceOrder.push(source);
        }
    }

    return sourceOrder.length > 0 ? sourceOrder : [...fallback];
}

function providerQuery(originalQuery, extractedTracks) {
    const query = String(originalQuery || "").trim();
    const isUrl = /^[a-z][a-z0-9+.-]*:/i.test(query);
    if (query && !isUrl) return query;
    return createTrackIdentity(extractedTracks[0]).searchQuery || query;
}

function matchProviderItems(source, items, extractedTracks) {
    const provider = playbackProviders[source];
    const matches = [];
    const seen = new Set();

    for (const item of items) {
        let bestTrack = null;
        let bestScore = 0;

        for (const extractedTrack of extractedTracks) {
            const score = calculateMatchScore(extractedTrack, item);
            if (score > bestScore) {
                bestScore = score;
                bestTrack = extractedTrack;
            }
        }

        const identifier = provider.identifier(item);
        if (bestScore >= MINIMUM_MATCH_SCORE && identifier && !seen.has(identifier)) {
            seen.add(identifier);
            matches.push({ source, item, extractedTrack: bestTrack, score: bestScore });
        }
    }

    return matches.sort((left, right) => right.score - left.score);
}

async function searchProvider(source, query) {
    let timer;
    try {
        return await Promise.race([
            playbackProviders[source].search(query),
            new Promise((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error(`${source} playback search timed out`)),
                    SOURCE_SEARCH_TIMEOUT_MS,
                );
            }),
        ]);
    } catch (error) {
        console.log(`[ELITE_PLAYBACK] ${source} source search failed; continuing to the next source. ${error.message}`);
        return [];
    } finally {
        clearTimeout(timer);
    }
}

async function resolvePlaybackSource(search, originalQuery, config) {
    const extractedTracks = search?.tracks || [];
    if (extractedTracks.length === 0) return null;

    for (const source of parseSourceOrder(config.playbackSourceOrder)) {
        if (source === "default") {
            return {
                source,
                results: extractedTracks.map((item) => ({ source, item, extractedTrack: item })),
            };
        }

        const provider = playbackProviders[source];
        if (!provider?.enabled(config)) continue;

        const items = await searchProvider(source, providerQuery(originalQuery, extractedTracks));
        const results = matchProviderItems(source, items, extractedTracks);
        if (results.length > 0) return { source, results };
    }

    return null;
}

async function addResolvedTrack(interaction, nextSong, result, responseType) {
    interaction.playbackSource = result.source;

    try {
        if (result.source === "default") {
            return await musicFuncs.addTracks(
                interaction,
                nextSong,
                { tracks: [result.item], playlist: null },
                responseType,
            );
        }
        return await playbackProviders[result.source].add(interaction, nextSong, result.item, responseType);
    } finally {
        delete interaction.playbackSource;
    }
}

function selectionIdentifier(result) {
    return result.source === "default" ? result.item.url : playbackProviders[result.source].identifier(result.item);
}

function resultDuration(result) {
    if (result.source === "default") return result.item.duration || "--:--";
    return formatDurationMs(parseDurationMs(result.item.rawDuration ?? result.item.duration));
}

function resultDescription(result) {
    if (result.source === "default") return result.item.description || result.item.author || result.item.title;

    const artist = result.item.grandparentTitle || result.item.artist || result.item.author;
    const album = result.item.parentTitle || result.item.album;
    return [artist, album].filter(Boolean).join(" • ") || result.item.title;
}

function truncate(value, maximum) {
    const text = String(value || "");
    return text.length > maximum ? `${text.slice(0, maximum - 3)}...` : text;
}

function buildPlaybackPicker(interaction, resolution, nextSong) {
    const sourceName = translate(interaction, `playback.sources.${resolution.source}`);
    const menu = new StringSelectMenuBuilder()
        .setCustomId(`playsearch:${resolution.source}:${nextSong ? 1 : 0}`)
        .setMinValues(1)
        .setMaxValues(1)
        .setPlaceholder(translate(interaction, "search.placeholder"));
    const fields = [];

    resolution.results.slice(0, 10).forEach((result, index) => {
        const duration = resultDuration(result);
        fields.push({
            name: translate(interaction, "search.songResult", { index: index + 1, duration }),
            value: truncate(resultDescription(result), 1024),
        });
        menu.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(truncate(result.item.title, 100))
                .setValue(selectionIdentifier(result))
                .setDescription(truncate(`${sourceName} • ${duration}`, 100))
                .setEmoji(PICKER_EMOJIS[index]),
        );
    });

    const titleKey = resolution.source === "default" ? "search.resultsTitle" : `search.${resolution.source}Title`;
    const embed = new EmbedBuilder()
        .setAuthor({
            name: interaction.client.user.tag,
            iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setTitle(translate(interaction, titleKey))
        .setDescription(translate(interaction, "search.multipleResults"))
        .addFields(buildPlaybackSourceField(interaction, resolution.source), ...fields)
        .setColor(interaction.client.config.embedColour)
        .setTimestamp()
        .setFooter(buildRequestedByFooter(interaction, interaction.user));

    const cancel = new ButtonBuilder()
        .setCustomId("np-delete")
        .setStyle(ButtonStyle.Danger)
        .setLabel(translate(interaction, "search.cancel"));

    return {
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(cancel)],
    };
}

async function addPlaybackSelection(interaction, customId, identifier, responseType) {
    const selection = /^playsearch:(plex|subsonic|jellyfin|default):([01])$/.exec(customId);
    if (!selection) return null;

    const [, source, nextSongFlag] = selection;
    let item;

    if (source === "default") {
        const search = await useMainPlayer().search(identifier, {
            requestedBy: interaction.user,
            searchEngine: QueryType.AUTO,
        });
        item = search?.tracks?.find((track) => track.url === identifier) || search?.tracks?.[0];
    } else {
        item = playbackProviders[source].itemFromIdentifier(identifier);
    }

    if (!item) return null;
    const result = { source, item, extractedTrack: item };
    await addResolvedTrack(interaction, nextSongFlag === "1", result, responseType);
    return result;
}

module.exports = {
    addPlaybackSelection,
    addResolvedTrack,
    buildPlaybackPicker,
    parseSourceOrder,
    resolvePlaybackSource,
};
