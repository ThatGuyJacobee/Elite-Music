require("dotenv").config();
const fs = require("fs");
const { Client, Intents, Collection } = require("discord.js");
const { registerPlayerEvents } = require('./events/musicevents.js');
const { Player } = require("discord-player");
const { AutoPoster } = require("topgg-autoposter");
const client = new Client({
    intents: [ //Sets the necessary intents which discord requires
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_VOICE_STATES,
        Intents.FLAGS.GUILD_PRESENCES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    ],
    partials: [
    "MESSAGE", 
    "CHANNEL", 
    "REACTION",
    ],
});

//Music discord-player initialisation
global.player = new Player(client);
const downloader = require("@discord-player/downloader").Downloader;
global.player.use("YOUTUBE_DL", downloader);
registerPlayerEvents(global.player);

//Initialise commands through JSON
global.commands = [];
client.commands = new Collection(); //Creates new command collection
fs.readdirSync("./commands/").forEach((dir) => {
    commandFiles = fs.readdirSync(`./commands/${dir}`).filter(file => file.endsWith(".js"));

    for (const file of commandFiles) { //For each file, retrieve name/desc and push it as JSON
        const command = require(`./commands/${dir}/${file}`);
        global.commands.push(command.data.toJSON());
        client.commands.set(command.data.name, command);
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

const ap = AutoPoster(process.env.TOPGG_TOKEN, client)
ap.on('posted', () => {
    console.log("Top.gg stats updated successfully!")
})

//"npm run dev" for testing (auto restart on save) | "npm run prod" for production

client.login(process.env.TOKEN); //Login to the bot via token passed (from .env)