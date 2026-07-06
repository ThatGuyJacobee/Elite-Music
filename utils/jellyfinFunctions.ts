import "dotenv/config";
import { EmbedBuilder } from "discord.js";
import { useMainPlayer, QueryType, Track } from "discord-player";
import type { GuildCommandInteraction } from "../types/discord";
import { buildImageAttachment, formatDurationMs } from "./utilityFunctions";
import { clearNpControlMessages } from "./npControlMessages";
import { getQueue } from "./sharedFunctions";
import {
    jellyfinSearch,
    jellyfinGetPlaylist,
    jellyfinGetAlbum,
    jellyfinStreamUrl,
    jellyfinCoverArtUrl,
} from "./jellyfinAPI";
import type { ExtendedClient } from "../types";

const client = (globalThis as any).client as ExtendedClient;
const player = useMainPlayer();

function applyTrackOrder(tracks: Track[], orderMode = "sequential"): Track[] {
    if (orderMode === "reverse") {
        return [...tracks].reverse();
    }

    if (orderMode === "shuffle") {
        const shuffledTracks = [...tracks];
        for (let index = shuffledTracks.length - 1; index > 0; index--) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            const originalTrack = shuffledTracks[index];
            shuffledTracks[index] = shuffledTracks[randomIndex];
            shuffledTracks[randomIndex] = originalTrack;
        }
        return shuffledTracks;
    }

    return tracks;
}

async function addContainerTracksToQueue(
    interaction: GuildCommandInteraction,
    tracks: Track[],
    nextSong: boolean,
): Promise<void> {
    const queue = await getQueue(interaction);
    if (nextSong) {
        for (let index = tracks.length - 1; index >= 0; index--) {
            queue.insertTrack(tracks[index]);
        }
        return;
    }
    queue.addTrack(tracks);
}

export interface JellyfinSearchResult {
    songs: Record<string, unknown>[];
    playlists: Record<string, unknown>[];
    albums: Record<string, unknown>[];
    size: number;
}

export async function jellyfinSearchQuery(
    query: string,
    options: { scope?: string } = {},
): Promise<JellyfinSearchResult | false> {
    const scope = options.scope ?? "auto";

    try {
        const results = await jellyfinSearch(client.config, query, { scope });

        const songs = results.filter((item) => (item as any).Type === "Audio");
        const albums = results.filter((item) => (item as any).Type === "MusicAlbum");
        const playlists = results.filter((item) => (item as any).Type === "Playlist");

        if (!songs.length && !albums.length && !playlists.length) return false;

        return {
            songs,
            playlists,
            albums,
            size: songs.length + albums.length + playlists.length,
        };
    } catch (err) {
        console.log(err);
        return false;
    }
}

export async function jellyfinAddTrack(
    interaction: GuildCommandInteraction,
    nextSong: boolean,
    itemMetadata: Record<string, unknown>,
    responseType: "send" | "edit",
): Promise<void> {
    const mediaSources = (itemMetadata as any).MediaSources ?? [];
    const mediaSourceId = mediaSources[0]?.Id ?? "";
    const streamUrl = jellyfinStreamUrl(client.config, itemMetadata.Id as string, mediaSourceId);
    const thumbUrl = jellyfinCoverArtUrl(client.config, itemMetadata.Id as string);

    const newTrack = new Track(player, {
        title: itemMetadata.Name as string,
        author: (itemMetadata as any).AlbumArtist ?? (itemMetadata as any).Artists?.[0] ?? "Unknown Artist",
        url: streamUrl,
        thumbnail: thumbUrl,
        duration: formatDurationMs(((itemMetadata as any).RunTimeTicks ?? 0) / 10000),
        views: 69,
        playlist: undefined,
        description: undefined,
        requestedBy: interaction.user,
        source: "arbitrary",
        engine: streamUrl,
        queryType: QueryType.ARBITRARY,
    });

    try {
        const queue = await getQueue(interaction);

        if (nextSong) {
            queue.insertTrack(newTrack);
        } else {
            queue.addTrack(newTrack);
        }

        await jellyfinQueuePlay(interaction, responseType, itemMetadata, itemMetadata.Id as string, nextSong);
    } catch (err) {
        await interaction.followUp({
            content: "❌ | Ooops... something went wrong, failed to add the track(s) to the queue.",
            ephemeral: true,
        });
    }
}

