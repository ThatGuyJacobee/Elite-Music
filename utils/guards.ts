import type { ChatInputCommandInteraction, Guild, GuildMember } from "discord.js";
import type { ExtendedClient } from "../types";

const client = (globalThis as any).client as ExtendedClient;

/**
 * Check if DJ mode is active and user has the required role.
 * Returns true if the check passed (user can proceed), false otherwise.
 */
export async function checkDjMode(interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (client.config.enableDjMode) {
        const member = interaction.member as GuildMember;
        if (!member.roles.cache.has(client.config.djRole)) {
            await interaction.reply({
                content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`,
                ephemeral: true,
            });
            return false;
        }
    }
    return true;
}

/**
 * Check if the user is in a voice channel and in the same channel as the bot.
 * Returns true if the check passed, false otherwise.
 */
export async function checkVoiceChannel(interaction: ChatInputCommandInteraction): Promise<boolean> {
    const member = interaction.member as GuildMember;
    if (!member.voice.channelId) {
        await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        return false;
    }

    const guild = interaction.guild as Guild;
    if (guild.members.me!.voice.channelId && member.voice.channelId !== guild.members.me!.voice.channelId) {
        await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        return false;
    }

    return true;
}

/**
 * Check that music is currently playing in this guild.
 * Returns the queue if playing, null otherwise.
 */
export async function checkQueue(interaction: ChatInputCommandInteraction): Promise<any> {
    const { useMainPlayer } = await import("discord-player");
    const player = useMainPlayer();
    const guild = interaction.guild as Guild;
    const queue = player.nodes.get(guild.id);

    if (!queue || !queue.isPlaying()) {
        await interaction.reply({ content: "❌ | No music is currently being played!", ephemeral: true });
        return null;
    }

    return queue;
}

/**
 * Get the guild from the interaction (asserted non-null).
 */
export function getGuild(interaction: ChatInputCommandInteraction): Guild {
    return interaction.guild as Guild;
}

/**
 * Get the member from the interaction (asserted as GuildMember).
 */
export function getMember(interaction: ChatInputCommandInteraction): GuildMember {
    return interaction.member as GuildMember;
}

/**
 * Build a footer text for user identification.
 */
export function getUserFooter(user: any): string {
    return `Requested by: ${user.discriminator !== "0" ? user.tag : user.username}`;
}

/**
 * Get the embed color from config.
 */
export function getEmbedColour(): string {
    return client.config.embedColour;
}
