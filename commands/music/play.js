require("dotenv").config();
const musicFuncs = require("../../utils/sharedFunctions.js");
const {
    addPlaybackSelection,
    addResolvedTrack,
    buildPlaybackPicker,
    resolvePlaybackSource,
    resolveTextQuery,
} = require("../../utils/playbackResolver.js");
const { ensurePlaybackSourceAvailable, playbackSlashOption } = require("../../utils/playbackOptions.js");
const { isHttpUrl, searchPlaybackQuery } = require("../../utils/urlPlayback.js");
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
        .setName("play")
        .setDescription("Place a song into the queue!")
        .addStringOption((option) =>
            option
                .setName("music")
                .setDescription("Either the name, URL or playlist URL you want to play.")
                .setRequired(true),
        )
        .addStringOption(playbackSlashOption),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const playback = interaction.options.getString("playback");
        const forcedSource = playback && playback !== "auto" ? playback : null;
        if (!(await ensurePlaybackSourceAvailable(interaction, forcedSource))) return;

        const query = interaction.options.getString("music");
        const player = useMainPlayer();
        await musicFuncs.getQueue(interaction);
        await interaction.deferReply();

        try {
            const isUrlQuery = isHttpUrl(query);

            let resolution = null;

            if (isUrlQuery) {
                const search = await searchPlaybackQuery(player, query, {
                    requestedBy: interaction.user,
                    searchEngine: QueryType.AUTO,
                });

                if (!search?.tracks?.length) {
                    return sendEphemeralError(interaction, translate(interaction, "errors.failedToFindSongQuery"));
                }

                if (search.playlist) {
                    await musicFuncs.addTracks(interaction, false, search, "send");
                    return;
                }

                resolution = await resolvePlaybackSource(search, interaction.client.config, forcedSource);
            } else {
                resolution = await resolveTextQuery(query, interaction.client.config, forcedSource, interaction.user);
            }

            if (!resolution) {
                return sendEphemeralError(
                    interaction,
                    translate(interaction, forcedSource ? "errors.playbackSourceNoMatch" : "errors.noPlaybackSource", {
                        source: forcedSource ? translate(interaction, `playback.sources.${forcedSource}`) : null,
                    }),
                );
            }

            if (resolution.playlistSearch) {
                await musicFuncs.addTracks(interaction, false, resolution.playlistSearch, "send");
                return;
            }

            if (resolution.autoPlay) {
                await addResolvedTrack(interaction, false, resolution.results[0], "send");
            } else {
                await interaction.followUp(buildPlaybackPicker(interaction, resolution, false));
            }
        } catch (err) {
            console.log(err);
            return sendEphemeralError(interaction, translate(interaction, "errors.playRequest"));
        }
    },
};

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId.startsWith("playsearch:")) {
        await musicFuncs.getQueue(interaction);

        try {
            await interaction.deferUpdate();

            const result = await addPlaybackSelection(interaction, interaction.customId, interaction.values[0], "edit");
            if (!result) {
                return sendEphemeralError(interaction, translate(interaction, "errors.failedToFindSong"));
            }
        } catch (err) {
            console.log(err);
            return sendEphemeralError(interaction, translate(interaction, "errors.playRequest"));
        }
    }
});
