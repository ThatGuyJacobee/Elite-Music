const { SlashCommandBuilder, inlineCode } = require("@discordjs/builders");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("botinfo")
        .setDescription("Return information about Elite Bot!"),
    async execute(interaction) {
        //Calculate the epoch time for automatic time counter
        var uptime = Date.now() - (Math.round(process.uptime()) * 1000);
        var botuptime = `<t:${(uptime-(uptime%1000)) / 1000}:R>`;

        //Check Discord.js dependency version
        const packageJSON = require("../../package.json");

        const botembed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag + " - Bot Info", iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail(interaction.client.user.displayAvatarURL({dynamic: true}))
        .setColor(client.config.embedColour)
        .setTitle("Elite Bot Music Information")
        .addFields(
            { name: "Process", value: `${((process.memoryUsage().heapUsed / 1024) / 1024).toFixed(2)} MB\nNJS - v${process.versions.node}\nDJS - v${packageJSON.dependencies["discord.js"]}\nDiscord Player - v${packageJSON.dependencies["discord-player"]}`, inline: true },
            { name: "Ping", value: `API - ${Math.round(interaction.client.ws.ping)}ms`, inline: true },
            { name: "Uptime Since", value: botuptime, inline: true },
            { name: "Developer & Maintainer", value: "[ThatGuyJacobee](https://github.com/ThatGuyJacobee)", inline: true },
            { name: "Open Source Project", value: "Are you interested in improving this open source bot? Or are you looking to host this yourself? Look no further! You can access the public bot [repository here](https://github.com/ThatGuyJacobee/Elite-Bot-Music) and follow the readme instructions for more info! :)", inline: false },
        )
        .setTimestamp()
        .setFooter({ text: `/botinfo - ${interaction.client.user.tag}` })

        var actionbuttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setURL(`https://github.com/ThatGuyJacobee/Elite-Bot-Music`)
                .setStyle(5)
                .setLabel("🛡️ Open Source Repo"),
            new ButtonBuilder()
                .setURL(`https://hub.docker.com/r/thatguyjacobee/elitemusic`)
                .setStyle(5)
                .setLabel("🐳 Docker Hub"),
            new ButtonBuilder()
                .setURL(`https://elite-bot.com/`)
                .setStyle(5)
                .setLabel("📄 Elite Bot Docs"),
            new ButtonBuilder()
                .setURL(`https://discord.elite-bot.com/`)
                .setStyle(5)
                .setLabel("🆘 Support Server")
        )

        interaction.reply({ embeds: [botembed], components: [actionbuttons] });
    }
}