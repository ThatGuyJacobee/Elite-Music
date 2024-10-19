require("dotenv").config();
const fs = require("fs");
const { REST } = require("@discordjs/rest");
const { Client, GatewayIntentBits, Partials, Collection, Routes } = require("discord.js");
const { Player } = require("discord-player");
const { YoutubeiExtractor } = require("discord-player-youtubei")
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
    fs.appendFileSync('exception.txt', `${date.toGMTString()}: ${err.stack}\n`);
});

process.on('unhandledRejection', async function(err) {
    var date = new Date();
    console.log(`Caught Rejection: ${err.stack}\n`);
    fs.appendFileSync('rejection.txt', `${date.toGMTString()}: ${err.stack}\n`);
});

//Discord-Player initialisation
const defaultConsts = require(`./utils/defaultConsts`);
const player = new Player(client, {
    smoothVolume: process.env.SMOOTH_VOLUME,
    ytdlOptions: defaultConsts.ytdlOptions
})

player.extractors.register(YoutubeiExtractor, {
    authentication: process.env.YT_CREDENTIALS,
});

player.extractors.loadDefault(
    (extractor) => !["YouTubeExtractor"].includes(extractor)
);

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
    console.log(`[ELITE_CONFIG] Loading Configuration... (Config Version: ${process.env.CFG_VERSION || 'N/A'})`)
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log("[ELITE_CMDS] Commands registered (production)!");
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

//Authenticate with Discord via .env passed token
if (!process.env.TOKEN) {
    console.log(`[ELITE_ERROR] The .env file could not be found/doesn't exist. Have you followed the setup instructions correctly (https://github.com/ThatGuyJacobee/Elite-Music) to ensure that you have configured your environment correctly?`)
    process.exit(0)
}

client.login(process.env.TOKEN)
.catch((err) => {
    console.log(`[ELITE_ERROR] Bot could not login and authenticate with Discord. Have you populated your .env file with your bot token and copied it over correctly? (Using token: ${process.env.TOKEN})\nError Trace: ${err}`);
})

//Verbose logging for debugging purposes
const verbose = process.env.VERBOSE ? process.env.VERBOSE.toLocaleLowerCase() : "none";
if (verbose == "full" || verbose == "normal") {
    //Both normal and full verbose logging will log unhandled rejects, uncaught exceptions and warnings to the console
    process.on("unhandledRejection", (reason) => console.error(reason));
    process.on("uncaughtException", (error) => console.error(error));
    process.on("warning", (warning) => console.error(warning));

    if (verbose == "full") {
        console.log(`[ELITE_CONFIG] Verbose logging enabled and set to full. This will log everything to the console, including: discord-player debugging, unhandled rejections, uncaught exceptions and warnings to the console.`)
        
        //Full verbose logging will also log everything from discord-player to the console
        console.log(player.scanDeps());player.on('debug',console.log).events.on('debug',(_,m)=>console.log(m));
    }

    else if (verbose == "normal") {
        console.log(`[ELITE_CONFIG] Verbose logging enabled and set to normal. This will log unhandled rejections, uncaught exceptions and warnings to the console.`)
    }
}

else {
    console.log(`[ELITE_CONFIG] Verbose logging is disabled.`)
}