require("dotenv").config();
const { EmbedBuilder, MessageFlags } = require("discord.js");
const { useMainPlayer, QueryType, Track } = require("discord-player");
const { buildImageAttachment, formatDurationMs } = require("./utilityFunctions");
const { clearNpControlMessages } = require("./npControlMessages");
const { getQueue } = require("./sharedFunctions");
const { clear, startInitialPlayback } = require("./softTransitions");
const {
    searchItems: jellyfinSearchItems,
    getItem: jellyfinGetItem,
    getAlbumTracks: jellyfinGetAlbumTracks,
    getPlaylistItems: jellyfinGetPlaylistItems,
    streamUrl: jellyfinStreamUrl,
    imageUrl: jellyfinImageUrl,
    ticksToMs,
} = require("./jellyfinAPI");
const { buildRequestedByFooter, buildCoverImageDescription, translate } = require("./botText");

const player = useMainPlayer();

function applyTrackOrder(tracks, orderMode = "sequential") {
    if (orderMode === "reverse") {
        return [...tracks].reverse();
    }

    if (orderMode === "shuffle") {
        const shuffledTracks = [...tracks];
        for (let index = shuffledTracks.length - 1; index > 0; index--) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            const originalTrack = shuffledTracks[index];
            shuffledTracks[index] = shuffledTracks[randomIndex];
            shuffledTracks[randomIndex] = originalTrack;
        }
        return shuffledTracks;
    }

    return tracks;
}

async function addContainerTracksToQueue(interaction, tracks, nextSong) {
    const queue = await getQueue(interaction);
    if (nextSong) {
        for (let index = tracks.length - 1; index >= 0; index--) {
            queue.insertTrack(tracks[index]);
        }
        return;
    }
    queue.addTrack(tracks);
}

function sortAlbumSongs(songs) {
    return [...songs].sort((a, b) => {
        const discA = Number(a.ParentIndexNumber ?? a.discNumber ?? 1);
        const discB = Number(b.ParentIndexNumber ?? b.discNumber ?? 1);
        if (discA !== discB) return discA - discB;
        const trackA = Number(a.IndexNumber ?? a.track ?? 0);
        const trackB = Number(b.IndexNumber ?? b.track ?? 0);
        if (trackA !== trackB) return trackA - trackB;
        return String(a.Name || a.title || "").localeCompare(String(b.Name || b.title || ""));
    });
}

function nameFromGuidPairs(pairs) {
    if (!Array.isArray(pairs) || pairs.length === 0) return null;
    const first = pairs[0];
    return first?.Name || first?.name || null;
}

function parseArtistTitleFromName(name) {
    if (!name || typeof name !== "string") return null;

    const separatorIndex = name.indexOf(" - ");
    if (separatorIndex <= 0) return null;

    const artist = name.slice(0, separatorIndex).trim();
    const title = name.slice(separatorIndex + 3).trim();
    if (!artist || !title) return null;

    return { artist, title };
}

function resolveJellyfinArtist(item) {
    return (
        item.AlbumArtist ||
        nameFromGuidPairs(item.AlbumArtists) ||
        (Array.isArray(item.Artists) && item.Artists.length > 0 ? item.Artists[0] : null) ||
        nameFromGuidPairs(item.ArtistItems) ||
        null
    );
}

function mapJellyfinTrack(item) {
    const parsed = parseArtistTitleFromName(item.Name);
    const artist = resolveJellyfinArtist(item) || parsed?.artist || "Unknown Artist";
    const title = parsed?.title || item.Name || "Unknown Track";
    const album = item.Album || parsed?.title || title;

    return {
        type: "track",
        id: item.Id,
        title,
        grandparentTitle: artist,
        parentTitle: album,
        duration: ticksToMs(item.RunTimeTicks),
        imageItemId: item.AlbumId || item.Id,
    };
}

