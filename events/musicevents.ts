import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { useMainPlayer } from "discord-player";
import { buildImageAttachment } from "../utils/utilityFunctions";
import { clearNpControlMessages, registerNpControlMessage, startNpAutoRefresh } from "../utils/npControlMessages";
import {
  buildNpComponents,
  buildPlayerStartNpEmbed,
  buildPlayerStartNpRefreshEditOptions,
} from "../utils/nowPlayingUi";
import type { ExtendedClient } from "../types";
import { translate } from "../utils/botText";

const client = (globalThis as any).client as ExtendedClient;
const player = useMainPlayer();

player.events.on("error", (queue: any, error: Error) => {
  console.log(`[${queue.guild.name}] (ID:${queue.metadata.channel}) Error emitted from the queue: ${error.message}`);
});

player.events.on("playerError", (queue: any, error: Error) => {
  console.log(`[${queue.guild.name}] (ID:${queue.metadata.channel}) Error emitted from the player: ${error.message}`);
  queue.metadata.channel.send({
    content: translate(queue.metadata, "errors.failedToExtractSong"),
  });
});

player.events.on("playerStart", async (queue: any) => {
  await clearNpControlMessages(queue);

  const imageAttachment = await buildImageAttachment(queue.currentTrack.thumbnail, {
    name: "coverimage.jpg",
    description: `Song Cover Image for ${queue.currentTrack.title}`,
  });

  const npembed = buildPlayerStartNpEmbed(queue);
  if (!npembed) return;

  const finalComponents = buildNpComponents();

  if (!queue.guild.members.me.permissionsIn(queue.metadata.channel).has(PermissionFlagsBits.SendMessages)) {
    console.log(`No Perms! (ID: ${queue.guild.id})`);
    return;
  }

  const msg = await queue.metadata.channel.send({
    embeds: [npembed],
    components: finalComponents,
    files: [imageAttachment],
  });

  registerNpControlMessage(queue, msg.id);
  startNpAutoRefresh(queue, msg, async (q: any) => buildPlayerStartNpRefreshEditOptions(q));
});

player.events.on("disconnect", async (queue: any) => {
  await clearNpControlMessages(queue);

  const disconnectedembed = new EmbedBuilder()
    .setAuthor({ name: player.client.user!.tag, iconURL: player.client.user!.displayAvatarURL() })
    .setThumbnail(queue.guild.iconURL({ dynamic: true }))
    .setColor(client.config.embedColour as any)
    .setTitle(translate(queue.metadata, "np.disconnectTitle"))
    .setDescription(translate(queue.metadata, "np.disconnectDescription"))
    .setTimestamp();

  if (!queue.guild.members.me.permissionsIn(queue.metadata.channel).has(PermissionFlagsBits.SendMessages)) {
    console.log(`No Perms! (ID: ${queue.guild.id})`);
    return;
  }
  queue.metadata.channel.send({ embeds: [disconnectedembed] });
});

player.events.on("emptyChannel", async (queue: any) => {
  await clearNpControlMessages(queue);

  const emptyembed = new EmbedBuilder()
    .setAuthor({ name: player.client.user!.tag, iconURL: player.client.user!.displayAvatarURL() })
    .setThumbnail(queue.guild.iconURL({ dynamic: true }))
    .setColor(client.config.embedColour as any)
    .setTitle(translate(queue.metadata, "np.emptyChannelTitle"))
    .setDescription(translate(queue.metadata, "np.emptyChannelDescription"))
    .setTimestamp();

  if (!queue.guild.members.me.permissionsIn(queue.metadata.channel).has(PermissionFlagsBits.SendMessages)) {
    console.log(`No Perms! (ID: ${queue.guild.id})`);
    return;
  }
  queue.metadata.channel.send({ embeds: [emptyembed] });
});

player.events.on("emptyQueue", async (queue: any) => {
  await clearNpControlMessages(queue);

  const endembed = new EmbedBuilder()
    .setAuthor({ name: player.client.user!.tag, iconURL: player.client.user!.displayAvatarURL() })
    .setThumbnail(queue.guild.iconURL({ dynamic: true }))
    .setColor(client.config.embedColour as any)
    .setTitle(translate(queue.metadata, "np.emptyQueueTitle"))
    .setDescription(translate(queue.metadata, "np.emptyQueueDescription"))
    .setTimestamp();

  if (!queue.guild.members.me.permissionsIn(queue.metadata.channel).has(PermissionFlagsBits.SendMessages)) {
    console.log(`No Perms! (ID: ${queue.guild.id})`);
    return;
  }
  queue.metadata.channel.send({ embeds: [endembed] });
});

// Only registers discord-player listeners, skip the Discord.js client event loader.
export default { skipDiscordEventRegistration: true };
