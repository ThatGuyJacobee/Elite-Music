require("dotenv").config();
const musicFuncs = require("../../utils/sharedFunctions.js");
const subsonicFuncs = require("../../utils/subsonicFunctions.js");
const { formatDurationMs } = require("../../utils/utilityFunctions.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const {
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require("discord.js");

const subsonicScopeSlashOption = (option) =>
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

const subsonicOrderSlashOption = (option) =>
    option
        .setName("order")
        .setDescription("Order used when adding multiple tracks from a playlist or album.")
        .setRequired(false)
        .addChoices(
            { name: "Sequential", value: "sequential" },
            { name: "Shuffle", value: "shuffle" },
            { name: "Reverse", value: "reverse" },
        );

function subsonicSelectValue(kind, playNext, order, id) {
    const orderMode = order && order !== "" ? order : "sequential";
    return `${kind}|${playNext ? "true" : "false"}|${orderMode}|${id}`;
}

function parseSubsonicSelectValue(option) {
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
        .setName("subsonic")
        .setDescription("Play music from your Subsonic library into the queue!")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("play")
                .setDescription("Play a track, playlist, or album from your Subsonic server.")
                .addStringOption((option) =>
                    option
                        .setName("music")
                        .setDescription("Search query for a track, playlist, or album.")
                        .setRequired(true),
                )
                .addStringOption(subsonicScopeSlashOption)
                .addStringOption(subsonicOrderSlashOption),
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
                .addStringOption(subsonicScopeSlashOption)
                .addStringOption(subsonicOrderSlashOption),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("playnext")
                .setDescription("Add a track, playlist, or album from your Subsonic server to play next.")
                .addStringOption((option) =>
                    option
                        .setName("music")
                        .setDescription("Search query for a track, playlist, or album.")
                        .setRequired(true),
                )
                .addStringOption(subsonicScopeSlashOption)
                .addStringOption(subsonicOrderSlashOption),
        ),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "play" || subcommand === "playnext" || subcommand === "search") {
            return runSubsonicFlow(interaction, {
                subcommand,
                forcePicker: subcommand === "search",
            });
        }
    },
};

