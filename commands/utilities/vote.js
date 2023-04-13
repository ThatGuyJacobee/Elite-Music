const { SlashCommandBuilder, inlineCode } = require("@discordjs/builders");
const { MessageEmbed, Message } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("vote")
        .setDescription("Vote for Elite Bot on top.gg! Thank you for your support :D"),
    async execute(interaction) {
        const voteembed = new MessageEmbed()
            .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
            .setThumbnail(interaction.client.user.displayAvatarURL({dynamic: true}))
            .setColor(0xFF0000)
            .setTitle("Vote for Elite Bot!")
            .setDescription(`Feel free to vote for me on the [Top.gg Website](https://top.gg/bot/528660579208921098) which is free and will support my growth in the long term. It's much appreciated <3`)
            .setTimestamp()
            .setFooter(`Requested by: ${interaction.user.tag}`, interaction.user.displayAvatarURL())

        interaction.reply({ embeds: [voteembed] });
    }
}