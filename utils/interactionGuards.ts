import { MessageFlags } from "discord.js";
import type { GuildCommandInteraction } from "../types/discord";
import type { ExtendedClient } from "../types";
import { translate } from "./botText";

const client = (globalThis as any).client as ExtendedClient;

export function ephemeralReply(options: string | { content: string; flags?: number }): {
    content: string;
    flags: number;
} {
    if (typeof options === "string") {
        return { content: options, flags: MessageFlags.Ephemeral };
    }

    return { ...options, flags: MessageFlags.Ephemeral };
}

export async function ensureDjAccess(interaction: GuildCommandInteraction): Promise<boolean> {
    if (!client.config.enableDjMode) return true;
    if (interaction.member.roles.cache.has(client.config.djRole)) return true;

    await interaction.reply(
        ephemeralReply({
            content: translate(interaction, "guards.djMode", { role: `<@&${client.config.djRole}>` }),
        }),
    );
    return false;
}

export async function ensureInVoiceChannel(interaction: GuildCommandInteraction): Promise<boolean> {
    if (interaction.member.voice.channelId) return true;

    await interaction.reply(
        ephemeralReply({
            content: translate(interaction, "guards.notInVoice"),
        }),
    );
    return false;
}

export async function ensureSameVoiceChannel(interaction: GuildCommandInteraction): Promise<boolean> {
    if (
        !interaction.guild.members.me!.voice.channelId ||
        interaction.member.voice.channelId === interaction.guild.members.me!.voice.channelId
    ) {
        return true;
    }

    await interaction.reply(
        ephemeralReply({
            content: translate(interaction, "guards.notInBotVoice"),
        }),
    );
    return false;
}

export function getQueueNotPlayingResponse(interaction: GuildCommandInteraction): { content: string; flags: number } {
    return ephemeralReply({
        content: translate(interaction, "queue.nothingPlaying"),
    });
}

export function getQueueEmptyResponse(interaction: GuildCommandInteraction): { content: string; flags: number } {
    return ephemeralReply({
        content: translate(interaction, "queue.empty"),
    });
}

export async function ensurePlexEnabled(interaction: GuildCommandInteraction): Promise<boolean> {
    if (client.config.enablePlex) return true;

    await interaction.reply(
        ephemeralReply({
            content: translate(interaction, "feature.plexDisabled"),
        }),
    );
    return false;
}

export async function ensureSubsonicEnabled(interaction: GuildCommandInteraction): Promise<boolean> {
    if (client.config.enableSubsonic) return true;

    await interaction.reply(
        ephemeralReply({
            content: translate(interaction, "feature.subsonicDisabled"),
        }),
    );
    return false;
}

export async function ensureJellyfinEnabled(interaction: GuildCommandInteraction): Promise<boolean> {
    if (client.config.enableJellyfin) return true;

    await interaction.reply(
        ephemeralReply({
            content: translate(interaction, "feature.jellyfinDisabled"),
        }),
    );
    return false;
}
