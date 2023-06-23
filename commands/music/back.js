require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { Player, QueryType } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("back")
        .setDescription("Play the previous song!"),
    async execute(interaction) {
        if (process.env.ENABLE_DJMODE == true) {
            if (!interaction.member.roles.cache.has(process.env.DJ_ROLE)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${process.env.DJ_ROLE}> to use any music commands!`, ephemeral: true });
        }
        
        if (!interaction.member.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in my voice channel!", ephemeral: true });

        const player = Player.singleton();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });
        
        const previousTracks = queue.history.tracks.toArray();
        if (!previousTracks[0]) return interaction.reply({ content: `❌ | There is no music history prior to the current song. Please try again.`, ephemeral: true });

        const backembed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(process.env.EMBED_COLOUR)
        .setTitle(`Playing previous song ⏮️`)
        .setDescription(`Returning next to the previous song ${previousTracks[0].title} ([Link](${previousTracks[0].url}))!`)
        .setTimestamp()
        .setFooter({ text: `Requested by: ${interaction.user.tag}` })

        try {
            queue.history.back();
            interaction.reply({ embeds: [backembed] })
        }

        catch (err) {
            interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error returning to the previous song. Please try again.`, ephemeral: true });
        }
    }
}