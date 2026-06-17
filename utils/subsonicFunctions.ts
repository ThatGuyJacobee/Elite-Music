import "dotenv/config";
import { EmbedBuilder } from "discord.js";
import { useMainPlayer, QueryType, Track } from "discord-player";
import type { GuildCommandInteraction } from "../types/discord";
import { buildImageAttachment, formatDurationMs } from "./utilityFunctions";
import { clearNpControlMessages } from "./npControlMessages";
import { getQueue } from "./sharedFunctions";
import {
    search2 as subsonicSearch2,
    getPlaylists as subsonicGetPlaylists,
    getPlaylist as subsonicGetPlaylist,
    getAlbum as subsonicGetAlbum,
    getSong as subsonicGetSong,
    streamUrl as subsonicStreamUrl,
    coverArtUrl as subsonicCoverArtUrl,
} from "./subsonicAPI";
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

function sortAlbumSongs(songs: Record<string, unknown>[]): Record<string, unknown>[] {
    return [...songs].sort((a, b) => {
        const discA = Number((a as any).discNumber ?? (a as any).disc ?? 1);
        const discB = Number((b as any).discNumber ?? (b as any).disc ?? 1);
        if (discA !== discB) return discA - discB;
        const trackA = Number((a as any).track ?? 0);
        const trackB = Number((b as any).track ?? 0);
        if (trackA !== trackB) return trackA - trackB;
        return String(a.title ?? "").localeCompare(String(b.title ?? ""));
    });
}

export interface SubsonicSearchResult {
    songs: Record<string, unknown>[];
    playlists: Record<string, unknown>[];
    albums: Record<string, unknown>[];
    size: number;
}

export async function subsonicSearchQuery(
    query: string,
    options: { scope?: string } = {},
): Promise<SubsonicSearchResult | false> {
    const scope = options.scope ?? "auto";

    try {
        const cfg = client.config;

        const songCount = scope === "playlist" || scope === "album" ? 0 : 10;
        const albumCount = scope === "track" || scope === "playlist" ? 0 : 10;

        const { songs, albums: albumsRaw } = await subsonicSearch2(cfg, query, {
            songCount,
            artistCount: 0,
            albumCount,
        });

        let mappedPlaylists: Record<string, unknown>[] = [];
        if (scope !== "track" && scope !== "album") {
            const playlistsRaw = await subsonicGetPlaylists(cfg);
            const normalizedQuery = String(query).toLowerCase();
            const playlistsMatch = playlistsRaw.filter((playlistEntry) =>
                String((playlistEntry as any).name ?? "")
                    .toLowerCase()
                    .includes(normalizedQuery),
            );
            mappedPlaylists = playlistsMatch.map((playlistEntry) => ({
                type: "playlist",
                id: (playlistEntry as any).id,
                title: (playlistEntry as any).name,
                ratingKey: (playlistEntry as any).id,
                songCount: (playlistEntry as any).songCount,
                leafCount: (playlistEntry as any).songCount,
                duration: (playlistEntry as any).duration != null ? Number((playlistEntry as any).duration) * 1000 : 0,
            }));
        }

        const mappedSongs = songs.map((songEntry) => ({
            type: "track",
            id: (songEntry as any).id,
            title: (songEntry as any).title,
            grandparentTitle: (songEntry as any).artist || "Unknown Artist",
            parentTitle: (songEntry as any).album || "Unknown Album",
            duration: Number((songEntry as any).duration || 0) * 1000,
            coverArt: (songEntry as any).coverArt,
        }));

        const mappedAlbums = albumsRaw.map((albumEntry) => {
            const albumName = (albumEntry as any).name || (albumEntry as any).title || "Unknown Album";
            const albumArtist = (albumEntry as any).artist || (albumEntry as any).albumArtist || "";
            const songCountVal = Number((albumEntry as any).songCount ?? (albumEntry as any).childCount ?? 0);
            return {
                type: "album",
                id: (albumEntry as any).id,
                title: albumName,
                artist: albumArtist,
                parentTitle: albumArtist ? `${albumName} - ${albumArtist}` : albumName,
                leafCount: Number.isFinite(songCountVal) ? songCountVal : 0,
                coverArt: (albumEntry as any).coverArt,
                duration: (albumEntry as any).duration != null ? Number((albumEntry as any).duration) * 1000 : 0,
            };
        });

        let songSlice: Record<string, unknown>[] = [];
        let playlistSlice: Record<string, unknown>[] = [];
        let albumSlice: Record<string, unknown>[] = [];

        if (scope === "auto") {
            songSlice = mappedSongs.slice(0, 10);
            let room = 10 - songSlice.length;
            playlistSlice = mappedPlaylists.slice(0, Math.max(0, room));
            room -= playlistSlice.length;
            albumSlice = mappedAlbums.slice(0, Math.max(0, room));
        } else if (scope === "track") {
            songSlice = mappedSongs.slice(0, 10);
        } else if (scope === "playlist") {
            playlistSlice = mappedPlaylists.slice(0, 10);
        } else if (scope === "album") {
            albumSlice = mappedAlbums.slice(0, 10);
        }

        if (!songSlice.length && !playlistSlice.length && !albumSlice.length) return false;

        return {
            songs: songSlice,
            playlists: playlistSlice,
            albums: albumSlice,
            size: songSlice.length + playlistSlice.length + albumSlice.length,
        };
    } catch (err) {
        console.log(err);
        return false;
    }
}

