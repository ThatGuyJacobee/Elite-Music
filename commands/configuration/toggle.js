const { SlashCommandBuilder, inlineCode } = require("@discordjs/builders");
const { MessageEmbed, Permissions } = require("discord.js");
const { config } = require("dotenv");
const ebmusic = require("../../models/ebmusic.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("toggle")
        .setDescription("Toggle any Elite Bot feature using this command!")
        .setDefaultMemberPermissions(Permissions.FLAGS.ADMINISTRATOR)
        .addSubcommand((subcommand) => subcommand
            .setName("djonly")
            .setDescription("Toggle DJ only for the music feature!")
            .addBooleanOption((option) => option
                .setName("choice")
                .setDescription("True or false?")
                .setRequired(true)
            )
        ),
    async execute(interaction) {
        if (interaction.options.getSubcommand() === "djonly") {
            const returnedbool = interaction.options.getBoolean("choice");
            const guildid = interaction.guild.id;
            const search = await ebmusic.findOne({
                where: {
                    GuildID: guildid
                }
            });

            if (search) {
                if (search.DJToggle == false && returnedbool == true) {
                    let updateValues = { DJToggle: returnedbool }
                    ebmusic.update(updateValues, { where: { GuildID: guildid }});
                    interaction.reply({ content: "The DJ music feature has been **enabled** for this guild!", ephemeral: true });
                }

                else if (search.DJToggle == true && returnedbool == false) {
                    let updateValues = { DJToggle: returnedbool }
                    ebmusic.update(updateValues, { where: { GuildID: guildid }});
                    interaction.reply({ content: "The DJ music feature has been **disabled** for this guild!", ephemeral: true });
                }

                else if (search.DJToggle == true && returnedbool == true) {
                    interaction.reply({ content: "The DJ music feature is already enabled for this guild.", ephemeral: true });
                }

                else if (search.DJToggle == false && returnedbool == false) {
                    interaction.reply({ content: "The DJ music feature is already disabled for this guild.", ephemeral: true });
                }
            }

            else {
                console.log("GuildID doesn't exist yet, creating new record.");
                ebmusic.create({
                    GuildID: guildid,
                    DJToggle: returnedbool,
                })
                interaction.reply({ content: "Your DJ music feature has been toggled.", ephemeral: true });
            }
        }
    }
}