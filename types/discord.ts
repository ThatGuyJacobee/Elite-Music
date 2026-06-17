import type { ChatInputCommandInteraction, Guild, GuildMember } from "discord.js";

/**
 * A ChatInputCommandInteraction with guaranteed guild context.
 * All our slash commands are guild commands, so these are always available.
 */
export interface GuildCommandInteraction extends Omit<ChatInputCommandInteraction, "guild" | "member"> {
  guild: Guild;
  member: GuildMember;
}

/**
 * Cast a ChatInputCommandInteraction to GuildCommandInteraction.
 * Safe to use for all guild slash commands.
 */
export function asGuildInteraction(
  interaction: ChatInputCommandInteraction,
): GuildCommandInteraction {
  return interaction as unknown as GuildCommandInteraction;
}
