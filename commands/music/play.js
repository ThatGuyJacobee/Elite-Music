require("dotenv").config();
const musicFuncs = require('../../utils/sharedFunctions.js')
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
        
        const query = interaction.options.getString("music");
        const player = Player.singleton();
        await musicFuncs.getQueue(interaction);

        try {
            const search = await player.search(query, {
				requestedBy: interaction.user,
				searchEngine: QueryType.AUTO
			})
            
            //console.log(search)
            if (!search || search.tracks.length == 0 || !search.tracks) {
                return interaction.reply({ content: `❌ | Ooops... something went wrong, couldn't find the song with the requested query.`, ephemeral: true })
            }

            //Otherwise it has found so defer reply
            await interaction.deferReply();

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
                        .setValue(`${!result.playlist ? 'song' : 'playlist' }_${result.url}_false`)
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
                .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                interaction.followUp({ embeds: [searchembed], components: [actionmenu] })
            }

            //There is only one search result, play it direct
            else {
                await musicFuncs.addTracks(interaction, 'false', search, 'send')
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
        await musicFuncs.getQueue(interaction);
        var allcomponents = interaction.values;
        var getPlayNext = allcomponents[0].split('_')[2] != null && allcomponents[0].split('_')[2] == "true" ? true : false
        //console.log(allcomponents)
        
        try {
            const search = await player.search(allcomponents[0].split('_')[1], {
				requestedBy: interaction.user,
				searchEngine: QueryType.AUTO
			})

            if (!search || search.tracks.length == 0 || !search.tracks) {
                return interaction.reply({ content: `❌ | Ooops... something went wrong, couldn't find the song.`, ephemeral: true })
            }

            //Defer update from menu interaction
            await interaction.deferUpdate();

            await musicFuncs.addTracks(interaction, getPlayNext, search, 'edit')
        }
        
        catch (err) {
            console.log(err)
            return interaction.followUp({ content: `❌ | Ooops... something went wrong whilst attempting to play the requested song. Please try again.`, ephemeral: true })
        }
    }
})