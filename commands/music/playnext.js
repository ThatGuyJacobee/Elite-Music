require("dotenv").config();
const musicFuncs = require("../../utils/sharedFunctions.js");
const { addResolvedTrack, buildPlaybackPicker, resolvePlaybackSource } = require("../../utils/playbackResolver.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageFlags } = require("discord.js");
const { useMainPlayer, QueryType } = require("discord-player");
const { translate } = require("../../utils/botText");
const { ensureDjAccess, ensureInVoiceChannel, ensureSameVoiceChannel } = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("playnext")
        .setDescription("Add a song to the top of the queue!")
        .addStringOption((option) =>
            option
                .setName("music")
                .setDescription("Either the name or URL of the song you want to play (no playlists).")
                .setRequired(true),
        ),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const query = interaction.options.getString("music");
        const player = useMainPlayer();
        await musicFuncs.getQueue(interaction);

        try {
            const search = await player.search(query, {
                requestedBy: interaction.user,
                searchEngine: QueryType.AUTO,
            });

            if (!search || search.tracks.length == 0 || !search.tracks) {
                return interaction.reply({
                    content: translate(interaction, "errors.failedToFindSongQuery"),
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (search.playlist) {
                return interaction.reply({
                    content: translate(interaction, "errors.playNextPlaylistOnly"),
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply();

            const resolution = await resolvePlaybackSource(search, query, interaction.client.config);
            if (!resolution) {
                return interaction.editReply({
                    content: translate(interaction, "errors.noPlaybackSource"),
                });
            }

            if (resolution.results.length === 1) {
                await addResolvedTrack(interaction, true, resolution.results[0], "send");
            } else {
                await interaction.followUp(buildPlaybackPicker(interaction, resolution, true));
            }
        } catch (err) {
            console.log(err);
            return interaction.followUp({
                content: translate(interaction, "errors.playRequest"),
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
