require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, MessageFlags } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { buildRequestedByFooter, translate, translateGenericAction } = require("../../utils/botText");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueNotPlayingResponse,
} = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder().setName("clearqueue").setDescription("Clear the current music queue!"),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

        const clearembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setColor(client.config.embedColour)
            .setTitle(translate(interaction, "queue.clearTitle"))
            .setDescription(translate(interaction, "queue.clearDescription"))
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.tracks.clear();
            interaction.reply({ embeds: [clearembed] });
        } catch (err) {
            interaction.reply({
                content: translateGenericAction(interaction, "clearingQueue"),
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
