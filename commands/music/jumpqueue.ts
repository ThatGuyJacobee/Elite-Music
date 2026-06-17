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
    data: new SlashCommandBuilder()
        .setName("jumpqueue")
        .setDescription("Jump to a specific song in the queue!")
        .addIntegerOption((option) =>
            option
                .setName("song")
                .setDescription("What #no. song should be moved to the front of the queue (use /queue to check)?")
                .setRequired(true),
        ),
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

        const queuedTracks = queue.tracks.toArray();
        const skipAmount = interaction.options.getInteger("song")!;
        const trackIndex = skipAmount - 1;

        const jumpembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL())
            .setColor(client.config.embedColour as any)
            .setTitle(translate(interaction, "jumpqueue.title"))
            .setDescription(
                translate(interaction, "np.skipDescription", {
                    title: queuedTracks[trackIndex].title,
                    link: buildTrackLinkText(queuedTracks[trackIndex], interaction),
                }),
            )
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.node.jump(trackIndex);
            await interaction.reply({ embeds: [jumpembed] });
        } catch (err) {
            console.log(err);
            await interaction.reply({
                content: translateGenericAction(interaction, "jumpingQueue"),
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
