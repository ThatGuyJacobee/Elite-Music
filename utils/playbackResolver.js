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
const { buildProviderQueries, parseDurationMs, rankProviderItems } = require("./playbackMatching");

const SOURCE_SEARCH_TIMEOUT_MS = 3000;
const MAX_PICKER_RESULTS = 10;
const MAX_AGGREGATED_RESULTS = 25;
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

const VALID_SOURCES = [...Object.keys(playbackProviders), "youtube"];
const LEGACY_SOURCE_ALIASES = { default: "youtube" };

function parseSourceOrder(value, { fallback = ["youtube"], onInvalid, onAlias } = {}) {
    const entries = Array.isArray(value) ? value : String(value || "").split(",");
    const sourceOrder = [];

    for (const entry of entries) {
        const requested = String(entry).trim().toLowerCase();
        if (!requested) continue;

        const source = LEGACY_SOURCE_ALIASES[requested] ?? requested;
        if (source !== requested) onAlias?.(requested, source);

        if (!VALID_SOURCES.includes(source)) {
            onInvalid?.(requested);
        } else if (!sourceOrder.includes(source)) {
            sourceOrder.push(source);
        }
    }

    return sourceOrder.length > 0 ? sourceOrder : [...fallback];
}

function getAvailablePlaybackSources(config) {
    return parseSourceOrder(config.playbackSourceOrder).filter(
        (source) => !playbackProviders[source] || playbackProviders[source].enabled(config),
    );
}

function getPlaybackSourceAvailability(config, source) {
    if (!VALID_SOURCES.includes(source)) return "invalid";

    if (playbackProviders[source] && !playbackProviders[source].enabled(config)) return "disabled";
    if (!parseSourceOrder(config.playbackSourceOrder).includes(source)) return "not-in-order";

    return "available";
}

async function searchProvider(source, queries) {
    const provider = playbackProviders[source];
    const results = await Promise.all(
        queries.map(async (query) => {
            let timer;
            try {
                return await Promise.race([
                    provider.search(query),
                    new Promise((_, reject) => {
                        timer = setTimeout(
                            () => reject(new Error(`${source} playback search timed out`)),
                            SOURCE_SEARCH_TIMEOUT_MS,
                        );
                    }),
                ]);
            } catch (error) {
                console.log(
                    `[ELITE_PLAYBACK] ${source} source search failed; continuing to the next source. ${error.message}`,
                );
                return [];
            } finally {
                clearTimeout(timer);
            }
        }),
    );

    const merged = new Map();
    for (const items of results) {
        for (const item of items) {
            const identifier = provider.identifier(item);
            if (identifier && !merged.has(identifier)) merged.set(identifier, item);
        }
    }
    return [...merged.values()];
}

function isArbitraryTrack(track) {
    const queryType = track?.queryType ?? track?.raw?.queryType;
    return queryType === QueryType.ARBITRARY || queryType === QueryType.FILE;
}

function directSourceResults(extractedTracks) {
    return extractedTracks
        .filter(isArbitraryTrack)
        .map((item) => ({ source: "direct", item, extractedTrack: item, score: 1, tier: "auto" }));
}

function youtubeSourceResults(extractedTracks) {
    const tracks = extractedTracks.filter((item) => !isArbitraryTrack(item));
    const tier = tracks.length === 1 ? "auto" : "picker";

    return tracks.map((item) => ({ source: "youtube", item, extractedTrack: item, score: 1, tier }));
}

async function resolveSourceResults(source, extractedTracks, config) {
    if (source === "youtube") {
        return youtubeSourceResults(extractedTracks);
    }

    const provider = playbackProviders[source];
    if (!provider?.enabled(config)) return [];

    const queries = buildProviderQueries(extractedTracks[0]);
    console.log(`[ELITE_PLAYBACK] ${source}: searching ${JSON.stringify(queries)}`);
    const items = await searchProvider(source, queries);
    const matches = rankProviderItems(items, extractedTracks).map((match) => ({ source, ...match }));
    console.log(
        `[ELITE_PLAYBACK] ${source}: ${items.length} candidate(s), ${matches.length} match(es)${
            matches[0] ? `, best ${matches[0].score.toFixed(3)} (${matches[0].tier})` : ""
        }`,
    );

    return matches;
}

