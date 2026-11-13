require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageFlags } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { buildQueuePage } = require("../../utils/queuePages");
const { translate } = require("../../utils/botText");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueNotPlayingResponse,
} = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queuehistory")
        .setDescription("Check the past history of the queue within the guild!"),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

        const previousTracks = queue.history.tracks.toArray();
        if (!previousTracks[0])
            return interaction.reply({
                content: translate(interaction, "np.backMissing"),
                flags: MessageFlags.Ephemeral,
            });

        const { embed, components } = buildQueuePage(interaction, queue, 1, {
            history: true,
            user: interaction.user,
        });
        return interaction.reply({ embeds: [embed], components });
    },
};
