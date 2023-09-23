require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { Player, QueueRepeatMode } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("loop")
        .setDescription("Set the loop type!")
        .addIntegerOption((option) => option
            .setName("loopmode")
            .setDescription("What loop mode do you want to activate?")
            .setRequired(true)
            .addChoices(
                {
                    name: "Off",
                    value: QueueRepeatMode.OFF
                },
                {
                    name: "Track",
                    value: QueueRepeatMode.TRACK
                },
                {
                    name: "Queue",
                    value: QueueRepeatMode.QUEUE
                },
                {
                    name: "Autoplay",
                    value: QueueRepeatMode.AUTOPLAY
                }
            )
        ),
    async execute(interaction) {
        const loopmode = interaction.options.getInteger("loopmode");
        if (client.config.enableDjMode) {
            if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
        }

        if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        
        const player = Player.singleton();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });

        const mode = loopmode === QueueRepeatMode.TRACK ? 'Loop mode on 🔂' : loopmode === QueueRepeatMode.QUEUE ? 'Loop mode on 🔁' : loopmode === QueueRepeatMode.AUTOPLAY ? 'Loop mode on 🤖' : 'Loop mode off 📴';
        const modename = loopmode === QueueRepeatMode.TRACK ? 'the **current track**' : loopmode === QueueRepeatMode.QUEUE ? 'the **entire queue**' : loopmode === QueueRepeatMode.AUTOPLAY ? '**autoplay music**' : '**off**';

        const loopembed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(client.config.embedColour)
        .setTitle(mode)
        .setDescription(`The loop mode has been set to ${modename}!`)
        .setTimestamp()
        .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

        try {
            queue.setRepeatMode(loopmode);
            interaction.reply({ embeds: [loopembed] })
        }

        catch (err) {
            interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error switching loop mode. Please try again.`, ephemeral: true });
        }
    }
}