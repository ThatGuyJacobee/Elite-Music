require("dotenv").config();
const { EmbedBuilder, MessageFlags } = require("discord.js");
const { useMainPlayer, QueryType, Track } = require("discord-player");
const { buildImageAttachment, formatDurationMs } = require("./utilityFunctions");
const { clearNpControlMessages } = require("./npControlMessages");
const { getQueue } = require("./sharedFunctions");
const { clear, startInitialPlayback } = require("./softTransitions");
const { buildRequestedByFooter, buildCoverImageDescription, translate } = require("./botText");

const player = useMainPlayer();

function formatPlexDurationLabel(durationMilliseconds) {
    return formatDurationMs(durationMilliseconds);
}

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

function plexSearchTypeQueryParam(scope) {
    if (scope === "track") return "10";
    if (scope === "playlist") return "15";
    if (scope === "album") return "9";
    return "9,10,15";
}

async function plexSearchQuery(query, options = {}) {
    const scope = options.scope ?? "auto";
    const typeQueryParam = plexSearchTypeQueryParam(scope);

    try {
        const searchRequest = await fetch(
            `${client.config.plexServer}/search?X-Plex-Token=${client.config.plexAuthtoken}&query=${encodeURIComponent(query)}&limit=10&type=${typeQueryParam}`,
            {
                method: "GET",
                headers: { accept: "application/json" },
            },
        );

        const searchJson = await searchRequest.json();
        if (searchJson.MediaContainer.size == 0) return false;

        const allSongs = searchJson.MediaContainer.Metadata.filter((metadataEntry) => metadataEntry.type == "track");
        const allPlaylists = searchJson.MediaContainer.Metadata.filter(
            (metadataEntry) => metadataEntry.type == "playlist",
        );
        const allAlbums = searchJson.MediaContainer.Metadata.filter((metadataEntry) => metadataEntry.type == "album");

        return {
            songs: allSongs,
            playlists: allPlaylists,
            albums: allAlbums,
            size:
                (allAlbums ? allAlbums.length : 0) +
                (allSongs ? allSongs.length : 0) +
                (allPlaylists ? allPlaylists.length : 0),
        };
    } catch (err) {
        console.log(err);
        return false;
    }
}

