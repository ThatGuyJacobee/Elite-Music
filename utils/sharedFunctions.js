require("dotenv").config();
const { EmbedBuilder } = require("discord.js");
const { useMainPlayer, QueryType, Track } = require('discord-player');
const { buildImageAttachment } = require("../utils/utilityFunctions");
const { clearNpControlMessages } = require("./npControlMessages");
const {
    search2: subsonicSearch2,
    getPlaylists: subsonicGetPlaylists,
    getPlaylist: subsonicGetPlaylist,
    getSong: subsonicGetSong,
    streamUrl: subsonicStreamUrl,
    coverArtUrl: subsonicCoverArtUrl,
} = require("./subsonicAPI");
const player = useMainPlayer();

//Core music functions
async function getQueue(interaction) {
    const player = useMainPlayer() ;
    var checkqueue = player.nodes.get(interaction.guild.id);

    if (!checkqueue) {
        player.nodes.create(interaction.guild.id, {
            leaveOnEmpty: client.config.leaveOnEmpty,
            leaveOnEmptyCooldown: client.config.leaveOnEmptyCooldown,
            leaveOnEnd: client.config.leaveOnEnd,
            leaveOnEndCooldown: client.config.leaveOnEndCooldown,
            leaveOnStop: client.config.leaveOnStop,
            leaveOnStopCooldown: client.config.leaveOnStopCooldown,
            selfDeaf: client.config.selfDeafen,
            skipOnNoStream: true,
            metadata: {
                channel: interaction.channel,
                requestedBy: interaction.user,
                client: interaction.guild.members.me,
            }
        })
    }

    return player.nodes.get(interaction.guild.id);
}

async function addTracks(interaction, nextSong, search, responseType) {
    try {
        let queue = await getQueue(interaction);

        if (nextSong) {
            queue.insertTrack(search.tracks[0]);
        }

        else {
            queue.addTrack(search.tracks);
        }

        await queuePlay(interaction, responseType, search, nextSong);
    }

    catch (err) {
        console.log(err)
        return interaction.followUp({ content: `❌ | Ooops... something went wrong, failed to add the track(s) to the queue.`, ephemeral: true })
    }
}

async function queuePlay(interaction, responseType, search, nextSong) {
    var queue = await getQueue(interaction);

    try {
        if (!queue.connection) await queue.connect(interaction.member.voice.channel);
    }

    catch (err) {
        await clearNpControlMessages(queue);
        queue.delete();
        return interaction.followUp({ content: `❌ | Ooops... something went wrong, couldn't join your channel.`, ephemeral: true })
    }

    // Handle the song/playlist cover image
    let imageAttachment = await buildImageAttachment(search.tracks[0].thumbnail, { name: 'coverimage.jpg', description: search.playlist ? `Playlist Cover Image for ${search.tracks[0].playlist.title}` : `Song Cover Image for ${search.tracks[0].title}` });

    const embed = new EmbedBuilder()
    .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
    .setThumbnail('attachment://coverimage.jpg')
    .setColor(client.config.embedColour)
    .setTimestamp()
    .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

    if (!queue.isPlaying()) {
        try {
            await queue.node.play(queue.tracks[0]);
            queue.node.setVolume(client.config.defaultVolume);
        }

        catch (err) {
            return interaction.followUp({ content: `❌ | Ooops... something went wrong, there was a playback related error. Please try again.`, ephemeral: true })
        }

        if (search.playlist) {
            embed.setDescription(`Imported the **${search.tracks[0].playlist.title} ([Link](${search.tracks[0].playlist.url})) playlist** with **${search.tracks.length}** songs and started to play the queue!`)
        }

        else {
            embed.setDescription(`Began playing the song **${search.tracks[0].title}** ${search.tracks[0].queryType != 'arbitrary' ? `([Link](${search.tracks[0].url}))` : ''}!`)
        }

        embed.setTitle(`Started playback ▶️`)
    }

    else {
        if (search.playlist) {
            embed.setDescription(`Imported the **${search.tracks[0].playlist.title} ([Link](${search.tracks[0].playlist.url})) playlist** with **${search.tracks.length}** songs!`)
        }

        else {
            if (nextSong) {
                embed.setDescription(`Added song **${search.tracks[0].title}** ${search.tracks[0].queryType != 'arbitrary' ? `([Link](${search.tracks[0].url}))` : ''} to the top of the queue (playing next)!`)
                embed.setTitle(`Added to the top of the queue ⏱️`)
            }

            else {
                embed.setDescription(`Began playing the song **${search.tracks[0].title}** ${search.tracks[0].queryType != 'arbitrary' ? `([Link](${search.tracks[0].url}))` : ''}!`)
                embed.setTitle(`Added to queue ⏱️`)
            }
        } 
    }

    if (responseType == 'edit') {
        interaction.message.edit({ embeds: [embed], files: [imageAttachment], components: [] })
    }

    else {
        interaction.followUp({ embeds: [embed], files: [imageAttachment] })
    }
}

