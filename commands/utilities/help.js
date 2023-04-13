const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, Modal, TextInputComponent, MessageEmbed, MessageButton, Message, MessageSelectMenu } = require("discord.js");
const fs = require("fs");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Get information about my commands!"),
    async execute(interaction) {
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
            "configuration": "⚙️",
            "fun": "🎈",
            "moderation": "🛡️",
            "music": "🎵",
            "utilities": "🛄",
        };

        const description = {
            "configuration": "Commands which configure Elite Bot.",
            "fun": "Fun commands.",
            "moderation": "Moderation commands.",
            "music": "Commands used for music things.",
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

        const embed = new MessageEmbed()
        .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
        //.setThumbnail(interaction.client.user.displayAvatarURL({dynamic: true}))
        .setColor(0xFF0000)
        .setTitle('Help Menu')
        .setDescription(`Select a category to view the commands.`)
        .setFooter(`/help | Requested by: ${interaction.user.tag}`)
        .setTimestamp();

        dirs.forEach((dir, index) => {
            embed.addField(
                `${emojis[dir] ||''} ${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()}`,
                `${description[dir] ? description[dir] : `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()} Commands`}`
            )

            menuoptions.push({
                label: `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()}`,
                description: `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()} commands page`,
                emoji: `${emojis[dir] || ''}`,
                value: `${page++}`
            })
        });

        const row = new MessageActionRow().addComponents(
            new MessageSelectMenu()
            .setCustomId('select')
            .setPlaceholder('Click to see all the categories')
            .addOptions(menuoptions)
        )

        var msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true});

        const filter = i => !i.user.bot;
        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            componentType: 'SELECT_MENU'
        })

        collector.on('collect', async (i) => {
            //if(i.user.id !== interaction.author.id) return i.reply({ content: `This help page is not for you!`, ephemeral: true })
            i.deferUpdate();

            const value = i.values[0];

            if(i.customId !== 'select') return;

            if(value && value !== 'home') {
                embed.fields = [];
                embed.setTitle(`Help Menu - ${categories[value][0].name.charAt(0).toUpperCase() + categories[value][0].name.slice(1).toLowerCase()} Category! ${emojis[categories[value][0].name] ? emojis[categories[value][0].name]: ''}`)

                categories[value].forEach(cmd => {
                    embed.addField(
                        `\`/${cmd.commands.name}\``,
                        `${cmd.commands.description || 'No description'}`,
                        true
                    )
                });

                msg = await msg.edit({ embeds: [embed], components: [row], fetchReply: true });
            }

            if(value === 'home') {
                embed.fields = [];
                embed.setTitle('Help Menu')

                dirs.forEach(dir => {
                    embed.addField(
                        `${emojis[dir] || ''} ${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()}`,
                        `${description[dir] ? description[dir] : `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()} Commands`}`
                    )
                });
                
                msg = await msg.edit({ embeds: [embed], components: [row], fetchReply: true });
            }
        });

        collector.on('end', async () => {
            msg = await msg.edit({ embeds: [embed], components: [], fetchReply: true });
        });
    }
}