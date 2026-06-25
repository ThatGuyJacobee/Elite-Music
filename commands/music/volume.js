require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { buildRequestedByFooter, translate, translateGenericAction } = require("../../utils/botText");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueNotPlayingResponse,
} = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("volume")
        .setDescription("Check or set the current music volume!")
        .addIntegerOption((option) =>
            option
                .setName("amount")
                .setDescription("What do you want to set the volume as (0-100)?")
                .setRequired(false),
        ),
    async execute(interaction) {
        const vol = interaction.options.getInteger("amount");
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

        if (vol == null)
            return interaction.reply({
                content: translate(interaction, "volume.current", { volume: queue.node.volume }),
                ephemeral: true,
            });
        if (vol > 100 || vol < 0)
            return interaction.reply({
                content: translate(interaction, "volume.invalidRange"),
                ephemeral: true,
            });

        const volumeembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setColor(client.config.embedColour)
            .setTitle(translate(interaction, "np.volumeTitle"))
            .setDescription(translate(interaction, "np.volumeDescription", { volume: vol }))
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.node.setVolume(vol);
            interaction.reply({ embeds: [volumeembed] });
        } catch (err) {
            interaction.reply({
                content: translateGenericAction(interaction, "adjustingVolume"),
                ephemeral: true,
            });
        }
    },
};
