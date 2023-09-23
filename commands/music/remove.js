require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { Player } = require('discord-player');

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
        const removeamount = interaction.options.getInteger("song");
        if (client.config.enableDjMode) {
            if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
        }

        if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });

        const player = Player.singleton();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });

        const queuedTracks = queue.tracks.toArray()
        if (!queuedTracks[removeamount-1]) return interaction.reply({ content: `❌ | There is no song at the queried position in the queue. Please try again.`, ephemeral: true });
        
        const removeembed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(client.config.embedColour)
        .setTitle(`Song removed ❌`)
        .setDescription(`Removed track ${queuedTracks[removeamount-1].title} ${queuedTracks[removeamount-1].queryType != 'arbitrary' ? `([Link](${queuedTracks[removeamount-1].url}))` : ''} from the queue!`)
        .setTimestamp()
        .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

        try {
            queue.removeTrack(removeamount-1)
            interaction.reply({ embeds: [removeembed] })
        }

        catch (err) {
            interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error removing the song from the queue. Please try again.`, ephemeral: true });
        }
    }
}