async function subsonicSearchQuery(query) {
    try {
        const cfg = client.config;
        const { songs } = await subsonicSearch2(cfg, query, {
            songCount: 10,
            artistCount: 0,
            albumCount: 0,
        });
        const playlistsRaw = await subsonicGetPlaylists(cfg);
        const q = String(query).toLowerCase();
        const playlistsMatch = playlistsRaw.filter((p) =>
            String(p.name || "")
                .toLowerCase()
                .includes(q),
        );

        const mappedSongs = songs.map((s) => ({
            type: "track",
            id: s.id,
            title: s.title,
            grandparentTitle: s.artist || "Unknown Artist",
            parentTitle: s.album || "Unknown Album",
            duration: Number(s.duration || 0) * 1000,
            coverArt: s.coverArt,
        }));

        const mappedPlaylists = playlistsMatch.map((p) => ({
            type: "playlist",
            id: p.id,
            title: p.name,
            ratingKey: p.id,
            songCount: p.songCount,
            leafCount: p.songCount,
            duration: p.duration != null ? Number(p.duration) * 1000 : 0,
        }));

        const songSlice = mappedSongs.slice(0, 10);
        const room = 10 - songSlice.length;
        const playlistSlice = mappedPlaylists.slice(0, Math.max(0, room));

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
        const s = await subsonicGetSong(client.config, meta.id);
        if (!s) {
            return interaction.followUp({
                content: `❌ | Could not load song metadata from Subsonic.`,
                ephemeral: true,
            });
        }

        meta = {
            type: "track",
            id: s.id,
            title: s.title,
            grandparentTitle: s.artist,
            parentTitle: s.album,
            duration: Number(s.duration || 0) * 1000,
            coverArt: s.coverArt,
        };
    }

    const stream = subsonicStreamUrl(client.config, meta.id);
    const thumbUrl =
        meta.coverArt != null && meta.coverArt !== ""
            ? subsonicCoverArtUrl(client.config, meta.coverArt, 500)
            : interaction.client.user.displayAvatarURL();

    let date = new Date(meta.duration || 0);
    var newTrack = new Track(player, {
        title: meta.title,
        author: meta.grandparentTitle || "Unknown Artist",
        url: stream,
        thumbnail: thumbUrl,
        duration: `${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`,
        views: "69",
        playlist: null,
        description: null,
        requestedBy: interaction.user,
        source: "arbitrary",
        engine: stream,
        queryType: QueryType.ARBITRARY,
    });

    try {
        let queue = await getQueue(interaction);

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

async function subsonicAddPlaylist(interaction, itemMetadata, responseType) {
    const { playlist, entries } = await subsonicGetPlaylist(client.config, itemMetadata.id);
    const tracks = entries.filter((e) => !e.isDir);
    if (!tracks.length) {
        return interaction.followUp({
            content: `❌ | This playlist has no playable tracks.`,
            ephemeral: true,
        });
    }
    
    const title = itemMetadata.title && itemMetadata.title !== "" ? itemMetadata.title : playlist.name || "Playlist";

    for (const item of tracks) {
        const stream = subsonicStreamUrl(client.config, item.id);
        const thumbUrl =
            item.coverArt != null && item.coverArt !== ""
                ? subsonicCoverArtUrl(client.config, item.coverArt, 500)
                : interaction.client.user.displayAvatarURL();

        let date = new Date(Number(item.duration || 0) * 1000);
        var newTrack = new Track(player, {
            title: item.title,
            author: item.artist || "Unknown Artist",
            url: stream,
            thumbnail: thumbUrl,
            duration: `${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`,
            views: "69",
            playlist: null,
            description: null,
            requestedBy: interaction.user,
            source: "arbitrary",
            engine: stream,
            queryType: QueryType.ARBITRARY,
        });

        try {
            let queue = await getQueue(interaction);
            queue.addTrack(newTrack);
        } catch (err) {
            return interaction.followUp({
                content: `❌ | Ooops... something went wrong, failed to add the track(s) to the queue.`,
                ephemeral: true,
            });
        }
    }

    const metaOut = {
        ...itemMetadata,
        type: "playlist",
        title,
        leafCount: tracks.length,
    };
    const firstCover = tracks[0] && tracks[0].coverArt ? tracks[0].coverArt : null;
    await subsonicQueuePlay(interaction, responseType, metaOut, firstCover, false);
}

async function subsonicQueuePlay(interaction, responseType, itemMetadata, defaultCoverArtId, nextSong) {
    var queue = await getQueue(interaction);

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

    let imageAttachment = await buildImageAttachment(coverUrl, {
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
            embed.setDescription(
                `Imported the **${itemMetadata.title} playlist** with **${itemMetadata.leafCount}** songs!`,
            );
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
    getQueue,
    addTracks,
    queuePlay,
    subsonicSearchQuery,
    subsonicAddTrack,
    subsonicAddPlaylist,
    subsonicQueuePlay,
};
