const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, AttachmentBuilder } = require("discord.js");
const { useMainPlayer } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("nowplaying")
        .setDescription("Check the currently playing song!"),
    async execute(interaction) {
        if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        
        const player = useMainPlayer() ;
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });
        
        const progress = queue.node.createProgressBar({
            indicator: '🔘',
            leftChar: '▬',
            rightChar: '▬',
            length: 20
        });
        const createBar = progress.replace(/ 0:00/g, ' ◉ LIVE');

        // Get queue info
        const queueSize = queue.tracks.size;
        const loopMode = queue.repeatMode === 1 ? 'Track' : queue.repeatMode === 2 ? 'Queue' : 'Normal';
        const pauseStatus = queue.node.isPaused() ? 'Paused' : 'Playing';

        var coverImage = new AttachmentBuilder(queue.currentTrack.thumbnail, { name: 'coverimage.jpg', description: `Song Cover Image for ${queue.currentTrack.title}` });
        
        const npembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail('attachment://coverimage.jpg')
            .setColor(client.config.embedColour)
            .setTitle(`🎵 Now Playing`)
            .setDescription(`**${queue.currentTrack.title}**${queue.currentTrack.queryType != 'arbitrary' ? ` ([Link](${queue.currentTrack.url}))` : ''}`)
            .addFields(
                { name: '🎤 Artist', value: queue.currentTrack.author || 'Unknown', inline: true },
                { name: '⏱️ Duration', value: queue.currentTrack.duration || 'Unknown', inline: true },
                { name: '📊 Status', value: pauseStatus, inline: true },
                { name: '🔊 Volume', value: `${queue.node.volume}%`, inline: true },
                { name: '🔄 Loop Mode', value: loopMode, inline: true },
                { name: '📑 Queue', value: `${queueSize} song${queueSize !== 1 ? 's' : ''}`, inline: true },
                { name: '⏳ Progress', value: createBar, inline: false }
            )
            .setTimestamp();

        if (queue.currentTrack.requestedBy != null) {
            npembed.setFooter({ text: `Requested by: ${queue.currentTrack.requestedBy.discriminator != 0 ? queue.currentTrack.requestedBy.tag : queue.currentTrack.requestedBy.username}` });
        }
        
        const finalComponents = [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("np-back")
                    .setStyle(2)
                    .setEmoji("⏮️"),
                new ButtonBuilder()
                    .setCustomId("np-pauseresume")
                    .setStyle(2)
                    .setEmoji("⏯️"),
                new ButtonBuilder()
                    .setCustomId("np-skip")
                    .setStyle(2)
                    .setEmoji("⏭️"),
                new ButtonBuilder()
                    .setCustomId("np-stop")
                    .setStyle(2)
                    .setEmoji("⏹️")
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("np-volumeadjust")
                    .setStyle(1)
                    .setEmoji("🔊")
                    .setLabel("Volume"),
                new ButtonBuilder()
                    .setCustomId("np-loop")
                    .setStyle(1)
                    .setEmoji("🔄")
                    .setLabel("Loop"),
                new ButtonBuilder()
                    .setCustomId("np-shuffle")
                    .setStyle(1)
                    .setEmoji("🔀")
                    .setLabel("Shuffle"),
                new ButtonBuilder()
                    .setCustomId("np-clear")
                    .setStyle(4)
                    .setEmoji("🧹")
                    .setLabel("Clear")
            )
        ];

        interaction.reply({ embeds: [npembed], components: finalComponents, files: [coverImage] })
    }
}