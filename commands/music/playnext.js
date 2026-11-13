require("dotenv").config();
const musicFuncs = require("../../utils/sharedFunctions.js");
const { addResolvedTrack, buildPlaybackPicker, resolvePlaybackSource } = require("../../utils/playbackResolver.js");
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
        .setName("playnext")
        .setDescription("Add a song to the top of the queue!")
        .addStringOption((option) =>
            option
                .setName("music")
                .setDescription("Either the name or URL of the song you want to play (no playlists).")
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

        try {
            const isUrlQuery = isHttpUrl(query);
            if (isUrlQuery) await interaction.deferReply();

            const search = await searchPlaybackQuery(player, query, {
                requestedBy: interaction.user,
                searchEngine: QueryType.AUTO,
            });

            if (!search || search.tracks.length == 0 || !search.tracks) {
                return sendEphemeralError(interaction, translate(interaction, "errors.failedToFindSongQuery"));
            }

            if (!isUrlQuery) await interaction.deferReply();

            if (search.playlist) {
                return sendEphemeralError(interaction, translate(interaction, "errors.playNextPlaylistOnly"));
            }

            const resolution = await resolvePlaybackSource(search, interaction.client.config, forcedSource);
            if (!resolution) {
                return sendEphemeralError(
                    interaction,
                    translate(interaction, forcedSource ? "errors.playbackSourceNoMatch" : "errors.noPlaybackSource", {
                        source: forcedSource ? translate(interaction, `playback.sources.${forcedSource}`) : null,
                    }),
                );
            }

            if (resolution.autoPlay) {
                await addResolvedTrack(interaction, true, resolution.results[0], "send");
            } else {
                await interaction.followUp(buildPlaybackPicker(interaction, resolution, true));
            }
        } catch (err) {
            console.log(err);
            return sendEphemeralError(interaction, translate(interaction, "errors.playRequest"));
        }
    },
};
