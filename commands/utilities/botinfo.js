const { SlashCommandBuilder, inlineCode } = require("@discordjs/builders");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const { checkLatestRelease } = require("../../utils/utilityFunctions");
const { translate } = require("../../utils/botText");

module.exports = {
    data: new SlashCommandBuilder().setName("botinfo").setDescription("Return information about Elite Bot!"),
    async execute(interaction) {
        // Calculate the epoch time for automatic time counter
        var uptime = Date.now() - Math.round(process.uptime()) * 1000;
        var botuptime = `<t:${(uptime - (uptime % 1000)) / 1000}:R>`;

        // Check Discord.js dependency version
        const packageJSON = require("../../package.json");

        // Check for latest release
        let checkGitHub = await checkLatestRelease();

        const botembed = new EmbedBuilder()
            .setAuthor({
                name: translate(interaction, "botinfo.author", { tag: interaction.client.user.tag }),
                iconURL: interaction.client.user.displayAvatarURL(),
            })
            .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }))
            .setColor(client.config.embedColour)
            .setTitle(translate(interaction, "botinfo.title"))
            .addFields(
                {
                    name: translate(interaction, "botinfo.process"),
                    value: `RAM: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\nNode: ${process.versions.node}`,
                    inline: true,
                },
                {
                    name: translate(interaction, "botinfo.dependencies"),
                    value: `Discord.js: ${packageJSON.dependencies["discord.js"]}\nDiscord-Player: ${packageJSON.dependencies["discord-player"]}\nYouTubei: ${packageJSON.dependencies["discord-player-youtubei"]}`,
                    inline: true,
                },
                {
                    name: translate(interaction, "botinfo.ping"),
                    value: `API: ${Math.round(interaction.client.ws.ping)}ms`,
                    inline: true,
                },
                { name: translate(interaction, "botinfo.uptime"), value: botuptime, inline: true },
                {
                    name: translate(interaction, "botinfo.version"),
                    value: `v1.8 (Latest: **[${checkGitHub.tag_name}](${checkGitHub.html_url})**)`,
                    inline: true,
                },
                { name: "\u200b", value: "\u200b", inline: true },
                {
                    name: translate(interaction, "botinfo.developer"),
                    value: "[ThatGuyJacobee](https://github.com/ThatGuyJacobee)",
                    inline: true,
                },
                {
                    name: translate(interaction, "botinfo.openSource"),
                    value: translate(interaction, "botinfo.openSourceDescription"),
                    inline: false,
                },
            )
            .setTimestamp()
            .setFooter({ text: translate(interaction, "botinfo.footer", { tag: interaction.client.user.tag }) });

        var actionbuttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setURL(`https://github.com/ThatGuyJacobee/Elite-Bot-Music`)
                .setStyle(5)
                .setLabel(translate(interaction, "botinfo.buttons.repo")),
            new ButtonBuilder()
                .setURL(`https://hub.docker.com/r/thatguyjacobee/elitemusic`)
                .setStyle(5)
                .setLabel(translate(interaction, "botinfo.buttons.docker")),
            new ButtonBuilder()
                .setURL(`https://elite-bot.com/`)
                .setStyle(5)
                .setLabel(translate(interaction, "botinfo.buttons.docs")),
            new ButtonBuilder()
                .setURL(`https://discord.elite-bot.com/`)
                .setStyle(5)
                .setLabel(translate(interaction, "botinfo.buttons.support")),
        );

        interaction.reply({ embeds: [botembed], components: [actionbuttons] });
    },
};
