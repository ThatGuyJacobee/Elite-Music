require("dotenv").config();
const musicFuncs = require("../../utils/sharedFunctions.js");
const {
    buildAggregatedPlaybackPicker,
    searchAllPlaybackSources,
    searchAllTextSources,
} = require("../../utils/playbackResolver.js");
const { isHttpUrl, isPublicHttpUrl } = require("../../utils/urlPlayback.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { useMainPlayer, QueryType } = require("discord-player");
const { translate } = require("../../utils/botText");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    sendEphemeralError,
} = require("../../utils/interactionGuards");

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
        await interaction.deferReply();

        if (isHttpUrl(query) && !(await isPublicHttpUrl(query))) {
            return sendEphemeralError(interaction, translate(interaction, "errors.failedToFindSongQuery"));
        }

        try {
            const isUrlQuery = isHttpUrl(query);
            let groups = null;

            if (isUrlQuery) {
                const search = await useMainPlayer().search(query, {
                    requestedBy: interaction.user,
                    searchEngine: QueryType.AUTO,
                });

                if (!search?.tracks?.length) {
                    return sendEphemeralError(interaction, translate(interaction, "errors.failedToFindSongQuery"));
                }

                if (search.playlist) {
                    return sendEphemeralError(interaction, translate(interaction, "errors.searchPlaylist"));
                }

                groups = await searchAllPlaybackSources(search, interaction.client.config);
            } else {
                groups = await searchAllTextSources(query, interaction.client.config, interaction.user);
            }

            if (!groups) {
                return sendEphemeralError(interaction, translate(interaction, "errors.noPlaybackSource"));
            }

            await interaction.editReply(buildAggregatedPlaybackPicker(interaction, groups));
        } catch (err) {
            console.log(err);
            return sendEphemeralError(interaction, translate(interaction, "errors.playRequest"));
        }
    },
};
