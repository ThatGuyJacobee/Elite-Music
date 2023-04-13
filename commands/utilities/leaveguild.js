const { SlashCommandBuilder, inlineCode } = require("@discordjs/builders");
const { MessageEmbed, Message, Permissions } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("leaveguild")
        .setDescription("Leave a guild.")
        .setDefaultMemberPermissions(Permissions.FLAGS.ADMINISTRATOR)
        .addStringOption((option) => option
            .setName("guildid")
            .setDescription("What guildid should I leave?")
            .setRequired(true)
        ),
    async execute(interaction) {
        const retrunedguildid = interaction.options.getString("guildid");
        if (interaction.user.id != 360815761662541824) return interaction.reply("You aren't authorized for this!");

        var targetguild = await interaction.client.guilds.cache.get(`${retrunedguildid}`);
        //console.log(targetguild)

        if (targetguild) {
            try {
                var count = targetguild.members.cache.size
                var memcount = targetguild.members.cache.filter(member => !member.user.bot).size;
                var botcount = targetguild.members.cache.filter(member => member.user.bot).size;

                //targetguild.delete() to leave bot-made server
                targetguild.leave()
                console.log(`Successfully left the guild: ${retrunedguildid}`)
                interaction.reply({ content: `Successfully left the guild!\nServer ID: ${targetguild.id}\nServer name: ${targetguild.name}\nHuman Count: ${memcount}/${count}\nBot count: ${botcount}/${count}` })
            }

            catch (err) {
                console.log(err)
                console.log(`Unsuccessfully attempt to leave the guild: ${retrunedguildid}`)
                interaction.reply({ content: `Unsuccessfully attempt to leave the guild: ${retrunedguildid}`, ephemeral: true })
            }
        }

        else {
            interaction.reply({ content: `The provided Guild ID (${retrunedguildid}) doesn't have Elite Bot yet!`, ephemeral: true })
        }
    }
}