import "dotenv/config";
import { SlashCommandBuilder } from "@discordjs/builders";
import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags,
} from "discord.js";
import type { GuildCommandInteraction, StringSelectMenuInteraction } from "../../types/discord";
import type { ExtendedClient } from "../../types";
import {
  buildRequestedByFooter,
  translate,
  translateSearchMediaType,
} from "../../utils/botText";
import {
  ensureDjAccess,
  ensureInVoiceChannel,
  ensureSameVoiceChannel,
  ensurePlexEnabled,
  ephemeralReply,
} from "../../utils/interactionGuards";
import { getQueue } from "../../utils/sharedFunctions";
import {
  formatPlexDurationLabel,
  plexAddPlaylist,
  plexAddAlbum,
  plexAddTrack,
  plexSearchQuery,
} from "../../utils/plexFunctions";

const client = (globalThis as any).client as ExtendedClient;
const pickerEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

// Re-usable slash option for content type selection
const plexScopeSlashOption = (option: any) =>
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

const plexOrderSlashOption = (option: any) =>
  option
    .setName("order")
    .setDescription("Order used when adding multiple tracks from a playlist or album.")
    .setRequired(false)
    .addChoices(
      { name: "Sequential", value: "sequential" },
      { name: "Shuffle", value: "shuffle" },
      { name: "Reverse", value: "reverse" },
    );

export default {
  data: new SlashCommandBuilder()
    .setName("plex")
    .setDescription("Play music from your Plex library into the queue!")
    .addSubcommand((subcommand: any) =>
      subcommand
        .setName("play")
        .setDescription("Play a track, playlist, or album from your Plex server.")
        .addStringOption((option: any) =>
          option.setName("music").setDescription("Search query for a track, playlist, or album.").setRequired(true),
        )
        .addStringOption(plexScopeSlashOption)
        .addStringOption(plexOrderSlashOption),
    )
    .addSubcommand((subcommand: any) =>
      subcommand
        .setName("search")
        .setDescription("Search tracks, playlists, and albums.")
        .addStringOption((option: any) =>
          option.setName("music").setDescription("Search query for a track, playlist, or album.").setRequired(true),
        )
        .addStringOption(plexScopeSlashOption)
        .addStringOption(plexOrderSlashOption),
    )
    .addSubcommand((subcommand: any) =>
      subcommand
        .setName("playnext")
        .setDescription("Add a track, playlist, or album from your Plex server to play next.")
        .addStringOption((option: any) =>
          option.setName("music").setDescription("Search query for a track, playlist, or album.").setRequired(true),
        )
        .addStringOption(plexScopeSlashOption)
        .addStringOption(plexOrderSlashOption),
    ),
  async execute(interaction: GuildCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "play" || subcommand === "playnext" || subcommand === "search") {
      return runPlexFlow(interaction, {
        subcommand,
        forcePicker: subcommand === "search",
      });
    }
  },
};

async function assertPlexSlashGuards(interaction: GuildCommandInteraction): Promise<boolean> {
  if (!(await ensureDjAccess(interaction))) return false;
  if (!(await ensurePlexEnabled(interaction))) return false;
  if (!(await ensureInVoiceChannel(interaction))) return false;
  if (!(await ensureSameVoiceChannel(interaction))) return false;
  return true;
}

