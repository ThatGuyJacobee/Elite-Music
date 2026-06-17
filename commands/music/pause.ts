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
  data: new SlashCommandBuilder().setName("pause").setDescription("Pause the current song at the current time!"),
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

    const checkPause = queue.node.isPaused();

    const pauseembed = new EmbedBuilder()
      .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
      .setThumbnail(queue.currentTrack!.thumbnail)
      .setColor(client.config.embedColour as any)
      .setTitle(translate(interaction, "np.pauseTitle"))
      .setDescription(
        translate(interaction, "np.pauseDescription", {
          state: translate(interaction, checkPause ? "np.pauseStateResumed" : "np.pauseStatePaused"),
          title: queue.currentTrack!.title,
          link: buildTrackLinkText(queue.currentTrack!, interaction),
        }),
      )
      .setTimestamp()
      .setFooter(buildRequestedByFooter(interaction, interaction.user));

    try {
      queue.node.setPaused(!queue.node.isPaused());
      await interaction.reply({ embeds: [pauseembed] });
    } catch {
      await interaction.reply({
        content: translateGenericAction(interaction, checkPause ? "resuming" : "pausing"),
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
