const { SlashCommandBuilder, inlineCode } = require("@discordjs/builders");
const { MessageEmbed, Message } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("botinfo")
        .setDescription("Return information about Elite Bot!"),
    async execute(interaction) {
            //Store time and date within the botuptime variable
            var uptime = process.uptime();
            var days = Math.floor((uptime % 31536000) / 86400);
            var hours = Math.floor((uptime % 86400) / 3600);
            var minutes = Math.floor((uptime % 3600) / 60);
            var seconds = Math.round(uptime % 60);
            var botuptime = (days > 0 ? days + " days, ":"") + (hours > 0 ? hours + " hours, ":"") + (minutes > 0 ? minutes + " minutes, ":"") + (seconds > 0 ? seconds + " seconds":"");

            //Check Discord.js dependency version
            const packageJSON = require("../../package.json");
            const discordJSVersion = packageJSON.dependencies["discord.js"];

        const botembed = new MessageEmbed()
            .setAuthor(interaction.client.user.tag + " - Bot Info", interaction.client.user.displayAvatarURL())
            .setThumbnail(interaction.client.user.displayAvatarURL({dynamic: true}))
            .setColor(0xFF0000)
            .setTitle("Elite Bot Information")
            .setDescription(`
                **__General Information__**
                **Status:** ${interaction.client.user.presence.status}
                **Playing:** ${interaction.client.user.presence.activities}
                **Uptime:** ${botuptime}
                **Ping:** ${Date.now() - interaction.createdTimestamp}ms
                **API Latency:** ${Math.round(interaction.client.ws.ping)}ms

                **__Technical Information__**
                **OS:** Windows 11
                **Memory:** ${((process.memoryUsage().heapUsed / 1024) / 1024).toFixed(2)} MB/32.00 GB
                **Node.js Version:** ${process.versions.node}
                **Discord.js Version:** ${discordJSVersion.substring(1)}
                `)
            .setFooter("/botinfo | Elite Bot#6645")
            .setTimestamp();

        interaction.reply({ embeds: [botembed] });
    }
}