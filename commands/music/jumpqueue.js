require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { Player } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("jumpqueue")
        .setDescription("Jump to a specific song in the queue!")
        .addIntegerOption((option) => option
            .setName("song")
            .setDescription("What #no. song should be moved to the front of the queue (use /queue to check)?")
            .setRequired(true)
        ),
    async execute(interaction) {
        if (client.config.enableDjMode) {
            if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
        }

        if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });

        const player = Player.singleton();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });

        const queuedTracks = queue.tracks.toArray()
        var skipAmount = interaction.options.getInteger("song");
        var trackIndex = skipAmount - 1;

        const jumpembed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(client.config.embedColour)
        .setTitle(`Jumped to song ⏭️`)
        .setDescription(`Now playing: ${queuedTracks[trackIndex].title} ${queuedTracks[trackIndex].queryType != 'arbitrary' ? `([Link](${queuedTracks[trackIndex].url}))` : ''}!`)
        .setTimestamp()
        .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

        try {
            queue.node.jump(trackIndex);
            interaction.reply({ embeds: [jumpembed] })
        }

        catch (err) {
            console.log(err)
            interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error jumping queue. Please try again.`, ephemeral: true });
        }
    }
}