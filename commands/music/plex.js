require("dotenv").config();
const musicFuncs = require("../../utils/sharedFunctions.js");
const plexFuncs = require("../../utils/plexFunctions.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const {
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require("discord.js");
const { buildRequestedByFooter, translate } = require("../../utils/botText");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    ensurePlexEnabled,
} = require("../../utils/interactionGuards");
const pickerEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

// Re-usable slash option for content type selection
const plexScopeSlashOption = (option) =>
    option
        .setName("scope")
        .setDescription("Pick what type of content to search for.")
        .setRequired(false)
        .addChoices(
            { name: "Auto (all types)", value: "auto" },
            { name: "Tracks only", value: "track" },
            { name: "Playlists only", value: "playlist" },
            { name: "Albums only", value: "album" },
        );

const plexOrderSlashOption = (option) =>
    option
        .setName("order")
        .setDescription("Order used when adding multiple tracks from a playlist or album.")
        .setRequired(false)
        .addChoices(
            { name: "Sequential", value: "sequential" },
            { name: "Shuffle", value: "shuffle" },
            { name: "Reverse", value: "reverse" },
        );

module.exports = {
    data: new SlashCommandBuilder()
        .setName("plex")
        .setDescription("Play music from your Plex library into the queue!")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("play")
                .setDescription("Play a track, playlist, or album from your Plex server.")
                .addStringOption((option) =>
                    option
                        .setName("music")
                        .setDescription("Search query for a track, playlist, or album.")
                        .setRequired(true),
                )
                .addStringOption(plexScopeSlashOption)
                .addStringOption(plexOrderSlashOption),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("search")
                .setDescription("Search tracks, playlists, and albums.")
                .addStringOption((option) =>
                    option
                        .setName("music")
                        .setDescription("Search query for a track, playlist, or album.")
                        .setRequired(true),
                )
                .addStringOption(plexScopeSlashOption)
                .addStringOption(plexOrderSlashOption),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("playnext")
                .setDescription("Add a track, playlist, or album from your Plex server to play next.")
                .addStringOption((option) =>
                    option
                        .setName("music")
                        .setDescription("Search query for a track, playlist, or album.")
                        .setRequired(true),
                )
                .addStringOption(plexScopeSlashOption)
                .addStringOption(plexOrderSlashOption),
        ),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "play" || subcommand === "playnext" || subcommand === "search") {
            return runPlexFlow(interaction, {
                subcommand,
                forcePicker: subcommand === "search",
            });
        }
    },
};

async function assertPlexSlashGuards(interaction) {
    if (!(await ensureDjAccess(interaction))) return false;
    if (!(await ensurePlexEnabled(interaction))) return false;
    if (!(await ensureInVoiceChannel(interaction))) return false;
    if (!(await ensureSameVoiceChannel(interaction))) return false;
    return true;
}

