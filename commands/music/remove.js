require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remove")
        .setDescription("Remove a specific song from the queue!")
        .addIntegerOption((option) =>
            option.setName("song").setDescription("What #no. song should be removed from the queue?").setRequired(true),
        ),
    async execute(interaction) {
        const removeamount = interaction.options.getInteger("song");
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

        const queuedTracks = queue.tracks.toArray();
        if (!queuedTracks[removeamount - 1])
            return interaction.reply({
                content: translate(interaction, "remove.invalidPosition"),
                ephemeral: true,
            });

        const removeembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setColor(client.config.embedColour)
            .setTitle(translate(interaction, "remove.title"))
            .setDescription(
                translate(interaction, "remove.description", {
                    title: queuedTracks[removeamount - 1].title,
                    link: buildTrackLinkText(queuedTracks[removeamount - 1], interaction),
                }),
            )
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.removeTrack(removeamount - 1);
            interaction.reply({ embeds: [removeembed] });
        } catch (err) {
            interaction.reply({
                content: translateGenericAction(interaction, "removingSong"),
                ephemeral: true,
            });
        }
    },
};
