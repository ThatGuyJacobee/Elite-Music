const { SlashCommandBuilder } = require("@discordjs/builders");
const { ButtonBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const fs = require("fs");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Get information about my commands!"),
    cooldown: 30,
    async execute(interaction) {
        const guildid = interaction.guild.id;
        const dirs = [];
        const categories = [];

        fs.readdirSync("./commands/").forEach((dir) => {
            let commands = fs.readdirSync(`./commands/${dir}`).filter(file => file.endsWith(".js"));
            const cmds = commands.map((command) => {
                let file = require(`../../commands/${dir}/${command}`);
                return {
                    name: dir,
                    commands: {
                        name: file.data.name,
                        description: file.data.description
                    }
                }
            });

            categories.push(cmds.filter(categ => categ.name === dir));
        })

        let page = 0;
        const emojis = {
            "music": "🎵",
            "utilities": "🛄",
        };

        const description = {
            "music": "Music commands.",
            "utilities": "Generally useful commands to use.",
        }

        const menuoptions = [
            {
                label: "Home",
                description: "Home Page",
                emoji: "🏡",
                value: "home"
            }
        ]

        categories.forEach(cat => {
            dirs.push(cat[0].name);
        });

        const embed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setColor(client.config.embedColour)
        .setTitle('Elite Music - Help Menu')
        .setDescription(`Select a category via the menu below to view the commands available. 📢 \n\nExperiencing a bug or have a great suggestion for improvement? Please create an issue on the **[GitHub Repository](https://github.com/ThatGuyJacobee/Elite-Music)** or contact me by joining the **[Support Discord Server](https://discord.elite-bot.com)** and it will be reviewed as soon as possible. 🆘\n\nFor in-depth setup information, please browse the **[GitHub Repository ReadMe](https://github.com/ThatGuyJacobee/Elite-Music)** which is always maintained up-to-date and provides you with everything you need to know. 📄`)
        .setTimestamp()
        .setFooter({ text: `/help | Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })
        
        dirs.forEach((dir, index) => {
            embed.addFields({ name: `${emojis[dir] ||''} ${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()}`, value: `${description[dir] ? description[dir] : `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()} Commands`}`},)

            menuoptions.push({
                label: `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()}`,
                description: `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()} commands page`,
                emoji: `${emojis[dir] || ''}`,
                value: `${page++}`
            })
        });

        var finalComponents = [
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select')
                    .setPlaceholder('Click to see all the categories')
                    .addOptions(menuoptions),
            ),
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("np-delete")
                    .setStyle(4)
                    .setLabel("🗑️"),
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
        ];

        interaction.reply({ embeds: [embed], components: finalComponents, fetchReply: true});
    }
}