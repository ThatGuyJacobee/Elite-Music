require("dotenv").config();
const musicFuncs = require("../../utils/sharedFunctions.js");
const { buildAggregatedPlaybackPicker, searchAllPlaybackSources } = require("../../utils/playbackResolver.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageFlags } = require("discord.js");
const { useMainPlayer, QueryType } = require("discord-player");
const { translate } = require("../../utils/botText");
const { ensureDjAccess, ensureInVoiceChannel, ensureSameVoiceChannel } = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("search")
        .setDescription("Search every configured playback source!")
        .addStringOption((option) =>
            option
                .setName("music")
                .setDescription("Either the name or URL of the song you want to search for.")
                .setRequired(true),
        ),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const query = interaction.options.getString("music");
        await musicFuncs.getQueue(interaction);

        try {
            const search = await useMainPlayer().search(query, {
                requestedBy: interaction.user,
                searchEngine: QueryType.AUTO,
            });

            if (!search?.tracks?.length) {
                return interaction.reply({
                    content: translate(interaction, "errors.failedToFindSongQuery"),
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (search.playlist) {
                return interaction.reply({
                    content: translate(interaction, "errors.searchPlaylist"),
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply();

            const groups = await searchAllPlaybackSources(search, query, interaction.client.config);
            if (!groups) {
                return interaction.editReply({
                    content: translate(interaction, "errors.noPlaybackSource"),
                });
            }

            await interaction.editReply(buildAggregatedPlaybackPicker(interaction, groups));
        } catch (err) {
            console.log(err);
            const response = {
                content: translate(interaction, "errors.playRequest"),
                flags: MessageFlags.Ephemeral,
            };
            return interaction.deferred || interaction.replied
                ? interaction.followUp(response)
                : interaction.reply(response);
        }
    },
};
