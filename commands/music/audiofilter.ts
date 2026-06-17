import "dotenv/config";
import { SlashCommandBuilder } from "@discordjs/builders";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { useMainPlayer } from "discord-player";
import type { GuildCommandInteraction } from "../../types/discord";
import type { ExtendedClient } from "../../types";
import { buildRequestedByFooter, translate, translateAudioFilter, translateGenericAction } from "../../utils/botText";
import {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueNotPlayingResponse,
} from "../../utils/interactionGuards";

const client = (globalThis as any).client as ExtendedClient;

export default {
    data: new SlashCommandBuilder()
        .setName("audiofilter")
        .setDescription("Check or toggle audio filters!")
        .addStringOption((option: any) =>
            option.setName("filter").setDescription("What filter do you want to toggle?").setRequired(false).addChoices(
                {
                    name: "Bassboost",
                    value: "bassboost",
                },
                {
                    name: "8D",
                    value: "8D",
                },
                {
                    name: "Subboost",
                    value: "subboost",
                },
                {
                    name: "Nightcore",
                    value: "nightcore",
                },
                {
                    name: "Surrounding",
                    value: "surrounding",
                },
                {
                    name: "Vaporwave",
                    value: "vaporwave",
                },
                {
                    name: "Normalizer",
                    value: "normalizer",
                },
                {
                    name: "Lofi",
                    value: "lofi",
                },
                {
                    name: "Fadein",
                    value: "fadein",
                },
            ),
        ),
    async execute(interaction: GuildCommandInteraction): Promise<void> {
        const filter = interaction.options.getString("filter");
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) {
            await interaction.reply(getQueueNotPlayingResponse(interaction));
            return;
        }

        if (!filter) {
            const curFilters = queue.filters.ffmpeg.getFiltersEnabled();

            if (curFilters.length === 0) {
                await interaction.reply({ content: translate(interaction, "audiofilter.noneEnabled") });
            } else {
                await interaction.reply({
                    content: translate(interaction, "audiofilter.listEnabled", {
                        filters: curFilters
                            .map((enabledFilter) => translateAudioFilter(interaction, enabledFilter))
                            .join("\n- "),
                    }),
                });
            }
        } else {
            const isEnabled = queue.filters.ffmpeg.getFiltersEnabled().includes(filter as any);
            const filterembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL())
                .setColor(client.config.embedColour as any)
                .setTitle(translate(interaction, "audiofilter.toggleTitle"))
                .setDescription(
                    translate(interaction, "audiofilter.toggleDescription", {
                        filter: translateAudioFilter(interaction, filter),
                        state: translate(
                            interaction,
                            isEnabled ? "audiofilter.stateDisabled" : "audiofilter.stateEnabled",
                        ),
                    }),
                )
                .setTimestamp()
                .setFooter(buildRequestedByFooter(interaction, interaction.user));

            try {
                queue.filters.ffmpeg.toggle(filter as any);
                await interaction.reply({ embeds: [filterembed] });
            } catch {
                await interaction.reply({
                    content: translateGenericAction(interaction, "adjustingAudioFilter"),
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    },
};
