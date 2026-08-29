require("dotenv").config();
const musicFuncs = require("../../utils/sharedFunctions.js");
const {
    addPlaybackSelection,
    addResolvedTrack,
    buildPlaybackPicker,
    resolvePlaybackSource,
} = require("../../utils/playbackResolver.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageFlags } = require("discord.js");
const { useMainPlayer, QueryType } = require("discord-player");
const { translate } = require("../../utils/botText");
const { ensureDjAccess, ensureInVoiceChannel, ensureSameVoiceChannel } = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Place a song into the queue!")
        .addStringOption((option) =>
            option
                .setName("music")
                .setDescription("Either the name, URL or playlist URL you want to play.")
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

            await interaction.deferReply();

            if (search.playlist) {
                await musicFuncs.addTracks(interaction, false, search, "send");
                return;
            }

            const resolution = await resolvePlaybackSource(search, query, interaction.client.config);
            if (!resolution) {
                return interaction.editReply({
                    content: translate(interaction, "errors.noPlaybackSource"),
                });
            }

            if (resolution.results.length === 1) {
                await addResolvedTrack(interaction, false, resolution.results[0], "send");
            } else {
                await interaction.followUp(buildPlaybackPicker(interaction, resolution, false));
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

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId.startsWith("playsearch:")) {
        await musicFuncs.getQueue(interaction);

        try {
            await interaction.deferUpdate();

            const result = await addPlaybackSelection(interaction, interaction.customId, interaction.values[0], "edit");
            if (!result) {
                return interaction.editReply({
                    content: translate(interaction, "errors.failedToFindSong"),
                    embeds: [],
                    components: [],
                });
            }
        } catch (err) {
            console.log(err);
            return interaction.followUp({
                content: translate(interaction, "errors.playRequest"),
                flags: MessageFlags.Ephemeral,
            });
        }
    }
});