function mapJellyfinAlbum(item) {
    const albumName = item.Name || "Unknown Album";
    const albumArtist = resolveJellyfinArtist(item) || "";
    const songCountVal = Number(item.ChildCount ?? 0);

    return {
        type: "album",
        id: item.Id,
        title: albumName,
        artist: albumArtist,
        parentTitle: albumArtist ? `${albumName} - ${albumArtist}` : albumName,
        leafCount: Number.isFinite(songCountVal) ? songCountVal : 0,
        imageItemId: item.Id,
        duration: ticksToMs(item.RunTimeTicks),
    };
}

function mapJellyfinPlaylist(item) {
    const songCountVal = Number(item.ChildCount ?? 0);

    return {
        type: "playlist",
        id: item.Id,
        title: item.Name || "Playlist",
        leafCount: Number.isFinite(songCountVal) ? songCountVal : 0,
        imageItemId: item.Id,
        duration: ticksToMs(item.RunTimeTicks),
    };
}

function buildTrackFromJellyfinItem(interaction, item) {
    const meta = mapJellyfinTrack(item);
    const stream = jellyfinStreamUrl(client.config, meta.id);
    const thumbUrl =
        jellyfinImageUrl(client.config, meta.imageItemId || meta.id, 500) || interaction.client.user.displayAvatarURL();

    return new Track(player, {
        title: meta.title,
        author: meta.grandparentTitle || "Unknown Artist",
        url: stream,
        thumbnail: thumbUrl,
        duration: formatDurationMs(meta.duration || 0),
        views: "69",
        playlist: null,
        description: null,
        requestedBy: interaction.user,
        source: "arbitrary",
        engine: stream,
        queryType: QueryType.ARBITRARY,
    });
}

async function enrichTrackItemFromParent(config, item, cache) {
    let enriched = { ...item };

    if (!enriched.Album || !resolveJellyfinArtist(enriched)) {
        if (!cache.has(`item:${enriched.Id}`)) {
            try {
                cache.set(`item:${enriched.Id}`, await jellyfinGetItem(config, enriched.Id));
            } catch {
                cache.set(`item:${enriched.Id}`, null);
            }
        }

        const fullItem = cache.get(`item:${enriched.Id}`);
        if (fullItem) {
            enriched = { ...enriched, ...fullItem };
        }
    }

    if (enriched.Album && resolveJellyfinArtist(enriched)) return enriched;

    const parentId = enriched.ParentId;
    if (!parentId) return enriched;

    if (!cache.has(`parent:${parentId}`)) {
        try {
            cache.set(`parent:${parentId}`, await jellyfinGetItem(config, parentId));
        } catch {
            cache.set(`parent:${parentId}`, null);
        }
    }

    const parent = cache.get(`parent:${parentId}`);
    if (!parent || parent.Type === "Folder" || parent.Type === "CollectionFolder") return enriched;

    return {
        ...enriched,
        Album: enriched.Album || parent.Name,
        AlbumArtist: enriched.AlbumArtist || parent.AlbumArtist || nameFromGuidPairs(parent.AlbumArtists),
        Artists: enriched.Artists?.length ? enriched.Artists : parent.Artists,
        ArtistItems: enriched.ArtistItems?.length ? enriched.ArtistItems : parent.ArtistItems,
        AlbumArtists: enriched.AlbumArtists?.length ? enriched.AlbumArtists : parent.AlbumArtists,
        AlbumId: enriched.AlbumId || parent.Id,
    };
}

async function mapJellyfinTracksFromItems(items) {
    const parentCache = new Map();
    const enrichedItems = await Promise.all(
        items
            .filter((item) => item.Type === "Audio")
            .map((item) => enrichTrackItemFromParent(client.config, item, parentCache)),
    );

    return enrichedItems.map(mapJellyfinTrack);
}

