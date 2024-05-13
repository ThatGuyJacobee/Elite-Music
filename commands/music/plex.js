require("dotenv").config();
const musicFuncs = require('../../utils/sharedFunctions.js')
const { SlashCommandBuilder } = require("@discordjs/builders");
const { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");

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
        )
        .addSubcommand((subcommand) => subcommand
            .setName("playnext")
            .setDescription("Add a song from your plex to the top of the queue.")
            .addStringOption((option) => option
                .setName("music")
                .setDescription("Search query for a single song or playlist.")
                .setRequired(true)
            )
        ),
    async execute(interaction) {
        if (interaction.options.getSubcommand() === "play" || interaction.options.getSubcommand() === "playnext") {
            if (client.config.enableDjMode) {
                if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
            }
    
            if (!client.config.enablePlex) {
                return interaction.reply({ content: `❌ | Plex is currently disabled! Ask the server admin to enable and configure this in the environment file.`, ephemeral: true });
            }
    
            if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
            if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });
            
            const query = interaction.options.getString("music");
            await musicFuncs.getQueue(interaction);
    
            try {
                var results = await musicFuncs.plexSearchQuery(query);
                if (!results.songs && !results.playlists) {
                    return interaction.reply({ content: `❌ | Ooops... something went wrong, couldn't find the song or playlist with the requested query.`, ephemeral: true })
                }

                //Otherwise something is found so defer reply
                await interaction.deferReply();

                //More than one search result, show menu
                if (results.size >= 2) {
                    var embedFields = []
                    let count = 1
                    let emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣','5️⃣', '6️⃣', '7️⃣', '8️⃣','9️⃣', '🔟']

                    var actionmenu = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                            .setCustomId("plexsearch")
                            .setMinValues(1)
                            .setMaxValues(1)
                            .setPlaceholder('Add an item to queue 👈')
                        )
    
                    if (results.songs) {
                        for (let item of results.songs) {
                            //console.log(item)
                            let date = new Date(item.duration)
                            embedFields.push({ name: `[${count}] ${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Result (${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()})`, value: `${item.parentTitle} - ${item.grandparentTitle}` })
                            
                            actionmenu.components[0].addOptions(
                                new StringSelectMenuOptionBuilder()
                                .setLabel(`${item.parentTitle} - ${item.grandparentTitle}`)
                                .setValue(`${item.type}_${item.key}_${interaction.options.getSubcommand() == "playnext" ? "true" : "false"}`)
                                .setDescription(`Duration - ${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`)
                                .setEmoji(emojis[count-1])
                            )
                            count++
                        }
                    }
    
                    if (results.playlists && interaction.options.getSubcommand() != "playnext") {
                        for (var item of results.playlists) {
                            //console.log(item)
                            let date = new Date(item.duration)
                            embedFields.push({ name: `[${count}] ${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Result (${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()})`, value: `${item.title}` })
                            
                            actionmenu.components[0].addOptions(
                                new StringSelectMenuOptionBuilder()
                                .setLabel(`${item.title}`)
                                .setValue(`${item.type}_${item.key}_${interaction.options.getSubcommand() == "playnext" ? "true" : "false"}`)
                                .setDescription(`Duration - ${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`)
                                .setEmoji(emojis[count-1])
                            )
                            count++
                        }
                    }

                    const searchembed = new EmbedBuilder()
                    .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                    .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                    .setTitle(`Plex Search Results 🎵`)
                    .setDescription('Found multiple songs matching the provided search query, select one form the menu below.')
                    .addFields(embedFields)
                    .setColor(client.config.embedColour)
                    .setTimestamp()
                    .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })
                    
                    interaction.followUp({ embeds: [searchembed], components: [actionmenu] })
                }

                //There is only one search result, play it direct
                else {
                    var itemFound = await (results.songs ? results.songs[0] : null) || (results.playlists ? results.playlists[0] : null)
                    //console.log(itemFound)
                    
                    if (itemFound.type == 'playlist') {
                        await musicFuncs.plexAddPlaylist(interaction, itemFound, 'send')
                    }

                    else {
                        await musicFuncs.plexAddTrack(interaction, interaction.options.getSubcommand() == "playnext" ? true : false, itemFound, 'send')
                    }
                }
            }
    
            catch (err) {
                console.log(err)
                return interaction.followUp({ content: `❌ | Ooops... something went wrong whilst attempting to play the requested song. Please try again.`, ephemeral: true })
            }
        }

        else if (interaction.options.getSubcommand() === "search") {
            if (client.config.enableDjMode) {
                if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
            }
    
            if (!client.config.enablePlex) {
                return interaction.reply({ content: `❌ | Plex is currently disabled! Ask the server admin to enable and configure this in the environment file.`, ephemeral: true });
            }
    
            if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
            if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });
            
            const query = interaction.options.getString("music");
            await musicFuncs.getQueue(interaction);

            try {
                var results = await musicFuncs.plexSearchQuery(query);
                if (!results.songs && !results.playlists) {
                    return interaction.reply({ content: `❌ | Ooops... something went wrong, couldn't find the song or playlist with the requested query.`, ephemeral: true })
                }

                //Otherwise something is found so defer reply
                await interaction.deferReply();
                
                var embedFields = []
                let count = 1
                let emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣','5️⃣', '6️⃣', '7️⃣', '8️⃣','9️⃣', '🔟']

                var actionmenu = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                        .setCustomId("plexsearch")
                        .setMinValues(1)
                        .setMaxValues(1)
                        .setPlaceholder('Add an item to queue 👈')
                    )
    
                if (results.songs) {
                    for (let item of results.songs) {
                        //console.log(item)
                        let date = new Date(item.duration)
                        embedFields.push({ name: `[${count}] ${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Result (${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()})`, value: `${item.parentTitle} - ${item.grandparentTitle}` })
                        
                        actionmenu.components[0].addOptions(
                            new StringSelectMenuOptionBuilder()
                            .setLabel(`${item.parentTitle} - ${item.grandparentTitle}`)
                            .setValue(`${item.type}_${item.key}`)
                            .setDescription(`Duration - ${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`)
                            .setEmoji(emojis[count-1])
                        )
                        count++
                    }
                }

                if (results.playlists) {
                    for (var item of results.playlists) {
                        //console.log(item)
                        let date = new Date(item.duration)
                        embedFields.push({ name: `[${count}] ${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Result (${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()})`, value: `${item.title}` })
                        
                        actionmenu.components[0].addOptions(
                            new StringSelectMenuOptionBuilder()
                            .setLabel(`${item.title}`)
                            .setValue(`${item.type}_${item.key}`)
                            .setDescription(`Duration - ${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`)
                            .setEmoji(emojis[count-1])
                        )
                        count++
                    }
                }

                const searchembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setTitle(`Plex Search Results 🎵`)
                .addFields(embedFields)
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
        await musicFuncs.getQueue(interaction);
        var allcomponents = interaction.values;
        //console.log(allcomponents)

        for await (option of allcomponents) {
            var getItemType = option.split('_')[0]
            var getItemKey = option.split('_')[1]
            var getPlayNext = option.split('_')[2] != null && option.split('_')[2] == "true" ? true : false

            var request = await fetch(`${client.config.plexServer}${getItemKey}?X-Plex-Token=${client.config.plexAuthtoken}`, {
                method: 'GET',
                headers: { accept: 'application/json'}
            })

            var result = await request.json()

            //Defer update from menu interaction
            await interaction.deferUpdate();

            //Playlist
            if (getItemType == 'playlist') {
                result.MediaContainer.type = getItemType;
                await musicFuncs.plexAddPlaylist(interaction, result.MediaContainer, 'edit')
            }

            //Single song
            else {
                await musicFuncs.plexAddTrack(interaction, getPlayNext, result.MediaContainer.Metadata[0], 'edit')
            }
        }
    }
})