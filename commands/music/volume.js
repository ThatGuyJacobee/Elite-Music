require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { Player } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("volume")
        .setDescription("Check or set the current music volume!")
        .addIntegerOption((option) => option
            .setName("amount")
            .setDescription("What do you want to set the volume as (0-100)?")
            .setRequired(false)
        ),
    async execute(interaction) {
        const vol = interaction.options.getInteger("amount");
        if (client.config.enableDjMode) {
            if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
        }

        if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        
        const player = Player.singleton();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });
    
        if (vol == null) return interaction.reply({ content: `🔊 | The current volume is set to **${queue.node.volume}%**!`, ephemeral: true })
        if (vol > 100 || vol < 0) return interaction.reply({ content: `❌ | The volume must be set between 0-100%!`, ephemeral: true })
        
        const volumeembed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(client.config.embedColour)
        .setTitle(`Volume adjusted 🎧`)
        .setDescription(`The volume has been set to **${vol}%**!`)
        .setTimestamp()
        .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

        try {
            queue.node.setVolume(vol);
            interaction.reply({ embeds: [volumeembed] })
        }

        catch (err) {
            interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error adjusting the volume. Please try again.`, ephemeral: true });
        }
    }
}