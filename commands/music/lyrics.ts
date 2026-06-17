import "dotenv/config";
import { SlashCommandBuilder } from "@discordjs/builders";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, MessageFlags } from "discord.js";
import { lyricsExtractor } from "@discord-player/extractor";
import type { GuildCommandInteraction } from "../../types/discord";
import type { ExtendedClient } from "../../types";
import { buildRequestedByFooter, translate } from "../../utils/botText";
import { ensureDjAccess } from "../../utils/interactionGuards";

const client = (globalThis as any).client as ExtendedClient;

export default {
    data: new SlashCommandBuilder()
        .setName("lyrics")
        .setDescription("Get the lyrics for a song!")
        .addStringOption((option: any) =>
            option.setName("query").setDescription("Enter the name of the song.").setRequired(true),
        ),
    async execute(interaction: GuildCommandInteraction): Promise<void> {
        if (!(await ensureDjAccess(interaction))) return;

        const query = interaction.options.getString("query")!;
        const extractor = lyricsExtractor() as any;

        const findLyrics = await extractor.search(query, { requestedBy: interaction.user }).catch(() => null);

        if (!findLyrics) {
            await interaction.reply({
                content: translate(interaction, "lyrics.notFound"),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const splicedLyrics = findLyrics.lyrics.slice(0, 4000);

        const lyricsembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
            .setColor(client.config.embedColour as any)
            .setTitle(
                translate(interaction, "lyrics.title", {
                    title: findLyrics.title,
                    artist: findLyrics.artist.name,
                }),
            )
            .setDescription(
                findLyrics.lyrics.length > 4000
                    ? splicedLyrics + translate(interaction, "lyrics.truncatedSuffix")
                    : findLyrics.lyrics,
            )
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        const actionbuttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("np-delete").setStyle(4).setLabel("🗑️"),
            new ButtonBuilder()
                .setURL(findLyrics.url)
                .setStyle(5)
                .setLabel(translate(interaction, "lyrics.fullLyricsButton")),
        );

        await interaction.reply({ embeds: [lyricsembed], components: [actionbuttons] as any });
    },
};
