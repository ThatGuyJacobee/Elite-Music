const { SlashCommandBuilder, inlineCode } = require("@discordjs/builders");
const { MessageEmbed, Permissions } = require("discord.js");
const { config } = require("dotenv");
const ebmusic = require("../../models/ebmusic.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("dj")
        .setDescription("Change multiple configuration settings for the DJ Music feature using this command!")
        .setDefaultMemberPermissions(Permissions.FLAGS.MANAGE_ROLES)
        .addSubcommand((subcommand) => subcommand
            .setName("role")
            .setDescription("Set your DJ role for the music feature!")
            .addRoleOption((option) => option
                .setName("role")
                .setDescription("Set the role to be used for the DJ music feature.")
                .setRequired(true)
            )
        ),
    async execute(interaction) {
        if (interaction.options.getSubcommand() === "role") {
            const returnedrole = interaction.options.getRole("role");
            const guildid = interaction.guild.id;
            const search = await ebmusic.findOne({
                where: {
                    GuildID: guildid
                }
            });
    
            if (!returnedrole.editable) {
                interaction.reply({ content: "Error: Cannot assign a role that is higher or equal to Elite Bot's role.", ephemeral: true });
            }
    
            if (search) {
                if (search.GuildID == returnedrole) {
                    interaction.reply({ content: "Error: This role is already set as the DJ role.", ephemeral: true });
                    return
                }
                
                else {
                    let updateValues = { DJRole: returnedrole.id }
                    ebmusic.update(updateValues, { where: { GuildID: guildid }});
                    interaction.reply({ content: `The DJ role has been updated to: <@&${returnedrole.id}>`, ephemeral: true });
                    return
                }
            }
    
            else {
                interaction.reply({ content: "Since this is a new guild for Elite Bot, toggle the feature on first. Please enable it with **/toggle createvc** before setting this up.", ephemeral: true });
            }
        }
    }
}