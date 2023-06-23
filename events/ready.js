require("dotenv").config();

module.exports = {
    name: "ready",
    once: true,
    async execute (client, commands){
        client.user.setActivity(`/help | elite-bot.com`, { type: 2 });
        console.log("[ELITE_STATUS] Checks are successful. Core of the bot is ready!");
    }
}