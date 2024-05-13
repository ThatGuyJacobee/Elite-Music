require("dotenv").config();
const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { Player, QueryType, Track } = require('discord-player');
const player = Player.singleton();

//Core music functions
async function getQueue(interaction) {
    const player = Player.singleton();
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
            queue.addTrack(search.tracks[0]);
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
        queue.delete();
        return interaction.followUp({ content: `❌ | Ooops... something went wrong, couldn't join your channel.`, ephemeral: true })
    }

    const embed = new EmbedBuilder()
    .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
    .setThumbnail(search.tracks[0].thumbnail)
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
        interaction.message.edit({ embeds: [embed], components: [] })
    }

    else {
        interaction.followUp({ embeds: [embed] })
    }
}


//Plex optional feature functions
async function plexSearchQuery(query) {
    try {
        var request = await fetch(`${client.config.plexServer}/search?X-Plex-Token=${client.config.plexAuthtoken}&query=${encodeURIComponent(query)}&limit=10&type=10,15`, {
            method: 'GET',
            headers: { accept: 'application/json'}
        })

        var result = await request.json()
        let allSongs = result.MediaContainer.Metadata.filter(x => x.type == 'track')
        let allPlaylists = result.MediaContainer.Metadata.filter(x => x.type == 'playlist')

        //Object: songs array, playlists array, total size of both arrays, default thumbnail
        return { 
            songs: allSongs, 
            playlists: allPlaylists, 
            size: (allSongs ? allSongs.length : 0) + (allPlaylists ? allPlaylists.length : 0)
        }
    }
    
    catch (err) {
        console.log(err)
        return false
    }
}

async function plexAddTrack(interaction, nextSong, itemMetadata, responseType) {
    var request = await fetch(`${client.config.plexServer}${itemMetadata.key}?X-Plex-Token=${client.config.plexAuthtoken}`, {
        method: 'GET',
        headers: { accept: 'application/json'}
    })

    var result = await request.json()
    var songFound = await result.MediaContainer.Metadata[0]

    let date = new Date(songFound.duration)
    var newTrack = new Track(player, {
        title: songFound.title,
        author: songFound.grandparentTitle,
        url: `${client.config.plexServer}${songFound.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
        thumbnail: `${client.config.plexServer}${songFound.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
        duration: `${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`,
        views: '69',
        playlist: null,
        description: null,
        requestedBy: interaction.user,
        source: 'arbitrary',
        engine: `${client.config.plexServer}${songFound.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
        queryType: QueryType.ARBITRARY
    })

    try {
        let queue = await getQueue(interaction);

        if (nextSong) {
            queue.insertTrack(newTrack);
        }

        else {
            queue.addTrack(newTrack);
        }

        await plexQueuePlay(interaction, responseType, itemMetadata, songFound.thumb, nextSong);
    }

    catch (err) {
        return interaction.followUp({ content: `❌ | Ooops... something went wrong, failed to add the track(s) to the queue.`, ephemeral: true })
    }
}

async function plexAddPlaylist(interaction, itemMetadata, responseType) {
    var request = await fetch(`${client.config.plexServer}/playlists/${itemMetadata.ratingKey}/items?X-Plex-Token=${client.config.plexAuthtoken}`, {
        method: 'GET',
        headers: { accept: 'application/json'}
    })

    var result = await request.json()
    for await (var item of result.MediaContainer.Metadata) {
        let date = new Date(item.duration)
        //console.log(item)
        var newTrack = new Track(player, {
            title: item.title,
            author: item.grandparentTitle,
            url: `${client.config.plexServer}${item.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            thumbnail: `${client.config.plexServer}${item.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            duration: `${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`,
            views: '69',
            playlist: null,
            description: null,
            requestedBy: interaction.user,
            source: 'arbitrary',
            engine: `${client.config.plexServer}${item.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            queryType: QueryType.ARBITRARY
        })

        try {
            let queue = await getQueue(interaction);
            queue.addTrack(newTrack);
        }

        catch (err) {
            return interaction.followUp({ content: `❌ | Ooops... something went wrong, failed to add the track(s) to the queue.`, ephemeral: true })
        }
    }

    await plexQueuePlay(interaction, responseType, itemMetadata, result.MediaContainer.Metadata[0].thumb)
}

async function plexQueuePlay(interaction, responseType, itemMetadata, defaultThumbnail, nextSong) {
    var queue = await getQueue(interaction);

    try {
        if (!queue.connection) await queue.connect(interaction.member.voice.channel);
    }

    catch (err) {
        queue.delete();
        return interaction.followUp({ content: `❌ | Ooops... something went wrong, couldn't join your channel.`, ephemeral: true })
    }

    const coverImage = new AttachmentBuilder(`${client.config.plexServer}${defaultThumbnail}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`, { name: 'coverimage.jpg', description: `${itemMetadata.type == 'playlist' ? "Playlist" : "Song"} Cover Image` })

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

        if (itemMetadata.type == 'playlist') {
            embed.setDescription(`Imported the **${itemMetadata.title} playlist** with **${itemMetadata.leafCount}** songs and started to play the queue!`)
        }

        else {
            embed.setDescription(`Began playing the song **${itemMetadata.title}**!`)
        }

        embed.setTitle(`Started playback ▶️`)
    }

    else {
        if (itemMetadata.type == 'playlist') {
            embed.setDescription(`Imported the **${itemMetadata.title} playlist** with **${itemMetadata.leafCount}** songs!`)
            embed.setTitle(`Added to queue ⏱️`)
        }

        else {
            if (nextSong) {
                embed.setDescription(`Added song **${itemMetadata.title}** to the top of the queue (playing next)!`)
                embed.setTitle(`Added to the top of the queue ⏱️`)
            }

            else {
                embed.setDescription(`Added song **${itemMetadata.title}** to the queue!`)
                embed.setTitle(`Added to queue ⏱️`)
            }
        } 
    }

    if (responseType == 'edit') {
        interaction.message.edit({ embeds: [embed], files: [coverImage], components: [] })
    }

    else {
        interaction.followUp({ embeds: [embed], files: [coverImage] })
    }
}

module.exports = { getQueue, addTracks, queuePlay, plexSearchQuery, plexAddTrack, plexAddPlaylist, plexQueuePlay };