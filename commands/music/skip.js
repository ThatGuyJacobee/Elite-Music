require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { Player } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Skip the current song!"),
    async execute(interaction) {
        if (client.config.enableDjMode) {
            if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
        }
        
        if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        
        const player = Player.singleton();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });

        const queuedTracks = queue.tracks.toArray();
        if (!queuedTracks[0]) return interaction.reply({ content: `❌ | There is no music is currently in the queue!`, ephemeral: true });

        var coverImage = new AttachmentBuilder(queuedTracks[0].thumbnail, { name: 'coverimage.jpg', description: `Song Cover Image for ${queuedTracks[0].title}` })
        const skipembed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail('attachment://coverimage.jpg')
        .setColor(client.config.embedColour)
        .setTitle(`Song skipped ⏭️`)
        .setDescription(`Now playing: ${queuedTracks[0].title} ${queuedTracks[0].queryType != 'arbitrary' ? `([Link](${queuedTracks[0].url}))` : ''}`)
        .setTimestamp()
        .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

        try {
            queue.node.skip();
            interaction.reply({ embeds: [skipembed], files: [coverImage] });
        }

        catch (err) {
            interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error skipping the song. Please try again.`, ephemeral: true });
        }
    }
}