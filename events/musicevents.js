const { MessageEmbed, MessageActionRow, MessageButton, Permissions } = require("discord.js");
module.exports.registerPlayerEvents = (player) => {

    player.on("error", (queue, error) => {
        console.log(`[${queue.guild.name}] (ID:${queue.metadata.channel}) Error emitted from the queue: ${error.message}`);
    });
    player.on("connectionError", (queue, error) => {
        console.log(`[${queue.guild.name}] (ID:${queue.metadata.channel}) Error emitted from the connection: ${error.message}`);
    });

    player.on("trackStart", (queue, track) => {
        //queue.metadata.channel.send(`🎶 | Started playing: **${track.title}** in **${queue.connection.channel.name}**!`);
        const progress = queue.createProgressBar();
        const percentage = queue.getPlayerTimestamp();
        var create = progress.replace(/ 0:00/g, ' ◉ LIVE');

        const npembed = new MessageEmbed()
        .setAuthor(player.client.user.tag, player.client.user.displayAvatarURL())
        .setThumbnail(queue.current.thumbnail)
        .setColor(0xFF0000)
        .setTitle(`Now playing 🎵`)
        .setDescription(`${queue.current.title} ([Link](${queue.current.url})) (\`${percentage.progress == 'Infinity' ? 'Live' : percentage.progress + '%'}\`)\n${create}`)
        //.addField('\u200b', progress.replace(/ 0:00/g, ' ◉ LIVE'))
        .setTimestamp()
        //.setFooter(`Requested by: ${interaction.user.tag}`)

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

        //Check if bot has message perms
        if (!queue.guild.me.permissionsIn(queue.metadata.channel).has("SEND_MESSAGES")) return console.log(`No Perms! (ID: ${queue.guild.id})`);
        queue.metadata.channel.send({ embeds: [npembed], components })
    });

    //player.on("trackAdd", (queue, track) => {
    //    queue.metadata.channel.send(`🎶 | Track **${track.title}** queued!`);
    //});

    player.on("botDisconnect", (queue) => {
        //queue.metadata.channel.send("❌ | I was manually disconnected from the voice channel, clearing queue!");
        const disconnectedembed = new MessageEmbed()
        .setAuthor(player.client.user.tag, player.client.user.displayAvatarURL())
        //.setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(0xFF0000)
        .setTitle(`Ending playback... 🛑`)
        .setDescription(`I've been manually disconnected from the voice channel, clearing queue...!`)
        .setTimestamp()
        //.setFooter(`Requested by: ${interaction.user.tag}`)

        //Check if bot has message perms
        if (!queue.guild.me.permissionsIn(queue.metadata.channel).has("SEND_MESSAGES")) return console.log(`No Perms! (ID: ${queue.guild.id})`);
        queue.metadata.channel.send({ embeds: [disconnectedembed] })
    });

    player.on("channelEmpty", (queue) => {
        //queue.metadata.channel.send("❌ | Nobody is in the voice channel, leaving...");
        const emptyembed = new MessageEmbed()
        .setAuthor(player.client.user.tag, player.client.user.displayAvatarURL())
        //.setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(0xFF0000)
        .setTitle(`Ending playback... 🛑`)
        .setDescription(`Nobody is in the voice channel, disconnecting...!`)
        .setTimestamp()
        //.setFooter(`Requested by: ${interaction.user.tag}`)

        //Check if bot has message perms
        if (!queue.guild.me.permissionsIn(queue.metadata.channel).has("SEND_MESSAGES")) return console.log(`No Perms! (ID: ${queue.guild.id})`);
        queue.metadata.channel.send({ embeds: [emptyembed] })
    });

    player.on("queueEnd", (queue) => {
        //queue.metadata.channel.send("✅ | Queue finished!");
        const endembed = new MessageEmbed()
        .setAuthor(player.client.user.tag, player.client.user.displayAvatarURL())
        //.setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(0xFF0000)
        .setTitle(`Queue has ended... 🛑`)
        .setDescription(`The music queue has been finished, disconnecting...!`)
        .setTimestamp()
        //.setFooter(`Requested by: ${interaction.user.tag}`)

        //Check if bot has message perms
        if (!queue.guild.me.permissionsIn(queue.metadata.channel).has("SEND_MESSAGES")) return console.log(`No Perms! (ID: ${queue.guild.id})`);
        queue.metadata.channel.send({ embeds: [endembed] })
    });
};