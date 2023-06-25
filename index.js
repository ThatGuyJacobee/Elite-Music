require("dotenv").config();
const fs = require("fs");
const { REST } = require("@discordjs/rest");
const { Client, GatewayIntentBits, Partials, Collection, Routes } = require("discord.js");
const { Player } = require("discord-player");
client = new Client({
    intents: [ //Sets the necessary intents which discord requires
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
    partials: [
        Partials.GuildMember,
        Partials.User,
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
    ],
});

//Added logging for exceptions and rejection
process.on('uncaughtException', async function(err) {
    var date = new Date();
    console.log(`Caught Exception: ${err.stack}\n`);
    fs.appendFileSync('logs/exception.txt', `${date.toGMTString()}: ${err.stack}\n`);
});

process.on('unhandledRejection', async function(err) {
    var date = new Date();
    console.log(`Caught Rejection: ${err.stack}\n`);
    fs.appendFileSync('logs/rejection.txt', `${date.toGMTString()}: ${err.stack}\n`);
});

//Discord-Player initialisation
const defaultConsts = require(`./utils/defaultConsts`);
const { YouTubeExtractor, SpotifyExtractor, SoundCloudExtractor, AttachmentExtractor } = require('@discord-player/extractor')
const player = new Player(client, {
    smoothVolume: process.env.SMOOTH_VOLUME,
    ytdlOptions: defaultConsts.ytdlOptions
})
player.extractors.register(YouTubeExtractor, SpotifyExtractor, SoundCloudExtractor, AttachmentExtractor)

//Initialise commands through JSON
const commands = [];
client.commands = new Collection(); //Creates new command collection
fs.readdirSync("./commands/").forEach((dir) => {
    const commandFiles = fs.readdirSync(`./commands/${dir}`).filter(file => file.endsWith(".js"));

    for (const file of commandFiles) { //For each file, retrieve name/desc and push it as JSON
        const command = require(`./commands/${dir}/${file}`);
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    }
})

//Register all of the commands
client.once('ready', async function() {
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

    try {
        if (process.env.ENV === "prod") {
            await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
            await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), { body: [] });
            console.log("[ELITE_CMDS] Commands registered (production)!");
        } else {
            await rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID), { body: commands });
            await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
            console.log("[ELITE_CMDS] Commands registered (development)!");
        }
    } catch (err) {
        console.error(err);
    }
})

const eventFiles = fs.readdirSync("./events").filter(file => file.endsWith(".js")); //Searches all .js files
for (const file of eventFiles) { //For each file, check if the event is .once or .on and execute it as specified within the event file itself
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, commands));
    } else {
        client.on(event.name, (...args) => event.execute(...args, commands));
    }
}

//Login to the bot via token passed (from .env)
client.login(process.env.TOKEN)
.catch((err) => {
    console.log(`[ELITE_ERROR] Bot could not login and authenticate.\nError Trace: ${err}`);
})