import "dotenv/config";
import { SlashCommandBuilder } from "@discordjs/builders";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { useMainPlayer } from "discord-player";
import type { GuildCommandInteraction } from "../../types/discord";
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
    data: new SlashCommandBuilder().setName("clearqueue").setDescription("Clear the current music queue!"),
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

        const clearembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL())
            .setColor(client.config.embedColour as any)
            .setTitle(translate(interaction, "queue.clearTitle"))
            .setDescription(translate(interaction, "queue.clearDescription"))
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.tracks.clear();
            await interaction.reply({ embeds: [clearembed] });
        } catch {
            await interaction.reply({
                content: translateGenericAction(interaction, "clearingQueue"),
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
