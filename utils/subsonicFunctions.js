require("dotenv").config();
const { EmbedBuilder } = require("discord.js");
const { useMainPlayer, QueryType, Track } = require("discord-player");
const { buildImageAttachment } = require("./utilityFunctions");
const { clearNpControlMessages } = require("./npControlMessages");
const { getQueue } = require("./sharedFunctions");
const {
    search2: subsonicSearch2,
    getPlaylists: subsonicGetPlaylists,
    getPlaylist: subsonicGetPlaylist,
    getSong: subsonicGetSong,
    streamUrl: subsonicStreamUrl,
    coverArtUrl: subsonicCoverArtUrl,
} = require("./subsonicAPI");

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

async function subsonicSearchQuery(query, options = {}) {
    const scope = options.scope ?? "auto";

    try {
        const cfg = client.config;

        const songCount = scope === "playlist" ? 0 : 10;
        const { songs } = await subsonicSearch2(cfg, query, {
            songCount,
            artistCount: 0,
            albumCount: 0,
        });

        let mappedPlaylists = [];
        if (scope !== "track") {
            const playlistsRaw = await subsonicGetPlaylists(cfg);
            const normalizedQuery = String(query).toLowerCase();
            const playlistsMatch = playlistsRaw.filter((playlistEntry) =>
                String(playlistEntry.name || "")
                    .toLowerCase()
                    .includes(normalizedQuery),
            );
            mappedPlaylists = playlistsMatch.map((playlistEntry) => ({
                type: "playlist",
                id: playlistEntry.id,
                title: playlistEntry.name,
                ratingKey: playlistEntry.id,
                songCount: playlistEntry.songCount,
                leafCount: playlistEntry.songCount,
                duration: playlistEntry.duration != null ? Number(playlistEntry.duration) * 1000 : 0,
            }));
        }

        const mappedSongs = songs.map((songEntry) => ({
            type: "track",
            id: songEntry.id,
            title: songEntry.title,
            grandparentTitle: songEntry.artist || "Unknown Artist",
            parentTitle: songEntry.album || "Unknown Album",
            duration: Number(songEntry.duration || 0) * 1000,
            coverArt: songEntry.coverArt,
        }));

        let songSlice = [];
        let playlistSlice = [];

        if (scope === "auto") {
            songSlice = mappedSongs.slice(0, 10);
            const room = 10 - songSlice.length;
            playlistSlice = mappedPlaylists.slice(0, Math.max(0, room));
        } else if (scope === "track") {
            songSlice = mappedSongs.slice(0, 10);
        } else if (scope === "playlist") {
            playlistSlice = mappedPlaylists.slice(0, 10);
        }

        if (!songSlice.length && !playlistSlice.length) return false;

        return {
            songs: songSlice,
            playlists: playlistSlice,
            size: songSlice.length + playlistSlice.length,
        };
    } catch (err) {
        console.log(err);
        return false;
    }
}

async function subsonicAddTrack(interaction, nextSong, itemMetadata, responseType) {
    let meta = itemMetadata;
    if ((!meta.title || meta.title === "") && meta.id) {
        const songFromApi = await subsonicGetSong(client.config, meta.id);
        if (!songFromApi) {
            return interaction.followUp({
                content: `❌ | Could not load song metadata from Subsonic.`,
                ephemeral: true,
            });
        }

        meta = {
            type: "track",
            id: songFromApi.id,
            title: songFromApi.title,
            grandparentTitle: songFromApi.artist,
            parentTitle: songFromApi.album,
            duration: Number(songFromApi.duration || 0) * 1000,
            coverArt: songFromApi.coverArt,
        };
    }

    const stream = subsonicStreamUrl(client.config, meta.id);
    const thumbUrl =
        meta.coverArt != null && meta.coverArt !== ""
            ? subsonicCoverArtUrl(client.config, meta.coverArt, 500)
            : interaction.client.user.displayAvatarURL();

    const durationDate = new Date(meta.duration || 0);
    const newTrack = new Track(player, {
        title: meta.title,
        author: meta.grandparentTitle || "Unknown Artist",
        url: stream,
        thumbnail: thumbUrl,
        duration: `${durationDate.getMinutes()}:${durationDate.getSeconds() < 10 ? `0${durationDate.getSeconds()}` : durationDate.getSeconds()}`,
        views: "69",
        playlist: null,
        description: null,
        requestedBy: interaction.user,
        source: "arbitrary",
        engine: stream,
        queryType: QueryType.ARBITRARY,
    });

    try {
        const queue = await getQueue(interaction);

        if (nextSong) {
            queue.insertTrack(newTrack);
        } else {
            queue.addTrack(newTrack);
        }

        await subsonicQueuePlay(interaction, responseType, meta, meta.coverArt, nextSong);
    } catch (err) {
        return interaction.followUp({
            content: `❌ | Ooops... something went wrong, failed to add the track(s) to the queue.`,
            ephemeral: true,
        });
    }
}