async function runPlexFlow(
  interaction: GuildCommandInteraction,
  { subcommand, forcePicker }: { subcommand: string; forcePicker?: boolean },
): Promise<void> {
  const guardsOk = await assertPlexSlashGuards(interaction);
  if (!guardsOk) return;

  const query = interaction.options.getString("music")!;
  const searchScope = interaction.options.getString("scope") ?? "auto";
  const playlistOrder = interaction.options.getString("order") ?? "sequential";
  await getQueue(interaction);

  try {
    const searchResults = await plexSearchQuery(query, { scope: searchScope });
    if (!searchResults) {
      return interaction.reply(ephemeralReply({
        content: translate(interaction, "errors.failedToFindMediaQuery"),
      }));
    }

    await interaction.deferReply();

    const usePlayNext = subcommand === "playnext";
    const shouldShowPicker = forcePicker || searchResults.size >= 2;

    if (shouldShowPicker) {
      const embedFields: { name: string; value: string }[] = [];
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

          const durationLabel = formatPlexDurationLabel(song.duration as number);
          const songTitle = `${(song as any).parentTitle} - ${(song as any).grandparentTitle}`;
          embedFields.push({
            name: translate(interaction, "search.mediaResult", {
              index: resultIndex,
              type: translateSearchMediaType(interaction, song.type as string),
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

          const durationLabel = formatPlexDurationLabel(playlist.duration as number);
          const playlistSongCount = Number((playlist as any).leafCount ?? (playlist as any).childCount ?? 0);
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
                  type: translateSearchMediaType(interaction, playlist.type as string),
                  suffix: playlistResultSuffix,
                })
              : translate(interaction, "search.mediaResultNoSuffix", {
                  index: resultIndex,
                  type: translateSearchMediaType(interaction, playlist.type as string),
                }),
            value: `${playlist.title}`,
          });

          actionRowSelect.components[0].addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(
                (playlist.title as string).length > 100
                  ? `${playlist.title.substring(0, 97)}...`
                  : playlist.title,
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

          const albumSongCount = Number((album as any).leafCount ?? (album as any).childCount ?? 0);
          const albumSongCountLabel =
            Number.isFinite(albumSongCount) && albumSongCount > 0
              ? translate(interaction, "search.songCount", { count: albumSongCount })
              : "";
          const albumTitle = (album as any).parentTitle
            ? `${album.title} - ${(album as any).parentTitle}`
            : album.title;
          embedFields.push({
            name: albumSongCountLabel
              ? translate(interaction, "search.mediaResult", {
                  index: resultIndex,
                  type: translateSearchMediaType(interaction, album.type as string),
                  suffix: albumSongCountLabel,
                })
              : translate(interaction, "search.mediaResultNoSuffix", {
                  index: resultIndex,
                  type: translateSearchMediaType(interaction, album.type as string),
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
        .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setTitle(translate(interaction, "search.plexTitle"))
        .setDescription(pickerDescription)
        .addFields(embedFields)
        .setColor(client.config.embedColour as any)
        .setTimestamp()
        .setFooter(buildRequestedByFooter(interaction, interaction.user));

      const cancelRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("np-delete")
          .setStyle(4)
          .setLabel(translate(interaction, "search.cancel")),
      );

      await interaction.followUp({ embeds: [resultsEmbed], components: [actionRowSelect, cancelRow] as any });
    } else {
      const itemFound =
        (searchResults.songs && searchResults.songs[0]) ||
        (searchResults.playlists && searchResults.playlists[0]) ||
        (searchResults.albums && searchResults.albums[0]);

      if (itemFound.type == "playlist") {
        await plexAddPlaylist(interaction, itemFound, "send", playlistOrder, usePlayNext);
      } else if (itemFound.type == "album") {
        await plexAddAlbum(interaction, itemFound, "send", playlistOrder, usePlayNext);
      } else {
        await plexAddTrack(interaction, usePlayNext, itemFound, "send");
      }
    }
  } catch (err) {
    console.log(err);
    const errorMessage = translate(interaction, "errors.playRequest");
    if (interaction.deferred) {
      return interaction
        .followUp({ content: errorMessage, flags: MessageFlags.Ephemeral })
        .catch(() => interaction.editReply({ content: errorMessage }));
    }
    return interaction.reply(ephemeralReply({ content: errorMessage }));
  }
}

// Handle plex search select menu
client.on("interactionCreate", async (interaction: any) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId != "plexsearch") return;

  await getQueue(interaction);

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
      (metadataJson.MediaContainer as any).type = itemType;
      await plexAddPlaylist(
        interaction,
        metadataJson.MediaContainer,
        "edit",
        playlistOrder,
        usePlayNext,
      );
    } else if (itemType == "album") {
      (metadataJson.MediaContainer as any).type = itemType;
      await plexAddAlbum(
        interaction,
        metadataJson.MediaContainer.Metadata[0],
        "edit",
        playlistOrder,
        usePlayNext,
      );
    } else {
      await plexAddTrack(interaction, usePlayNext, metadataJson.MediaContainer.Metadata[0], "edit");
    }
  }
});
