require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { Player, QueryType } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pause")
        .setDescription("Pause the current song at the current time!"),
    async execute(interaction) {
        if (process.env.ENABLE_DJMODE == true) {
            if (!interaction.member.roles.cache.has(process.env.DJ_ROLE)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${process.env.DJ_ROLE}> to use any music commands!`, ephemeral: true });
        }

        if (!interaction.member.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        
        const player = Player.singleton();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });
        var checkPause = queue.node.isPaused();
    
        const pauseembed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail(queue.currentTrack.thumbnail)
        .setColor(process.env.EMBED_COLOUR)
        .setTitle(`Song paused ⏸️`)
        .setDescription(`Playback has been **${checkPause ? 'resumed' : 'paused'}**. Currently playing ${queue.currentTrack.title} ([Link](${queue.currentTrack.url}))!`)
        .setTimestamp()
        .setFooter({ text: `Requested by: ${interaction.user.tag}` })

        try {
            queue.node.setPaused(!queue.node.isPaused());
            interaction.reply({ embeds: [pauseembed] })
        }

        catch (err) {
            interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error ${checkPause ? 'resuming' : 'pausing'} the song. Please try again.`, ephemeral: true });
        }
    }
}