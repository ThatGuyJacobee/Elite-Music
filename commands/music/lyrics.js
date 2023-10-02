require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const { Player } = require('discord-player');
const { lyricsExtractor } = require("@discord-player/extractor");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lyrics")
        .setDescription("Get the lyrics for a song!")
        .addStringOption((option) => option
            .setName("query")
            .setDescription("Enter the name of the song.")
            .setRequired(true)
        ),
    async execute(interaction) {
        if (client.config.enableDjMode) {
            if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
        }

        var query = interaction.options.getString("query");
        const extractor = lyricsExtractor();
        
        var findLyrics = await extractor.search(query)
        .catch(err => {})

        if (!findLyrics) return interaction.reply({ content: `❌ | No lyrics were found for the requested query!`, ephemeral: true });
        let splicedLyrics = findLyrics.lyrics.slice(0, 4000)

        const lyricsembed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        //.setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(client.config.embedColour)
        .setTitle(`Lyrics for ${findLyrics.title} by ${findLyrics.artist.name} 🎶`)
        .setDescription(findLyrics.lyrics.length > 4000 ? splicedLyrics + '\nAnd more...' : findLyrics.lyrics)
        .setTimestamp()
        .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

        var actionbuttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setCustomId("np-delete")
            .setStyle(4)
            .setLabel("🗑️"),
            //.addOptions(options)
            new ButtonBuilder()
            .setURL(findLyrics.url)
            .setStyle(5) //Link
            .setLabel("🎶 Full Lyrics"),
            //.addOptions(options)
        )

        interaction.reply({ embeds: [lyricsembed], components: [actionbuttons] })
    }
}