import "dotenv/config";
import { SlashCommandBuilder } from "@discordjs/builders";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { useMainPlayer } from "discord-player";
import ms from "ms";
import type { GuildCommandInteraction } from "../../types/discord";
import type { ExtendedClient } from "../../types";
import {
  buildRequestedByFooter,
  buildTrackLinkText,
  translate,
  translateGenericAction,
} from "../../utils/botText";
import {
  ensureDjAccess,
  ensureInVoiceChannel,
  ensureSameVoiceChannel,
  getQueueNotPlayingResponse,
} from "../../utils/interactionGuards";

const client = (globalThis as any).client as ExtendedClient;

export default {
  data: new SlashCommandBuilder()
    .setName("seek")
    .setDescription("Seek to another time in the current song!")
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("The time to seek the current song (Examples: 1s, 1m, 1h)!")
        .setRequired(true),
    ),
  async execute(interaction: GuildCommandInteraction): Promise<void> {
    if (!(await ensureDjAccess(interaction))) return;
    if (!(await ensureInVoiceChannel(interaction))) return;
    if (!(await ensureSameVoiceChannel(interaction))) return;

    const player = useMainPlayer();
    const queue = player.nodes.get(interaction.guild.id);
    if (!queue || !queue.isPlaying()) {
      await interaction.reply(getQueueNotPlayingResponse(interaction));
      return;
    }

    const removeamount = ms(interaction.options.getString("time")! as any);

    const seekembed = new EmbedBuilder()
      .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setColor(client.config.embedColour as any)
      .setTitle(translate(interaction, "seek.title"))
      .setDescription(
        translate(interaction, "seek.description", {
          time: ms(removeamount as any),
          title: queue.currentTrack!.title,
          link: buildTrackLinkText(queue.currentTrack!, interaction),
        }),
      )
      .setTimestamp()
      .setFooter(buildRequestedByFooter(interaction, interaction.user));

    try {
      queue.node.seek(removeamount as any);
      await interaction.reply({ embeds: [seekembed] });
    } catch {
      await interaction.reply({
        content: translateGenericAction(interaction, "seekingSong"),
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