async function assertSubsonicSlashGuards(interaction) {
    if (client.config.enableDjMode) {
        if (!interaction.member.roles.cache.has(client.config.djRole)) {
            await interaction.reply({
                content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`,
                ephemeral: true,
            });
            return false;
        }
    }

    if (!client.config.enableSubsonic) {
        await interaction.reply({
            content: `❌ | Subsonic is currently disabled! Ask the server admin to enable and configure this in the environment file.`,
            ephemeral: true,
        });
        return false;
    }

    if (!interaction.member.voice.channelId) {
        await interaction.reply({
            content: "❌ | You are not in a voice channel!",
            ephemeral: true,
        });
        return false;
    }

    if (
        interaction.guild.members.me.voice.channelId &&
        interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId
    ) {
        await interaction.reply({
            content: "❌ | You are not in my voice channel!",
            ephemeral: true,
        });
        return false;
    }

    return true;
}

async function runSubsonicFlow(interaction, { subcommand, forcePicker }) {
    const guardsOk = await assertSubsonicSlashGuards(interaction);
    if (!guardsOk) return;

    const query = interaction.options.getString("music");
    const searchScope = interaction.options.getString("scope") ?? "auto";
    const playlistOrder = interaction.options.getString("order") ?? "sequential";
    await musicFuncs.getQueue(interaction);

    try {
        const results = await subsonicFuncs.subsonicSearchQuery(query, { scope: searchScope });
        if (!results || (!results.songs?.length && !results.playlists?.length && !results.albums?.length)) {
            return interaction.reply({
                content: `❌ | Ooops... something went wrong, couldn't find the song, playlist, or album with the requested query.`,
                ephemeral: true,
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
                    .setCustomId("subsonicsearch")
                    .setMinValues(1)
                    .setMaxValues(1)
                    .setPlaceholder("Add an item to queue 👈"),
            );

            if (results.songs) {
                for (const item of results.songs) {
                    if (count > 10) break;

                    const durationLabel = formatDurationMs(item.duration);
                    const songTitle = `${item.parentTitle} - ${item.grandparentTitle}`;
                    embedFields.push({
                        name: `[${count}] ${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Result (${durationLabel})`,
                        value: songTitle,
                    });

                    actionmenu.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(songTitle.length > 100 ? `${songTitle.substring(0, 97)}...` : songTitle)
                            .setValue(subsonicSelectValue("song", playNextFlag, playlistOrder, item.id))
                            .setDescription(`Duration - ${durationLabel}`)
                            .setEmoji(emojis[count - 1]),
                    );
                    count++;
                }
            }

            if (results.playlists) {
                for (const item of results.playlists) {
                    if (count > 10) break;

                    const playlistSongCount = Number(item.leafCount ?? item.songCount ?? 0);
                    const playlistSongCountLabel =
                        Number.isFinite(playlistSongCount) && playlistSongCount > 0 ? `${playlistSongCount} songs` : "";

                    const playlistDurationLabel = formatDurationMs(item.duration || 0);
                    const hasKnownDuration = playlistDurationLabel !== "--:--";
                    const playlistResultSuffix =
                        playlistSongCountLabel && hasKnownDuration
                            ? `${playlistSongCountLabel} - ${playlistDurationLabel}`
                            : playlistSongCountLabel || (hasKnownDuration ? playlistDurationLabel : "");

                    embedFields.push({
                        name: `[${count}] ${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Result${playlistResultSuffix ? ` (${playlistResultSuffix})` : ""}`,
                        value: `${item.title}`,
                    });

                    actionmenu.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(item.title.length > 100 ? `${item.title.substring(0, 97)}...` : item.title)
                            .setValue(subsonicSelectValue("playlist", playNextFlag, playlistOrder, item.id))
                            .setDescription(playlistResultSuffix || "Playlist")
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
                        Number.isFinite(albumSongCount) && albumSongCount > 0 ? `${albumSongCount} songs` : "";

                    const albumDurationLabel = formatDurationMs(item.duration || 0);
                    const hasKnownDuration = albumDurationLabel !== "--:--";
                    const albumResultSuffix =
                        albumSongCountLabel && hasKnownDuration
                            ? `${albumSongCountLabel} - ${albumDurationLabel}`
                            : albumSongCountLabel || (hasKnownDuration ? albumDurationLabel : "");

                    const albumTitle = item.artist ? `${item.title} - ${item.artist}` : item.title;
                    embedFields.push({
                        name: `[${count}] ${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Result${albumResultSuffix ? ` (${albumResultSuffix})` : ""}`,
                        value: albumTitle,
                    });

                    actionmenu.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(albumTitle.length > 100 ? `${albumTitle.substring(0, 97)}...` : albumTitle)
                            .setValue(subsonicSelectValue("album", playNextFlag, playlistOrder, item.id))
                            .setDescription(albumResultSuffix || "Album")
                            .setEmoji(emojis[count - 1]),
                    );
                    count++;
                }
            }

            const searchEmbedDescription =
                results.size >= 2
                    ? "Found multiple results matching the provided search query, select one from the menu below."
                    : "Select an item below to add it to the queue.";

            const searchEmbed = new EmbedBuilder()
                .setAuthor({
                    name: interaction.client.user.tag,
                    iconURL: interaction.client.user.displayAvatarURL(),
                })
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setTitle(`Subsonic Search Results 🎵`)
                .setDescription(searchEmbedDescription)
                .addFields(embedFields)
                .setColor(client.config.embedColour)
                .setTimestamp()
                .setFooter({
                    text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}`,
                });

            const actionbutton = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("np-delete").setStyle(4).setLabel("Cancel Search 🗑️"),
            );

            return interaction.followUp({ embeds: [searchEmbed], components: [actionmenu, actionbutton] });
        }

        const itemFound =
            (results.songs && results.songs[0]) ||
            (results.playlists && results.playlists[0]) ||
            (results.albums && results.albums[0]);

        if (itemFound.type == "playlist") {
            return subsonicFuncs.subsonicAddPlaylist(interaction, itemFound, "send", playlistOrder, playNextFlag);
        }

        if (itemFound.type == "album") {
            return subsonicFuncs.subsonicAddAlbum(interaction, itemFound, "send", playlistOrder, playNextFlag);
        }

        return subsonicFuncs.subsonicAddTrack(interaction, playNextFlag, itemFound, "send");
    } catch (err) {
        console.log(err);
        const errorMessage = `❌ | Ooops... something went wrong whilst attempting to play the requested song. Please try again.`;
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
    if (interaction.customId == "subsonicsearch") {
        await musicFuncs.getQueue(interaction);
        const allcomponents = interaction.values;

        await interaction.deferUpdate();

        for await (const option of allcomponents) {
            const { kind, playNext, order, id } = parseSubsonicSelectValue(option);

            if (kind === "playlist") {
                await subsonicFuncs.subsonicAddPlaylist(interaction, { type: "playlist", id }, "edit", order, playNext);
            } else if (kind === "album") {
                await subsonicFuncs.subsonicAddAlbum(interaction, { type: "album", id }, "edit", order, playNext);
            } else {
                await subsonicFuncs.subsonicAddTrack(interaction, playNext, { type: "track", id }, "edit");
            }
        }
    }
});