export async function jellyfinAddPlaylist(
    interaction: GuildCommandInteraction,
    itemMetadata: Record<string, unknown>,
    responseType: "send" | "edit",
    orderMode = "sequential",
    nextSong = false,
): Promise<void> {
    const playlistData = await jellyfinGetPlaylist(client.config, itemMetadata.Id as string);
    const playlistEntries = (playlistData as any).Items ?? [];

    if (!playlistEntries.length) {
        await interaction.followUp({
            content: "❌ | This playlist has no playable tracks.",
            ephemeral: true,
        });
        return;
    }

    const builtTracks: Track[] = [];
    for (const item of playlistEntries) {
        const mediaSources = (item as any).MediaSources ?? [];
        const mediaSourceId = mediaSources[0]?.Id ?? "";
        const streamUrl = jellyfinStreamUrl(client.config, item.Id as string, mediaSourceId);
        const thumbUrl = jellyfinCoverArtUrl(client.config, item.Id as string);

        const newTrack = new Track(player, {
            title: item.Name as string,
            author: (item as any).AlbumArtist ?? (item as any).Artists?.[0] ?? "Unknown Artist",
            url: streamUrl,
            thumbnail: thumbUrl,
            duration: formatDurationMs(((item as any).RunTimeTicks ?? 0) / 10000),
            views: 69,
            playlist: undefined,
            description: undefined,
            requestedBy: interaction.user,
            source: "arbitrary",
            engine: streamUrl,
            queryType: QueryType.ARBITRARY,
        });

        builtTracks.push(newTrack);
    }

    try {
        const orderedTracks = applyTrackOrder(builtTracks, orderMode);
        await addContainerTracksToQueue(interaction, orderedTracks, nextSong);
    } catch (err) {
        await interaction.followUp({
            content: "❌ | Ooops... something went wrong, failed to add the track(s) to the queue.",
            ephemeral: true,
        });
        return;
    }

    const metaOut = {
        ...itemMetadata,
        type: "playlist",
        title: itemMetadata.Name as string,
        leafCount: playlistEntries.length,
    };
    await jellyfinQueuePlay(interaction, responseType, metaOut, itemMetadata.Id as string, nextSong);
}

export async function jellyfinAddAlbum(
    interaction: GuildCommandInteraction,
    itemMetadata: Record<string, unknown>,
    responseType: "send" | "edit",
    orderMode = "sequential",
    nextSong = false,
): Promise<void> {
    const albumData = await jellyfinGetAlbum(client.config, itemMetadata.Id as string);
    const albumEntries = (albumData as any).Items ?? [];

    if (!albumEntries.length) {
        await interaction.followUp({
            content: "❌ | This album has no playable tracks.",
            ephemeral: true,
        });
        return;
    }

    const builtTracks: Track[] = [];
    for (const item of albumEntries) {
        const mediaSources = (item as any).MediaSources ?? [];
        const mediaSourceId = mediaSources[0]?.Id ?? "";
        const streamUrl = jellyfinStreamUrl(client.config, item.Id as string, mediaSourceId);
        const thumbUrl = jellyfinCoverArtUrl(client.config, item.Id as string);

        const newTrack = new Track(player, {
            title: item.Name as string,
            author: (item as any).AlbumArtist ?? (item as any).Artists?.[0] ?? "Unknown Artist",
            url: streamUrl,
            thumbnail: thumbUrl,
            duration: formatDurationMs(((item as any).RunTimeTicks ?? 0) / 10000),
            views: 69,
            playlist: undefined,
            description: undefined,
            requestedBy: interaction.user,
            source: "arbitrary",
            engine: streamUrl,
            queryType: QueryType.ARBITRARY,
        });

        builtTracks.push(newTrack);
    }

    try {
        const orderedTracks = applyTrackOrder(builtTracks, orderMode);
        await addContainerTracksToQueue(interaction, orderedTracks, nextSong);
    } catch (err) {
        await interaction.followUp({
            content: "❌ | Ooops... something went wrong, failed to add the track(s) to the queue.",
            ephemeral: true,
        });
        return;
    }

    const metaOut = {
        ...itemMetadata,
        type: "album",
        title: itemMetadata.Name as string,
        leafCount: albumEntries.length,
    };
    await jellyfinQueuePlay(interaction, responseType, metaOut, itemMetadata.Id as string, nextSong);
}