async function jellyfinSearchQuery(query, options = {}) {
    const scope = options.scope ?? "auto";

    try {
        const cfg = client.config;

        let mappedSongs = [];
        let mappedAlbums = [];
        let mappedPlaylists = [];

        if (scope === "auto") {
            const [trackItems, albumItems, playlistItems] = await Promise.all([
                jellyfinSearchItems(cfg, query, { scope: "track", limit: 10 }),
                jellyfinSearchItems(cfg, query, { scope: "album", limit: 10 }),
                jellyfinSearchItems(cfg, query, { scope: "playlist", limit: 10 }),
            ]);

            mappedSongs = await mapJellyfinTracksFromItems(trackItems);
            mappedAlbums = albumItems.filter((item) => item.Type === "MusicAlbum").map(mapJellyfinAlbum);
            mappedPlaylists = playlistItems.filter((item) => item.Type === "Playlist").map(mapJellyfinPlaylist);
        } else {
            const items = await jellyfinSearchItems(cfg, query, { scope, limit: 10 });

            if (scope === "track") {
                mappedSongs = await mapJellyfinTracksFromItems(items);
            } else if (scope === "album") {
                mappedAlbums = items.filter((item) => item.Type === "MusicAlbum").map(mapJellyfinAlbum);
            } else if (scope === "playlist") {
                mappedPlaylists = items.filter((item) => item.Type === "Playlist").map(mapJellyfinPlaylist);
            }
        }

        let songSlice = [];
        let playlistSlice = [];
        let albumSlice = [];

        if (scope === "auto") {
            songSlice = mappedSongs.slice(0, 10);
            let room = 10 - songSlice.length;
            playlistSlice = mappedPlaylists.slice(0, Math.max(0, room));
            room -= playlistSlice.length;
            albumSlice = mappedAlbums.slice(0, Math.max(0, room));
        } else if (scope === "track") {
            songSlice = mappedSongs.slice(0, 10);
        } else if (scope === "playlist") {
            playlistSlice = mappedPlaylists.slice(0, 10);
        } else if (scope === "album") {
            albumSlice = mappedAlbums.slice(0, 10);
        }

        if (!songSlice.length && !playlistSlice.length && !albumSlice.length) return false;

        return {
            songs: songSlice,
            playlists: playlistSlice,
            albums: albumSlice,
            size: songSlice.length + playlistSlice.length + albumSlice.length,
        };
    } catch (err) {
        console.log(err);
        return false;
    }
}

async function jellyfinAddTrack(interaction, nextSong, itemMetadata, responseType) {
    let meta = itemMetadata;

    if ((!meta.title || meta.title === "") && meta.id) {
        const itemFromApi = await jellyfinGetItem(client.config, meta.id);
        if (!itemFromApi || itemFromApi.Type !== "Audio") {
            return interaction.followUp({
                content: translate(interaction, "errors.jellyfinSongMetadata"),
                flags: MessageFlags.Ephemeral,
            });
        }

        const parentCache = new Map();
        const enrichedItem = await enrichTrackItemFromParent(client.config, itemFromApi, parentCache);
        meta = mapJellyfinTrack(enrichedItem);
    }

    const newTrack = buildTrackFromJellyfinItem(interaction, {
        Id: meta.id,
        Name: meta.title,
        AlbumArtist: meta.grandparentTitle,
        Album: meta.parentTitle,
        RunTimeTicks: (meta.duration || 0) * 10000,
        AlbumId: meta.imageItemId,
    });

    try {
        const queue = await getQueue(interaction);

        if (nextSong) {
            queue.insertTrack(newTrack);
        } else {
            queue.addTrack(newTrack);
        }

        await jellyfinQueuePlay(interaction, responseType, meta, meta.imageItemId || meta.id, nextSong);
    } catch (err) {
        return interaction.followUp({
            content: translate(interaction, "errors.addTracks"),
            flags: MessageFlags.Ephemeral,
        });
    }
}

