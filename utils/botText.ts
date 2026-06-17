import type { User, GuildMember } from "discord.js";
import type { ExtendedClient } from "../types";
import { FALLBACK_LOCALE } from "./i18n";

const client = (globalThis as any).client as ExtendedClient;

const COVER_IMAGE_KEYS: Record<string, string> = {
  song: "common.songCoverImage",
  playlist: "common.playlistCoverImage",
  album: "common.albumCoverImage",
};

const SEARCH_MEDIA_TYPE_KEYS: Record<string, string> = {
  track: "search.track",
  song: "search.track",
  playlist: "search.playlist",
  album: "search.album",
};

type TranslateSource = any;

export function getDisplayName(user: User | GuildMember | null, source: TranslateSource = null): string {
  if (!user) return source ? translate(source, "common.unknownUser") : "Unknown User";
  const u = user as User;
  return u.discriminator !== "0" ? u.tag : u.username;
}

function getClientFromSource(source: TranslateSource): ExtendedClient | undefined {
  return source?.client ?? source?.guild?.client ?? source?.metadata?.channel?.client ?? (globalThis as any).client;
}

function getSourceLocale(source: TranslateSource): string | undefined {
  return (
    source?.locale ??
    source?.interaction?.locale ??
    source?.metadata?.locale ??
    source?.metadata?.interaction?.locale
  );
}

function getLocaleFromSource(source: TranslateSource): string {
  const clientInstance = getClientFromSource(source);
  const primaryLocale = clientInstance?.config?.primaryLocale ?? FALLBACK_LOCALE;
  const localeMode = clientInstance?.config?.localeMode ?? "global";

  if (localeMode !== "user") {
    return primaryLocale;
  }

  const sourceLocale = getSourceLocale(source);
  const matchedLocale = clientInstance?.i18n?.getSupportedLocale?.(sourceLocale);
  return matchedLocale ?? primaryLocale;
}

export function translate(source: TranslateSource, key: string, variables: Record<string, any> = {}): string {
  const clientInstance = getClientFromSource(source);
  const locale = variables.locale ?? getLocaleFromSource(source);

  if (clientInstance?.t) {
    return clientInstance.t(key, variables, locale);
  }

  return key;
}

export function getRequestedByText(source: TranslateSource, user: User | GuildMember): string {
  return translate(source, "footer.requestedBy", { user: getDisplayName(user, source) });
}

export function buildRequestedByFooter(source: TranslateSource, user: User | GuildMember): { text: string } {
  return {
    text: getRequestedByText(source, user),
  };
}

export function buildRequestedByPageFooter(source: TranslateSource, user: User | GuildMember, page: number): { text: string } {
  return {
    text: translate(source, "footer.requestedByPage", { user: getDisplayName(user, source), page }),
  };
}

export function buildTrackLinkText(track: any, source: TranslateSource = null): string {
  if (!track || track.queryType === "arbitrary" || !track.url) {
    return "";
  }

  const label = source ? translate(source, "common.link") : "Link";
  return `([${label}](${track.url}))`;
}

export function buildUrlLinkText(source: TranslateSource, url: string): string {
  if (!url) {
    return "";
  }

  return `([${translate(source, "common.link")}](${url}))`;
}

export function buildCoverImageDescription(source: TranslateSource, mediaType: string, title: string): string {
  const key = COVER_IMAGE_KEYS[mediaType] ?? COVER_IMAGE_KEYS.song;
  return translate(source, key, { title });
}

export function translateGenericAction(source: TranslateSource, actionKey: string): string {
  return translate(source, "errors.genericAction", {
    action: translate(source, `errors.actions.${actionKey}`),
  });
}

export function translateHelpCategory(source: TranslateSource, categoryKey: string): string {
  const normalized = categoryKey?.toLowerCase();
  const key = `help.categories.${normalized}`;
  const localized = translate(source, key);

  if (localized === key) {
    return categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1).toLowerCase();
  }

  return localized;
}

export function translateSearchMediaType(source: TranslateSource, mediaType: string): string {
  const key = SEARCH_MEDIA_TYPE_KEYS[mediaType?.toLowerCase()];

  if (key) {
    return translate(source, key);
  }

  return mediaType ? mediaType.charAt(0).toUpperCase() + mediaType.slice(1) : mediaType;
}

export function translateAudioFilter(source: TranslateSource, filterId: string): string {
  const key = `audiofilter.filters.${filterId}`;
  const localized = translate(source, key);

  if (localized === key) {
    return filterId;
  }

  return localized;
}
