require("dotenv").config();
const musicFuncs = require("../../utils/sharedFunctions.js");
const plexFuncs = require("../../utils/plexFunctions.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { ActionRowBuilder, ButtonBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");
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
        .setDescription("Order used when adding multiple tracks from a playlist.")
        .setRequired(false)
        .addChoices(
            { name: "Sequential", value: "sequential" },
            { name: "Shuffle", value: "shuffle" },
            { name: "Reverse", value: "reverse" },
        );

module.exports = {
    data: new SlashCommandBuilder()
        .setName("plex")
        .setDescription("Play a song into the queue!")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("play")
                .setDescription("Play a song from your plex.")
                .addStringOption((option) => option
                    .setName("music")
                    .setDescription("Name of the song you want to play.")
                    .setRequired(true),
                )
                .addStringOption(plexScopeSlashOption)
                .addStringOption(plexOrderSlashOption),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("search")
                .setDescription("Search songs and playlists.")
                .addStringOption((option) => option
                    .setName("music")
                    .setDescription("Search query for a single song or playlist.")
                    .setRequired(true),
                )
                .addStringOption(plexScopeSlashOption)
                .addStringOption(plexOrderSlashOption),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("playnext")
                .setDescription("Add a song from your plex to the top of the queue.")
                .addStringOption((option) => option
                    .setName("music")
                    .setDescription("Search query for a single song or playlist.")
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
    if (client.config.enableDjMode) {
        if (!interaction.member.roles.cache.has(client.config.djRole)) {
            await interaction.reply({
                content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`,
                ephemeral: true,
            });
            return false;
        }
    }

    if (!client.config.enablePlex) {
        await interaction.reply({
            content: `❌ | Plex is currently disabled! Ask the server admin to enable and configure this in the environment file.`,
            ephemeral: true,
        });
        return false;
    }

    if (!interaction.member.voice.channelId) {
        await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        return false;
    }

    if (
        interaction.guild.members.me.voice.channelId &&
        interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId
    ) {
        await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        return false;
    }

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
                content: `❌ | Ooops... something went wrong, couldn't find the song or playlist with the requested query.`,
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
                    .setPlaceholder("Add an item to queue 👈"),
            );

            if (searchResults.songs) {
                for (const song of searchResults.songs) {
                    if (resultIndex > 10) break;

                    const durationDate = new Date(song.duration);
                    const durationLabel = `${durationDate.getMinutes()}:${durationDate.getSeconds() < 10 ? `0${durationDate.getSeconds()}` : durationDate.getSeconds()}`;
                    const songTitle = `${song.parentTitle} - ${song.grandparentTitle}`;
                    embedFields.push({
                        name: `[${resultIndex}] ${song.type.charAt(0).toUpperCase() + song.type.slice(1)} Result (${durationLabel})`,
                        value: songTitle,
                    });

                    actionRowSelect.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(songTitle.length > 100 ? `${songTitle.substring(0, 97)}...` : songTitle)
                            .setValue(`${song.type}_${usePlayNext}_key=${song.key}`)
                            .setDescription(`Duration - ${durationLabel}`)
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
                    const playlistSongCountLabel = Number.isFinite(playlistSongCount) && playlistSongCount > 0
                        ? `${playlistSongCount} songs`
                        : "";

                    const hasKnownDuration = durationLabel !== "--:--";
                    const playlistResultSuffix = playlistSongCountLabel && hasKnownDuration
                        ? `${playlistSongCountLabel} - ${durationLabel}`
                        : playlistSongCountLabel || (hasKnownDuration ? durationLabel : "");

                    embedFields.push({
                        name: `[${resultIndex}] ${playlist.type.charAt(0).toUpperCase() + playlist.type.slice(1)} Result${playlistResultSuffix ? ` (${playlistResultSuffix})` : ""}`,
                        value: `${playlist.title}`,
                    });

                    actionRowSelect.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(playlist.title.length > 100 ? `${playlist.title.substring(0, 97)}...` : playlist.title)
                            .setValue(`${playlist.type}_${usePlayNext}_order=${playlistOrder}_key=${playlist.key}`)
                            .setDescription(playlistResultSuffix || "Playlist")
                            .setEmoji(pickerEmojis[resultIndex - 1]),
                    );
                    resultIndex++;
                }
            }

            if (searchResults.albums) {
                for (const album of searchResults.albums) {
                    if (resultIndex > 10) break;

                    const albumSongCount = Number(album.leafCount ?? album.childCount ?? 0);
                    const albumSongCountLabel = Number.isFinite(albumSongCount) && albumSongCount > 0
                        ? `${albumSongCount} songs`
                        : "";
                    const albumTitle = album.parentTitle ? `${album.title} - ${album.parentTitle}` : album.title;
                    embedFields.push({
                        name: `[${resultIndex}] ${album.type.charAt(0).toUpperCase() + album.type.slice(1)} Result${albumSongCountLabel ? ` (${albumSongCountLabel})` : ""}`,
                        value: albumTitle,
                    });

                    actionRowSelect.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(albumTitle.length > 100 ? `${albumTitle.substring(0, 97)}...` : albumTitle)
                            .setValue(`${album.type}_${usePlayNext}_order=${playlistOrder}_key=${album.key}`)
                            .setDescription(albumSongCountLabel || "Album")
                            .setEmoji(pickerEmojis[resultIndex - 1]),
                    );
                    resultIndex++;
                }
            }

            const pickerDescription =
                searchResults.size >= 2
                    ? "Found multiple songs matching the provided search query, select one form the menu below."
                    : "Select an item below to add it to the queue.";

            const resultsEmbed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setTitle(`Plex Search Results 🎵`)
                .setDescription(pickerDescription)
                .addFields(embedFields)
                .setColor(client.config.embedColour)
                .setTimestamp()
                .setFooter({
                    text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}`,
                });

            const cancelRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("np-delete").setStyle(4).setLabel("Cancel Search 🗑️"),
            );

            await interaction.followUp({ embeds: [resultsEmbed], components: [actionRowSelect, cancelRow] });
        } else {
            const itemFound =
                (searchResults.songs && searchResults.songs[0])
                || (searchResults.playlists && searchResults.playlists[0])
                || (searchResults.albums && searchResults.albums[0]);

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
    if (interaction.customId == "plexsearch") {
        await musicFuncs.getQueue(interaction);

        for await (const selectedValue of interaction.values) {
            const itemType = selectedValue.split("_")[0];
            const playNextSegment = selectedValue.split("_")[1];
            const usePlayNext = playNextSegment != null && playNextSegment == "true";
            const orderSegment = selectedValue.split("_")[2];
            const playlistOrder = orderSegment != null && orderSegment.startsWith("order=")
                ? orderSegment.split("order=")[1]
                : "sequential";
            const itemKey = selectedValue.split("key=")[1];

            const metadataRequest = await fetch(`${client.config.plexServer}${itemKey}?X-Plex-Token=${client.config.plexAuthtoken}`, {
                method: "GET",
                headers: { accept: "application/json" },
            });

            const metadataJson = await metadataRequest.json();

            await interaction.deferUpdate();

            if (itemType == "playlist") {
                metadataJson.MediaContainer.type = itemType;
                await plexFuncs.plexAddPlaylist(interaction, metadataJson.MediaContainer, "edit", playlistOrder, usePlayNext);
            } else if (itemType == "album") {
                metadataJson.MediaContainer.type = itemType;
                await plexFuncs.plexAddAlbum(interaction, metadataJson.MediaContainer.Metadata[0], "edit", playlistOrder, usePlayNext);
            } else {
                await plexFuncs.plexAddTrack(interaction, usePlayNext, metadataJson.MediaContainer.Metadata[0], "edit");
            }
        }
    }
});
