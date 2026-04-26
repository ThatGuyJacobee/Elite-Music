require("dotenv").config();
const { EmbedBuilder } = require("discord.js");
const { useMainPlayer, QueryType, Track } = require("discord-player");
const { buildImageAttachment } = require("./utilityFunctions");
const { clearNpControlMessages } = require("./npControlMessages");
const { getQueue } = require("./sharedFunctions");

const player = useMainPlayer();

function formatPlexDurationLabel(durationMilliseconds) {
    const durationAsNumber = Number(durationMilliseconds);
    if (!Number.isFinite(durationAsNumber) || durationAsNumber < 0) {
        return "--:--";
    }

    const totalSeconds = Math.floor(durationAsNumber / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
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
        const allPlaylists = searchJson.MediaContainer.Metadata.filter((metadataEntry) => metadataEntry.type == "playlist");
        const allAlbums = searchJson.MediaContainer.Metadata.filter((metadataEntry) => metadataEntry.type == "album");

        return {
            songs: allSongs,
            playlists: allPlaylists,
            albums: allAlbums,
            size: (allAlbums ? allAlbums.length : 0) + (allSongs ? allSongs.length : 0) + (allPlaylists ? allPlaylists.length : 0),
        };
    } catch (err) {
        console.log(err);
        return false;
    }
}

async function plexAddTrack(interaction, nextSong, itemMetadata, responseType) {
    const trackRequest = await fetch(`${client.config.plexServer}${itemMetadata.key}?X-Plex-Token=${client.config.plexAuthtoken}`, {
        method: "GET",
        headers: { accept: "application/json" },
    });

    const trackJson = await trackRequest.json();
    const songFound = trackJson.MediaContainer.Metadata[0];

    const durationDate = new Date(songFound.duration);
    const newTrack = new Track(player, {
        title: songFound.title,
        author: songFound.grandparentTitle,
        url: `${client.config.plexServer}${songFound.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
        thumbnail: `${client.config.plexServer}${songFound.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
        duration: `${durationDate.getMinutes()}:${durationDate.getSeconds() < 10 ? `0${durationDate.getSeconds()}` : durationDate.getSeconds()}`,
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
        return interaction.followUp({ content: `❌ | Ooops... something went wrong, failed to add the track(s) to the queue.`, ephemeral: true });
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
        const durationDate = new Date(playlistTrack.duration);
        const newTrack = new Track(player, {
            title: playlistTrack.title,
            author: playlistTrack.grandparentTitle,
            url: `${client.config.plexServer}${playlistTrack.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            thumbnail: `${client.config.plexServer}${playlistTrack.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            duration: `${durationDate.getMinutes()}:${durationDate.getSeconds() < 10 ? `0${durationDate.getSeconds()}` : durationDate.getSeconds()}`,
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
            return interaction.followUp({ content: `❌ | Ooops... something went wrong, failed to add the track(s) to the queue.`, ephemeral: true });
        }
    }

    const orderedTracks = applyTrackOrder(builtTracks, orderMode);
    await addContainerTracksToQueue(interaction, orderedTracks, nextSong);
    await plexQueuePlay(interaction, responseType, itemMetadata, playlistJson.MediaContainer.Metadata[0].thumb, nextSong);
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
        const durationDate = new Date(albumTrack.duration);
        const newTrack = new Track(player, {
            title: albumTrack.title,
            author: albumTrack.grandparentTitle,
            url: `${client.config.plexServer}${albumTrack.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            thumbnail: `${client.config.plexServer}${albumTrack.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            duration: `${durationDate.getMinutes()}:${durationDate.getSeconds() < 10 ? `0${durationDate.getSeconds()}` : durationDate.getSeconds()}`,
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

    await plexQueuePlay(interaction, responseType, albumMetadataForEmbed, albumChildrenJson.MediaContainer.Metadata[0].thumb, nextSong);
}

async function plexQueuePlay(interaction, responseType, itemMetadata, defaultThumbnail, nextSong) {
    const queue = await getQueue(interaction);

    try {
        if (!queue.connection) await queue.connect(interaction.member.voice.channel);
    } catch (err) {
        await clearNpControlMessages(queue);
        queue.delete();
        return interaction.followUp({ content: `❌ | Ooops... something went wrong, couldn't join your channel.`, ephemeral: true });
    }

    const imageAttachment = await buildImageAttachment(
        `${client.config.plexServer}${defaultThumbnail}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
        {
            name: "coverimage.jpg",
            description: `${itemMetadata.type == "playlist" ? "Playlist" : "Song"} Cover Image for ${itemMetadata.title}`,
        },
    );

    const embed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail("attachment://coverimage.jpg")
        .setColor(client.config.embedColour)
        .setTimestamp()
        .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` });

    if (!queue.isPlaying()) {
        try {
            await queue.node.play(queue.tracks[0]);
            queue.node.setVolume(client.config.defaultVolume);
        } catch (err) {
            return interaction.followUp({ content: `❌ | Ooops... something went wrong, there was a playback related error. Please try again.`, ephemeral: true });
        }

        if (itemMetadata.type == "playlist") {
            embed.setDescription(`Imported the **${itemMetadata.title} playlist** with **${itemMetadata.leafCount}** songs and started to play the queue!`);
        } else if (itemMetadata.type == "album") {
            embed.setDescription(`Imported the **${itemMetadata.title} album** with **${itemMetadata.leafCount}** songs and started to play the queue!`);
        } else {
            embed.setDescription(`Began playing the song **${itemMetadata.title}**!`);
        }

        embed.setTitle(`Started playback ▶️`);
    } else {
        if (itemMetadata.type == "playlist") {
            embed.setDescription(`Imported the **${itemMetadata.title} playlist** with **${itemMetadata.leafCount}** songs!`);
            embed.setTitle(`Added to queue ⏱️`);
        } else if (itemMetadata.type == "album") {
            embed.setDescription(`Imported the **${itemMetadata.title} album** with **${itemMetadata.leafCount}** songs!`);
            embed.setTitle(`Added to queue ⏱️`);
        } else {
            if (nextSong) {
                embed.setDescription(`Added song **${itemMetadata.title}** to the top of the queue (playing next)!`);
                embed.setTitle(`Added to the top of the queue ⏱️`);
            } else {
                embed.setDescription(`Added song **${itemMetadata.title}** to the queue!`);
                embed.setTitle(`Added to queue ⏱️`);
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
