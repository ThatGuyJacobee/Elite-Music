require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { useMainPlayer } = require("discord-player");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueNotPlayingResponse,
} = require("../../utils/interactionGuards");
const { skipCurrentTrack } = require("../../utils/sharedFunctions");

module.exports = {
    data: new SlashCommandBuilder().setName("skip").setDescription("Skip the current song!"),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

        return interaction.reply(await skipCurrentTrack(interaction, queue, interaction.user));
    },
};
