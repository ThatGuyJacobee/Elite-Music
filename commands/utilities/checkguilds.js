const { SlashCommandBuilder, inlineCode } = require("@discordjs/builders");
const { MessageEmbed, Message, Permissions } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("checkguilds")
        .setDescription("Check the guilds.")
        .setDefaultMemberPermissions(Permissions.FLAGS.ADMINISTRATOR),
    async execute(interaction) {
        if (interaction.user.id != 360815761662541824) return interaction.reply("You aren't authorized for this!");
        var ownerIDs = [];

        const guilds = interaction.client.guilds.cache.map(guild => guild);
        guilds.forEach(async guild => {
            var count = guild.members.cache.size
            var memcount = guild.members.cache.filter(member => !member.user.bot).size;
            var botcount = guild.members.cache.filter(member => member.user.bot).size;

            console.log("")
            var find = ownerIDs.find(element => element == guild.ownerId)
            if (find) {
                console.log("Owner ID: " + guild.ownerId + " has already been found!")
            }

            else {
                console.log("Owner ID: " + guild.ownerId)
                ownerIDs.push(guild.ownerId);
            }
            console.log("Server ID: " + guild.id)
            console.log("Server name: " + guild.name)
            console.log("Human Count: " + memcount + "/" + count)
            console.log("Bot Count: " + botcount + "/" + count)
            console.log("")
        });
    }
}