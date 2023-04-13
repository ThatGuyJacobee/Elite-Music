const { SlashCommandBuilder, inlineCode } = require("@discordjs/builders");
const { MessageEmbed, Message, Permissions } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("alertowner")
        .setDescription("Alert the Guild Owners to invite Elite Bot.")
        .setDefaultMemberPermissions(Permissions.FLAGS.ADMINISTRATOR),
    async execute(interaction) {
        if (interaction.user.id != 360815761662541824) return interaction.reply("You aren't authorized for this!");
        
        const elitebotmove = new MessageEmbed()
        .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
        //.setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(0xFF0000)
        .setTitle("Re-invite the Elite Bot!")
        .setDescription(`Hi there fellow server owners 👋\n\nThe current Elite Bot has moved to a different application (due to verification issues), which means you must invite Elite Bot again! All of your configurations (apart from a few such as member count which you will simply have to do /toggle again!) will be saved so don't worry! \n\nI apologise for this move, but the main reason is due to verification issues with the current application, meaning I must switch to another Discord Developer application in order to enable verification again. This doesn't change anything about Elite Bot\n\nHowever, due to requirements Elite Bot Music (which is what current application has been rebranded to) is now the sole music bot. There will no longer be a music feature within the MAIN Elite Bot due to future bot verification issues, hence if you wish for music, keep Elite Bot Music in your server!`)
        .addField(`Re-invite Elite Bot:`, `[Via Discord Link](https://discord.com/oauth2/authorize?client_id=723275350922100840&permissions=1239533562928&scope=bot%20applications.commands) OR [Via Top.gg](https://top.gg/bot/528660579208921098)`)
        .addField(`Support Server`, `[Discord Support](https://discord.eguk.me)`)
        .setImage(`https://elite-gaming.co.uk/img/home-slider/slide2.png`)
        .setTimestamp()
        .setFooter(`Re-invite the bot!`, interaction.user.displayAvatarURL())

        const guilds = interaction.client.guilds.cache.map(guild => guild);
        guilds.forEach(async guild => {
            const owner = await guild.fetchOwner();
            try {
                await owner.send({embeds: [elitebotmove]})
                console.log("Sent.");
            }
            
            catch (error) {
                console.log(error)
                console.log("Couldn't send.");
            }
        });
    }
}