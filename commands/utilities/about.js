const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed, Permissions } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("about")
        .setDescription("Information about Elite Bot!"),
    cooldown: 10,
    async execute(interaction) {
        console.log(interaction.client.guilds.cache)

        var totalcount = ""

        await interaction.client.guilds.cache.forEach(guild => {
            var count = guild.members.cache.size
            totalcount = +totalcount + +count
        })

        console.log(totalcount)

        const originalembed = new MessageEmbed()
        .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
        .setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(0xFF0000)
        .setTitle("About Elite Bot")
        .setDescription(`Elite Bot is a powerful /slash command bot running on discord.js with a range of essential and unique features such as Five M Server Status. Customisability and ease of use are also highly considered, making Elite Bot a very useful and essential multi-puprose Discord Bot!`)
        .addField(`Documentation`, `https://elite-bot.com`)
        .addField(`Support Server`, `[Discord Support](https://discord.eguk.me)`)
        .addField(`Server Count`, `${interaction.client.guilds.cache.size}`)
        .addField(`Total Member Count`, `${totalcount}`)
        .addField("Developer", `ThatGuyJacobee#9909`)
        .setTimestamp()
        .setFooter(`Requested by: ${interaction.user.tag}`, interaction.user.displayAvatarURL())

        interaction.reply({ embeds: [originalembed] })
    }
}