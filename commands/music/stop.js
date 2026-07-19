require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, MessageFlags } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { clearNpControlMessages } = require("../../utils/npControlMessages");
const { clear } = require("../../utils/softTransitions");
const { buildRequestedByFooter, translate, translateGenericAction } = require("../../utils/botText");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueNotPlayingResponse,
} = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder().setName("stop").setDescription("Stops any music playing!"),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

        const stopembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setColor(client.config.embedColour)
            .setTitle(translate(interaction, "np.stopTitle"))
            .setDescription(translate(interaction, "np.stopDescription"))
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            await clearNpControlMessages(queue);
            clear(queue);
            queue.delete();
            interaction.reply({ embeds: [stopembed] });
        } catch (err) {
            interaction.reply({
                content: translateGenericAction(interaction, "stoppingQueue"),
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
