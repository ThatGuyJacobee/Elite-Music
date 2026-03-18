const { EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ActionRowBuilder } = require("discord.js");
const { useMainPlayer } = require('discord-player');
const { buildImageAttachment } = require("../utils/utilityFunctions");
const player = useMainPlayer();

player.events.on("error", (queue, error) => {
    console.log(`[${queue.guild.name}] (ID:${queue.metadata.channel}) Error emitted from the queue: ${error.message}`);
})

player.events.on("playerError", (queue, error) => {
    console.log(`[${queue.guild.name}] (ID:${queue.metadata.channel}) Error emitted from the player: ${error.message}`);
    
    try {
        if (queue.guild.members.me.permissionsIn(queue.metadata.channel).has(PermissionFlagsBits.SendMessages)) {
            queue.metadata.channel.send({ content: '❌ | Failed to extract the following song... skipping to the next!' });
        }
    } catch (err) {
        console.log(`[MUSIC_EVENTS] Failed to send player error message: ${err.message}`);
    }
})

player.events.on("playerStart", async (queue, track) => {
    async function createNowPlayingEmbed() {
        const progress = queue.node.createProgressBar({
            indicator: '🔘',
            leftChar: '▬',
            rightChar: '▬',
            length: 20
        });
        const createBar = progress.replace(/ 0:00/g, ' ◉ LIVE');

        const queueSize = queue.tracks.size;
        const loopMode = queue.repeatMode === 1 ? 'Track' : queue.repeatMode === 2 ? 'Queue' : 'Normal';
        const pauseStatus = queue.node.isPaused() ? 'Paused' : 'Playing';
        
        let imageAttachment = await buildImageAttachment(queue.currentTrack.thumbnail, { name: 'coverimage.jpg', description: `Song Cover Image for ${queue.currentTrack.title}` });
        
        const npembed = new EmbedBuilder()
            .setAuthor({ name: player.client.user.tag, iconURL: player.client.user.displayAvatarURL() })
            .setThumbnail('attachment://coverimage.jpg')
            .setColor(client.config.embedColour)
            .setTitle(`🎵 Now Playing`)
            .setDescription(`**${queue.currentTrack.title}**${track.queryType != 'arbitrary' ? ` ([Link](${queue.currentTrack.url}))` : ''}`)
            .addFields(
                { name: '🎤 Artist', value: queue.currentTrack.author || 'Unknown', inline: true },
                { name: '⏱️ Duration', value: queue.currentTrack.duration || 'Unknown', inline: true },
                { name: '📊 Status', value: pauseStatus, inline: true },
                { name: '🔊 Volume', value: `${queue.node.volume}%`, inline: true },
                { name: '🔄 Loop Mode', value: loopMode, inline: true },
                { name: '📑 Queue', value: `${queueSize} song${queueSize !== 1 ? 's' : ''}`, inline: true },
                { name: '⏳ Progress', value: createBar, inline: false }
            )
            .setTimestamp();

        if (queue.currentTrack.requestedBy != null) {
            npembed.setFooter({ text: `Requested by: ${queue.currentTrack.requestedBy.discriminator != 0 ? queue.currentTrack.requestedBy.tag : queue.currentTrack.requestedBy.username}` });
        }

        return { embed: npembed, attachment: imageAttachment };
    }

    const finalComponents = [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("np-back")
                .setStyle(2)
                .setEmoji("⏮️"),
            new ButtonBuilder()
                .setCustomId("np-pauseresume")
                .setStyle(2)
                .setEmoji("⏯️"),
            new ButtonBuilder()
                .setCustomId("np-skip")
                .setStyle(2)
                .setEmoji("⏭️"),
            new ButtonBuilder()
                .setCustomId("np-stop")
                .setStyle(2)
                .setEmoji("⏹️")
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("np-volumeadjust")
                .setStyle(1)
                .setEmoji("🔊")
                .setLabel("Volume"),
            new ButtonBuilder()
                .setCustomId("np-loop")
                .setStyle(1)
                .setEmoji("🔄")
                .setLabel("Loop"),
            new ButtonBuilder()
                .setCustomId("np-shuffle")
                .setStyle(1)
                .setEmoji("🔀")
                .setLabel("Shuffle"),
            new ButtonBuilder()
                .setCustomId("np-clear")
                .setStyle(4)
                .setEmoji("🧹")
                .setLabel("Clear")
        )
    ];

    const botPermissions = queue.guild.members.me.permissionsIn(queue.metadata.channel);
    const requiredPerms = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles];
    const missingPerms = requiredPerms.filter(perm => !botPermissions.has(perm));
    
    if (missingPerms.length > 0) {
        console.log(`[MUSIC_EVENTS] Missing permissions in ${queue.metadata.channel.name} (${queue.guild.name}): ${missingPerms.map(p => Object.keys(PermissionFlagsBits).find(k => PermissionFlagsBits[k] === p)).join(', ')}`);
        return;
    }
    
    const initialEmbed = await createNowPlayingEmbed();
    var msg;
    try {
        msg = await queue.metadata.channel.send({ embeds: [initialEmbed.embed], components: finalComponents, files: [initialEmbed.attachment] });
    } catch (err) {
        console.log(`[MUSIC_EVENTS] Failed to send now playing message: ${err.message}`);
        return;
    }

    const UPDATE_INTERVAL_MS = 5000; // 5 seconds - safe and smooth
    
    const updateInterval = setInterval(async () => {
        if (!queue.isPlaying() || !queue.currentTrack || queue.currentTrack.id !== track.id) {
            clearInterval(updateInterval);
            return;
        }

        try {
            const progress = queue.node.createProgressBar({
                indicator: '🔘',
                leftChar: '▬',
                rightChar: '▬',
                length: 20
            });
            const createBar = progress.replace(/ 0:00/g, ' ◉ LIVE');
            const queueSize = queue.tracks.size;
            const loopMode = queue.repeatMode === 1 ? 'Track' : queue.repeatMode === 2 ? 'Queue' : 'Normal';
            const pauseStatus = queue.node.isPaused() ? 'Paused' : 'Playing';

            const updatedEmbed = new EmbedBuilder()
                .setAuthor({ name: player.client.user.tag, iconURL: player.client.user.displayAvatarURL() })
                .setThumbnail('attachment://coverimage.jpg')
                .setColor(client.config.embedColour)
                .setTitle(`🎵 Now Playing`)
                .setDescription(`**${queue.currentTrack.title}**${track.queryType != 'arbitrary' ? ` ([Link](${queue.currentTrack.url}))` : ''}`)
                .addFields(
                    { name: '🎤 Artist', value: queue.currentTrack.author || 'Unknown', inline: true },
                    { name: '⏱️ Duration', value: queue.currentTrack.duration || 'Unknown', inline: true },
                    { name: '📊 Status', value: pauseStatus, inline: true },
                    { name: '🔊 Volume', value: `${queue.node.volume}%`, inline: true },
                    { name: '🔄 Loop Mode', value: loopMode, inline: true },
                    { name: '📑 Queue', value: `${queueSize} song${queueSize !== 1 ? 's' : ''}`, inline: true },
                    { name: '⏳ Progress', value: createBar, inline: false }
                )
                .setTimestamp();

            if (queue.currentTrack.requestedBy != null) {
                updatedEmbed.setFooter({ text: `Requested by: ${queue.currentTrack.requestedBy.discriminator != 0 ? queue.currentTrack.requestedBy.tag : queue.currentTrack.requestedBy.username}` });
            }

            await msg.edit({ embeds: [updatedEmbed], components: finalComponents });
        } catch (err) {
            clearInterval(updateInterval);
        }
    }, UPDATE_INTERVAL_MS);

    const trackDuration = track.durationMS || track.duration || 600000;
    setTimeout(() => {
        clearInterval(updateInterval);
        try {
            msg.edit({ components: [] }).catch(() => {});
        } catch (err) {
            console.log(`[MUSIC_EVENTS] Now playing msg no longer exists! (ID: ${queue.guild.id})`);
        }
    }, trackDuration + 5000); // 5 seconds after song ends
})