async function resolvePlaybackSource(search, config, forcedSource = null) {
    const extractedTracks = search?.tracks || [];
    if (extractedTracks.length === 0) return null;

    const directResults = directSourceResults(extractedTracks);
    if (directResults.length > 0) return { source: "direct", results: directResults, autoPlay: true };

    const requestedSource = forcedSource && forcedSource !== "auto" ? forcedSource : null;
    const sources = requestedSource ? [requestedSource] : parseSourceOrder(config.playbackSourceOrder);

    for (const source of sources) {
        const results = await resolveSourceResults(source, extractedTracks, config);
        if (results.length > 0) {
            const autoPlay = results[0].tier === "auto";
            console.log(
                `[ELITE_PLAYBACK] resolved via ${source}: ${results.length} result(s), ${autoPlay ? "playing" : "picker"}`,
            );
            return { source, results, autoPlay };
        }
    }

    console.log(`[ELITE_PLAYBACK] no source matched ${JSON.stringify(extractedTracks[0]?.title)}`);
    return null;
}

async function searchAllPlaybackSources(search, config) {
    const extractedTracks = search?.tracks || [];
    if (extractedTracks.length === 0) return null;

    const groups = await Promise.all(
        parseSourceOrder(config.playbackSourceOrder).map(async (source) => ({
            source,
            results: await resolveSourceResults(source, extractedTracks, config),
        })),
    );
    const matches = groups.filter((group) => group.results.length > 0);

    return matches.length > 0 ? matches : null;
}

async function addResolvedTrack(interaction, nextSong, result, responseType) {
    interaction.playbackSource = result.source;

    try {
        const provider = playbackProviders[result.source];
        if (!provider) {
            return await musicFuncs.addTracks(
                interaction,
                nextSong,
                { tracks: [result.item], playlist: null },
                responseType,
            );
        }
        return await provider.add(interaction, nextSong, result.item, responseType);
    } finally {
        delete interaction.playbackSource;
    }
}

function selectionIdentifier(result) {
    return playbackProviders[result.source]
        ? playbackProviders[result.source].identifier(result.item)
        : result.item.url;
}

function resultDuration(interaction, result) {
    if (result.item?.live) return translate(interaction, "np.liveIndicator").trim();
    if (!playbackProviders[result.source]) return result.item.duration || "--:--";
    return formatDurationMs(parseDurationMs(result.item.rawDuration ?? result.item.duration));
}

function resultDescription(result) {
    if (!playbackProviders[result.source]) return result.item.description || result.item.author || result.item.title;

    const artist = result.item.grandparentTitle || result.item.artist || result.item.author;
    const album = result.item.parentTitle || result.item.album;
    return [artist, album].filter(Boolean).join(" • ") || result.item.title;
}

function truncate(value, maximum) {
    const text = String(value || "");
    return text.length > maximum ? `${text.slice(0, maximum - 3)}...` : text;
}

function sourceName(interaction, source) {
    return translate(interaction, `playback.sources.${source}`);
}

function pickerDescription(interaction, resultCount) {
    return translate(interaction, resultCount === 1 ? "search.singleResult" : "search.multipleResults");
}

function buildResultMenu(interaction, customId, results, selectionValue) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setMinValues(1)
        .setMaxValues(1)
        .setPlaceholder(translate(interaction, "search.placeholder"));

    results.forEach((result, index) => {
        const option = new StringSelectMenuOptionBuilder()
            .setLabel(truncate(result.item.title, 100))
            .setValue(selectionValue(result))
            .setDescription(
                truncate(`${sourceName(interaction, result.source)} • ${resultDuration(interaction, result)}`, 100),
            );

        if (PICKER_EMOJIS[index]) option.setEmoji(PICKER_EMOJIS[index]);
        menu.addOptions(option);
    });

    return menu;
}

function buildResultFields(interaction, results, includeSource) {
    return results.map((result, index) => {
        const variables = {
            index: index + 1,
            duration: resultDuration(interaction, result),
            source: sourceName(interaction, result.source),
        };

        return {
            name: translate(interaction, includeSource ? "search.songResultSource" : "search.songResult", variables),
            value: truncate(resultDescription(result), 1024),
        };
    });
}

