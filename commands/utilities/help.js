const { SlashCommandBuilder } = require("@discordjs/builders");
const { ButtonBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const fs = require("fs");
const { getDisplayName, translate, translateHelpCategory } = require("../../utils/botText");

module.exports = {
    data: new SlashCommandBuilder().setName("help").setDescription("Get information about my commands!"),
    cooldown: 30,
    async execute(interaction) {
        const guildid = interaction.guild.id;
        const dirs = [];
        const categories = [];

        fs.readdirSync("./commands/").forEach((dir) => {
            let commands = fs.readdirSync(`./commands/${dir}`).filter((file) => file.endsWith(".js"));
            const cmds = commands.map((command) => {
                let file = require(`../../commands/${dir}/${command}`);
                return {
                    name: dir,
                    commands: {
                        name: file.data.name,
                        description: file.data.description,
                    },
                };
            });

            categories.push(cmds.filter((categ) => categ.name === dir));
        });

        let page = 0;
        const emojis = {
            music: "🎵",
            utilities: "🛄",
        };

        const description = {
            music: translate(interaction, "help.musicDescription"),
            utilities: translate(interaction, "help.utilitiesDescription"),
        };

        const menuoptions = [
            {
                label: translate(interaction, "help.homeOptionLabel"),
                description: translate(interaction, "help.homeOptionDescription"),
                emoji: "🏡",
                value: "home",
            },
        ];

        categories.forEach((cat) => {
            dirs.push(cat[0].name);
        });

        const embed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setColor(client.config.embedColour)
            .setTitle(translate(interaction, "help.title"))
            .setDescription(translate(interaction, "help.homeDescription"))
            .setTimestamp()
            .setFooter({ text: translate(interaction, "help.footer", { user: getDisplayName(interaction.user) }) });

        dirs.forEach((dir, index) => {
            const categoryLabel = translateHelpCategory(interaction, dir);

            embed.addFields({
                name: `${emojis[dir] || ""} ${categoryLabel}`,
                value: `${description[dir] ? description[dir] : translate(interaction, "help.categoryFallback", { category: categoryLabel })}`,
            });

            menuoptions.push({
                label: categoryLabel,
                description: translate(interaction, "help.categoryPageDescription", {
                    category: categoryLabel,
                }),
                emoji: `${emojis[dir] || ""}`,
                value: `${page++}`,
            });
        });

        var finalComponents = [
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("select")
                    .setPlaceholder(translate(interaction, "help.menuPlaceholder"))
                    .addOptions(menuoptions),
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("np-delete").setStyle(4).setLabel("🗑️"),
                new ButtonBuilder()
                    .setURL(`https://github.com/ThatGuyJacobee/Elite-Bot-Music`)
                    .setStyle(5)
                    .setLabel(translate(interaction, "help.buttons.repo")),
                new ButtonBuilder()
                    .setURL(`https://hub.docker.com/r/thatguyjacobee/elitemusic`)
                    .setStyle(5)
                    .setLabel(translate(interaction, "help.buttons.docker")),
                new ButtonBuilder()
                    .setURL(`https://elite-bot.com/`)
                    .setStyle(5)
                    .setLabel(translate(interaction, "help.buttons.docs")),
                new ButtonBuilder()
                    .setURL(`https://discord.elite-bot.com/`)
                    .setStyle(5)
                    .setLabel(translate(interaction, "help.buttons.support")),
            ),
        ];

        interaction.reply({ embeds: [embed], components: finalComponents, fetchReply: true });
    },
};
