import { AttachmentBuilder } from "discord.js";
import { createHash, randomBytes } from "crypto";
import { readFileSync } from "fs";
import type { BotConfig } from "../types";

// Configuration secrets that should not be logged into console during startup
export const CONFIG_SECRET_KEYS: (keyof BotConfig)[] = ["plexAuthtoken", "subsonicPass", "jellyfinPass"] as (keyof BotConfig)[];

export function normalizeBaseUrl(server: string | undefined | null): string {
  if (!server || typeof server !== "string") return "";
  return server.replace(/\/+$/, "");
}

export function toArray<T>(value: T[] | T | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function randomSalt(byteLength = 8): string {
  return randomBytes(byteLength).toString("hex");
}

export function md5Utf8Hex(value: string): string {
  return createHash("md5").update(value, "utf8").digest("hex");
}

export function formatDurationMs(durationMilliseconds: number | string): string {
  const durationAsNumber = Number(durationMilliseconds);
  if (!Number.isFinite(durationAsNumber) || durationAsNumber < 0) {
    return "--:--";
  }

  const totalSeconds = Math.floor(durationAsNumber / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
}

export function redactConfigSecrets(
  config: BotConfig,
  options: { revealSecrets?: boolean } = {},
): BotConfig {
  const { revealSecrets = false } = options;
  const out = { ...config };
  if (revealSecrets) return out;
  for (const key of CONFIG_SECRET_KEYS) {
    const v = out[key];
    if (v != null && String(v).length > 0) {
      (out as Record<string, any>)[key] = "********";
    }
  }
  return out;
}

async function getImageSize(url: string): Promise<string> {
  const request = await fetch(url);
  if (request.ok) {
    return request.headers.get("content-length") || "0";
  }
  return "0";
}

export async function buildImageAttachment(
  url: string,
  metadata: { name: string; description: string },
): Promise<AttachmentBuilder> {
  try {
    const imgSize = await getImageSize(url);

    if (Number(imgSize) < 10_000_000) {
      return new AttachmentBuilder(url, metadata);
    }

    const defaultImg = readFileSync("./assets/default-thumbnail.png");
    return new AttachmentBuilder(defaultImg, {
      name: "coverimage.jpg",
      description: "Cover Image Not Found",
    });
  } catch (error) {
    console.log("Error building image attachment from source. Defaulting to placeholder image...");
    const defaultImg = readFileSync("./assets/default-thumbnail.png");
    return new AttachmentBuilder(defaultImg, { name: "coverimage.jpg", description: "Cover Image Not Found" });
  }
}

export async function checkLatestRelease(): Promise<Record<string, unknown> | false> {
  const checkGitHub = await fetch("https://api.github.com/repos/ThatGuyJacobee/Elite-Music/releases/latest", {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (checkGitHub.ok) {
    const response = (await checkGitHub.json()) as Record<string, unknown>;
    return response;
  }

  return false;
}