function aggregateResults(groups) {
    const results = [];

    for (const group of groups) {
        results.push(...group.results.slice(0, MAX_PICKER_RESULTS));
        if (results.length >= MAX_AGGREGATED_RESULTS) break;
    }

    return results.slice(0, MAX_AGGREGATED_RESULTS);
}

function buildPicker(interaction, options) {
    const fields = buildResultFields(interaction, options.results, options.includeResultSource);
    if (options.playbackSource) {
        fields.unshift(buildPlaybackSourceField(interaction, options.playbackSource));
    }

    const embed = new EmbedBuilder()
        .setAuthor({
            name: interaction.client.user.tag,
            iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setTitle(options.title)
        .setDescription(pickerDescription(interaction, options.results.length))
        .addFields(fields)
        .setColor(interaction.client.config.embedColour)
        .setTimestamp()
        .setFooter(buildRequestedByFooter(interaction, interaction.user));
    const menu = buildResultMenu(interaction, options.customId, options.results, options.selectionValue);
    const cancel = new ButtonBuilder()
        .setCustomId("np-delete")
        .setStyle(ButtonStyle.Danger)
        .setLabel(translate(interaction, "search.cancel"));

    return {
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(menu), new ActionRowBuilder().addComponents(cancel)],
    };
}

function buildPlaybackPicker(interaction, resolution, nextSong) {
    const source = resolution.source;
    const titleKey = playbackProviders[source] ? `search.${source}Title` : "search.resultsTitle";

    return buildPicker(interaction, {
        title: translate(interaction, titleKey),
        results: resolution.results.slice(0, MAX_PICKER_RESULTS),
        customId: `playsearch:${source}:${nextSong ? 1 : 0}`,
        selectionValue: selectionIdentifier,
        playbackSource: source,
    });
}

function buildAggregatedPlaybackPicker(interaction, groups) {
    if (groups.length === 1) return buildPlaybackPicker(interaction, groups[0], false);

    return buildPicker(interaction, {
        title: translate(interaction, "search.allSourcesTitle"),
        results: aggregateResults(groups),
        customId: "playsearch:all:0",
        selectionValue: (result) => `${result.source}:${selectionIdentifier(result)}`,
        includeResultSource: true,
    });
}

function parsePlaybackSelection(customId, identifier) {
    const selection = /^playsearch:(plex|subsonic|jellyfin|youtube|all):([01])$/.exec(customId);
    if (!selection) return null;

    let [, source, nextSongFlag] = selection;
    if (source === "all") {
        const separatorIndex = identifier.indexOf(":");
        source = identifier.slice(0, separatorIndex);
        identifier = identifier.slice(separatorIndex + 1);
        if (!VALID_SOURCES.includes(source)) return null;
    }

    return { source, nextSong: nextSongFlag === "1", identifier };
}

async function addPlaybackSelection(interaction, customId, identifier, responseType) {
    const selection = parsePlaybackSelection(customId, identifier);
    if (!selection) return null;

    const { source, nextSong, identifier: selectedIdentifier } = selection;
    let item;

    if (source === "youtube") {
        const search = await useMainPlayer().search(selectedIdentifier, {
            requestedBy: interaction.user,
            searchEngine: QueryType.AUTO,
        });
        item = search?.tracks?.find((track) => track.url === selectedIdentifier) || search?.tracks?.[0];
    } else {
        item = playbackProviders[source].itemFromIdentifier(selectedIdentifier);
    }

    if (!item) return null;
    const result = { source, item, extractedTrack: item };
    await addResolvedTrack(interaction, nextSong, result, responseType);
    return result;
}

module.exports = {
    VALID_SOURCES,
    addPlaybackSelection,
    addResolvedTrack,
    buildAggregatedPlaybackPicker,
    buildPlaybackPicker,
    getAvailablePlaybackSources,
    getPlaybackSourceAvailability,
    parseSourceOrder,
    resolvePlaybackSource,
    searchAllPlaybackSources,
};
