require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { Player, QueryType } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Stops any music playing!"),
    async execute(interaction) {
        if (process.env.ENABLE_DJMODE == true) {
            if (!interaction.member.roles.cache.has(process.env.DJ_ROLE)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${process.env.DJ_ROLE}> to use any music commands!`, ephemeral: true });
        }

        if (!interaction.member.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        
        const player = Player.singleton();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });
        
        const stopembed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(process.env.EMBED_COLOUR)
        .setTitle(`Stopped music 🛑`)
        .setDescription(`Music has been stopped... leaving the channel!`)
        .setTimestamp()
        .setFooter({ text: `Requested by: ${interaction.user.tag}` })

        try {
            queue.delete();
            interaction.reply({ embeds: [stopembed] })
        }

        catch (err) {
            interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error stopping the queue. Please try again.`, ephemeral: true });
        }
    }
}