export async function subsonicAddTrack(
    interaction: GuildCommandInteraction,
    nextSong: boolean,
    itemMetadata: Record<string, unknown>,
    responseType: "send" | "edit",
): Promise<void> {
    let meta = itemMetadata;
    if ((!meta.title || meta.title === "") && meta.id) {
        const songFromApi = await subsonicGetSong(client.config, meta.id as string);
        if (!songFromApi) {
            await interaction.followUp({
                content: "❌ | Could not load song metadata from Subsonic.",
                ephemeral: true,
            });
            return;
        }

        meta = {
            type: "track",
            id: (songFromApi as any).id,
            title: (songFromApi as any).title,
            grandparentTitle: (songFromApi as any).artist,
            parentTitle: (songFromApi as any).album,
            duration: Number((songFromApi as any).duration || 0) * 1000,
            coverArt: (songFromApi as any).coverArt,
        };
    }

    const stream = subsonicStreamUrl(client.config, meta.id as string);
    const thumbUrl =
        meta.coverArt != null && meta.coverArt !== ""
            ? subsonicCoverArtUrl(client.config, meta.coverArt as string, 500)
            : interaction.client.user!.displayAvatarURL();

    const newTrack = new Track(player, {
        title: meta.title as string,
        author: (meta.grandparentTitle as string) || "Unknown Artist",
        url: stream,
        thumbnail: thumbUrl ?? "",
        duration: formatDurationMs((meta.duration as number) || 0),
        views: 69,
        playlist: undefined,
        description: undefined,
        requestedBy: interaction.user,
        source: "arbitrary",
        engine: stream,
        queryType: QueryType.ARBITRARY,
    });

    try {
        const queue = await getQueue(interaction);

        if (nextSong) {
            queue.insertTrack(newTrack);
        } else {
            queue.addTrack(newTrack);
        }

        await subsonicQueuePlay(interaction, responseType, meta, meta.coverArt as string | undefined, nextSong);
    } catch (err) {
        await interaction.followUp({
            content: "❌ | Ooops... something went wrong, failed to add the track(s) to the queue.",
            ephemeral: true,
        });
    }
}

