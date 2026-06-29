import type { BotConfig } from "../types";
import { normalizeBaseUrl, toArray, randomSalt, md5Utf8Hex } from "./utilityFunctions";

const DEFAULT_API_VERSION = "1.16.0";

interface SubsonicError {
  code?: string | number;
  message?: string;
}

interface SubsonicResponseRoot {
  status: string;
  error?: SubsonicError;
  "subsonic-response"?: {
    status: string;
    error?: SubsonicError;
    [key: string]: unknown;
  };
}

function buildQueryParams(config: BotConfig, extra: Record<string, string | number> = {}): URLSearchParams {
  const salt = randomSalt(6);
  const token = md5Utf8Hex(config.subsonicPass + salt);
  const params = new URLSearchParams({
    u: config.subsonicUser,
    t: token,
    s: salt,
    v: config.subsonicApiVersion || DEFAULT_API_VERSION,
    c: config.subsonicAppName || "Elite-Music-Bot",
    f: "json",
  });

  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }

  return params;
}

function restUrl(config: BotConfig, method: string, extra: Record<string, string | number> = {}): string {
  const base = normalizeBaseUrl(config.subsonicServer);
  const params = buildQueryParams(config, extra);

  return `${base}/rest/${method}?${params.toString()}`;
}

function parseSubsonicJson(data: unknown): Record<string, unknown> {
  const typedData = data as Record<string, unknown>;
  const root = typedData && typedData["subsonic-response"];

  if (!root) {
    const err = new Error("Invalid Subsonic response: missing subsonic-response");
    (err as any).code = "INVALID_JSON";
    throw err;
  }

  const rootTyped = root as Record<string, unknown>;
  if (rootTyped.status !== "ok") {
    const errorObj = rootTyped.error as SubsonicError | undefined;
    const err = new Error(errorObj?.message ?? "Subsonic request failed");
    (err as any).code = errorObj?.code != null ? String(errorObj.code) : "SUBSONIC_FAILED";
    (err as any).subsonic = errorObj;
    throw err;
  }

  return rootTyped;
}

export async function subsonicRequest(
  config: BotConfig,
  method: string,
  extraParams: Record<string, string | number> = {},
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  const url = restUrl(config, method, extraParams);
  const res = await fetch(url, { method: "GET", ...init });
  const text = await res.text();
  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    const err = new Error("Subsonic response was not JSON");
    (err as any).code = "NOT_JSON";
    throw err;
  }

  return parseSubsonicJson(data);
}

export async function ping(config: BotConfig, init: RequestInit = {}): Promise<Record<string, unknown>> {
  return subsonicRequest(config, "ping", {}, init);
}

export interface SubsonicSearchResult {
  songs: Record<string, unknown>[];
  albums: Record<string, unknown>[];
  artists: Record<string, unknown>[];
}

export async function search2(
  config: BotConfig,
  query: string,
  options: { songCount?: number; artistCount?: number; albumCount?: number; songOffset?: number } = {},
): Promise<SubsonicSearchResult> {
  const { songCount = 10, artistCount = 0, albumCount = 0, songOffset = 0 } = options;
  const root = await subsonicRequest(config, "search2", {
    query,
    songCount,
    songOffset,
    artistCount,
    albumCount,
  });
  const block = (root.searchResult2 as Record<string, unknown>) || {};

  return {
    songs: toArray(block.song as Record<string, unknown>[] | Record<string, unknown>),
    albums: toArray(block.album as Record<string, unknown>[] | Record<string, unknown>),
    artists: toArray(block.artist as Record<string, unknown>[] | Record<string, unknown>),
  };
}

export async function getPlaylists(config: BotConfig): Promise<Record<string, unknown>[]> {
  const root = await subsonicRequest(config, "getPlaylists");
  const block = (root.playlists as Record<string, unknown>) || {};

  return toArray(block.playlist as Record<string, unknown>[] | Record<string, unknown>);
}

export async function getPlaylist(
  config: BotConfig,
  id: string,
): Promise<{ playlist: Record<string, unknown>; entries: Record<string, unknown>[] }> {
  const root = await subsonicRequest(config, "getPlaylist", { id });
  const pl = (root.playlist as Record<string, unknown>) || {};
  const entries = toArray((pl.entry as Record<string, unknown>[] | Record<string, unknown>) || []);

  return { playlist: pl, entries };
}

export async function getSong(config: BotConfig, id: string): Promise<Record<string, unknown> | undefined> {
  const root = await subsonicRequest(config, "getSong", { id });
  const s = root.song;

  return Array.isArray(s) ? (s[0] as Record<string, unknown>) : (s as Record<string, unknown>);
}

export async function getAlbum(
  config: BotConfig,
  id: string,
): Promise<{ album: Record<string, unknown>; songs: Record<string, unknown>[] }> {
  const root = await subsonicRequest(config, "getAlbum", { id });
  const album = (root.album as Record<string, unknown>) || {};
  const songs = toArray((album.song as Record<string, unknown>[] | Record<string, unknown>) || []);

  return { album, songs };
}

export function streamUrl(config: BotConfig, songId: string): string {
  return restUrl(config, "stream", { id: songId, format: "raw" });
}

export function coverArtUrl(config: BotConfig, coverArtId: string | null | undefined, size?: number): string | null {
  if (coverArtId == null || coverArtId === "") return null;

  const extra: Record<string, string | number> = { id: coverArtId };
  if (size != null) extra.size = size;

  return restUrl(config, "getCoverArt", extra);
}

export { DEFAULT_API_VERSION };
