const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed, Permissions } = require("discord.js");
const { QueueRepeatMode } = require('discord-player');
const ebmusic = require("../../models/ebmusic.js");

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
        const guildid = interaction.guild.id;
        const DJCheck = await ebmusic.findOne({
            where: {
                GuildID: guildid
            }
        });

        if (DJCheck) {
            if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
        }

        const queue = player.getQueue(interaction.guild);

        if (!queue || !queue.playing) return interaction.reply({ content: `❌ | No music is currently being played!` });
        if (!interaction.member.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        const loopmode = interaction.options.getInteger("loopmode");
        queue.setRepeatMode(loopmode);

        const mode = loopmode === QueueRepeatMode.TRACK ? 'Loop mode on 🔂' : loopmode === QueueRepeatMode.QUEUE ? 'Loop mode on 🔁' : loopmode === QueueRepeatMode.AUTOPLAY ? 'Loop mode on 🤖' : 'Loop mode off 📴';
        const modename = loopmode === QueueRepeatMode.TRACK ? 'the **current track**' : loopmode === QueueRepeatMode.QUEUE ? 'the **entire queue**' : loopmode === QueueRepeatMode.AUTOPLAY ? '**autoplay music**' : '**off**';

        const loopembed = new MessageEmbed()
        .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
        .setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(0xFF0000)
        .setTitle(mode)
        .setDescription(`The loop mode has been set to ${modename}!`)
        .setTimestamp()
        .setFooter(`Requested by: ${interaction.user.tag}`)

        interaction.reply({ embeds: [loopembed] })
    }
}