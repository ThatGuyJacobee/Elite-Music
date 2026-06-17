import "dotenv/config";
import { SlashCommandBuilder } from "@discordjs/builders";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { useMainPlayer, QueueRepeatMode } from "discord-player";
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
    data: new SlashCommandBuilder()
        .setName("loop")
        .setDescription("Set the loop type!")
        .addIntegerOption((option) =>
            option
                .setName("loopmode")
                .setDescription("What loop mode do you want to activate?")
                .setRequired(true)
                .addChoices(
                    {
                        name: "Off",
                        value: QueueRepeatMode.OFF,
                    },
                    {
                        name: "Track",
                        value: QueueRepeatMode.TRACK,
                    },
                    {
                        name: "Queue",
                        value: QueueRepeatMode.QUEUE,
                    },
                ),
        ),
    async execute(interaction: GuildCommandInteraction): Promise<void> {
        const loopmode = interaction.options.getInteger("loopmode")!;

        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) {
            await interaction.reply(getQueueNotPlayingResponse(interaction));
            return;
        }

        const titleKey =
            loopmode === QueueRepeatMode.TRACK
                ? "np.loopTrackTitle"
                : loopmode === QueueRepeatMode.QUEUE
                  ? "loop.queueTitle"
                  : "np.loopOffTitle";
        const modeKey =
            loopmode === QueueRepeatMode.TRACK
                ? "loop.trackMode"
                : loopmode === QueueRepeatMode.QUEUE
                  ? "loop.queueMode"
                  : "loop.offMode";

        const loopembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL())
            .setColor(client.config.embedColour as any)
            .setTitle(translate(interaction, titleKey))
            .setDescription(translate(interaction, "loop.description", { mode: translate(interaction, modeKey) }))
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.setRepeatMode(loopmode as any);
            await interaction.reply({ embeds: [loopembed] });
        } catch {
            await interaction.reply({
                content: translateGenericAction(interaction, "switchingLoopMode"),
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