async function plexAddTrack(interaction, nextSong, itemMetadata, responseType) {
    const trackRequest = await fetch(
        `${client.config.plexServer}${itemMetadata.key}?X-Plex-Token=${client.config.plexAuthtoken}`,
        {
            method: "GET",
            headers: { accept: "application/json" },
        },
    );

    const trackJson = await trackRequest.json();
    const songFound = trackJson.MediaContainer.Metadata[0];

    const newTrack = new Track(player, {
        title: songFound.title,
        author: songFound.grandparentTitle,
        url: `${client.config.plexServer}${songFound.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
        thumbnail: `${client.config.plexServer}${songFound.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
        duration: formatDurationMs(songFound.duration),
        views: "69",
        playlist: null,
        description: null,
        requestedBy: interaction.user,
        source: "arbitrary",
        engine: `${client.config.plexServer}${songFound.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
        queryType: QueryType.ARBITRARY,
    });

    try {
        const queue = await getQueue(interaction);

        if (nextSong) {
            queue.insertTrack(newTrack);
        } else {
            queue.addTrack(newTrack);
        }

        await plexQueuePlay(interaction, responseType, itemMetadata, songFound.thumb, nextSong);
    } catch (err) {
        return interaction.followUp({
            content: translate(interaction, "errors.addTracks"),
            flags: MessageFlags.Ephemeral,
        });
    }
}

async function addContainerTracksToQueue(interaction, tracks, nextSong) {
    const queue = await getQueue(interaction);
    if (nextSong) {
        // Insert in reverse so the first track in 'tracks' plays next.
        for (let index = tracks.length - 1; index >= 0; index--) {
            queue.insertTrack(tracks[index]);
        }
        return;
    }
    queue.addTrack(tracks);
}

async function plexAddPlaylist(interaction, itemMetadata, responseType, orderMode = "sequential", nextSong = false) {
    const playlistRequest = await fetch(
        `${client.config.plexServer}/playlists/${itemMetadata.ratingKey}/items?X-Plex-Token=${client.config.plexAuthtoken}`,
        {
            method: "GET",
            headers: { accept: "application/json" },
        },
    );

    const playlistJson = await playlistRequest.json();
    const builtTracks = [];
    for await (const playlistTrack of playlistJson.MediaContainer.Metadata) {
        const newTrack = new Track(player, {
            title: playlistTrack.title,
            author: playlistTrack.grandparentTitle,
            url: `${client.config.plexServer}${playlistTrack.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            thumbnail: `${client.config.plexServer}${playlistTrack.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            duration: formatDurationMs(playlistTrack.duration),
            views: "69",
            playlist: null,
            description: null,
            requestedBy: interaction.user,
            source: "arbitrary",
            engine: `${client.config.plexServer}${playlistTrack.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            queryType: QueryType.ARBITRARY,
        });

        try {
            builtTracks.push(newTrack);
        } catch (err) {
            return interaction.followUp({
                content: translate(interaction, "errors.addTracks"),
                flags: MessageFlags.Ephemeral,
            });
        }
    }

    const orderedTracks = applyTrackOrder(builtTracks, orderMode);
    await addContainerTracksToQueue(interaction, orderedTracks, nextSong);
    await plexQueuePlay(
        interaction,
        responseType,
        itemMetadata,
        playlistJson.MediaContainer.Metadata[0].thumb,
        nextSong,
    );
}

async function plexAddAlbum(interaction, itemMetadata, responseType, orderMode = "sequential", nextSong = false) {
    const albumRatingKey = itemMetadata.ratingKey || itemMetadata.key.split("/").pop();
    const albumChildrenRequest = await fetch(
        `${client.config.plexServer}/library/metadata/${albumRatingKey}/children?X-Plex-Token=${client.config.plexAuthtoken}`,
        {
            method: "GET",
            headers: { accept: "application/json" },
        },
    );

    const albumChildrenJson = await albumChildrenRequest.json();
    const builtTracks = [];
    for await (const albumTrack of albumChildrenJson.MediaContainer.Metadata) {
        const newTrack = new Track(player, {
            title: albumTrack.title,
            author: albumTrack.grandparentTitle,
            url: `${client.config.plexServer}${albumTrack.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            thumbnail: `${client.config.plexServer}${albumTrack.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            duration: formatDurationMs(albumTrack.duration),
            views: "69",
            playlist: null,
            description: null,
            requestedBy: interaction.user,
            source: "arbitrary",
            engine: `${client.config.plexServer}${albumTrack.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            queryType: QueryType.ARBITRARY,
        });

        builtTracks.push(newTrack);
    }

    const orderedTracks = applyTrackOrder(builtTracks, orderMode);
    await addContainerTracksToQueue(interaction, orderedTracks, nextSong);

    const albumMetadataForEmbed = {
        ...itemMetadata,
        leafCount: builtTracks.length,
    };

    await plexQueuePlay(
        interaction,
        responseType,
        albumMetadataForEmbed,
        albumChildrenJson.MediaContainer.Metadata[0].thumb,
        nextSong,
    );
}

async function plexQueuePlay(interaction, responseType, itemMetadata, defaultThumbnail, nextSong) {
    const queue = await getQueue(interaction);

    try {
        if (!queue.connection) await queue.connect(interaction.member.voice.channel);
    } catch (err) {
        await clearNpControlMessages(queue);
        clear(queue);
        queue.delete();
        return interaction.followUp({
            content: translate(interaction, "errors.joinVoice"),
            flags: MessageFlags.Ephemeral,
        });
    }

    const imageAttachment = await buildImageAttachment(
        `${client.config.plexServer}${defaultThumbnail}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
        {
            name: "coverimage.jpg",
            description: buildCoverImageDescription(
                interaction,
                itemMetadata.type == "playlist" ? "playlist" : "song",
                itemMetadata.title,
            ),
            source: interaction,
        },
    );

    const embed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
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
            embed.setDescription(
                translate(interaction, "playback.importedPlaylistQueued", {
                    title: itemMetadata.title,
                    link: "",
                    count: itemMetadata.leafCount,
                }),
            );
            embed.setTitle(translate(interaction, "playback.addedTitle"));
        } else if (itemMetadata.type == "album") {
            embed.setDescription(
                translate(interaction, "playback.importedAlbumQueued", {
                    title: itemMetadata.title,
                    count: itemMetadata.leafCount,
                }),
            );
            embed.setTitle(translate(interaction, "playback.addedTitle"));
        } else {
            if (nextSong) {
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
    }

    if (responseType == "edit") {
        interaction.message.edit({ embeds: [embed], files: [imageAttachment], components: [] });
    } else {
        interaction.followUp({ embeds: [embed], files: [imageAttachment] });
    }
}

module.exports = {
    formatPlexDurationLabel,
    plexSearchQuery,
    plexAddTrack,
    plexAddPlaylist,
    plexAddAlbum,
    plexQueuePlay,
};
