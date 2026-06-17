import type { GuildCommandInteraction } from "./discord";
import { SlashCommandBuilder } from "@discordjs/builders";

export interface Command {
    data: SlashCommandBuilder;
    execute: (interaction: GuildCommandInteraction) => Promise<void>;
    cooldown?: number;
}
