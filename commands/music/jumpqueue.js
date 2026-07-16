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
    data: new SlashCommandBuilder()
        .setName("jumpqueue")
        .setDescription("Jump to a specific song in the queue!")
        .addIntegerOption((option) =>
            option
                .setName("song")
                .setDescription("What #no. song should be moved to the front of the queue (use /queue to check)?")
                .setRequired(true),
        ),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

        const queuedTracks = queue.tracks.toArray();
        var skipAmount = interaction.options.getInteger("song");
        var trackIndex = skipAmount - 1;
        const targetTrack = queuedTracks[trackIndex];
        if (!targetTrack)
            return interaction.reply({
                content: translate(interaction, "remove.invalidPosition"),
                flags: MessageFlags.Ephemeral,
            });

        const jumpembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setColor(client.config.embedColour)
            .setTitle(translate(interaction, "jumpqueue.title"))
            .setDescription(
                translate(interaction, "np.skipDescription", {
                    title: targetTrack.title,
                    link: buildTrackLinkText(targetTrack, interaction),
                }),
            )
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            const jumped = await transition(queue, () => queue.node.jump(trackIndex));
            if (jumped === false)
                return interaction.reply({
                    content: translate(interaction, "errors.transitionInProgress"),
                    flags: MessageFlags.Ephemeral,
                });
            interaction.reply({ embeds: [jumpembed] });
        } catch (err) {
            console.log(err);
            interaction.reply({
                content: translateGenericAction(interaction, "jumpingQueue"),
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
