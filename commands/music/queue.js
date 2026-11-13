require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { useMainPlayer } = require("discord-player");
const { buildQueuePage } = require("../../utils/queuePages");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueEmptyResponse,
    getQueueNotPlayingResponse,
} = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder().setName("queue").setDescription("Check the current music that is in the queue!"),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));
        if (queue.tracks.toArray().length === 0) return interaction.reply(getQueueEmptyResponse(interaction));

        const { embed, components } = buildQueuePage(interaction, queue, 1, { user: interaction.user });
        return interaction.reply({ embeds: [embed], components });
    },
};
