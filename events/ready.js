const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const request = require('request');
const { MessageEmbed, Permissions } = require("discord.js");
const { config } = require("dotenv");
const ms = require("ms");
const { random } = require("../database/database.js");
require("dotenv").config();

module.exports = {
    name: "ready",
    once: true,
    async execute (client, commands){
        console.log("[ELITE_STATUS] Core of the bot is ready!");
		client.user.setActivity(`/help | elite-bot.com`, {type: 'WATCHING'});

        //Database connection on bot launch
		const db = require("../database/database.js"); //Require database.js
        const ebmusic = require("../models/ebmusic.js");
        //Login to database
        (async () => {
            db.authenticate()
                .then(() => {
                    console.log("[ELITE_DB] Database connection has been established successfully.");
                    ebmusic.init(db);
                    ebmusic.sync();
                })
                .catch(err => console.log(err));
        })();

        //Register all of the commands
        const CLIENT_ID = client.user.id;
        const rest = new REST({
            version: "9"
        }).setToken(process.env.TOKEN);
    
        (async () => {
            try {
                if (process.env.ENV === "production") {
                    await rest.put(Routes.applicationCommands(CLIENT_ID), {
                        body: commands
                    });
                    console.log("[ELITE_CMDS] Commands registered. (global prod)!");
                } else {
                    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, process.env.GUILD_ID), {
                        body: commands
                    });
                    console.log("[ELITE_CMDS] Commands registered (local dev)!");
                }
            } catch (err) {
                if (err) console.error(err);
            }
        })();
    }
}