import "dotenv/config";
import { readFileSync } from "fs";
import { REST } from "@discordjs/rest";
import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  Routes,
  Events,
} from "discord.js";
import { Player } from "discord-player";
import { DefaultExtractors } from "@discord-player/extractor";
import { YoutubeiExtractor } from "discord-player-youtubei";
import { defaultConsts } from "./utils/defaultConsts";
import type { Command } from "./types/commands";
import type { ExtendedClient } from "./types";
import { createI18n } from "./utils/i18n";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.AutoModerationExecution,
  ],
  partials: [Partials.GuildMember, Partials.User, Partials.Message, Partials.Channel, Partials.Reaction],
}) as ExtendedClient;

// Make client globally available
global.client = client;
global.page = 1;

// Logging for exceptions and rejection
process.on("uncaughtException", (err: Error) => {
  const date = new Date();
  console.log(`Caught Exception: ${err.stack}\n`);
  const fs = require("fs");
  fs.appendFileSync("exception.txt", `${date.toUTCString()}: ${err.stack}\n`);
});

process.on("unhandledRejection", (err: unknown) => {
  const date = new Date();
  const error = err instanceof Error ? err : new Error(String(err));
  console.log(`Caught Rejection: ${error.stack}\n`);
  const fs = require("fs");
  fs.appendFileSync("rejection.txt", `${date.toUTCString()}: ${error.stack}\n`);
});

// Discord-Player initialisation
const player = new Player(client, {
  ytdlOptions: defaultConsts.ytdlOptions,
} as any);
player.extractors.loadMulti(DefaultExtractors);
player.extractors.register(YoutubeiExtractor, {
  authentication: process.env.YT_CREDENTIALS || undefined,
});

// Initialise commands through directory scanning
const fs = require("fs");
const path = require("path");
const commands: Command[] = [];
client.commands = new Collection();

const commandsDir = path.join(__dirname, "commands");
const categoryDirs = fs.readdirSync(commandsDir);

for (const dir of categoryDirs) {
  const commandFiles = fs
    .readdirSync(path.join(commandsDir, dir))
    .filter((file: string) => file.endsWith(".js") || file.endsWith(".ts"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsDir, dir, file);
    const commandModule = require(filePath);
    const command: Command = commandModule.default || commandModule;
    client.commands.set(command.data.name, command);
    commands.push(command.data as any);
  }
}

// Register all of the commands
client.once("clientReady", async () => {
  console.log(
    `[ELITE_CONFIG] Loading Configuration... (Config Version: ${process.env.CFG_VERSION || "N/A"})`,
  );
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN!);

  try {
    await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
    console.log("[ELITE_CMDS] Commands registered (production)!");
  } catch (err) {
    console.error(err);
  }
});

// Load event files
const eventsDir = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsDir).filter((file: string) => file.endsWith(".js") || file.endsWith(".ts"));

for (const file of eventFiles) {
  const filePath = path.join(eventsDir, file);
  const eventModule = require(filePath);
  const event = eventModule.default || eventModule;

  if (event.skipDiscordEventRegistration) continue;

  if (event.once) {
    client.once(event.name, (...args: unknown[]) => event.execute(...args, commands));
  } else {
    client.on(event.name, (...args: unknown[]) => event.execute(...args, commands));
  }
}

// Authenticate with Discord via .env passed token
if (!process.env.TOKEN) {
  console.log(
    `[ELITE_ERROR] The .env file could not be found/doesn't exist. Have you followed the setup instructions correctly (https://github.com/ThatGuyJacobee/Elite-Music) to ensure that you have configured your environment correctly?`,
  );
  process.exit(0);
}

client.login(process.env.TOKEN).catch((err: unknown) => {
  console.log(
    `[ELITE_ERROR] Bot could not login and authenticate with Discord. Have you populated your .env file with your bot token and copied it over correctly? (Using token: ${process.env.TOKEN})\nError Trace: ${err}`,
  );
});

// Verbose logging for debugging purposes
const verbose = process.env.VERBOSE ? process.env.VERBOSE.toLowerCase() : "none";
if (verbose === "full" || verbose === "normal") {
  process.on("unhandledRejection", (reason: unknown) => console.error(reason));
  process.on("uncaughtException", (error: Error) => console.error(error));
  process.on("warning", (warning: Error) => console.error(warning);

  if (verbose === "full") {
    console.log(
      `[ELITE_CONFIG] Verbose logging enabled and set to full. This will log everything to the console, including: discord-player debugging, unhandled rejections, uncaught exceptions and warnings to the console.`,
    );

    console.log(player.scanDeps());
    player.on("debug", console.log);
    player.events.on("debug", (_: unknown, m: unknown) => console.log(m));
  } else if (verbose === "normal") {
    console.log(
      `[ELITE_CONFIG] Verbose logging enabled and set to normal. This will log unhandled rejections, uncaught exceptions and warnings to the console.`,
    );
  }
} else {
  console.log(`[ELITE_CONFIG] Verbose logging is disabled.`);
}
