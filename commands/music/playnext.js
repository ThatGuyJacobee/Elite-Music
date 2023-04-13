const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed, Permissions } = require("discord.js");
const { QueryType } = require('discord-player');
const ebmusic = require("../../models/ebmusic.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("playnext")
        .setDescription("Add a song to the top of the queue!")
        .addStringOption((option) => option
            .setName("music")
            .setDescription("Either the name or URL of the song you want to play (no playlists).")
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
        
        const query = interaction.options.getString("music");
        const queue = player.getQueue(interaction.guild);

        if (!queue || !queue.playing) return interaction.reply({ content: `❌ | No music is currently being played!` });
        if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });

        const search = await player.search(query, {
            requestedBy: interaction.user,
            searchEngine: QueryType.AUTO
        });
        if (!search) return await interaction.reply({ content: `❌ | Track **${query}** not found!` });

        queue.insert(search.tracks[0]);
        
        const playsongembed = new MessageEmbed()
        .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
        .setThumbnail(search.tracks[0].thumbnail)
        .setColor(0xFF0000)
        .setTitle(`Added to the top of the queue ⏱️`)
        .setDescription(`Added song **${search.tracks[0].title}** ([Link](${search.tracks[0].url})) to the top of the queue (playing next)!`)
        .setTimestamp()
        .setFooter(`Requested by: ${interaction.user.tag}`)

        interaction.followUp({ embeds: [playsongembed] })
    }
}