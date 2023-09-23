require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, AttachmentBuilder } = require("discord.js");
const { Player, QueryType, Track } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("plex")
        .setDescription("Play a song into the queue!")
        .addSubcommand((subcommand) => subcommand
            .setName("play")
            .setDescription("Play a song from your plex.")
            .addStringOption((option) => option
                .setName("music")
                .setDescription("Name of the song you want to play.")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) => subcommand
            .setName("search")
            .setDescription("Search songs and playlists.")
            .addStringOption((option) => option
                .setName("music")
                .setDescription("Search query for a single song or playlist.")
                .setRequired(true)
            )
        ),
    async execute(interaction) {
        if (interaction.options.getSubcommand() === "play") {
            if (client.config.enableDjMode) {
                if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
            }
    
            if (!client.config.enablePlex) {
                return interaction.reply({ content: `❌ | Plex is currently disabled! Ask the server admin to enable and configure this in the environment file.`, ephemeral: true });
            }
    
            if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
            if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });
            
            const player = Player.singleton();
            const query = interaction.options.getString("music");
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
            
            var queue = player.nodes.get(interaction.guild.id);
    
            const fetch = require('node-fetch');
            try {
                const search = await fetch(`${client.config.plexServer}/hubs/search?X-Plex-Token=${client.config.plexAuthtoken}&query=${query}&limit=10&type=10,15`, {
                    method: 'GET',
                    headers: { accept: 'application/json'}
                })
    
                var searchRes = await search.json()
                var allSongs = searchRes.MediaContainer.Hub.find(type => type.type == 'track')
                //console.log(allSongs.Metadata)
    
                if (!allSongs.Metadata) {
                    return interaction.reply({ content: `❌ | Ooops... something went wrong, couldn't find the song with the requested query.`, ephemeral: true })
                }

                //Otherwise it has found so defer reply
                await interaction.deferReply();

                //If there is more than one search result
                if (allSongs.Metadata.length >= 2) {
                    var foundItems = []
                    let count = 1
                    let emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣','5️⃣', '6️⃣', '7️⃣', '8️⃣','9️⃣', '🔟']
                    //console.log(searchRes)

                    var actionmenu = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                            .setCustomId("plexsearch")
                            .setMinValues(1)
                            .setMaxValues(1)
                            .setPlaceholder('Add an item to queue 👈')
                            //.addOptions(options)
                        )
        
                    var allSongs = searchRes.MediaContainer.Hub.find(type => type.type == 'track')
                    for (var result of allSongs.Metadata) {
                        //console.log(result)
                        let date = new Date(result.duration)
                        foundItems.push({ name: `[${count}] ${result.type.charAt(0).toUpperCase() + result.type.slice(1)} Result (${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()})`, value: `${result.parentTitle} - ${result.grandparentTitle}` })
                        
                        actionmenu.components[0].addOptions(
                            new StringSelectMenuOptionBuilder()
                            .setLabel(`${result.parentTitle} - ${result.grandparentTitle}`)
                            .setValue(`${result.type}_${result.key}`)
                            .setDescription(`Duration - ${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`)
                            .setEmoji(emojis[count-1])
                        )

                        count++
                    }

                    const searchembed = new EmbedBuilder()
                    .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                    .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                    .setTitle(`Plex Search Results 🎵`)
                    .setDescription('Found multiple songs matching the provided search query, select one form the menu below.')
                    .addFields(foundItems)
                    .setColor(client.config.embedColour)
                    .setTimestamp()
                    .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                    interaction.followUp({ embeds: [searchembed], components: [actionmenu] })
                }

                //There is only one search result, play it direct
                else {
                    var songFound = await allSongs.Metadata[0]

                    if (songFound.type == 'playlist') {
                        var playlistID = songFound.ratingKey
                        const search = await fetch(`${client.config.plexServer}/playlists/${playlistID}/items?X-Plex-Token=${client.config.plexAuthtoken}`, {
                            method: 'GET',
                            headers: { accept: 'application/json'}
                        })
            
                        var searchRes = await search.json()

                        for await (var result of searchRes.MediaContainer.Metadata) {
                            let date = new Date(result.duration)
                            //console.log(result)
                            var newTrack = new Track(player, {
                                title: result.title,
                                author: result.grandparentTitle,
                                url: `${client.config.plexServer}${result.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
                                thumbnail: `${client.config.plexServer}${result.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
                                duration: `${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`,
                                views: '69',
                                playlist: null,
                                description: null,
                                requestedBy: interaction.user,
                                source: 'arbitrary',
                                engine: `${client.config.plexServer}${result.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
                                queryType: QueryType.ARBITRARY
                            })
        
                            try {
                                queue.addTrack(newTrack)
                            }
                
                            catch (err) {
                                return interaction.followUp({ content: `❌ | Ooops... something went wrong, failed to add the track(s) to the queue.`, ephemeral: true })
                            }
                        }

                        var coverImage = new AttachmentBuilder(`${client.config.plexServer}${searchRes.MediaContainer.Metadata[0].thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`, { name: 'coverimage.jpg', description: `Song Cover Image for ${searchRes.MediaContainer.Metadata[0].title}` })
                    }

                    else {
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
                            queue.addTrack(newTrack)
                        }
            
                        catch (err) {
                            return interaction.followUp({ content: `❌ | Ooops... something went wrong, failed to add the track(s) to the queue.`, ephemeral: true })
                        }

                        var coverImage = new AttachmentBuilder(`${client.config.plexServer}${songFound.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`, { name: 'coverimage.jpg', description: `Song Cover Image for ${songFound.title}` })
                    }

                    try {
                        if (!queue.connection) await queue.connect(interaction.member.voice.channel);
                    }
        
                    catch (err) {
                        queue.delete();
                        return interaction.followUp({ content: `❌ | Ooops... something went wrong, couldn't join your channel.`, ephemeral: true })
                    }
                    //console.log(songFound.Media[0].Part[0])
                    //console.log(`${client.config.plexServer}${songFound.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`)
        
                    if (!queue.isPlaying()) {
                        try {
                            await queue.node.play(queue.tracks[0]);
                            queue.node.setVolume(client.config.defaultVolume);
                        }
        
                        catch (err) {
                            return interaction.followUp({ content: `❌ | Ooops... something went wrong, there was a playback related error. Please try again.`, ephemeral: true })
                        }
        
                        if (songFound.type == 'playlist') {
                            const playsongembed = new EmbedBuilder()
                            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                            .setThumbnail('attachment://coverimage.jpg')
                            .setColor(client.config.embedColour)
                            .setTitle(`Started playback ▶️`)
                            .setDescription(`Imported the **${searchRes.MediaContainer.title} playlist** with **${searchRes.MediaContainer.size}** songs and started to play the queue!`)
                            .setTimestamp()
                            .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })
            
                            interaction.followUp({ embeds: [playsongembed], files: [coverImage] })
                        }

                        else {
                            const playsongembed = new EmbedBuilder()
                            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                            .setThumbnail('attachment://coverimage.jpg')
                            .setColor(client.config.embedColour)
                            .setTitle(`Started playback ▶️`)
                            .setDescription(`Began playing the song **${newTrack.title}**!`)
                            .setTimestamp()
                            .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })
            
                            interaction.followUp({ embeds: [playsongembed], files: [coverImage] })
                        }
                    }
        
                    else {
                        if (songFound.type == 'playlist') {
                            const queuesongembed = new EmbedBuilder()
                            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                            .setThumbnail('attachment://coverimage.jpg')
                            .setColor(client.config.embedColour)
                            .setTitle(`Added to queue ⏱️`)
                            .setDescription(`Imported the **${searchRes.MediaContainer.title} playlist** with **${searchRes.MediaContainer.size}** songs!`)
                            .setTimestamp()
                            .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })
            
                            interaction.followUp({ embeds: [queuesongembed], files: [coverImage] })
                        }

                        else {
                            const queuesongembed = new EmbedBuilder()
                            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                            .setThumbnail('attachment://coverimage.jpg')
                            .setColor(client.config.embedColour)
                            .setTitle(`Added to queue ⏱️`)
                            .setDescription(`Added song **${newTrack.title}** to the queue!`)
                            .setTimestamp()
                            .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })
            
                            interaction.followUp({ embeds: [queuesongembed], files: [coverImage] })
                        }
                    }
                }
            }
    
            catch (err) {
                console.log(err)
                return interaction.followUp({ content: `❌ | Ooops... something went wrong whilst attempting to play the requested song. Please try again.`, ephemeral: true })
            }
        }

        else if (interaction.options.getSubcommand() === "search") {
            if (process.env.ENABLE_DJMODE == true) {
                if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
            }
    
            if (!client.config.enablePlex) {
                return interaction.reply({ content: `❌ | Plex is currently disabled! Ask the server admin to enable and configure this in the environment file.`, ephemeral: true });
            }
    
            await interaction.deferReply();
            if (!interaction.member.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in a voice channel!", ephemeral: true });
            if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in my voice channel!", ephemeral: true });
            
            const player = Player.singleton();
            const query = interaction.options.getString("music");

            const fetch = require('node-fetch');
            try {
                const search = await fetch(`${client.config.plexServer}/hubs/search?X-Plex-Token=${client.config.plexAuthtoken}&query=${query}&limit=10&type=10,15`, {
                    method: 'GET',
                    headers: { accept: 'application/json'}
                })
                
                var searchRes = await search.json()
                var foundItems = []
                let count = 1
                let emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣','5️⃣', '6️⃣', '7️⃣', '8️⃣','9️⃣', '🔟']
                //console.log(searchRes)

                var actionmenu = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                        .setCustomId("plexsearch")
                        .setMinValues(1)
                        .setMaxValues(1)
                        .setPlaceholder('Add an item to queue 👈')
                        //.addOptions(options)
                    )
    
                var allSongs = searchRes.MediaContainer.Hub.find(type => type.type == 'track')
                for (var result of allSongs.Metadata) {
                    //console.log(result)
                    let date = new Date(result.duration)
                    foundItems.push({ name: `[${count}] ${result.type.charAt(0).toUpperCase() + result.type.slice(1)} Result (${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()})`, value: `${result.parentTitle} - ${result.grandparentTitle}` })
                    
                    actionmenu.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                        .setLabel(`${result.parentTitle} - ${result.grandparentTitle}`)
                        .setValue(`${result.type}_${result.key}`)
                        .setDescription(`Duration - ${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`)
                        .setEmoji(emojis[count-1])
                    )

                    count++
                }

                const searchembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setTitle(`Plex Search Results 🎵`)
                .addFields(foundItems)
                .setColor(client.config.embedColour)
                .setTimestamp()
                .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                interaction.followUp({ embeds: [searchembed], components: [actionmenu] })
            }

            catch (err) {
                console.log(err)
                return interaction.followUp({ content: `❌ | Ooops... something went wrong whilst attempting to play the requested song. Please try again.`, ephemeral: true })
            }
        }
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId == "plexsearch") {
        await interaction.deferReply();

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
        
        var queue = player.nodes.get(interaction.guild.id);
        const fetch = require('node-fetch');
        var allcomponents = interaction.values;
        //console.log(allcomponents)

        for await (option of allcomponents) {
            var getItemType = option.split('_')[0]
            var getItemKey = option.split('_')[1]

            //Playlist
            if (getItemType == 'playlist') {
                const search = await fetch(`${client.config.plexServer}${getItemKey}?X-Plex-Token=${client.config.plexAuthtoken}`, {
                    method: 'GET',
                    headers: { accept: 'application/json'}
                })
    
                var searchRes = await search.json()
                //console.log(searchRes)

                for await (var result of searchRes.MediaContainer.Metadata) {
                    let date = new Date(result.duration)
                    //console.log(result)
                    var newTrack = new Track(player, {
                        title: result.title,
                        author: result.grandparentTitle,
                        url: `${client.config.plexServer}${result.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
                        thumbnail: `${client.config.plexServer}${result.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
                        duration: `${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`,
                        views: '69',
                        playlist: null,
                        description: null,
                        requestedBy: interaction.user,
                        source: 'arbitrary',
                        engine: `${client.config.plexServer}${result.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
                        queryType: QueryType.ARBITRARY
                    })

                    try {
                        queue.addTrack(newTrack)
                       
                    }
        
                    catch (err) {
                        return interaction.followUp({ content: `❌ | Ooops... something went wrong, failed to add the track(s) to the queue.`, ephemeral: true })
                    }
                }
                
                var coverImage = new AttachmentBuilder(`${client.config.plexServer}${searchRes.MediaContainer.Metadata[0].thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`, { name: 'coverimage.jpg', description: `Song Cover Image for ${searchRes.MediaContainer.Metadata[0].title}` })
            }

            //Single song
            else {
                const search = await fetch(`${client.config.plexServer}${getItemKey}?X-Plex-Token=${client.config.plexAuthtoken}`, {
                    method: 'GET',
                    headers: { accept: 'application/json'}
                })
    
                var searchRes = await search.json()
                //console.log(searchRes)

                var songFound = await searchRes.MediaContainer.Metadata[0]
                let date = new Date(songFound.duration)
                const newTrack = new Track(player, {
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
                    queue.addTrack(newTrack)
                }
    
                catch (err) {
                    return interaction.followUp({ content: `❌ | Ooops... something went wrong, failed to add the track(s) to the queue.`, ephemeral: true })
                }

                var coverImage = new AttachmentBuilder(`${client.config.plexServer}${songFound.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`, { name: 'coverimage.jpg', description: `Song Cover Image for ${songFound.title}` })
            }

            try {
                if (!queue.connection) await queue.connect(interaction.member.voice.channel);
            }

            catch (err) {
                queue.delete();
                return interaction.followUp({ content: `❌ | Ooops... something went wrong, couldn't join your channel.`, ephemeral: true })
            }
        }

        if (!queue.isPlaying()) {
            try {
                await queue.node.play(queue.tracks[0]);
                queue.node.setVolume(client.config.defaultVolume);
            }

            catch (err) {
                return interaction.followUp({ content: `❌ | Ooops... something went wrong, there was a playback related error. Please try again.`, ephemeral: true })
            }

            if (getItemType == 'playlist') {
                const playsongembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail('attachment://coverimage.jpg')
                .setColor(client.config.embedColour)
                .setTitle(`Started playback ▶️`)
                .setDescription(`Imported the **${searchRes.MediaContainer.title} playlist** with **${searchRes.MediaContainer.size}** songs and started to play the queue!`)
                .setTimestamp()
                .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                var sourceMessage = interaction.message
                sourceMessage.edit({embeds: sourceMessage.embeds, components: []})
                interaction.followUp({ embeds: [playsongembed], files: [coverImage] })
            }

            else {
                const playsongembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail('attachment://coverimage.jpg')
                .setColor(client.config.embedColour)
                .setTitle(`Started playback ▶️`)
                .setDescription(`Began playing the song **${songFound.title}**!`)
                .setTimestamp()
                .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                var sourceMessage = interaction.message
                sourceMessage.edit({embeds: sourceMessage.embeds, components: []})
                interaction.followUp({ embeds: [playsongembed], files: [coverImage] })
            }
        }

        else {
            if (getItemType == 'playlist') {
                const playsongembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail('attachment://coverimage.jpg')
                .setColor(client.config.embedColour)
                .setTitle(`Added to queue ⏱️`)
                .setDescription(`Imported the **${searchRes.MediaContainer.title} playlist** with **${searchRes.MediaContainer.size}** songs!`)
                .setTimestamp()
                .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                var sourceMessage = interaction.message
                sourceMessage.edit({embeds: sourceMessage.embeds, components: []})
                interaction.followUp({ embeds: [playsongembed], files: [coverImage] })
            }

            else {
                const playsongembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail('attachment://coverimage.jpg')
                .setColor(client.config.embedColour)
                .setTitle(`Added to queue ⏱️`)
                .setDescription(`Added song **${songFound.title}** to the queue!`)
                .setTimestamp()
                .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                var sourceMessage = interaction.message
                sourceMessage.edit({embeds: sourceMessage.embeds, components: []})
                interaction.followUp({ embeds: [playsongembed], files: [coverImage] })
            }
        }
    }
})