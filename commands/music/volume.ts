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
    data: new SlashCommandBuilder()
        .setName("volume")
        .setDescription("Check or set the current music volume!")
        .addIntegerOption((option) =>
            option
                .setName("amount")
                .setDescription("What do you want to set the volume as (0-100)?")
                .setRequired(false),
        ),
    async execute(interaction: GuildCommandInteraction): Promise<void> {
        const vol = interaction.options.getInteger("amount");

        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) {
            await interaction.reply(getQueueNotPlayingResponse(interaction));
            return;
        }

        if (vol == null) {
            await interaction.reply({
                content: translate(interaction, "volume.current", { volume: queue.node.volume }),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (vol > 100 || vol < 0) {
            await interaction.reply({
                content: translate(interaction, "volume.invalidRange"),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const volumeembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL())
            .setColor(client.config.embedColour as any)
            .setTitle(translate(interaction, "np.volumeTitle"))
            .setDescription(translate(interaction, "np.volumeDescription", { volume: vol }))
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.node.setVolume(vol);
            await interaction.reply({ embeds: [volumeembed] });
        } catch {
            await interaction.reply({
                content: translateGenericAction(interaction, "adjustingVolume"),
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
