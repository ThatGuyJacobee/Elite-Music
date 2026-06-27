require("dotenv").config();
const musicFuncs = require("../../utils/sharedFunctions.js");
const jellyfinFuncs = require("../../utils/jellyfinFunctions.js");
const { formatDurationMs } = require("../../utils/utilityFunctions.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const {
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
} = require("discord.js");
const { buildRequestedByFooter, translate, translateSearchMediaType } = require("../../utils/botText");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    ensureJellyfinEnabled,
} = require("../../utils/interactionGuards");

const jellyfinScopeSlashOption = (option) =>
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

const jellyfinOrderSlashOption = (option) =>
    option
        .setName("order")
        .setDescription("Order used when adding multiple tracks from a playlist or album.")
        .setRequired(false)
        .addChoices(
            { name: "Sequential", value: "sequential" },
            { name: "Shuffle", value: "shuffle" },
            { name: "Reverse", value: "reverse" },
        );

function jellyfinSelectValue(kind, playNext, order, id) {
    const orderMode = order && order !== "" ? order : "sequential";
    return `${kind}|${playNext ? "true" : "false"}|${orderMode}|${id}`;
}

function parseJellyfinSelectValue(option) {
    const parts = String(option).split("|");
    const kind = parts[0];
    const playNext = parts[1] === "true";
    if (parts.length >= 4) {
        return { kind, playNext, order: parts[2], id: parts.slice(3).join("|") };
    }
    const id = parts.slice(2).join("|");
    return { kind, playNext, order: "sequential", id };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("jellyfin")
        .setDescription("Play music from your Jellyfin library into the queue!")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("play")
                .setDescription("Play a track, playlist, or album from your Jellyfin server.")
                .addStringOption((option) =>
                    option
                        .setName("music")
                        .setDescription("Search query for a track, playlist, or album.")
                        .setRequired(true),
                )
                .addStringOption(jellyfinScopeSlashOption)
                .addStringOption(jellyfinOrderSlashOption),
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
                .addStringOption(jellyfinScopeSlashOption)
                .addStringOption(jellyfinOrderSlashOption),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("playnext")
                .setDescription("Add a track, playlist, or album from your Jellyfin server to play next.")
                .addStringOption((option) =>
                    option
                        .setName("music")
                        .setDescription("Search query for a track, playlist, or album.")
                        .setRequired(true),
                )
                .addStringOption(jellyfinScopeSlashOption)
                .addStringOption(jellyfinOrderSlashOption),
        ),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "play" || subcommand === "playnext" || subcommand === "search") {
            return runJellyfinFlow(interaction, {
                subcommand,
                forcePicker: subcommand === "search",
            });
        }
    },
};

async function assertJellyfinSlashGuards(interaction) {
    if (!(await ensureDjAccess(interaction))) return false;
    if (!(await ensureJellyfinEnabled(interaction))) return false;
    if (!(await ensureInVoiceChannel(interaction))) return false;
    if (!(await ensureSameVoiceChannel(interaction))) return false;
    return true;
}

