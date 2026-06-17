import { SlashCommandBuilder } from "@discordjs/builders";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from "discord.js";
import type { GuildCommandInteraction } from "../../types/discord";
import { checkLatestRelease } from "../../utils/utilityFunctions";
import type { ExtendedClient } from "../../types";
import { translate } from "../../utils/botText";

const client = (globalThis as any).client as ExtendedClient;

export default {
  data: new SlashCommandBuilder().setName("botinfo").setDescription("Return information about Elite Bot!"),
  async execute(interaction: GuildCommandInteraction): Promise<void> {
    const uptime = Date.now() - Math.round(process.uptime()) * 1000;
    const botuptime = `<t:${Math.floor((uptime - (uptime % 1000)) / 1000)}:R>`;

    const packageJSON: { dependencies: Record<string, string> } = require("../../package.json");

    const checkGitHub = await checkLatestRelease();

    const botembed = new EmbedBuilder()
      .setAuthor({
        name: translate(interaction, "botinfo.author", { tag: interaction.client.user!.tag }),
        iconURL: interaction.client.user!.displayAvatarURL(),
      })
      .setThumbnail(interaction.client.user!.displayAvatarURL({ dynamic: true }))
      .setColor(client.config.embedColour as any)
      .setTitle(translate(interaction, "botinfo.title"))
      .addFields(
        {
          name: translate(interaction, "botinfo.process"),
          value: `RAM: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\nNode: ${process.versions.node}`,
          inline: true,
        },
        {
          name: translate(interaction, "botinfo.dependencies"),
          value: `Discord.js: ${packageJSON.dependencies["discord.js"]}\nDiscord-Player: ${packageJSON.dependencies["discord-player"]}\nYouTubei: ${packageJSON.dependencies["discord-player-youtubei"]}`,
          inline: true,
        },
        {
          name: translate(interaction, "botinfo.ping"),
          value: `API: ${Math.round(interaction.client.ws.ping)}ms`,
          inline: true,
        },
        { name: translate(interaction, "botinfo.uptime"), value: botuptime, inline: true },
        {
          name: translate(interaction, "botinfo.version"),
          value: `v1.9 (Latest: **[${(checkGitHub as any)?.tag_name}](${(checkGitHub as any)?.html_url})**)`,
          inline: true,
        },
        { name: "\u200b", value: "\u200b", inline: true },
        {
          name: translate(interaction, "botinfo.developer"),
          value: "[ThatGuyJacobee](https://github.com/ThatGuyJacobee)",
          inline: true,
        },
        {
          name: translate(interaction, "botinfo.openSource"),
          value: translate(interaction, "botinfo.openSourceDescription"),
          inline: false,
        },
      )
      .setTimestamp()
      .setFooter({ text: translate(interaction, "botinfo.footer", { tag: interaction.client.user!.tag }) });

    const actionbuttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setURL("https://github.com/ThatGuyJacobee/Elite-Bot-Music")
        .setStyle(5)
        .setLabel(translate(interaction, "botinfo.buttons.repo")),
      new ButtonBuilder()
        .setURL("https://hub.docker.com/r/thatguyjacobee/elitemusic")
        .setStyle(5)
        .setLabel(translate(interaction, "botinfo.buttons.docker")),
      new ButtonBuilder().setURL("https://elite-bot.com/").setStyle(5).setLabel(translate(interaction, "botinfo.buttons.docs")),
      new ButtonBuilder()
        .setURL("https://discord.elite-bot.com/")
        .setStyle(5)
        .setLabel(translate(interaction, "botinfo.buttons.support")),
    );

    await interaction.reply({ embeds: [botembed], components: [actionbuttons] as any });
  },
};
