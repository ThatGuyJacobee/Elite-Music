const { SlashCommandBuilder } = require("@discordjs/builders");
const { AttachmentBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { registerNpControlMessage } = require("../../utils/npControlMessages");
const { buildNpComponents, buildNpEmbed, NP_SLASH_TITLE_KEY } = require("../../utils/nowPlayingUi");
const { buildCoverImageDescription } = require("../../utils/botText");
const {
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueNotPlayingResponse,
} = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder().setName("nowplaying").setDescription("Check the currently playing song!"),
    async execute(interaction) {
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) {
            return interaction.reply(getQueueNotPlayingResponse(interaction));
        }

        const footerMember = queue.currentTrack.requestedBy != null ? interaction.user : null;

        const npembed = buildNpEmbed(queue, {
            title: NP_SLASH_TITLE_KEY,
            footerMember,
        });
        if (!npembed) return interaction.reply(getQueueNotPlayingResponse(interaction));

        var coverImage = new AttachmentBuilder(queue.currentTrack.thumbnail, {
            name: "coverimage.jpg",
            description: buildCoverImageDescription(interaction, "song", queue.currentTrack.title),
        });

        const finalComponents = buildNpComponents(interaction);

        await interaction.reply({ embeds: [npembed], components: finalComponents, files: [coverImage] });
        const msg = await interaction.fetchReply();
        registerNpControlMessage(queue, msg.id);
    },
};
