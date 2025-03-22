const { EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ActionRowBuilder } = require("discord.js");
const { useMainPlayer } = require('discord-player');
const { buildImageAttachment } = require("../utils/utilityFunctions");
const player = useMainPlayer();

player.events.on("error", (queue, error) => {
    console.log(`[${queue.guild.name}] (ID:${queue.metadata.channel}) Error emitted from the queue: ${error.message}`);
})

player.events.on("playerError", (queue, error) => {
    console.log(`[${queue.guild.name}] (ID:${queue.metadata.channel}) Error emitted from the player: ${error.message}`);
    queue.metadata.channel.send({ content: '❌ | Failed to extract the following song... skipping to the next!' })
})

player.events.on("playerStart", async (queue, track) => {
    const progress = queue.node.createProgressBar();
    var createBar = progress.replace(/ 0:00/g, ' ◉ LIVE');

    // Handle the song/playlist cover image
    let imageAttachment = await buildImageAttachment(queue.currentTrack.thumbnail, { name: 'coverimage.jpg', description: `Song Cover Image for ${queue.currentTrack.title}` });
    
    const npembed = new EmbedBuilder()
    .setAuthor({ name: player.client.user.tag, iconURL: player.client.user.displayAvatarURL() })
    .setThumbnail('attachment://coverimage.jpg')
    .setColor(client.config.embedColour)
    .setTitle(`Starting next song... Now Playing 🎵`)
    .setDescription(`${queue.currentTrack.title} ${track.queryType != 'arbitrary' ? `([Link](${queue.currentTrack.url}))` : ''}\n${createBar}`)
    .setTimestamp()

    if (queue.currentTrack.requestedBy != null) {
        npembed.setFooter({ text: `Requested by: ${queue.currentTrack.requestedBy.discriminator != 0 ? queue.currentTrack.requestedBy.tag : queue.currentTrack.requestedBy.username}` })
    }

    var finalComponents = [
        actionbutton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("np-delete")
                .setStyle(4)
                .setLabel("🗑️"),
                //.addOptions(options)
            new ButtonBuilder()
                .setCustomId("np-back")
                .setStyle(1)
                .setLabel("⏮️ Previous"),
            new ButtonBuilder()
                .setCustomId("np-pauseresume")
                .setStyle(1)
                .setLabel("⏯️ Play/Pause"),
            new ButtonBuilder()
                .setCustomId("np-skip")
                .setStyle(1)
                .setLabel("⏭️ Skip"),
            new ButtonBuilder()
                .setCustomId("np-clear")
                .setStyle(1)
                .setLabel("🧹 Clear Queue")
        ),
        actionbutton2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("np-volumeadjust")
                .setStyle(1)
                .setLabel("🔊 Adjust Volume"),
            new ButtonBuilder()
                .setCustomId("np-loop")
                .setStyle(1)
                .setLabel("🔂 Loop Once"),
            new ButtonBuilder()
                .setCustomId("np-shuffle")
                .setStyle(1)
                .setLabel("🔀 Shuffle Queue"),
            new ButtonBuilder()
                .setCustomId("np-stop")
                .setStyle(1)
                .setLabel("🛑 Stop Queue")
        )
    ];

    //Check if bot has message perms
    if (!queue.guild.members.me.permissionsIn(queue.metadata.channel).has(PermissionFlagsBits.SendMessages)) return console.log(`No Perms! (ID: ${queue.guild.id})`);
    var msg = await queue.metadata.channel.send({ embeds: [npembed], components: finalComponents, files: [imageAttachment] })
    
    // Dyanmically remove components, using collector to get upcoming messages and check if they are a queue-related event.
    const filter = (collectorMsg) => {
        // If the message is an embed, check if it's a queue-related event and if so return true
        if (collectorMsg.embeds[0]) {
            if (collectorMsg.embeds[0].title == "Starting next song... Now Playing 🎵" || collectorMsg.embeds[0].title == "Stopped music 🛑" || collectorMsg.embeds[0].title == "Disconnecting 🛑" || collectorMsg.embeds[0].title == "Ending playback 🛑" || collectorMsg.embeds[0].title == "Queue Finished 🛑") {
                return true;
            }
        }

        // Otherwise return false
        return false;
    }
    const collector = queue.metadata.channel.createMessageCollector({ filter, limit: 1, time: queue.currentTrack.durationMS * 3 })

    //Remove the buttons if the next song event runs (due to song skip... etc)
    collector.on('collect', async () => {
        try {
            msg.edit({ components: [] })
        }

        catch (err) {
            console.log(`Now playing msg no longer exists! (ID: ${queue.guild.id})`);
        }
    })

    //Remove the buttons once it expires
    collector.on('end', async () => {
        try {
            msg.edit({ components: [] })
        }

        catch (err) {
            console.log(`Now playing msg no longer exists! (ID: ${queue.guild.id})`);
        }
    })
})

player.events.on("disconnect", (queue) => {
    const disconnectedembed = new EmbedBuilder()
    .setAuthor({ name: player.client.user.tag, iconURL: player.client.user.displayAvatarURL() })
    .setThumbnail(queue.guild.iconURL({dynamic: true}))
    .setColor(client.config.embedColour)
    .setTitle(`Disconnecting 🛑`)
    .setDescription(`I've been inactive for a period of time!`)
    .setTimestamp()

    //Check if bot has message perms
    if (!queue.guild.members.me.permissionsIn(queue.metadata.channel).has(PermissionFlagsBits.SendMessages)) return console.log(`No Perms! (ID: ${queue.guild.id})`);
    queue.metadata.channel.send({ embeds: [disconnectedembed] })
})

player.events.on("emptyChannel", (queue) => {
    const emptyembed = new EmbedBuilder()
    .setAuthor({ name: player.client.user.tag, iconURL: player.client.user.displayAvatarURL() })
    .setThumbnail(queue.guild.iconURL({dynamic: true}))
    .setColor(client.config.embedColour)
    .setTitle(`Ending playback 🛑`)
    .setDescription(`Nobody is in the voice channel!`)
    .setTimestamp()

    //Check if bot has message perms
    if (!queue.guild.members.me.permissionsIn(queue.metadata.channel).has(PermissionFlagsBits.SendMessages)) return console.log(`No Perms! (ID: ${queue.guild.id})`);
    queue.metadata.channel.send({ embeds: [emptyembed] })
})

player.events.on("emptyQueue", (queue) => {
    const endembed = new EmbedBuilder()
    .setAuthor({ name: player.client.user.tag, iconURL: player.client.user.displayAvatarURL() })
    .setThumbnail(queue.guild.iconURL({dynamic: true}))
    .setColor(client.config.embedColour)
    .setTitle(`Queue Finished 🛑`)
    .setDescription(`The music queue has been finished!`)
    .setTimestamp()

    //Check if bot has message perms
    if (!queue.guild.members.me.permissionsIn(queue.metadata.channel).has(PermissionFlagsBits.SendMessages)) return console.log(`No Perms! (ID: ${queue.guild.id})`);
    queue.metadata.channel.send({ embeds: [endembed] })
})