export async function jellyfinQueuePlay(
    interaction: GuildCommandInteraction,
    responseType: "send" | "edit",
    itemMetadata: Record<string, unknown>,
    defaultItemId: string,
    nextSong: boolean,
): Promise<void> {
    const queue = await getQueue(interaction);

    try {
        if (!queue.connection) await queue.connect(interaction.member.voice.channel!);
    } catch (err) {
        await clearNpControlMessages(queue);
        queue.delete();
        await interaction.followUp({
            content: "❌ | Ooops... something went wrong, couldn't join your voice channel.",
            ephemeral: true,
        });
        return;
    }

    const coverUrl = jellyfinCoverArtUrl(client.config, defaultItemId);
    const coverKind = itemMetadata.type === "playlist" ? "Playlist" : itemMetadata.type === "album" ? "Album" : "Song";
    const imageAttachment = await buildImageAttachment(coverUrl, {
        name: "coverimage.jpg",
        description: `${coverKind} Cover Image for ${itemMetadata.title ?? itemMetadata.Name}`,
    });

    const embed = new EmbedBuilder()
        .setAuthor({
            name: interaction.client.user!.tag,
            iconURL: interaction.client.user!.displayAvatarURL(),
        })
        .setThumbnail("attachment://coverimage.jpg")
        .setColor(client.config.embedColour as any)
        .setTimestamp()
        .setFooter({
            text: `Requested by: ${interaction.user.discriminator !== "0" ? interaction.user.tag : interaction.user.username}`,
        });

    if (!queue.isPlaying()) {
        try {
            await queue.node.play(queue.tracks.first()!);
            queue.node.setVolume(client.config.defaultVolume);
        } catch (err) {
            await interaction.followUp({
                content: "❌ | Ooops... something went wrong, there was a playback related error. Please try again.",
                ephemeral: true,
            });
            return;
        }

        if (itemMetadata.type === "playlist") {
            embed.setDescription(
                `Imported the **${itemMetadata.title} playlist** with **${itemMetadata.leafCount}** songs and started to play the queue!`,
            );
        } else if (itemMetadata.type === "album") {
            embed.setDescription(
                `Imported the **${itemMetadata.title} album** with **${itemMetadata.leafCount}** songs and started to play the queue!`,
            );
        } else {
            embed.setDescription(`Began playing the song **${itemMetadata.title}**!`);
        }

        embed.setTitle("Started playback ▶️");
    } else {
        if (itemMetadata.type === "playlist") {
            embed.setDescription(
                `Imported the **${itemMetadata.title} playlist** with **${itemMetadata.leafCount}** songs!`,
            );
            embed.setTitle("Added to queue ⏱️");
        } else if (itemMetadata.type === "album") {
            embed.setDescription(
                `Imported the **${itemMetadata.title} album** with **${itemMetadata.leafCount}** songs!`,
            );
            embed.setTitle("Added to queue ⏱️");
        } else {
            if (nextSong) {
                embed.setDescription(`Added song **${itemMetadata.title}** to the top of the queue (playing next)!`);
                embed.setTitle("Added to the top of the queue ⏱️");
            } else {
                embed.setDescription(`Added song **${itemMetadata.title}** to the queue!`);
                embed.setTitle("Added to queue ⏱️");
            }
        }
    }

    if (responseType === "edit") {
        await (interaction as any).message.edit({ embeds: [embed], files: [imageAttachment], components: [] });
    } else {
        await interaction.followUp({ embeds: [embed], files: [imageAttachment] });
    }
}
