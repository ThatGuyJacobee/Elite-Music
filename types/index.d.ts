import { Client, Collection } from "discord.js";
import type { Command } from "./commands";
import type { I18n } from "../utils/i18n";

interface BotConfig {
    embedColour: string;
    presence: string;
    leaveOnEmpty: boolean;
    leaveOnEmptyCooldown: number;
    leaveOnEnd: boolean;
    leaveOnEndCooldown: number;
    leaveOnStop: boolean;
    leaveOnStopCooldown: number;
    selfDeafen: boolean;
    defaultVolume: number;
    smoothVolume: boolean;
    enableDjMode: boolean;
    djRole: string;
    enablePlex: boolean;
    plexServer: string;
    plexAuthtoken: string;
    enableSubsonic: boolean;
    subsonicServer: string;
    subsonicUser: string;
    subsonicPass: string;
    subsonicAppName: string;
    subsonicApiVersion: string;
    enableJellyfin: boolean;
    jellyfinServer: string;
    jellyfinUser: string;
    jellyfinPass: string;
    primaryLocale: string;
    localeMode: string;
}

declare global {
    var client: ExtendedClient;
    var page: number;
}

interface ExtendedClient extends Client {
    commands: Collection<string, Command>;
    config: BotConfig;
    i18n?: I18n;
    t?: (key: string, variables?: Record<string, any>, locale?: string) => string;
}
