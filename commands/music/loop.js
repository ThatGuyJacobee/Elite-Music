require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { useMainPlayer, QueueRepeatMode } = require("discord-player");
const { buildRequestedByFooter, translate, translateGenericAction } = require("../../utils/botText");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueNotPlayingResponse,
} = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("loop")
        .setDescription("Set the loop type!")
        .addIntegerOption((option) =>
            option
                .setName("loopmode")
                .setDescription("What loop mode do you want to activate?")
                .setRequired(true)
                .addChoices(
                    {
                        name: "Off",
                        value: QueueRepeatMode.OFF,
                    },
                    {
                        name: "Track",
                        value: QueueRepeatMode.TRACK,
                    },
                    {
                        name: "Queue",
                        value: QueueRepeatMode.QUEUE,
                    },
                ),
        ),
    async execute(interaction) {
        const loopmode = interaction.options.getInteger("loopmode");
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

        const titleKey =
            loopmode === QueueRepeatMode.TRACK
                ? "np.loopTrackTitle"
                : loopmode === QueueRepeatMode.QUEUE
                  ? "loop.queueTitle"
                  : "np.loopOffTitle";
        const modeKey =
            loopmode === QueueRepeatMode.TRACK
                ? "loop.trackMode"
                : loopmode === QueueRepeatMode.QUEUE
                  ? "loop.queueMode"
                  : "loop.offMode";

        const loopembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setColor(client.config.embedColour)
            .setTitle(translate(interaction, titleKey))
            .setDescription(translate(interaction, "loop.description", { mode: translate(interaction, modeKey) }))
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.setRepeatMode(loopmode);
            interaction.reply({ embeds: [loopembed] });
        } catch (err) {
            interaction.reply({
                content: translateGenericAction(interaction, "switchingLoopMode"),
                ephemeral: true,
            });
        }
    },
};
