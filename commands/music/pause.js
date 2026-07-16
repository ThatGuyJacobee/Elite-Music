require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, MessageFlags } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const {
    buildRequestedByFooter,
    buildTrackLinkText,
    translate,
    translateGenericAction,
} = require("../../utils/botText");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueNotPlayingResponse,
} = require("../../utils/interactionGuards");
const { cancel, startNaturalMonitor } = require("../../utils/softTransitions");

module.exports = {
    data: new SlashCommandBuilder().setName("pause").setDescription("Pause the current song at the current time!"),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));
        var checkPause = queue.node.isPaused();

        const pauseembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail(queue.currentTrack.thumbnail)
            .setColor(client.config.embedColour)
            .setTitle(translate(interaction, "np.pauseTitle"))
            .setDescription(
                translate(interaction, "np.pauseDescription", {
                    state: translate(interaction, checkPause ? "np.pauseStateResumed" : "np.pauseStatePaused"),
                    title: queue.currentTrack.title,
                    link: buildTrackLinkText(queue.currentTrack, interaction),
                }),
            )
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            cancel(queue);
            queue.node.setPaused(!queue.node.isPaused());
            if (checkPause) startNaturalMonitor(queue);
            interaction.reply({ embeds: [pauseembed] });
        } catch (err) {
            interaction.reply({
                content: translateGenericAction(interaction, checkPause ? "resuming" : "pausing"),
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
