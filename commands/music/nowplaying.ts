import { SlashCommandBuilder } from "@discordjs/builders";
import { AttachmentBuilder } from "discord.js";
import { useMainPlayer } from "discord-player";
import type { GuildCommandInteraction } from "../../types/discord";
import { registerNpControlMessage } from "../../utils/npControlMessages";
import { buildNpComponents, buildNpEmbed, NP_SLASH_TITLE_KEY } from "../../utils/nowPlayingUi";
import { buildCoverImageDescription } from "../../utils/botText";
import {
  ensureInVoiceChannel,
  ensureSameVoiceChannel,
  getQueueNotPlayingResponse,
} from "../../utils/interactionGuards";

export default {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription("Check the currently playing song!"),
  async execute(interaction: GuildCommandInteraction): Promise<void> {
    if (!(await ensureInVoiceChannel(interaction))) return;
    if (!(await ensureSameVoiceChannel(interaction))) return;

    const player = useMainPlayer();
    const queue = player.nodes.get(interaction.guild.id);
    if (!queue || !queue.isPlaying()) {
      await interaction.reply(getQueueNotPlayingResponse(interaction));
      return;
    }

    const footerMember = queue.currentTrack!.requestedBy != null ? interaction.user : null;

    const npembed = buildNpEmbed(queue, {
      title: NP_SLASH_TITLE_KEY,
      footerMember,
    });

    if (!npembed) {
      await interaction.reply(getQueueNotPlayingResponse(interaction));
      return;
    }

    const coverImage = new AttachmentBuilder(queue.currentTrack!.thumbnail, {
      name: "coverimage.jpg",
      description: buildCoverImageDescription(interaction, "song", queue.currentTrack!.title),
    });

    const finalComponents = buildNpComponents(interaction);

    const response = await interaction.reply({
      embeds: [npembed],
      components: finalComponents as any,
      files: [coverImage],
      withResponse: true,
    });
    registerNpControlMessage(queue, response.resource.message.id);
  },
};
