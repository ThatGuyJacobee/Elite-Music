require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { buildRequestedByFooter, translate } = require("../../utils/botText");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueNotPlayingResponse,
} = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("audiofilter")
        .setDescription("Check or toggle audio filters!")
        .addStringOption((option) =>
            option.setName("filter").setDescription("What filter do you want to toggle?").setRequired(false).addChoices(
                {
                    name: "Bassboost",
                    value: "bassboost",
                },
                {
                    name: "8D",
                    value: "8D",
                },
                {
                    name: "Subboost",
                    value: "subboost",
                },
                {
                    name: "Nightcore",
                    value: "nightcore",
                },
                {
                    name: "Surrounding",
                    value: "surrounding",
                },
                {
                    name: "Vaporwave",
                    value: "vaporwave",
                },
                {
                    name: "Normalizer",
                    value: "normalizer",
                },
                {
                    name: "Lofi",
                    value: "lofi",
                },
                {
                    name: "Fadein",
                    value: "fadein",
                },
            ),
        ),
    async execute(interaction) {
        const filter = interaction.options.getString("filter");
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

        if (!filter) {
            var curFilters = queue.filters.ffmpeg.getFiltersEnabled();

            if (curFilters.length == 0) {
                interaction.reply({ content: translate(interaction, "audiofilter.noneEnabled") });
            } else {
                interaction.reply({
                    content: translate(interaction, "audiofilter.listEnabled", { filters: curFilters.join("\n- ") }),
                });
            }
        } else {
            const isEnabled = queue.filters.ffmpeg.getFiltersEnabled().includes(filter);
            const filterembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setColor(client.config.embedColour)
                .setTitle(translate(interaction, "audiofilter.toggleTitle"))
                .setDescription(
                    translate(interaction, "audiofilter.toggleDescription", {
                        filter,
                        state: translate(
                            interaction,
                            isEnabled ? "audiofilter.stateDisabled" : "audiofilter.stateEnabled",
                        ),
                    }),
                )
                .setTimestamp()
                .setFooter(buildRequestedByFooter(interaction, interaction.user));

            try {
                queue.filters.ffmpeg.toggle(filter);
                interaction.reply({ embeds: [filterembed] });
            } catch (err) {
                interaction.reply({
                    content: translate(interaction, "errors.genericAction", { action: "adjusting the audio filter" }),
                    ephemeral: true,
                });
            }
        }
    },
};
