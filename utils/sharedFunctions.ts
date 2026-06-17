import "dotenv/config";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { useMainPlayer } from "discord-player";
import type { GuildCommandInteraction } from "../types/discord";
import type { SearchResult } from "discord-player";
import { buildImageAttachment } from "./utilityFunctions";
import { clearNpControlMessages } from "./npControlMessages";
import type { ExtendedClient } from "../types";
import { buildRequestedByFooter, buildTrackLinkText, getDisplayName, translate } from "./botText";

const client = (globalThis as any).client as ExtendedClient;

// Core music functions
export async function getQueue(interaction: GuildCommandInteraction): Promise<any> {
    const player = useMainPlayer();
    let checkqueue = player.nodes.get(interaction.guild.id);

    if (!checkqueue) {
        player.nodes.create(interaction.guild.id, {
            leaveOnEmpty: client.config.leaveOnEmpty,
            leaveOnEmptyCooldown: client.config.leaveOnEmptyCooldown,
            leaveOnEnd: client.config.leaveOnEnd,
            leaveOnEndCooldown: client.config.leaveOnEndCooldown,
            leaveOnStop: client.config.leaveOnStop,
            leaveOnStopCooldown: client.config.leaveOnStopCooldown,
            selfDeaf: client.config.selfDeafen,
            skipOnNoStream: true,
            metadata: {
                channel: interaction.channel as any,
                requestedBy: interaction.user,
                client: interaction.guild.members.me!,
                locale: interaction.locale,
                interaction,
            },
        } as any);
    }

    return player.nodes.get(interaction.guild.id);
}

export async function addTracks(
    interaction: GuildCommandInteraction,
    nextSong: boolean,
    search: SearchResult,
    responseType: "send" | "edit",
): Promise<void> {
    try {
        let queue = await getQueue(interaction);

        if (nextSong) {
            queue.insertTrack(search.tracks[0]);
        } else {
            queue.addTrack(search.tracks);
        }

        await queuePlay(interaction, responseType, search, nextSong);
    } catch (err) {
        console.log(err);
        await interaction.followUp({
            content: translate(interaction, "errors.failedToAddTracks"),
            flags: MessageFlags.Ephemeral,
        });
    }
}

export async function queuePlay(
    interaction: GuildCommandInteraction,
    responseType: "send" | "edit",
    search: SearchResult,
    nextSong: boolean,
): Promise<void> {
    let queue = await getQueue(interaction);

    try {
        if (!queue.connection) await queue.connect(interaction.member.voice.channel!);
    } catch (err) {
        await clearNpControlMessages(queue);
        queue.delete();
        await interaction.followUp({
            content: translate(interaction, "errors.failedToJoinChannel"),
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    // Handle the song/playlist cover image
    const imageAttachment = await buildImageAttachment(search.tracks[0].thumbnail, {
        name: "coverimage.jpg",
        description: search.playlist
            ? `Playlist Cover Image for ${search.tracks[0].playlist!.title}`
            : `Song Cover Image for ${search.tracks[0].title}`,
    });

    const embed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
        .setThumbnail("attachment://coverimage.jpg")
        .setColor(client.config.embedColour as any)
        .setTimestamp()
        .setFooter(buildRequestedByFooter(interaction, interaction.user));

    if (!queue.isPlaying()) {
        try {
            await queue.node.play(queue.tracks.first()!);
            queue.node.setVolume(client.config.defaultVolume);
        } catch (err) {
            await interaction.followUp({
                content: translate(interaction, "errors.playbackError"),
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        if (search.playlist) {
            embed.setDescription(
                translate(interaction, "queue.importedPlaylistStarted", {
                    title: search.tracks[0].playlist!.title,
                    link: search.tracks[0].playlist!.url
                        ? buildTrackLinkText({ url: search.tracks[0].playlist!.url }, interaction)
                        : "",
                    count: search.tracks.length,
                }),
            );
        } else {
            embed.setDescription(
                translate(interaction, "queue.startedPlaying", {
                    title: search.tracks[0].title,
                    link: buildTrackLinkText(search.tracks[0], interaction),
                }),
            );
        }

        embed.setTitle(translate(interaction, "queue.startedPlayback"));
    } else {
        if (search.playlist) {
            embed.setDescription(
                translate(interaction, "queue.importedPlaylist", {
                    title: search.tracks[0].playlist!.title,
                    link: search.tracks[0].playlist!.url
                        ? buildTrackLinkText({ url: search.tracks[0].playlist!.url }, interaction)
                        : "",
                    count: search.tracks.length,
                }),
            );
        } else {
            if (nextSong) {
                embed.setDescription(
                    translate(interaction, "queue.addedToTop", {
                        title: search.tracks[0].title,
                        link: buildTrackLinkText(search.tracks[0], interaction),
                    }),
                );
                embed.setTitle(translate(interaction, "queue.addedToTopTitle"));
            } else {
                embed.setDescription(
                    translate(interaction, "queue.addedToQueue", {
                        title: search.tracks[0].title,
                        link: buildTrackLinkText(search.tracks[0], interaction),
                    }),
                );
                embed.setTitle(translate(interaction, "queue.addedToQueueTitle"));
            }
        }
    }

    if (responseType === "edit") {
        await (interaction as any).message.edit({ embeds: [embed], files: [imageAttachment], components: [] });
    } else {
        await interaction.followUp({ embeds: [embed], files: [imageAttachment] });
    }
}

export function skipCurrentTrack(
    interaction: GuildCommandInteraction,
    queue: any,
    user: any,
): { embeds: EmbedBuilder[] } {
    const queuedTracks = queue.tracks.toArray();
    const skipembed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
        .setThumbnail(interaction.guild.iconURL())
        .setColor(client.config.embedColour as any)
        .setTitle(translate(interaction, "np.skipTitle"))
        .setDescription(
            translate(interaction, "np.skipDescription", {
                title: queuedTracks[0].title,
                link: buildTrackLinkText(queuedTracks[0], interaction),
            }),
        )
        .setTimestamp()
        .setFooter(buildRequestedByFooter(interaction, user));

    queue.node.skip();
    return { embeds: [skipembed] };
}
