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
const { transition } = require("../../utils/softTransitions");

module.exports = {
    data: new SlashCommandBuilder().setName("back").setDescription("Play the previous song!"),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

        const previousTracks = queue.history.tracks.toArray();
        if (!previousTracks[0])
            return interaction.reply({
                content: translate(interaction, "np.backMissing"),
                flags: MessageFlags.Ephemeral,
            });

        const backembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setColor(client.config.embedColour)
            .setTitle(translate(interaction, "np.backTitle"))
            .setDescription(
                translate(interaction, "np.backDescription", {
                    title: previousTracks[0].title,
                    link: buildTrackLinkText(previousTracks[0], interaction),
                }),
            )
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        await interaction.reply({ embeds: [backembed] });
        try {
            const returned = await transition(queue, () => queue.history.back());
            if (returned === false)
                return interaction.editReply({
                    content: translate(interaction, "errors.transitionInProgress"),
                    embeds: [],
                });
        } catch (err) {
            interaction.editReply({
                content: translateGenericAction(interaction, "returningToPreviousSong"),
                embeds: [],
            });
        }
    },
};