async function runPlexFlow(interaction, { subcommand, forcePicker }) {
    const guardsOk = await assertPlexSlashGuards(interaction);
    if (!guardsOk) return;

    const query = interaction.options.getString("music");
    const searchScope = interaction.options.getString("scope") ?? "auto";
    const playlistOrder = interaction.options.getString("order") ?? "sequential";
    await musicFuncs.getQueue(interaction);

    try {
        const searchResults = await plexFuncs.plexSearchQuery(query, { scope: searchScope });
        if (!searchResults.songs && !searchResults.playlists && !searchResults.albums) {
            return interaction.reply({
                content: translate(interaction, "errors.failedToFindMediaQuery"),
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        const usePlayNext = subcommand === "playnext";
        const shouldShowPicker = forcePicker || searchResults.size >= 2;

        if (shouldShowPicker) {
            const embedFields = [];
            let resultIndex = 1;

            const actionRowSelect = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("plexsearch")
                    .setMinValues(1)
                    .setMaxValues(1)
                    .setPlaceholder(translate(interaction, "search.placeholder")),
            );

            if (searchResults.songs) {
                for (const song of searchResults.songs) {
                    if (resultIndex > 10) break;

                    const durationLabel = plexFuncs.formatPlexDurationLabel(song.duration);
                    const songTitle = `${song.parentTitle} - ${song.grandparentTitle}`;
                    embedFields.push({
                        name: translate(interaction, "search.mediaResult", {
                            index: resultIndex,
                            type: song.type.charAt(0).toUpperCase() + song.type.slice(1),
                            suffix: durationLabel,
                        }),
                        value: songTitle,
                    });

                    actionRowSelect.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(songTitle.length > 100 ? `${songTitle.substring(0, 97)}...` : songTitle)
                            .setValue(`${song.type}_${usePlayNext}_key=${song.key}`)
                            .setDescription(translate(interaction, "search.duration", { duration: durationLabel }))
                            .setEmoji(pickerEmojis[resultIndex - 1]),
                    );
                    resultIndex++;
                }
            }

            if (searchResults.playlists) {
                for (const playlist of searchResults.playlists) {
                    if (resultIndex > 10) break;

                    const durationLabel = plexFuncs.formatPlexDurationLabel(playlist.duration);
                    const playlistSongCount = Number(playlist.leafCount ?? playlist.childCount ?? 0);
                    const playlistSongCountLabel =
                        Number.isFinite(playlistSongCount) && playlistSongCount > 0
                            ? translate(interaction, "search.songCount", { count: playlistSongCount })
                            : "";

                    const hasKnownDuration = durationLabel !== "--:--";
                    const playlistResultSuffix =
                        playlistSongCountLabel && hasKnownDuration
                            ? `${playlistSongCountLabel} - ${durationLabel}`
                            : playlistSongCountLabel || (hasKnownDuration ? durationLabel : "");

                    embedFields.push({
                        name: playlistResultSuffix
                            ? translate(interaction, "search.mediaResult", {
                                  index: resultIndex,
                                  type: playlist.type.charAt(0).toUpperCase() + playlist.type.slice(1),
                                  suffix: playlistResultSuffix,
                              })
                            : translate(interaction, "search.mediaResultNoSuffix", {
                                  index: resultIndex,
                                  type: playlist.type.charAt(0).toUpperCase() + playlist.type.slice(1),
                              }),
                        value: `${playlist.title}`,
                    });

                    actionRowSelect.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(
                                playlist.title.length > 100 ? `${playlist.title.substring(0, 97)}...` : playlist.title,
                            )
                            .setValue(`${playlist.type}_${usePlayNext}_order=${playlistOrder}_key=${playlist.key}`)
                            .setDescription(playlistResultSuffix || translate(interaction, "search.playlist"))
                            .setEmoji(pickerEmojis[resultIndex - 1]),
                    );
                    resultIndex++;
                }
            }

            if (searchResults.albums) {
                for (const album of searchResults.albums) {
                    if (resultIndex > 10) break;

                    const albumSongCount = Number(album.leafCount ?? album.childCount ?? 0);
                    const albumSongCountLabel =
                        Number.isFinite(albumSongCount) && albumSongCount > 0
                            ? translate(interaction, "search.songCount", { count: albumSongCount })
                            : "";
                    const albumTitle = album.parentTitle ? `${album.title} - ${album.parentTitle}` : album.title;
                    embedFields.push({
                        name: albumSongCountLabel
                            ? translate(interaction, "search.mediaResult", {
                                  index: resultIndex,
                                  type: album.type.charAt(0).toUpperCase() + album.type.slice(1),
                                  suffix: albumSongCountLabel,
                              })
                            : translate(interaction, "search.mediaResultNoSuffix", {
                                  index: resultIndex,
                                  type: album.type.charAt(0).toUpperCase() + album.type.slice(1),
                              }),
                        value: albumTitle,
                    });

                    actionRowSelect.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(albumTitle.length > 100 ? `${albumTitle.substring(0, 97)}...` : albumTitle)
                            .setValue(`${album.type}_${usePlayNext}_order=${playlistOrder}_key=${album.key}`)
                            .setDescription(albumSongCountLabel || translate(interaction, "search.album"))
                            .setEmoji(pickerEmojis[resultIndex - 1]),
                    );
                    resultIndex++;
                }
            }

            const pickerDescription =
                searchResults.size >= 2
                    ? translate(interaction, "search.multipleResults")
                    : translate(interaction, "search.singleResult");

            const resultsEmbed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setTitle(translate(interaction, "search.plexTitle"))
                .setDescription(pickerDescription)
                .addFields(embedFields)
                .setColor(client.config.embedColour)
                .setTimestamp()
                .setFooter(buildRequestedByFooter(interaction, interaction.user));

            const cancelRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("np-delete")
                    .setStyle(4)
                    .setLabel(translate(interaction, "search.cancel")),
            );

            await interaction.followUp({ embeds: [resultsEmbed], components: [actionRowSelect, cancelRow] });
        } else {
            const itemFound =
                (searchResults.songs && searchResults.songs[0]) ||
                (searchResults.playlists && searchResults.playlists[0]) ||
                (searchResults.albums && searchResults.albums[0]);

            if (itemFound.type == "playlist") {
                await plexFuncs.plexAddPlaylist(interaction, itemFound, "send", playlistOrder, usePlayNext);
            } else if (itemFound.type == "album") {
                await plexFuncs.plexAddAlbum(interaction, itemFound, "send", playlistOrder, usePlayNext);
            } else {
                await plexFuncs.plexAddTrack(interaction, usePlayNext, itemFound, "send");
            }
        }
    } catch (err) {
        console.log(err);
        const errorMessage = translate(interaction, "errors.playRequest");
        if (interaction.deferred) {
            return interaction
                .followUp({ content: errorMessage, ephemeral: true })
                .catch(() => interaction.editReply({ content: errorMessage }));
        }
        return interaction.reply({ content: errorMessage, ephemeral: true });
    }
}

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId == "plexsearch") {
        await musicFuncs.getQueue(interaction);

        for await (const selectedValue of interaction.values) {
            const itemType = selectedValue.split("_")[0];
            const playNextSegment = selectedValue.split("_")[1];
            const usePlayNext = playNextSegment != null && playNextSegment == "true";
            const orderSegment = selectedValue.split("_")[2];
            const playlistOrder =
                orderSegment != null && orderSegment.startsWith("order=")
                    ? orderSegment.split("order=")[1]
                    : "sequential";
            const itemKey = selectedValue.split("key=")[1];

            const metadataRequest = await fetch(
                `${client.config.plexServer}${itemKey}?X-Plex-Token=${client.config.plexAuthtoken}`,
                {
                    method: "GET",
                    headers: { accept: "application/json" },
                },
            );

            const metadataJson = await metadataRequest.json();

            await interaction.deferUpdate();

            if (itemType == "playlist") {
                metadataJson.MediaContainer.type = itemType;
                await plexFuncs.plexAddPlaylist(
                    interaction,
                    metadataJson.MediaContainer,
                    "edit",
                    playlistOrder,
                    usePlayNext,
                );
            } else if (itemType == "album") {
                metadataJson.MediaContainer.type = itemType;
                await plexFuncs.plexAddAlbum(
                    interaction,
                    metadataJson.MediaContainer.Metadata[0],
                    "edit",
                    playlistOrder,
                    usePlayNext,
                );
            } else {
                await plexFuncs.plexAddTrack(interaction, usePlayNext, metadataJson.MediaContainer.Metadata[0], "edit");
            }
        }
    }
});
