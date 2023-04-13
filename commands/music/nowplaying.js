const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed, MessageActionRow, MessageButton, Permissions } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("nowplaying")
        .setDescription("Check the currently playing song!"),
    async execute(interaction) {
        const queue = player.getQueue(interaction.guild);
        if (!queue || !queue.playing) return interaction.reply({ content: `❌ | No music is currently being played!` });
        if (!interaction.member.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        const query = interaction.options.getString("song");
        const progress = queue.createProgressBar();
        const percentage = queue.getPlayerTimestamp();
        var create = progress.replace(/ 0:00/g, ' ◉ LIVE');

        const npembed = new MessageEmbed()
        .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
        .setThumbnail(queue.current.thumbnail)
        .setColor(0xFF0000)
        .setTitle(`Now playing 🎵`)
        .setDescription(`${queue.current.title} ([Link](${queue.current.url})) (\`${percentage.progress == 'Infinity' ? 'Live' : percentage.progress + '%'}\`)\n${create}`)
        //.addField('\u200b', progress.replace(/ 0:00/g, ' ◉ LIVE'))
        .setTimestamp()
        .setFooter(`Requested by: ${interaction.user.tag}`)

        const components = [
            actionbutton = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId("np-delete")
                    .setStyle("DANGER")
                    .setLabel("🗑️"),
                    //.addOptions(options)
                new MessageButton()
                    .setCustomId("np-back")
                    .setStyle("PRIMARY")
                    .setLabel("⏮️ Previous"),
                new MessageButton()
                    .setCustomId("np-pauseresume")
                    .setStyle("PRIMARY")
                    .setLabel("⏯️ Play/Pause"),
                new MessageButton()
                    .setCustomId("np-skip")
                    .setStyle("PRIMARY")
                    .setLabel("⏭️ Skip"),
                new MessageButton()
                    .setCustomId("np-clear")
                    .setStyle("PRIMARY")
                    .setLabel("🧹 Clear Queue")
            ),
            actionbutton2 = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId("np-volumedown")
                    .setStyle("PRIMARY")
                    .setLabel("🔈 Volume Down"),
                new MessageButton()
                    .setCustomId("np-volumeup")
                    .setStyle("PRIMARY")
                    .setLabel("🔊 Volume Up"),
                new MessageButton()
                    .setCustomId("np-loop")
                    .setStyle("PRIMARY")
                    .setLabel("🔂 Loop Once"),
                new MessageButton()
                    .setCustomId("np-shuffle")
                    .setStyle("PRIMARY")
                    .setLabel("🔀 Shuffle Queue"),
                new MessageButton()
                    .setCustomId("np-stop")
                    .setStyle("PRIMARY")
                    .setLabel("🛑 Stop Queue")
            )
        ];

        interaction.reply({ embeds: [npembed], components })
    }
}