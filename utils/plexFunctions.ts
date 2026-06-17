import "dotenv/config";
import { EmbedBuilder } from "discord.js";
import { useMainPlayer, QueryType, Track } from "discord-player";
import type { GuildCommandInteraction } from "../types/discord";
import { buildImageAttachment, formatDurationMs } from "./utilityFunctions";
import { clearNpControlMessages } from "./npControlMessages";
import { getQueue } from "./sharedFunctions";
import type { ExtendedClient } from "../types";

const client = (globalThis as any).client as ExtendedClient;
const player = useMainPlayer();

export function formatPlexDurationLabel(durationMilliseconds: number): string {
    return formatDurationMs(durationMilliseconds);
}

export function applyTrackOrder(tracks: Track[], orderMode = "sequential"): Track[] {
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

function plexSearchTypeQueryParam(scope: string): string {
    if (scope === "track") return "10";
    if (scope === "playlist") return "15";
    if (scope === "album") return "9";
    return "9,10,15";
}

export interface PlexSearchResult {
    songs: Record<string, unknown>[];
    playlists: Record<string, unknown>[];
    albums: Record<string, unknown>[];
    size: number;
}

export async function plexSearchQuery(
    query: string,
    options: { scope?: string } = {},
): Promise<PlexSearchResult | false> {
    const scope = options.scope ?? "auto";
    const typeQueryParam = plexSearchTypeQueryParam(scope);

    try {
        const searchRequest = await fetch(
            `${client.config.plexServer}/search?X-Plex-Token=${client.config.plexAuthtoken}&query=${encodeURIComponent(query)}&limit=10&type=${typeQueryParam}`,
            {
                method: "GET",
                headers: { accept: "application/json" },
            },
        );

        const searchJson: { MediaContainer: { size: number; Metadata: Record<string, unknown>[] } } =
            (await searchRequest.json()) as any;

        if (searchJson.MediaContainer.size === 0) return false;

        const allSongs = searchJson.MediaContainer.Metadata.filter((metadataEntry) => metadataEntry.type === "track");
        const allPlaylists = searchJson.MediaContainer.Metadata.filter(
            (metadataEntry) => metadataEntry.type === "playlist",
        );
        const allAlbums = searchJson.MediaContainer.Metadata.filter((metadataEntry) => metadataEntry.type === "album");

        return {
            songs: allSongs,
            playlists: allPlaylists,
            albums: allAlbums,
            size: allAlbums.length + allSongs.length + allPlaylists.length,
        };
    } catch (err) {
        console.log(err);
        return false;
    }
}

export async function plexAddTrack(
    interaction: GuildCommandInteraction,
    nextSong: boolean,
    itemMetadata: Record<string, unknown>,
    responseType: "send" | "edit",
): Promise<void> {
    const trackRequest = await fetch(
        `${client.config.plexServer}${itemMetadata.key}?X-Plex-Token=${client.config.plexAuthtoken}`,
        {
            method: "GET",
            headers: { accept: "application/json" },
        },
    );

    const trackJson = (await trackRequest.json()) as { MediaContainer: { Metadata: Record<string, unknown>[] } };
    const songFound = trackJson.MediaContainer.Metadata[0];

    const newTrack = new Track(player, {
        title: songFound.title as string,
        author: songFound.grandparentTitle as string,
        url: `${client.config.plexServer}${(songFound.Media as any[])[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
        thumbnail: `${client.config.plexServer}${songFound.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
        duration: formatDurationMs(songFound.duration as number),
        views: 69,
        playlist: undefined,
        description: undefined,
        requestedBy: interaction.user,
        source: "arbitrary",
        engine: `${client.config.plexServer}${(songFound.Media as any[])[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
        queryType: QueryType.ARBITRARY,
    });

    try {
        const queue = await getQueue(interaction);

        if (nextSong) {
            queue.insertTrack(newTrack);
        } else {
            queue.addTrack(newTrack);
        }

        await plexQueuePlay(interaction, responseType, itemMetadata, songFound.thumb as string, nextSong);
    } catch (err) {
        await interaction.followUp({
            content: "❌ | Ooops... something went wrong, failed to add the track(s) to the queue.",
            ephemeral: true,
        });
    }
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

export async function plexAddPlaylist(
    interaction: GuildCommandInteraction,
    itemMetadata: Record<string, unknown>,
    responseType: "send" | "edit",
    orderMode = "sequential",
    nextSong = false,
): Promise<void> {
    const playlistRequest = await fetch(
        `${client.config.plexServer}/playlists/${itemMetadata.ratingKey}/items?X-Plex-Token=${client.config.plexAuthtoken}`,
        {
            method: "GET",
            headers: { accept: "application/json" },
        },
    );

    const playlistJson = (await playlistRequest.json()) as { MediaContainer: { Metadata: Record<string, unknown>[] } };
    const builtTracks: Track[] = [];

    for await (const playlistTrack of playlistJson.MediaContainer.Metadata) {
        const newTrack = new Track(player, {
            title: playlistTrack.title as string,
            author: playlistTrack.grandparentTitle as string,
            url: `${client.config.plexServer}${(playlistTrack.Media as any[])[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            thumbnail: `${client.config.plexServer}${playlistTrack.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            duration: formatDurationMs(playlistTrack.duration as number),
            views: 69,
            playlist: undefined,
            description: undefined,
            requestedBy: interaction.user,
            source: "arbitrary",
            engine: `${client.config.plexServer}${(playlistTrack.Media as any[])[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            queryType: QueryType.ARBITRARY,
        });

        try {
            builtTracks.push(newTrack);
        } catch (err) {
            await interaction.followUp({
                content: "❌ | Ooops... something went wrong, failed to add the track(s) to the queue.",
                ephemeral: true,
            });
            return;
        }
    }

    const orderedTracks = applyTrackOrder(builtTracks, orderMode);
    await addContainerTracksToQueue(interaction, orderedTracks, nextSong);
    await plexQueuePlay(
        interaction,
        responseType,
        itemMetadata,
        playlistJson.MediaContainer.Metadata[0].thumb as string,
        nextSong,
    );
}

export async function plexAddAlbum(
    interaction: GuildCommandInteraction,
    itemMetadata: Record<string, unknown>,
    responseType: "send" | "edit",
    orderMode = "sequential",
    nextSong = false,
): Promise<void> {
    const albumRatingKey = itemMetadata.ratingKey || itemMetadata.key?.toString().split("/").pop();
    const albumChildrenRequest = await fetch(
        `${client.config.plexServer}/library/metadata/${albumRatingKey}/children?X-Plex-Token=${client.config.plexAuthtoken}`,
        {
            method: "GET",
            headers: { accept: "application/json" },
        },
    );

    const albumChildrenJson: { MediaContainer: { Metadata: Record<string, unknown>[] } } =
        (await albumChildrenRequest.json()) as any;
    const builtTracks: Track[] = [];

    for await (const albumTrack of albumChildrenJson.MediaContainer.Metadata) {
        const newTrack = new Track(player, {
            title: albumTrack.title as string,
            author: albumTrack.grandparentTitle as string,
            url: `${client.config.plexServer}${(albumTrack.Media as any[])[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            thumbnail: `${client.config.plexServer}${albumTrack.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            duration: formatDurationMs(albumTrack.duration as number),
            views: 69,
            playlist: undefined,
            description: undefined,
            requestedBy: interaction.user,
            source: "arbitrary",
            engine: `${client.config.plexServer}${(albumTrack.Media as any[])[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
            queryType: QueryType.ARBITRARY,
        });

        builtTracks.push(newTrack);
    }

    const orderedTracks = applyTrackOrder(builtTracks, orderMode);
    await addContainerTracksToQueue(interaction, orderedTracks, nextSong);

    const albumMetadataForEmbed = {
        ...itemMetadata,
        leafCount: builtTracks.length,
    };

    await plexQueuePlay(
        interaction,
        responseType,
        albumMetadataForEmbed,
        albumChildrenJson.MediaContainer.Metadata[0].thumb as string,
        nextSong,
    );
}

export async function plexQueuePlay(
    interaction: GuildCommandInteraction,
    responseType: "send" | "edit",
    itemMetadata: Record<string, unknown>,
    defaultThumbnail: string,
    nextSong: boolean,
): Promise<void> {
    const queue = await getQueue(interaction);

    try {
        if (!queue.connection) await queue.connect(interaction.member.voice.channel!);
    } catch (err) {
        await clearNpControlMessages(queue);
        queue.delete();
        await interaction.followUp({
            content: "❌ | Ooops... something went wrong, couldn't join your channel.",
            ephemeral: true,
        });
        return;
    }

    const imageAttachment = await buildImageAttachment(
        `${client.config.plexServer}${defaultThumbnail}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
        {
            name: "coverimage.jpg",
            description: `${itemMetadata.type === "playlist" ? "Playlist" : "Song"} Cover Image for ${itemMetadata.title}`,
        },
    );

    const embed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user!.tag, iconURL: interaction.client.user!.displayAvatarURL() })
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
