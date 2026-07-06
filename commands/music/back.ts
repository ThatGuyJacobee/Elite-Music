import "dotenv/config";
import { SlashCommandBuilder } from "@discordjs/builders";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { useMainPlayer } from "discord-player";
import type { GuildCommandInteraction } from "../../types/discord";
import type { ExtendedClient } from "../../types";
import { buildRequestedByFooter, buildTrackLinkText, translate, translateGenericAction } from "../../utils/botText";
import {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueNotPlayingResponse,
} from "../../utils/interactionGuards";

const client = (globalThis as any).client as ExtendedClient;

export default {
    data: new SlashCommandBuilder().setName("back").setDescription("Play the previous song!"),
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

        const previousTracks = queue.history.tracks.toArray();
        if (!previousTracks[0]) {
            await interaction.reply({
                content: translate(interaction, "np.backMissing"),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const backembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL())
            .setColor(client.config.embedColour as any)
            .setTitle(translate(interaction, "np.backTitle"))
            .setDescription(
                translate(interaction, "np.backDescription", {
                    title: previousTracks[0].title,
                    link: buildTrackLinkText(previousTracks[0], interaction),
                }),
            )
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.history.back();
            await interaction.reply({ embeds: [backembed] });
        } catch {
            await interaction.reply({
                content: translateGenericAction(interaction, "returningToPreviousSong"),
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
