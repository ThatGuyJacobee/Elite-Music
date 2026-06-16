require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { buildRequestedByFooter, buildTrackLinkText, translate } = require("../../utils/botText");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueEmptyResponse,
    getQueueNotPlayingResponse,
} = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder().setName("skip").setDescription("Skip the current song!"),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

        const queuedTracks = queue.tracks.toArray();
        if (!queuedTracks[0]) return interaction.reply(getQueueEmptyResponse(interaction));

        var coverImage = new AttachmentBuilder(queuedTracks[0].thumbnail, {
            name: "coverimage.jpg",
            description: `Song Cover Image for ${queuedTracks[0].title}`,
        });
        const skipembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail("attachment://coverimage.jpg")
            .setColor(client.config.embedColour)
            .setTitle(translate(interaction, "np.skipTitle"))
            .setDescription(
                translate(interaction, "np.skipDescription", {
                    title: queuedTracks[0].title,
                    link: buildTrackLinkText(queuedTracks[0]),
                }),
            )
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.node.skip();
            interaction.reply({ embeds: [skipembed], files: [coverImage] });
        } catch (err) {
            interaction.reply({
                content: translate(interaction, "errors.genericAction", { action: "skipping the song" }),
                ephemeral: true,
            });
        }
    },
};