async function jellyfinAddPlaylist(
    interaction,
    itemMetadata,
    responseType,
    orderMode = "sequential",
    nextSong = false,
) {
    const playlistItems = await jellyfinGetPlaylistItems(client.config, itemMetadata.id);
    if (!playlistItems.length) {
        return interaction.followUp({
            content: translate(interaction, "errors.emptyPlaylist"),
            flags: MessageFlags.Ephemeral,
        });
    }

    let title = itemMetadata.title;
    if (!title || title === "") {
        const playlistMeta = await jellyfinGetItem(client.config, itemMetadata.id);
        title = (playlistMeta && playlistMeta.Name) || "Playlist";
    }

    const builtTracks = playlistItems.map((item) => buildTrackFromJellyfinItem(interaction, item));

    try {
        const orderedTracks = applyTrackOrder(builtTracks, orderMode);
        await addContainerTracksToQueue(interaction, orderedTracks, nextSong);
    } catch (err) {
        return interaction.followUp({
            content: translate(interaction, "errors.addTracks"),
            flags: MessageFlags.Ephemeral,
        });
    }

    const metaOut = {
        ...itemMetadata,
        type: "playlist",
        title,
        leafCount: playlistItems.length,
        imageItemId: itemMetadata.imageItemId || itemMetadata.id,
    };
    const firstImageId = mapJellyfinTrack(playlistItems[0]).imageItemId || metaOut.imageItemId;
    await jellyfinQueuePlay(interaction, responseType, metaOut, firstImageId, nextSong);
}

async function jellyfinAddAlbum(interaction, itemMetadata, responseType, orderMode = "sequential", nextSong = false) {
    const albumTracks = await jellyfinGetAlbumTracks(client.config, itemMetadata.id);
    const sortedEntries = sortAlbumSongs(albumTracks).filter((entry) => entry && entry.Id != null);
    if (!sortedEntries.length) {
        return interaction.followUp({
            content: translate(interaction, "errors.emptyAlbum"),
            flags: MessageFlags.Ephemeral,
        });
    }

    let albumName = itemMetadata.title;
    let albumArtist = itemMetadata.artist || "";
    if (!albumName || albumName === "") {
        const albumMeta = await jellyfinGetItem(client.config, itemMetadata.id);
        albumName = (albumMeta && albumMeta.Name) || "Album";
        albumArtist =
            (albumMeta && albumMeta.AlbumArtist) ||
            (albumMeta && Array.isArray(albumMeta.Artists) && albumMeta.Artists[0]) ||
            "";
    }

    const displayTitle = albumArtist ? `${albumName} - ${albumArtist}` : albumName;
    const title = itemMetadata.parentTitle || displayTitle;

    const builtTracks = sortedEntries.map((item) => buildTrackFromJellyfinItem(interaction, item));

    try {
        const orderedTracks = applyTrackOrder(builtTracks, orderMode);
        await addContainerTracksToQueue(interaction, orderedTracks, nextSong);
    } catch (err) {
        return interaction.followUp({
            content: translate(interaction, "errors.addTracks"),
            flags: MessageFlags.Ephemeral,
        });
    }

    const metaOut = {
        ...itemMetadata,
        type: "album",
        title,
        leafCount: sortedEntries.length,
        imageItemId: itemMetadata.imageItemId || itemMetadata.id,
    };
    const firstImageId = mapJellyfinTrack(sortedEntries[0]).imageItemId || metaOut.imageItemId;
    await jellyfinQueuePlay(interaction, responseType, metaOut, firstImageId, nextSong);
}

