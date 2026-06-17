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
import type { GuildCommandInteraction } from "../../types/discord";
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
  ensureSubsonicEnabled,
  ephemeralReply,
} from "../../utils/interactionGuards";
import { getQueue } from "../../utils/sharedFunctions";
import { formatDurationMs } from "../../utils/utilityFunctions";
import {
  subsonicSearchQuery,
  subsonicAddPlaylist,
  subsonicAddAlbum,
  subsonicAddTrack,
} from "../../utils/subsonicFunctions";

const client = (globalThis as any).client as ExtendedClient;
const pickerEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

const subsonicScopeSlashOption = (option: any) =>
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

const subsonicOrderSlashOption = (option: any) =>
  option
    .setName("order")
    .setDescription("Order used when adding multiple tracks from a playlist or album.")
    .setRequired(false)
    .addChoices(
      { name: "Sequential", value: "sequential" },
      { name: "Shuffle", value: "shuffle" },
      { name: "Reverse", value: "reverse" },
    );

function subsonicSelectValue(kind: string, playNext: boolean, order: string, id: string): string {
  const orderMode = order && order !== "" ? order : "sequential";
  return `${kind}|${playNext ? "true" : "false"}|${orderMode}|${id}`;
}

function parseSubsonicSelectValue(option: string): { kind: string; playNext: boolean; order: string; id: string } {
  const parts = String(option).split("|");
  const kind = parts[0];
  const playNext = parts[1] === "true";
  if (parts.length >= 4) {
    return { kind, playNext, order: parts[2], id: parts.slice(3).join("|") };
  }
  const id = parts.slice(2).join("|");
  return { kind, playNext, order: "sequential", id };
}

export default {
  data: new SlashCommandBuilder()
    .setName("subsonic")
    .setDescription("Play music from your Subsonic library into the queue!")
    .addSubcommand((subcommand: any) =>
      subcommand
        .setName("play")
        .setDescription("Play a track, playlist, or album from your Subsonic server.")
        .addStringOption((option: any) =>
          option.setName("music").setDescription("Search query for a track, playlist, or album.").setRequired(true),
        )
        .addStringOption(subsonicScopeSlashOption)
        .addStringOption(subsonicOrderSlashOption),
    )
    .addSubcommand((subcommand: any) =>
      subcommand
        .setName("search")
        .setDescription("Search tracks, playlists, and albums.")
        .addStringOption((option: any) =>
          option.setName("music").setDescription("Search query for a track, playlist, or album.").setRequired(true),
        )
        .addStringOption(subsonicScopeSlashOption)
        .addStringOption(subsonicOrderSlashOption),
    )
    .addSubcommand((subcommand: any) =>
      subcommand
        .setName("playnext")
        .setDescription("Add a track, playlist, or album from your Subsonic server to play next.")
        .addStringOption((option: any) =>
          option.setName("music").setDescription("Search query for a track, playlist, or album.").setRequired(true),
        )
        .addStringOption(subsonicScopeSlashOption)
        .addStringOption(subsonicOrderSlashOption),
    ),
  async execute(interaction: GuildCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "play" || subcommand === "playnext" || subcommand === "search") {
      return runSubsonicFlow(interaction, {
        subcommand,
        forcePicker: subcommand === "search",
      });
    }
  },
};

async function assertSubsonicSlashGuards(interaction: GuildCommandInteraction): Promise<boolean> {
  if (!(await ensureDjAccess(interaction))) return false;
  if (!(await ensureSubsonicEnabled(interaction))) return false;
  if (!(await ensureInVoiceChannel(interaction))) return false;
  if (!(await ensureSameVoiceChannel(interaction))) return false;
  return true;
}