async function runJellyfinFlow(interaction, { subcommand, forcePicker }) {
    const guardsOk = await assertJellyfinSlashGuards(interaction);
    if (!guardsOk) return;

    const query = interaction.options.getString("music");
    const searchScope = interaction.options.getString("scope") ?? "auto";
    const playlistOrder = interaction.options.getString("order") ?? "sequential";
    await musicFuncs.getQueue(interaction);

    try {
        const results = await jellyfinFuncs.jellyfinSearchQuery(query, { scope: searchScope });
        if (!results || (!results.songs?.length && !results.playlists?.length && !results.albums?.length)) {
            return interaction.reply({
                content: translate(interaction, "errors.failedToFindMediaQuery"),
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.deferReply();

        const playNextFlag = subcommand === "playnext";
        const shouldShowPicker = forcePicker || results.size >= 2;

        if (shouldShowPicker) {
            const embedFields = [];
            let count = 1;
            const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

            const actionmenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("jellyfinsearch")
                    .setMinValues(1)
                    .setMaxValues(1)
                    .setPlaceholder(translate(interaction, "search.placeholder")),
            );

            if (results.songs) {
                for (const item of results.songs) {
                    if (count > 10) break;

                    const durationLabel = formatDurationMs(item.duration);
                    const songTitle = `${item.parentTitle} - ${item.grandparentTitle}`;
                    embedFields.push({
                        name: translate(interaction, "search.mediaResult", {
                            index: count,
                            type: translateSearchMediaType(interaction, item.type),
                            suffix: durationLabel,
                        }),
                        value: songTitle,
                    });

                    actionmenu.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(songTitle.length > 100 ? `${songTitle.substring(0, 97)}...` : songTitle)
                            .setValue(jellyfinSelectValue("song", playNextFlag, playlistOrder, item.id))
                            .setDescription(translate(interaction, "search.duration", { duration: durationLabel }))
                            .setEmoji(emojis[count - 1]),
                    );
                    count++;
                }
            }

            if (results.playlists) {
                for (const item of results.playlists) {
                    if (count > 10) break;

                    const playlistSongCount = Number(item.leafCount ?? 0);
                    const playlistSongCountLabel =
                        Number.isFinite(playlistSongCount) && playlistSongCount > 0
                            ? translate(interaction, "search.songCount", { count: playlistSongCount })
                            : "";

                    const playlistDurationLabel = formatDurationMs(item.duration || 0);
                    const hasKnownDuration = playlistDurationLabel !== "--:--";
                    const playlistResultSuffix =
                        playlistSongCountLabel && hasKnownDuration
                            ? `${playlistSongCountLabel} - ${playlistDurationLabel}`
                            : playlistSongCountLabel || (hasKnownDuration ? playlistDurationLabel : "");

                    embedFields.push({
                        name: playlistResultSuffix
                            ? translate(interaction, "search.mediaResult", {
                                  index: count,
                                  type: translateSearchMediaType(interaction, item.type),
                                  suffix: playlistResultSuffix,
                              })
                            : translate(interaction, "search.mediaResultNoSuffix", {
                                  index: count,
                                  type: translateSearchMediaType(interaction, item.type),
                              }),
                        value: `${item.title}`,
                    });

                    actionmenu.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(item.title.length > 100 ? `${item.title.substring(0, 97)}...` : item.title)
                            .setValue(jellyfinSelectValue("playlist", playNextFlag, playlistOrder, item.id))
                            .setDescription(playlistResultSuffix || translate(interaction, "search.playlist"))
                            .setEmoji(emojis[count - 1]),
                    );
                    count++;
                }
            }

            if (results.albums) {
                for (const item of results.albums) {
                    if (count > 10) break;

                    const albumSongCount = Number(item.leafCount ?? 0);
                    const albumSongCountLabel =
                        Number.isFinite(albumSongCount) && albumSongCount > 0
                            ? translate(interaction, "search.songCount", { count: albumSongCount })
                            : "";

                    const albumDurationLabel = formatDurationMs(item.duration || 0);
                    const hasKnownDuration = albumDurationLabel !== "--:--";
                    const albumResultSuffix =
                        albumSongCountLabel && hasKnownDuration
                            ? `${albumSongCountLabel} - ${albumDurationLabel}`
                            : albumSongCountLabel || (hasKnownDuration ? albumDurationLabel : "");

                    const albumTitle = item.artist ? `${item.title} - ${item.artist}` : item.title;
                    embedFields.push({
                        name: albumResultSuffix
                            ? translate(interaction, "search.mediaResult", {
                                  index: count,
                                  type: translateSearchMediaType(interaction, item.type),
                                  suffix: albumResultSuffix,
                              })
                            : translate(interaction, "search.mediaResultNoSuffix", {
                                  index: count,
                                  type: translateSearchMediaType(interaction, item.type),
                              }),
                        value: albumTitle,
                    });

                    actionmenu.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(albumTitle.length > 100 ? `${albumTitle.substring(0, 97)}...` : albumTitle)
                            .setValue(jellyfinSelectValue("album", playNextFlag, playlistOrder, item.id))
                            .setDescription(albumResultSuffix || translate(interaction, "search.album"))
                            .setEmoji(emojis[count - 1]),
                    );
                    count++;
                }
            }

            const searchEmbedDescription =
                results.size >= 2
                    ? translate(interaction, "search.multipleResults")
                    : translate(interaction, "search.singleResult");

            const searchEmbed = new EmbedBuilder()
                .setAuthor({
                    name: interaction.client.user.tag,
                    iconURL: interaction.client.user.displayAvatarURL(),
                })
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setTitle(translate(interaction, "search.jellyfinTitle"))
                .setDescription(searchEmbedDescription)
                .addFields(embedFields)
                .setColor(client.config.embedColour)
                .setTimestamp()
                .setFooter(buildRequestedByFooter(interaction, interaction.user));

            const actionbutton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("np-delete")
                    .setStyle(4)
                    .setLabel(translate(interaction, "search.cancel")),
            );

            return interaction.followUp({ embeds: [searchEmbed], components: [actionmenu, actionbutton] });
        }

        const itemFound =
            (results.songs && results.songs[0]) ||
            (results.playlists && results.playlists[0]) ||
            (results.albums && results.albums[0]);

        if (itemFound.type == "playlist") {
            return jellyfinFuncs.jellyfinAddPlaylist(interaction, itemFound, "send", playlistOrder, playNextFlag);
        }

        if (itemFound.type == "album") {
            return jellyfinFuncs.jellyfinAddAlbum(interaction, itemFound, "send", playlistOrder, playNextFlag);
        }

        return jellyfinFuncs.jellyfinAddTrack(interaction, playNextFlag, itemFound, "send");
    } catch (err) {
        console.log(err);
        const errorMessage = translate(interaction, "errors.playRequest");
        if (interaction.deferred) {
            return interaction
                .followUp({ content: errorMessage, flags: MessageFlags.Ephemeral })
                .catch(() => interaction.editReply({ content: errorMessage }));
        }
        return interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
    }
}

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId == "jellyfinsearch") {
        await musicFuncs.getQueue(interaction);
        const allcomponents = interaction.values;

        await interaction.deferUpdate();

        for await (const option of allcomponents) {
            const { kind, playNext, order, id } = parseJellyfinSelectValue(option);

            if (kind === "playlist") {
                await jellyfinFuncs.jellyfinAddPlaylist(interaction, { type: "playlist", id }, "edit", order, playNext);
            } else if (kind === "album") {
                await jellyfinFuncs.jellyfinAddAlbum(interaction, { type: "album", id }, "edit", order, playNext);
            } else {
                await jellyfinFuncs.jellyfinAddTrack(interaction, playNext, { type: "track", id }, "edit");
            }
        }
    }
});
