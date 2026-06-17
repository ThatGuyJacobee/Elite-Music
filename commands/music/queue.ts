import "dotenv/config";
import { SlashCommandBuilder } from "@discordjs/builders";
import { EmbedBuilder, ButtonBuilder, ActionRowBuilder } from "discord.js";
import { useMainPlayer } from "discord-player";
import type { GuildCommandInteraction } from "../../types/discord";
import type { ExtendedClient } from "../../types";
import { buildRequestedByFooter, buildRequestedByPageFooter, buildTrackLinkText, translate } from "../../utils/botText";
import {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueEmptyResponse,
    getQueueNotPlayingResponse,
} from "../../utils/interactionGuards";

const client = (globalThis as any).client as ExtendedClient;

export default {
    data: new SlashCommandBuilder().setName("queue").setDescription("Check the current music that is in the queue!"),
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
        if (!queuedTracks[0]) {
            await interaction.reply(getQueueEmptyResponse(interaction));
            return;
        }

        const queueembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL())
            .setColor(client.config.embedColour as any)
            .setTitle(translate(interaction, "queue.title"))
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        let curPage = 1;
        const i = curPage * 10 - 10;
        const curTracks: { name: string; value: string }[] = [];

        curTracks.push({
            name: translate(interaction, "queue.nowPlayingField"),
            value: `**${queue.currentTrack!.title}** ${buildTrackLinkText(queue.currentTrack!, interaction)}`,
        });

        for (let j = i; j < curPage * 10; j++) {
            if (queuedTracks[j]) {
                curTracks.push({
                    name: `${j + 1}. ${queuedTracks[j].title}`,
                    value: `**${queuedTracks[j].author}** ${buildTrackLinkText(queuedTracks[j], interaction)}`,
                });
            }
        }

        queueembed.addFields(curTracks);

        const timestamp = Date.now();
        const finalComponents = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`queue-${timestamp}-delete`).setStyle(4).setLabel("🗑️"),
            new ButtonBuilder()
                .setCustomId(`queue-${timestamp}-previous`)
                .setStyle(1)
                .setLabel(translate(interaction, "queue.previousPage")),
            new ButtonBuilder()
                .setCustomId(`queue-${timestamp}-next`)
                .setStyle(1)
                .setLabel(translate(interaction, "queue.nextPage")),
        );

        await interaction.reply({ embeds: [queueembed], components: [finalComponents] as any });

        const filter = (i: any) => i.customId.includes(`queue-${timestamp}`);
        const collector = interaction.channel!.createMessageComponentCollector({ filter, time: 300000 });

        collector.on("collect", async (buttonResponse: any) => {
            if (buttonResponse.customId.includes("delete")) {
                await buttonResponse.message.delete();
                return;
            }

            const player = useMainPlayer();
            const queue = player.nodes.get(interaction.guild.id);
            if (!queue) return buttonResponse.deferUpdate();
            const queuedTracks = queue.tracks.toArray();

            if (!queuedTracks[0]) {
                await interaction.editReply({
                    content: translate(interaction, "queue.empty"),
                    components: [],
                });
                return;
            }

            const queueembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL())
                .setColor(client.config.embedColour as any)
                .setTitle(translate(interaction, "queue.title"))
                .setTimestamp();

            if (buttonResponse.customId.includes("next")) {
                const size = queuedTracks.length;
                if (curPage === Math.ceil(size / 10)) return buttonResponse.deferUpdate();
                curPage++;
            } else if (buttonResponse.customId.includes("previous")) {
                if (curPage === 1) return buttonResponse.deferUpdate();
                curPage--;
            }

            const jStart = curPage * 10 - 10;
            const curTracks: { name: string; value: string }[] = [];

            curTracks.push({
                name: translate(interaction, "queue.nowPlayingField"),
                value: `**${queue.currentTrack!.title}** ${buildTrackLinkText(queue.currentTrack!, interaction)}`,
            });

            for (let j = jStart; j < curPage * 10; j++) {
                if (queuedTracks[j]) {
                    curTracks.push({
                        name: `${j + 1}. ${queuedTracks[j].title}`,
                        value: `**${queuedTracks[j].author}** ${buildTrackLinkText(queuedTracks[j], interaction)}`,
                    });
                }
            }

            queueembed.addFields(curTracks);
            queueembed.setFooter(buildRequestedByPageFooter(interaction, interaction.user, curPage));
            await interaction.editReply({ embeds: [queueembed] });
            await buttonResponse.deferUpdate();
        });

        collector.on("end", async () => {
            await interaction.editReply({
                content: translate(interaction, "queue.expired"),
                components: [],
            });
        });
    },
};
