require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");
const { Player, QueryType } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Place a song into the queue!")
        .addStringOption((option) => option
            .setName("music")
            .setDescription("Either the name, URL or playlist URL you want to play.")
            .setRequired(true)
        ),
    async execute(interaction) {
        if (client.config.enableDjMode) {
            if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
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

        try {
            const search = await player.search(query, {
				requestedBy: interaction.user,
				searchEngine: QueryType.AUTO
			})

            if (!search || search.tracks.length == 0 || !search.tracks) {
                return interaction.reply({ content: `❌ | Ooops... something went wrong, couldn't find the song with the requested query.`, ephemeral: true })
            }

            //Otherwise it has found so defer reply
            await interaction.deferReply();
            //console.log(search)

            //If there is more than one search result
            if (search.tracks.length >= 2 && !search.playlist) {
                var foundItems = []
                let count = 1
                let emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣','5️⃣', '6️⃣', '7️⃣', '8️⃣','9️⃣', '🔟']

                var actionmenu = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                        .setCustomId("playsearch")
                        .setMinValues(1)
                        .setMaxValues(1)
                        .setPlaceholder('Add an item to queue 👈')
                        //.addOptions(options)
                    )
    
                for (var result of search.tracks) {
                    if (count > 10) break
                    foundItems.push({ name: `[${count}] ${!result.playlist ? 'Song' : 'Playlist' } Result (${result.duration})`, value: `${result.description}` })
                    
                    actionmenu.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                        .setLabel(result.title)
                        .setValue(`${!result.playlist ? 'song' : 'playlist' }_${result.url}`)
                        .setDescription(`Duration - ${result.duration}`)
                        .setEmoji(emojis[count-1])
                    )

                    count++
                }

                const searchembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setTitle(`Music Search Results 🎵`)
                .setDescription('Found multiple songs matching the provided search query, select one form the menu below.')
                .addFields(foundItems)
                .setColor(client.config.embedColour)
                .setTimestamp()
                .setFooter({ text: `Requested by: ${interaction.user.tag}` })

                interaction.followUp({ embeds: [searchembed], components: [actionmenu] })
            }

            //There is only one search result, play it direct
            else {
                try {
                    if (!queue.connection) await queue.connect(interaction.member.voice.channel);
                }

                catch (err) {
                    queue.delete();
                    return interaction.followUp({ content: `❌ | Ooops... something went wrong, couldn't join your channel.`, ephemeral: true })
                }

                try {
                    search.playlist ? queue.addTrack(search.tracks) : queue.addTrack(search.tracks[0])
                }

                catch (err) {
                    return interaction.followUp({ content: `❌ | Ooops... something went wrong, failed to add the track(s) to the queue.`, ephemeral: true })
                }

                if (!queue.isPlaying()) {
                    try {
                        await queue.node.play(queue.tracks[0]);
                        queue.node.setVolume(client.config.defaultVolume);
                    }

                    catch (err) {
                        return interaction.followUp({ content: `❌ | Ooops... something went wrong, there was a playback related error. Please try again.`, ephemeral: true })
                    }

                    if (search.playlist) {
                        const playlistembed = new EmbedBuilder()
                        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                        .setThumbnail(search.tracks[0].thumbnail)
                        .setColor(client.config.embedColour)
                        .setTitle(`Started playback ▶️`)
                        .setDescription(`Imported the **${search.tracks[0].playlist.title} ([Link](${search.tracks[0].playlist.url})) playlist** with **${search.tracks.length}** songs and started to play the queue!`)
                        .setTimestamp()
                        .setFooter({ text: `Requested by: ${interaction.user.tag}` })

                        interaction.followUp({ embeds: [playlistembed] })
                    }

                    else {
                        const playsongembed = new EmbedBuilder()
                        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                        .setThumbnail(search.tracks[0].thumbnail)
                        .setColor(client.config.embedColour)
                        .setTitle(`Started playback ▶️`)
                        .setDescription(`Began playing the song **${search.tracks[0].title}** ${search.tracks[0].queryType != 'arbitrary' ? `([Link](${search.tracks[0].url}))` : ''}!`)
                        .setTimestamp()
                        .setFooter({ text: `Requested by: ${interaction.user.tag}` })

                        interaction.followUp({ embeds: [playsongembed] })
                    }
                }

                else {
                    if (search.playlist) {
                        const queueplaylistembed = new EmbedBuilder()
                        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                        .setThumbnail(search.tracks[0].thumbnail)
                        .setColor(client.config.embedColour)
                        .setTitle(`Added to queue ⏱️`)
                        .setDescription(`Imported the **${search.tracks[0].playlist.title} ([Link](${search.tracks[0].playlist.url})) playlist** with **${search.tracks.length}** songs!`)
                        .setTimestamp()
                        .setFooter({ text: `Requested by: ${interaction.user.tag}` })
        
                        interaction.followUp({ embeds: [queueplaylistembed] })
                    }

                    else {
                        const queuesongembed = new EmbedBuilder()
                        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                        .setThumbnail(search.tracks[0].thumbnail)
                        .setColor(client.config.embedColour)
                        .setTitle(`Added to queue ⏱️`)
                        .setDescription(`Began playing the song **${search.tracks[0].title}** ${search.tracks[0].queryType != 'arbitrary' ? `([Link](${search.tracks[0].url}))` : ''}!`)
                        .setTimestamp()
                        .setFooter({ text: `Requested by: ${interaction.user.tag}` })

                        interaction.followUp({ embeds: [queuesongembed] })
                    }
                }
            }
        }

        catch (err) {
            console.log(err)
            return interaction.followUp({ content: `❌ | Ooops... something went wrong whilst attempting to play the requested song. Please try again.`, ephemeral: true })
        }
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId == "playsearch") {
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
        var allcomponents = interaction.values;
        
        try {
            const search = await player.search(allcomponents[0].split('_')[1], {
				requestedBy: interaction.user,
				searchEngine: QueryType.AUTO
			})

            if (!search || search.tracks.length == 0 || !search.tracks) {
                return interaction.reply({ content: `❌ | Ooops... something went wrong, couldn't find the song.`, ephemeral: true })
            }

            //Otherwise it has found so defer reply
            await interaction.deferReply();

            try {
                if (!queue.connection) await queue.connect(interaction.member.voice.channel);
            }

            catch (err) {
                queue.delete();
                return interaction.followUp({ content: `❌ | Ooops... something went wrong, couldn't join your channel.`, ephemeral: true })
            }

            try {
                search.playlist ? queue.addTrack(search.tracks) : queue.addTrack(search.tracks[0])
            }

            catch (err) {
                return interaction.followUp({ content: `❌ | Ooops... something went wrong, failed to add the track(s) to the queue.`, ephemeral: true })
            }

            if (!queue.isPlaying()) {
                try {
                    await queue.node.play(queue.tracks[0]);
                    queue.node.setVolume(client.config.defaultVolume);
                }

                catch (err) {
                    return interaction.followUp({ content: `❌ | Ooops... something went wrong, there was a playback related error. Please try again.`, ephemeral: true })
                }

                if (search.playlist) {
                    const playlistembed = new EmbedBuilder()
                    .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                    .setThumbnail(search.tracks[0].thumbnail)
                    .setColor(client.config.embedColour)
                    .setTitle(`Started playback ▶️`)
                    .setDescription(`Imported the **${search.tracks[0].playlist.title} ([Link](${search.tracks[0].playlist.url})) playlist** with **${search.tracks.length}** songs and started to play the queue!`)
                    .setTimestamp()
                    .setFooter({ text: `Requested by: ${interaction.user.tag}` })

                    var sourceMessage = interaction.message
                    sourceMessage.edit({embeds: sourceMessage.embeds, components: []})
                    interaction.followUp({ embeds: [playlistembed] })
                }

                else {
                    const playsongembed = new EmbedBuilder()
                    .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                    .setThumbnail(search.tracks[0].thumbnail)
                    .setColor(client.config.embedColour)
                    .setTitle(`Started playback ▶️`)
                    .setDescription(`Began playing the song **${search.tracks[0].title}** ${search.tracks[0].queryType != 'arbitrary' ? `([Link](${search.tracks[0].url}))` : ''}!`)
                    .setTimestamp()
                    .setFooter({ text: `Requested by: ${interaction.user.tag}` })

                    var sourceMessage = interaction.message
                    sourceMessage.edit({embeds: sourceMessage.embeds, components: []})
                    interaction.followUp({ embeds: [playsongembed] })
                }
            }

            else {
                if (search.playlist) {
                    const queueplaylistembed = new EmbedBuilder()
                    .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                    .setThumbnail(search.tracks[0].thumbnail)
                    .setColor(client.config.embedColour)
                    .setTitle(`Added to queue ⏱️`)
                    .setDescription(`Imported the **${search.tracks[0].playlist.title} ([Link](${search.tracks[0].playlist.url})) playlist** with **${search.tracks.length}** songs!`)
                    .setTimestamp()
                    .setFooter({ text: `Requested by: ${interaction.user.tag}` })
    
                    var sourceMessage = interaction.message
                    sourceMessage.edit({embeds: sourceMessage.embeds, components: []})
                    interaction.followUp({ embeds: [queueplaylistembed] })
                }

                else {
                    const queuesongembed = new EmbedBuilder()
                    .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                    .setThumbnail(search.tracks[0].thumbnail)
                    .setColor(client.config.embedColour)
                    .setTitle(`Added to queue ⏱️`)
                    .setDescription(`Began playing the song **${search.tracks[0].title}** ${search.tracks[0].queryType != 'arbitrary' ? `([Link](${search.tracks[0].url}))` : ''}!`)
                    .setTimestamp()
                    .setFooter({ text: `Requested by: ${interaction.user.tag}` })

                    var sourceMessage = interaction.message
                    sourceMessage.edit({embeds: sourceMessage.embeds, components: []})
                    interaction.followUp({ embeds: [queuesongembed] })
                }
            }
        }
        
        catch (err) {
            console.log(err)
            return interaction.followUp({ content: `❌ | Ooops... something went wrong whilst attempting to play the requested song. Please try again.`, ephemeral: true })
        }
    }
})