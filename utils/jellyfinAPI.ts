import { normalizeBaseUrl } from "./utilityFunctions";
import type { BotConfig } from "../types";

function jellyfinEndpoint(config: BotConfig, path: string): string {
    const baseUrl = normalizeBaseUrl(config.jellyfinServer);
    return `${baseUrl}/Users/${config.jellyfinUser}/${path}`;
}

function jellyfinHeaders(config: BotConfig): Record<string, string> {
    return {
        "X-Emby-Token": config.jellyfinPass,
        Accept: "application/json",
    };
}

export async function jellyfinPing(config: BotConfig, options: { signal?: AbortSignal } = {}): Promise<void> {
    const baseUrl = normalizeBaseUrl(config.jellyfinServer);
    const response = await fetch(`${baseUrl}/System/Info`, {
        method: "GET",
        headers: jellyfinHeaders(config),
        signal: options.signal,
    });

    if (!response.ok) {
        throw new Error(`Jellyfin ping failed with status ${response.status}`);
    }
}

export async function jellyfinSearch(
    config: BotConfig,
    query: string,
    options: {
        scope?: string;
        limit?: number;
        signal?: AbortSignal;
    } = {},
): Promise<Record<string, unknown>[]> {
    const scope = options.scope ?? "auto";
    const limit = options.limit ?? 10;

    const includeTypes =
        scope === "auto"
            ? "Movie,Series,Music,MusicAlbum,Playlist"
            : scope === "track"
              ? "Music"
              : scope === "album"
                ? "MusicAlbum"
                : scope === "playlist"
                  ? "Playlist"
                  : "Movie,Series,Music,MusicAlbum,Playlist";

    const url = new URL(`${normalizeBaseUrl(config.jellyfinServer)}/Users/${config.jellyfinUser}/Items`);
    url.searchParams.set("SearchTerm", query);
    url.searchParams.set("IncludeItemTypes", includeTypes);
    url.searchParams.set("Limit", String(limit));
    url.searchParams.set("Fields", "PrimaryImageAspectRatio,MediaSources,Path");

    const response = await fetch(url.toString(), {
        method: "GET",
        headers: jellyfinHeaders(config),
        signal: options.signal,
    });

    if (!response.ok) {
        throw new Error(`Jellyfin search failed with status ${response.status}`);
    }

    const json = (await response.json()) as { Items: Record<string, unknown>[] };
    return json.Items ?? [];
}

export async function jellyfinGetPlaylist(
    config: BotConfig,
    playlistId: string,
    options: { signal?: AbortSignal } = {},
): Promise<Record<string, unknown>> {
    const response = await fetch(`${jellyfinEndpoint(config, `Playlists/${playlistId}/Items`)}`, {
        method: "GET",
        headers: jellyfinHeaders(config),
        signal: options.signal,
    });

    if (!response.ok) {
        throw new Error(`Jellyfin get playlist failed with status ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
}

export async function jellyfinGetAlbum(
    config: BotConfig,
    albumId: string,
    options: { signal?: AbortSignal } = {},
): Promise<Record<string, unknown>> {
    const response = await fetch(`${jellyfinEndpoint(config, `Items/${albumId}/Items`)}`, {
        method: "GET",
        headers: jellyfinHeaders(config),
        signal: options.signal,
    });

    if (!response.ok) {
        throw new Error(`Jellyfin get album failed with status ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
}

export function jellyfinStreamUrl(config: BotConfig, itemId: string, mediaSourceId: string): string {
    const baseUrl = normalizeBaseUrl(config.jellyfinServer);
    return `${baseUrl}/Audio/${itemId}/stream.mediaSourceId=${mediaSourceId}.url?UserId=${config.jellyfinUser}&api_key=${config.jellyfinPass}`;
}

export function jellyfinCoverArtUrl(config: BotConfig, itemId: string): string {
    const baseUrl = normalizeBaseUrl(config.jellyfinServer);
    return `${baseUrl}/Items/${itemId}/Images/Primary?userId=${config.jellyfinUser}`;
}
