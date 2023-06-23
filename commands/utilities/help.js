const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
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
        //.setThumbnail(interaction.client.user.displayAvatarURL({dynamic: true}))
        .setColor(process.env.EMBED_COLOUR)
        .setTitle('Elite Bot - Help Menu')
        .setDescription(`Select a category via the menu below to view the commands available. 📢 \n\nIf you require assistance or are experiencing a persistant bug, please create a bug report using **/elitebot bugreport** or by joining the **[Support Discord Server](https://discord.elitegami.ng)**. 🆘\n\nFor more in-depth guides and help setting things up, please head over to the documentation which is always up-to-date and heavily detailed. 📄\n\n<:Rules:1039597018064093325> Docs & Invite: __**https://elite-bot.com**__\n<:LockedChannel:1039597788931035237> Privacy Policy: __**https://elite-bot.com/docs/privacy-policy**__\n<:HammerAction:1040729990876119050> Terms of Service: __**https://elite-bot.com/docs/terms-of-service/**__`)
        .setTimestamp()
        .setFooter({ text: `/help | Requested by: ${interaction.user.tag}` })
        
        dirs.forEach((dir, index) => {
            embed.addFields({ name: `${emojis[dir] ||''} ${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()}`, value: `${description[dir] ? description[dir] : `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()} Commands`}`},)

            menuoptions.push({
                label: `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()}`,
                description: `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()} commands page`,
                emoji: `${emojis[dir] || ''}`,
                value: `${page++}`
            })
        });

        const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
            .setCustomId('select')
            .setPlaceholder('Click to see all the categories')
            .addOptions(menuoptions)
        )

        interaction.reply({ embeds: [embed], components: [row], fetchReply: true});
    }
}