const { SlashCommandBuilder } = require("@discordjs/builders");
const { AttachmentBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { registerNpControlMessage } = require("../../utils/npControlMessages");
const { buildNpComponents, buildNpEmbed, NP_SLASH_TITLE } = require("../../utils/nowPlayingUi");

module.exports = {
    data: new SlashCommandBuilder().setName("nowplaying").setDescription("Check the currently playing song!"),
    async execute(interaction) {
        if (!interaction.member.voice.channelId) {
            return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        }
        if (
            interaction.guild.members.me.voice.channelId &&
            interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId
        ) {
            return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        }

        const player = useMainPlayer();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) {
            return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });
        }

        const footerMember = queue.currentTrack.requestedBy != null ? interaction.user : null;

        const npembed = buildNpEmbed(queue, {
            title: NP_SLASH_TITLE,
            footerMember,
        });
        if (!npembed)
            return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });

        var coverImage = new AttachmentBuilder(queue.currentTrack.thumbnail, {
            name: "coverimage.jpg",
            description: `Song Cover Image for ${queue.currentTrack.title}`,
        });

        const finalComponents = buildNpComponents();

        await interaction.reply({ embeds: [npembed], components: finalComponents, files: [coverImage] });
        const msg = await interaction.fetchReply();
        registerNpControlMessage(queue, msg.id);
    },
};