async function runSubsonicFlow(
  interaction: GuildCommandInteraction,
  { subcommand, forcePicker }: { subcommand: string; forcePicker?: boolean },
): Promise<void> {
  const guardsOk = await assertSubsonicSlashGuards(interaction);
  if (!guardsOk) return;

  const query = interaction.options.getString("music")!;
  const searchScope = interaction.options.getString("scope") ?? "auto";
  const playlistOrder = interaction.options.getString("order") ?? "sequential";
  await getQueue(interaction);

  try {
    const results = await subsonicSearchQuery(query, { scope: searchScope });
    if (!results || (!results.songs?.length && !results.playlists?.length && !results.albums?.length)) {
      return interaction.reply(ephemeralReply({
        content: translate(interaction, "errors.failedToFindMediaQuery"),
      }));
    }

    await interaction.deferReply();

    const playNextFlag = subcommand === "playnext";
    const shouldShowPicker = forcePicker || results.size >= 2;

    if (shouldShowPicker) {
      const embedFields: { name: string; value: string }[] = [];
      let count = 1;

      const actionmenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("subsonicsearch")
          .setMinValues(1)
          .setMaxValues(1)
          .setPlaceholder(translate(interaction, "search.placeholder")),
      );

      if (results.songs) {
        for (const item of results.songs) {
          if (count > 10) break;

          const durationLabel = formatDurationMs(item.duration as number);
          const songTitle = `${(item as any).parentTitle} - ${(item as any).grandparentTitle}`;
          embedFields.push({
            name: translate(interaction, "search.mediaResult", {
              index: count,
              type: translateSearchMediaType(interaction, item.type as string),
              suffix: durationLabel,
            }),
            value: songTitle,
          });

          actionmenu.components[0].addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(songTitle.length > 100 ? `${songTitle.substring(0, 97)}...` : songTitle)
              .setValue(subsonicSelectValue("song", playNextFlag, playlistOrder, item.id as string))
              .setDescription(translate(interaction, "search.duration", { duration: durationLabel }))
              .setEmoji(pickerEmojis[count - 1]),
          );
          count++;
        }
      }

      if (results.playlists) {
        for (const item of results.playlists) {
          if (count > 10) break;

          const playlistSongCount = Number((item as any).leafCount ?? (item as any).songCount ?? 0);
          const playlistSongCountLabel =
            Number.isFinite(playlistSongCount) && playlistSongCount > 0
              ? translate(interaction, "search.songCount", { count: playlistSongCount })
              : "";

          const playlistDurationLabel = formatDurationMs((item as any).duration || 0);
          const hasKnownDuration = playlistDurationLabel !== "--:--";
          const playlistResultSuffix =
            playlistSongCountLabel && hasKnownDuration
              ? `${playlistSongCountLabel} - ${playlistDurationLabel}`
              : playlistSongCountLabel || (hasKnownDuration ? playlistDurationLabel : "");

          embedFields.push({
            name: playlistResultSuffix
              ? translate(interaction, "search.mediaResult", {
                  index: count,
                  type: translateSearchMediaType(interaction, item.type as string),
                  suffix: playlistResultSuffix,
                })
              : translate(interaction, "search.mediaResultNoSuffix", {
                  index: count,
                  type: translateSearchMediaType(interaction, item.type as string),
                }),
            value: `${item.title}`,
          });

          actionmenu.components[0].addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(
                (item.title as string).length > 100
                  ? `${item.title.substring(0, 97)}...`
                  : item.title,
              )
              .setValue(subsonicSelectValue("playlist", playNextFlag, playlistOrder, item.id as string))
              .setDescription(playlistResultSuffix || translate(interaction, "search.playlist"))
              .setEmoji(pickerEmojis[count - 1]),
          );
          count++;
        }
      }

      if (results.albums) {
        for (const item of results.albums) {
          if (count > 10) break;

          const albumSongCount = Number((item as any).leafCount ?? 0);
          const albumSongCountLabel =
            Number.isFinite(albumSongCount) && albumSongCount > 0
              ? translate(interaction, "search.songCount", { count: albumSongCount })
              : "";

          const albumDurationLabel = formatDurationMs((item as any).duration || 0);
          const hasKnownDuration = albumDurationLabel !== "--:--";
          const albumResultSuffix =
            albumSongCountLabel && hasKnownDuration
              ? `${albumSongCountLabel} - ${albumDurationLabel}`
              : albumSongCountLabel || (hasKnownDuration ? albumDurationLabel : "");

          const albumTitle = (item as any).artist
            ? `${item.title} - ${(item as any).artist}`
            : item.title;
          embedFields.push({
            name: albumResultSuffix
              ? translate(interaction, "search.mediaResult", {
                  index: count,
                  type: translateSearchMediaType(interaction, item.type as string),
                  suffix: albumResultSuffix,
                })
              : translate(interaction, "search.mediaResultNoSuffix", {
                  index: count,
                  type: translateSearchMediaType(interaction, item.type as string),
                }),
            value: albumTitle,
          });

          actionmenu.components[0].addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(albumTitle.length > 100 ? `${albumTitle.substring(0, 97)}...` : albumTitle)
              .setValue(subsonicSelectValue("album", playNextFlag, playlistOrder, item.id as string))
              .setDescription(albumResultSuffix || translate(interaction, "search.album"))
              .setEmoji(pickerEmojis[count - 1]),
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
          name: interaction.client.user!.tag,
          iconURL: interaction.client.user!.displayAvatarURL(),
        })
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setTitle(translate(interaction, "search.subsonicTitle"))
        .setDescription(searchEmbedDescription)
        .addFields(embedFields)
        .setColor(client.config.embedColour as any)
        .setTimestamp()
        .setFooter(buildRequestedByFooter(interaction, interaction.user));

      const actionbutton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("np-delete")
          .setStyle(4)
          .setLabel(translate(interaction, "search.cancel")),
      );

      return interaction.followUp({ embeds: [searchEmbed], components: [actionmenu, actionbutton] as any });
    }

    const itemFound =
      (results.songs && results.songs[0]) ||
      (results.playlists && results.playlists[0]) ||
      (results.albums && results.albums[0]);

    if (itemFound.type == "playlist") {
      return subsonicAddPlaylist(interaction, itemFound, "send", playlistOrder, playNextFlag);
    }

    if (itemFound.type == "album") {
      return subsonicAddAlbum(interaction, itemFound, "send", playlistOrder, playNextFlag);
    }

    return subsonicAddTrack(interaction, playNextFlag, itemFound, "send");
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

// Handle subsonic search select menu
client.on("interactionCreate", async (interaction: any) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId == "subsonicsearch") return;

  await getQueue(interaction);
  const allcomponents = interaction.values;

  await interaction.deferUpdate();

  for await (const option of allcomponents) {
    const { kind, playNext, order, id } = parseSubsonicSelectValue(option);

    if (kind === "playlist") {
      await subsonicAddPlaylist(interaction, { type: "playlist", id }, "edit", order, playNext);
    } else if (kind === "album") {
      await subsonicAddAlbum(interaction, { type: "album", id }, "edit", order, playNext);
    } else {
      await subsonicAddTrack(interaction, playNext, { type: "track", id }, "edit");
    }
  }
});
