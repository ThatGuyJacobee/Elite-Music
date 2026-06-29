import "dotenv/config";
import { SlashCommandBuilder } from "@discordjs/builders";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { useMainPlayer } from "discord-player";
import type { GuildCommandInteraction } from "../../types/discord";
import { clearNpControlMessages } from "../../utils/npControlMessages";
import type { ExtendedClient } from "../../types";
import { buildRequestedByFooter, translate, translateGenericAction } from "../../utils/botText";
import {
  ensureDjAccess,
  ensureInVoiceChannel,
  ensureSameVoiceChannel,
  getQueueNotPlayingResponse,
} from "../../utils/interactionGuards";

const client = (globalThis as any).client as ExtendedClient;

export default {
  data: new SlashCommandBuilder().setName("stop").setDescription("Stops any music playing!"),
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

    const stopembed = new EmbedBuilder()
      .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setColor(client.config.embedColour as any)
      .setTitle(translate(interaction, "np.stopTitle"))
      .setDescription(translate(interaction, "np.stopDescription"))
      .setTimestamp()
      .setFooter(buildRequestedByFooter(interaction, interaction.user));

    try {
      await clearNpControlMessages(queue);
      queue.delete();
      await interaction.reply({ embeds: [stopembed] });
    } catch {
      await interaction.reply({
        content: translateGenericAction(interaction, "stoppingQueue"),
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