async function subsonicAddPlaylist(interaction, itemMetadata, responseType, orderMode = "sequential", nextSong = false) {
    const { playlist, entries } = await subsonicGetPlaylist(client.config, itemMetadata.id);
    const playlistEntries = entries.filter((entry) => !entry.isDir);
    if (!playlistEntries.length) {
        return interaction.followUp({
            content: `❌ | This playlist has no playable tracks.`,
            ephemeral: true,
        });
    }

    const title = itemMetadata.title && itemMetadata.title !== "" ? itemMetadata.title : playlist.name || "Playlist";

    const builtTracks = [];
    for (const item of playlistEntries) {
        const stream = subsonicStreamUrl(client.config, item.id);
        const thumbUrl =
            item.coverArt != null && item.coverArt !== ""
                ? subsonicCoverArtUrl(client.config, item.coverArt, 500)
                : interaction.client.user.displayAvatarURL();

        const durationDate = new Date(Number(item.duration || 0) * 1000);
        const newTrack = new Track(player, {
            title: item.title,
            author: item.artist || "Unknown Artist",
            url: stream,
            thumbnail: thumbUrl,
            duration: `${durationDate.getMinutes()}:${durationDate.getSeconds() < 10 ? `0${durationDate.getSeconds()}` : durationDate.getSeconds()}`,
            views: "69",
            playlist: null,
            description: null,
            requestedBy: interaction.user,
            source: "arbitrary",
            engine: stream,
            queryType: QueryType.ARBITRARY,
        });

        builtTracks.push(newTrack);
    }

    try {
        const orderedTracks = applyTrackOrder(builtTracks, orderMode);
        await addContainerTracksToQueue(interaction, orderedTracks, nextSong);
    } catch (err) {
        return interaction.followUp({
            content: `❌ | Ooops... something went wrong, failed to add the track(s) to the queue.`,
            ephemeral: true,
        });
    }

    const metaOut = {
        ...itemMetadata,
        type: "playlist",
        title,
        leafCount: playlistEntries.length,
    };
    const firstCover = playlistEntries[0] && playlistEntries[0].coverArt ? playlistEntries[0].coverArt : null;
    await subsonicQueuePlay(interaction, responseType, metaOut, firstCover, nextSong);
}

async function subsonicQueuePlay(interaction, responseType, itemMetadata, defaultCoverArtId, nextSong) {
    const queue = await getQueue(interaction);

    try {
        if (!queue.connection) await queue.connect(interaction.member.voice.channel);
    } catch (err) {
        await clearNpControlMessages(queue);
        queue.delete();
        return interaction.followUp({
            content: `❌ | Ooops... something went wrong, couldn't join your voice channel.`,
            ephemeral: true,
        });
    }

    const coverUrl =
        defaultCoverArtId != null && defaultCoverArtId !== ""
            ? subsonicCoverArtUrl(client.config, defaultCoverArtId, 500)
            : interaction.client.user.displayAvatarURL();

    const imageAttachment = await buildImageAttachment(coverUrl, {
        name: "coverimage.jpg",
        description: `${itemMetadata.type == "playlist" ? "Playlist" : "Song"} Cover Image for ${itemMetadata.title}`,
    });

    const embed = new EmbedBuilder()
        .setAuthor({
            name: interaction.client.user.tag,
            iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setThumbnail("attachment://coverimage.jpg")
        .setColor(client.config.embedColour)
        .setTimestamp()
        .setFooter({
            text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}`,
        });

    if (!queue.isPlaying()) {
        try {
            await queue.node.play(queue.tracks[0]);
            queue.node.setVolume(client.config.defaultVolume);
        } catch (err) {
            return interaction.followUp({
                content: `❌ | Ooops... something went wrong, there was a playback related error. Please try again.`,
                ephemeral: true,
            });
        }

        if (itemMetadata.type == "playlist") {
            embed.setDescription(
                `Imported the **${itemMetadata.title} playlist** with **${itemMetadata.leafCount}** songs and started to play the queue!`,
            );
        } else {
            embed.setDescription(`Began playing the song **${itemMetadata.title}**!`);
        }

        embed.setTitle(`Started playback ▶️`);
    } else {
        if (itemMetadata.type == "playlist") {
            if (nextSong) {
                embed.setDescription(
                    `Imported the **${itemMetadata.title} playlist** with **${itemMetadata.leafCount}** songs to the top of the queue (playing next)!`,
                );
                embed.setTitle(`Added to the top of the queue ⏱️`);
            } else {
                embed.setDescription(
                    `Imported the **${itemMetadata.title} playlist** with **${itemMetadata.leafCount}** songs!`,
                );
                embed.setTitle(`Added to queue ⏱️`);
            }
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
    subsonicSearchQuery,
    subsonicAddTrack,
    subsonicAddPlaylist,
    subsonicQueuePlay,
};