player.events.on("disconnect", (queue) => {
    const disconnectedembed = new EmbedBuilder()
    .setAuthor({ name: player.client.user.tag, iconURL: player.client.user.displayAvatarURL() })
    .setThumbnail(queue.guild.iconURL({dynamic: true}))
    .setColor(client.config.embedColour)
    .setTitle(`Disconnecting 🛑`)
    .setDescription(`I've been inactive for a period of time!`)
    .setTimestamp()

    if (!queue.guild.members.me.permissionsIn(queue.metadata.channel).has(PermissionFlagsBits.SendMessages)) return console.log(`No Perms! (ID: ${queue.guild.id})`);
    
    try {
        queue.metadata.channel.send({ embeds: [disconnectedembed] });
    } catch (err) {
        console.log(`[MUSIC_EVENTS] Failed to send disconnect message: ${err.message}`);
    }
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
    
    try {
        queue.metadata.channel.send({ embeds: [emptyembed] });
    } catch (err) {
        console.log(`[MUSIC_EVENTS] Failed to send empty channel message: ${err.message}`);
    }
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
    
    try {
        queue.metadata.channel.send({ embeds: [endembed] });
    } catch (err) {
        console.log(`[MUSIC_EVENTS] Failed to send queue finished message: ${err.message}`);
    }
})