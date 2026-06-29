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
import { useMainPlayer, QueryType } from "discord-player";
import type { GuildCommandInteraction } from "../../types/discord";
import type { ExtendedClient } from "../../types";
import { getQueue, addTracks } from "../../utils/sharedFunctions";
import { buildRequestedByFooter, translate } from "../../utils/botText";
import { ensureDjAccess, ensureInVoiceChannel, ensureSameVoiceChannel } from "../../utils/interactionGuards";

const client = (globalThis as any).client as ExtendedClient;

const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

export default {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Place a song into the queue!")
    .addStringOption((option) =>
      option
        .setName("music")
        .setDescription("Either the name, URL or playlist URL you want to play.")
        .setRequired(true),
    ),
  async execute(interaction: GuildCommandInteraction): Promise<void> {
    if (!(await ensureDjAccess(interaction))) return;
    if (!(await ensureInVoiceChannel(interaction))) return;
    if (!(await ensureSameVoiceChannel(interaction))) return;

    const query = interaction.options.getString("music")!;
    const player = useMainPlayer();
    await getQueue(interaction);

    try {
      const search = await player.search(query, {
        requestedBy: interaction.user,
        searchEngine: QueryType.AUTO,
      });

      if (!search || search.tracks.length === 0 || !search.tracks) {
        await interaction.reply({
          content: translate(interaction, "errors.failedToFindSongQuery"),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply();

      if (search.tracks.length >= 2 && !search.playlist) {
        const foundItems: { name: string; value: string }[] = [];
        let count = 1;

        const actionmenu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("playsearch")
            .setMinValues(1)
            .setMaxValues(1)
            .setPlaceholder(translate(interaction, "search.placeholder")),
        );

        for (const result of search.tracks) {
          if (count > 10) break;
          foundItems.push({
            name: translate(interaction, result.playlist ? "search.playlistResult" : "search.songResult", {
              index: count,
              duration: result.duration,
            }),
            value: `${result.description}`,
          });

          (actionmenu.components[0] as StringSelectMenuBuilder).addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(result.title.length > 100 ? `${result.title.substring(0, 97)}...` : result.title)
              .setValue(`${!result.playlist ? "song" : "playlist"}_false_url=${result.url}`)
              .setDescription(translate(interaction, "search.duration", { duration: result.duration }))
              .setEmoji(emojis[count - 1]),
          );
          count++;
        }

        const searchembed = new EmbedBuilder()
          .setAuthor({
            name: interaction.client.user!.tag,
            iconURL: interaction.client.user!.displayAvatarURL(),
          })
          .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
          .setTitle(translate(interaction, "search.resultsTitle"))
          .setDescription(translate(interaction, "search.resultsDescription"))
          .addFields(foundItems)
          .setColor(client.config.embedColour as any)
          .setTimestamp()
          .setFooter(buildRequestedByFooter(interaction, interaction.user));

        const actionbutton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("np-delete")
            .setStyle(4)
            .setLabel(translate(interaction, "search.cancel")),
        );

        await interaction.followUp({ embeds: [searchembed], components: [actionmenu, actionbutton] as any });
      } else {
        await addTracks(interaction, false, search, "send");
      }
    } catch (err) {
      console.log(err);
      await interaction.followUp({
        content: translate(interaction, "errors.playRequest"),
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

client.on("interactionCreate", async (interaction: any) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId === "playsearch") {
    const player = useMainPlayer();
    await getQueue(interaction);
    const allcomponents = interaction.values;
    const getPlayNext =
      allcomponents[0].split("_")[1] != null && allcomponents[0].split("_")[1] === "true" ? true : false;

    try {
      const search = await player.search(allcomponents[0].split("url=")[1], {
        requestedBy: interaction.user,
        searchEngine: QueryType.AUTO,
      });

      if (!search || search.tracks.length === 0 || !search.tracks) {
        await interaction.reply({
          content: translate(interaction, "errors.failedToFindSong"),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferUpdate();
      await addTracks(interaction, getPlayNext, search, "edit");
    } catch (err) {
      console.log(err);
      await interaction.followUp({
        content: translate(interaction, "errors.playRequest"),
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});
