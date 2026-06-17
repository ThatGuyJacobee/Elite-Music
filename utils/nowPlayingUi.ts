import { EmbedBuilder, ButtonBuilder, ActionRowBuilder } from "discord.js";
import type { User, GuildMember } from "discord.js";
import type { ExtendedClient } from "../types";
import {
  buildRequestedByFooter,
  buildTrackLinkText,
  getDisplayName,
  translate,
} from "./botText";

// Now Playing UI Constants
export const NP_PLAYER_START_TITLE = "Starting next song... Now Playing 🎵";
export const NP_SLASH_TITLE = "Now playing 🎵";

export function buildNpComponents(): ActionRowBuilder[] {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("np-delete").setStyle(4).setLabel("🗑️"),
      new ButtonBuilder().setCustomId("np-back").setStyle(1).setLabel("⏮️ Previous"),
      new ButtonBuilder().setCustomId("np-pauseresume").setStyle(1).setLabel("⏯️ Play/Pause"),
      new ButtonBuilder().setCustomId("np-skip").setStyle(1).setLabel("⏭️ Skip"),
      new ButtonBuilder().setCustomId("np-clear").setStyle(1).setLabel("🧹 Clear Queue"),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("np-volumeadjust").setStyle(1).setLabel("🔊 Adjust Volume"),
      new ButtonBuilder().setCustomId("np-loop").setStyle(1).setLabel("🔂 Loop Once"),
      new ButtonBuilder().setCustomId("np-shuffle").setStyle(1).setLabel("🔀 Shuffle Queue"),
      new ButtonBuilder().setCustomId("np-stop").setStyle(1).setLabel("🛑 Stop Queue"),
    ),
  ];
}

export function buildNpEmbed(
  queue: any,
  options: { title: string; footerMember?: User | GuildMember | null },
): EmbedBuilder | null {
  const currentTrack = queue.currentTrack;
  if (!currentTrack) return null;

  const bot = queue.guild.client as ExtendedClient;
  const progress = queue.node.createProgressBar();
  const createBar = progress.replace(/ 0:00/g, " ◉ LIVE");

  const npembed = new EmbedBuilder()
    .setAuthor({ name: bot.user!.tag, iconURL: bot.user!.displayAvatarURL() })
    .setThumbnail("attachment://coverimage.jpg")
    .setColor(bot.config.embedColour as any)
    .setTitle(options.title)
    .setDescription(
      `${currentTrack.title} ${buildTrackLinkText(currentTrack, queue.metadata?.interaction ?? null)}\n${createBar}`,
    )
    .setTimestamp();

  if (options.footerMember != null) {
    const user = typeof (options.footerMember as any).user?.id === "string" ? (options.footerMember as any).user : options.footerMember;
    npembed.setFooter({
      text: `Requested by: ${getDisplayName(user as User)}`,
    });
  }

  return npembed;
}

export function buildPlayerStartNpEmbed(queue: any): EmbedBuilder | null {
  const currentTrack = queue.currentTrack;
  if (!currentTrack) return null;

  return buildNpEmbed(queue, {
    title: NP_PLAYER_START_TITLE,
    footerMember: currentTrack.requestedBy ?? null,
  });
}

export function buildPlayerStartNpRefreshEditOptions(queue: any): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder[];
} {
  const currentTrack = queue.currentTrack;

  return {
    embeds: [
      buildNpEmbed(queue, {
        title: NP_PLAYER_START_TITLE,
        footerMember: currentTrack?.requestedBy ?? null,
      })!,
    ],
    components: buildNpComponents(),
  };
}
