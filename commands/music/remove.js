const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed, Permissions } = require("discord.js");
const ebmusic = require("../../models/ebmusic.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remove")
        .setDescription("Remove a specific song from the queue!")
        .addIntegerOption((option) => option
            .setName("song")
            .setDescription("What #no. song should be removed from the queue?")
            .setRequired(true)
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
        
        const removeamount = interaction.options.getInteger("song");
        const queue = player.getQueue(interaction.guild);

        if (!queue || !queue.playing) return interaction.reply({ content: `❌ | No music is currently being played!` });
        if (!interaction.member.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in my voice channel!", ephemeral: true });

        const trackIndex = removeamount - 1;
        const trackName = queue.tracks[trackIndex].title;
        const trackUrl = queue.tracks[trackIndex].url;
        await queue.remove(trackIndex);
        
        const removeembed = new MessageEmbed()
        .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
        .setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(0xFF0000)
        .setTitle(`Song removed ❌`)
        .setDescription(`Removed track ${trackName} ([Link](${trackUrl})) from the queue!`)
        .setTimestamp()
        .setFooter(`Requested by: ${interaction.user.tag}`)

        interaction.reply({ embeds: [removeembed] })
    }
}