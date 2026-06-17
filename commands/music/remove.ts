import "dotenv/config";
import { SlashCommandBuilder } from "@discordjs/builders";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { useMainPlayer } from "discord-player";
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
    .setName("remove")
    .setDescription("Remove a specific song from the queue!")
    .addIntegerOption((option) =>
      option.setName("song").setDescription("What #no. song should be removed from the queue?").setRequired(true),
    ),
  async execute(interaction: GuildCommandInteraction): Promise<void> {
    const removeamount = interaction.options.getInteger("song")!;

    if (!(await ensureDjAccess(interaction))) return;
    if (!(await ensureInVoiceChannel(interaction))) return;
    if (!(await ensureSameVoiceChannel(interaction))) return;

    const player = useMainPlayer();
    const queue = player.nodes.get(interaction.guild.id);
    if (!queue || !queue.isPlaying()) {
      await interaction.reply(getQueueNotPlayingResponse(interaction));
      return;
    }

    const queuedTracks = queue.tracks.toArray();
    if (!queuedTracks[removeamount - 1]) {
      await interaction.reply({
        content: translate(interaction, "remove.invalidPosition"),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const removeembed = new EmbedBuilder()
      .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setColor(client.config.embedColour as any)
      .setTitle(translate(interaction, "remove.title"))
      .setDescription(
        translate(interaction, "remove.description", {
          title: queuedTracks[removeamount - 1].title,
          link: buildTrackLinkText(queuedTracks[removeamount - 1], interaction),
        }),
      )
      .setTimestamp()
      .setFooter(buildRequestedByFooter(interaction, interaction.user));

    try {
      queue.removeTrack(removeamount - 1);
      await interaction.reply({ embeds: [removeembed] });
    } catch {
      await interaction.reply({
        content: translateGenericAction(interaction, "removingSong"),
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
