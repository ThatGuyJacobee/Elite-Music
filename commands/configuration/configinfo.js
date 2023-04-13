const { SlashCommandBuilder, inlineCode } = require("@discordjs/builders");
const { MessageEmbed, Message, Permissions } = require("discord.js");
const ebmusic = require("../../models/ebmusic.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("configinfo")
        .setDescription("Check your guild's configurations for various Elite Bot features here!")
        .setDefaultMemberPermissions(Permissions.FLAGS.ADMINISTRATOR)
        .addSubcommand((subcommand) => subcommand
            .setName("djfeature")
            .setDescription("Check the current configuration for the DJ Music Feature.")
        ),
    async execute(interaction) {
        if (interaction.options.getSubcommand() === "djfeature") {
            const guildid = interaction.guild.id;
            const search = await ebmusic.findOne({
                where: {
                    GuildID: guildid
                }
            });

            const configembed = new MessageEmbed()
            .setAuthor(interaction.client.user.tag + " - Bot Info", interaction.client.user.displayAvatarURL())
            .setThumbnail(interaction.client.user.displayAvatarURL({dynamic: true}))
            .setColor(0xFF0000)
            .setTitle("Elite Bot Guild Configruation")
            .setFooter("/configinfo | Elite Bot#6645")
            .setTimestamp();

            if (search) {
                configembed.setDescription(`
                **__General Information__**
                **Guild ID:** ${guildid}

                **__Music DJ Config:__**
                **DJ Toggle:** ${search.DJToggle}
                **DJ Role:** <@${search.DJRole}>
                **Support ID:** ${search.EntryID}
                `)
            }

            else {
                configembed.setDescription(`
                **__General Information__**
                **Guild ID:** ${guildid}

                **__Music DJ Config:__**
                **DJ Toggle:** false
                `)
            }

            interaction.reply({ embeds: [configembed] });
        }
    }
}