async function jellyfinQueuePlay(interaction, responseType, itemMetadata, defaultImageItemId, nextSong) {
    const queue = await getQueue(interaction);

    try {
        if (!queue.connection) await queue.connect(interaction.member.voice.channel);
    } catch (err) {
        await clearNpControlMessages(queue);
        clear(queue);
        queue.delete();
        return interaction.followUp({
            content: translate(interaction, "errors.joinVoiceChannel"),
            flags: MessageFlags.Ephemeral,
        });
    }

    const coverUrl =
        defaultImageItemId != null && defaultImageItemId !== ""
            ? jellyfinImageUrl(client.config, defaultImageItemId, 500)
            : interaction.client.user.displayAvatarURL();

    const coverKind = itemMetadata.type === "playlist" ? "playlist" : itemMetadata.type === "album" ? "album" : "song";
    const imageAttachment = await buildImageAttachment(coverUrl || interaction.client.user.displayAvatarURL(), {
        name: "coverimage.jpg",
        description: buildCoverImageDescription(interaction, coverKind, itemMetadata.title),
        source: interaction,
    });

    const embed = new EmbedBuilder()
        .setAuthor({
            name: interaction.client.user.tag,
            iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setThumbnail("attachment://coverimage.jpg")
        .setColor(client.config.embedColour)
        .setTimestamp()
        .setFooter(buildRequestedByFooter(interaction, interaction.user));

    if (!queue.isPlaying()) {
        try {
            await startInitialPlayback(queue, queue.tracks[0]);
        } catch (err) {
            return interaction.followUp({
                content: translate(interaction, "errors.playback"),
                flags: MessageFlags.Ephemeral,
            });
        }

        if (itemMetadata.type == "playlist") {
            embed.setDescription(
                translate(interaction, "playback.importedPlaylistStart", {
                    title: itemMetadata.title,
                    link: "",
                    count: itemMetadata.leafCount,
                }),
            );
        } else if (itemMetadata.type == "album") {
            embed.setDescription(
                translate(interaction, "playback.importedAlbumStart", {
                    title: itemMetadata.title,
                    count: itemMetadata.leafCount,
                }),
            );
        } else {
            embed.setDescription(
                translate(interaction, "playback.startedSong", { title: itemMetadata.title, link: "" }),
            );
        }

        embed.setTitle(translate(interaction, "playback.startedTitle"));
    } else {
        if (itemMetadata.type == "playlist") {
            if (nextSong) {
                embed.setDescription(
                    translate(interaction, "playback.importedPlaylistTop", {
                        title: itemMetadata.title,
                        link: "",
                        count: itemMetadata.leafCount,
                    }),
                );
                embed.setTitle(translate(interaction, "playback.addedTopTitle"));
            } else {
                embed.setDescription(
                    translate(interaction, "playback.importedPlaylistQueued", {
                        title: itemMetadata.title,
                        link: "",
                        count: itemMetadata.leafCount,
                    }),
                );
                embed.setTitle(translate(interaction, "playback.addedTitle"));
            }
        } else if (itemMetadata.type == "album") {
            if (nextSong) {
                embed.setDescription(
                    translate(interaction, "playback.importedAlbumTop", {
                        title: itemMetadata.title,
                        count: itemMetadata.leafCount,
                    }),
                );
                embed.setTitle(translate(interaction, "playback.addedTopTitle"));
            } else {
                embed.setDescription(
                    translate(interaction, "playback.importedAlbumQueued", {
                        title: itemMetadata.title,
                        count: itemMetadata.leafCount,
                    }),
                );
                embed.setTitle(translate(interaction, "playback.addedTitle"));
            }
        } else if (nextSong) {
            embed.setDescription(
                translate(interaction, "playback.queuedSongTop", { title: itemMetadata.title, link: "" }),
            );
            embed.setTitle(translate(interaction, "playback.addedTopTitle"));
        } else {
            embed.setDescription(
                translate(interaction, "playback.queuedSong", { title: itemMetadata.title, link: "" }),
            );
            embed.setTitle(translate(interaction, "playback.addedTitle"));
        }
    }

    if (responseType == "edit") {
        interaction.message.edit({ embeds: [embed], files: [imageAttachment], components: [] });
    } else {
        interaction.followUp({ embeds: [embed], files: [imageAttachment] });
    }
}

module.exports = {
    jellyfinSearchQuery,
    jellyfinAddTrack,
    jellyfinAddPlaylist,
    jellyfinAddAlbum,
    jellyfinQueuePlay,
};
