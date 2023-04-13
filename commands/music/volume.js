const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed, Permissions } = require("discord.js");
const ebmusic = require("../../models/ebmusic.js");

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
        const guildid = interaction.guild.id;
        const DJCheck = await ebmusic.findOne({
            where: {
                GuildID: guildid
            }
        });

        if (DJCheck) {
            if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
        }
        
        const vol = interaction.options.getInteger("amount");
        const queue = player.getQueue(interaction.guild);

        if (!queue || !queue.playing) return interaction.reply({ content: `❌ | No music is currently being played!` });
        if (!interaction.member.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        if (vol == null) return interaction.reply({ content: `🔊 | The current volume is set to **${queue.volume}%**!` })
        if (vol > 100 || vol < 0) return interaction.reply({ content: `❌ | The volume must be set between 0-100%!` })
        queue.setVolume(vol);

        const volumeembed = new MessageEmbed()
        .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
        .setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(0xFF0000)
        .setTitle(`Volume changed 🎧`)
        .setDescription(`The volume has been set to **${vol}%**!`)
        .setTimestamp()
        .setFooter(`Requested by: ${interaction.user.tag}`)

        interaction.reply({ embeds: [volumeembed] })
    }
}