export async function subsonicAddPlaylist(
    interaction: GuildCommandInteraction,
    itemMetadata: Record<string, unknown>,
    responseType: "send" | "edit",
    orderMode = "sequential",
    nextSong = false,
): Promise<void> {
    const { playlist, entries } = await subsonicGetPlaylist(client.config, itemMetadata.id as string);
    const playlistEntries = entries.filter((entry) => !(entry as any).isDir);

    if (!playlistEntries.length) {
        await interaction.followUp({
            content: "❌ | This playlist has no playable tracks.",
            ephemeral: true,
        });
        return;
    }

    const title =
        itemMetadata.title && itemMetadata.title !== "" ? itemMetadata.title : (playlist.name as string) || "Playlist";

    const builtTracks: Track[] = [];
    for (const item of playlistEntries) {
        const stream = subsonicStreamUrl(client.config, (item as any).id);
        const thumbUrl =
            (item as any).coverArt != null && (item as any).coverArt !== ""
                ? subsonicCoverArtUrl(client.config, (item as any).coverArt, 500)
                : interaction.client.user!.displayAvatarURL();

        const newTrack = new Track(player, {
            title: (item as any).title,
            author: (item as any).artist || "Unknown Artist",
            url: stream,
            thumbnail: thumbUrl ?? "",
            duration: formatDurationMs(Number((item as any).duration || 0) * 1000),
            views: 69,
            playlist: undefined,
            description: undefined,
            requestedBy: interaction.user,
            source: "arbitrary",
            engine: stream,
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
        title,
        leafCount: playlistEntries.length,
    };
    const firstCover = (playlistEntries[0] as any)?.coverArt ?? null;
    await subsonicQueuePlay(interaction, responseType, metaOut, firstCover, nextSong);
}

export async function subsonicAddAlbum(
    interaction: GuildCommandInteraction,
    itemMetadata: Record<string, unknown>,
    responseType: "send" | "edit",
    orderMode = "sequential",
    nextSong = false,
): Promise<void> {
    const { album, songs: rawSongs } = await subsonicGetAlbum(client.config, itemMetadata.id as string);
    const sortedEntries = sortAlbumSongs(rawSongs).filter(
        (entry) => entry && (entry as any).id != null && (entry as any).id !== "" && !(entry as any).isDir,
    );

    if (!sortedEntries.length) {
        await interaction.followUp({
            content: "❌ | This album has no playable tracks.",
            ephemeral: true,
        });
        return;
    }

    const albumName = (album.name as string) || (album.title as string) || (itemMetadata.title as string) || "Album";
    const albumArtist =
        (album.artist as string) || (album.albumArtist as string) || (itemMetadata.artist as string) || "";
    const displayTitle = albumArtist ? `${albumName} - ${albumArtist}` : albumName;
    const title = (itemMetadata.parentTitle as string) || displayTitle;

    const builtTracks: Track[] = [];
    for (const item of sortedEntries) {
        const stream = subsonicStreamUrl(client.config, (item as any).id);
        const thumbUrl =
            (item as any).coverArt != null && (item as any).coverArt !== ""
                ? subsonicCoverArtUrl(client.config, (item as any).coverArt, 500)
                : interaction.client.user!.displayAvatarURL();

        const newTrack = new Track(player, {
            title: (item as any).title,
            author: (item as any).artist || (item as any).albumArtist || albumArtist || "Unknown Artist",
            url: stream,
            thumbnail: thumbUrl ?? "",
            duration: formatDurationMs(Number((item as any).duration || 0) * 1000),
            views: 69,
            playlist: undefined,
            description: undefined,
            requestedBy: interaction.user,
            source: "arbitrary",
            engine: stream,
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
        title,
        leafCount: sortedEntries.length,
    };
    const firstCover = (sortedEntries[0] as any)?.coverArt || (album as any).coverArt || null;
    await subsonicQueuePlay(interaction, responseType, metaOut, firstCover, nextSong);
}

export async function subsonicQueuePlay(
    interaction: GuildCommandInteraction,
    responseType: "send" | "edit",
    itemMetadata: Record<string, unknown>,
    defaultCoverArtId: string | undefined | null,
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

    const coverUrl =
        defaultCoverArtId != null && defaultCoverArtId !== ""
            ? subsonicCoverArtUrl(client.config, defaultCoverArtId, 500)
            : interaction.client.user!.displayAvatarURL();

    const coverKind = itemMetadata.type === "playlist" ? "Playlist" : itemMetadata.type === "album" ? "Album" : "Song";
    const imageAttachment = await buildImageAttachment(coverUrl ?? "", {
        name: "coverimage.jpg",
        description: `${coverKind} Cover Image for ${itemMetadata.title}`,
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
            if (nextSong) {
                embed.setDescription(
                    `Imported the **${itemMetadata.title} playlist** with **${itemMetadata.leafCount}** songs to the top of the queue (playing next)!`,
                );
                embed.setTitle("Added to the top of the queue ⏱️");
            } else {
                embed.setDescription(
                    `Imported the **${itemMetadata.title} playlist** with **${itemMetadata.leafCount}** songs!`,
                );
                embed.setTitle("Added to queue ⏱️");
            }
        } else if (itemMetadata.type === "album") {
            if (nextSong) {
                embed.setDescription(
                    `Imported the **${itemMetadata.title} album** with **${itemMetadata.leafCount}** songs to the top of the queue (playing next)!`,
                );
                embed.setTitle("Added to the top of the queue ⏱️");
            } else {
                embed.setDescription(
                    `Imported the **${itemMetadata.title} album** with **${itemMetadata.leafCount}** songs!`,
                );
                embed.setTitle("Added to queue ⏱️");
            }
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
