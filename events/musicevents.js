const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { buildImageAttachment } = require("../utils/utilityFunctions");
const { clearNpControlMessages, registerNpControlMessage, startNpAutoRefresh } = require("../utils/npControlMessages");
const {
    buildNpComponents,
    buildPlayerStartNpEmbed,
    buildPlayerStartNpRefreshEditOptions,
} = require("../utils/nowPlayingUi");

const player = useMainPlayer();

player.events.on("error", (queue, error) => {
    console.log(`[${queue.guild.name}] (ID:${queue.metadata.channel}) Error emitted from the queue: ${error.message}`);
});

player.events.on("playerError", (queue, error) => {
    console.log(`[${queue.guild.name}] (ID:${queue.metadata.channel}) Error emitted from the player: ${error.message}`);
    queue.metadata.channel.send({ content: "❌ | Failed to extract the following song... skipping to the next!" });
});

player.events.on("playerStart", async (queue) => {
    await clearNpControlMessages(queue);

    let imageAttachment = await buildImageAttachment(queue.currentTrack.thumbnail, {
        name: "coverimage.jpg",
        description: `Song Cover Image for ${queue.currentTrack.title}`,
    });

    const npembed = buildPlayerStartNpEmbed(queue);
    if (!npembed) return;

    const finalComponents = buildNpComponents();

    if (!queue.guild.members.me.permissionsIn(queue.metadata.channel).has(PermissionFlagsBits.SendMessages)) {
        return console.log(`No Perms! (ID: ${queue.guild.id})`);
    }

    const msg = await queue.metadata.channel.send({
        embeds: [npembed],
        components: finalComponents,
        files: [imageAttachment],
    });

    registerNpControlMessage(queue, msg.id);
    startNpAutoRefresh(queue, msg, (q) => buildPlayerStartNpRefreshEditOptions(q));
});

player.events.on("disconnect", async (queue) => {
    await clearNpControlMessages(queue);

    const disconnectedembed = new EmbedBuilder()
        .setAuthor({ name: player.client.user.tag, iconURL: player.client.user.displayAvatarURL() })
        .setThumbnail(queue.guild.iconURL({ dynamic: true }))
        .setColor(client.config.embedColour)
        .setTitle(`Disconnecting 🛑`)
        .setDescription(`I've been inactive for a period of time!`)
        .setTimestamp();

    if (!queue.guild.members.me.permissionsIn(queue.metadata.channel).has(PermissionFlagsBits.SendMessages)) {
        return console.log(`No Perms! (ID: ${queue.guild.id})`);
    }
    queue.metadata.channel.send({ embeds: [disconnectedembed] });
});

player.events.on("emptyChannel", async (queue) => {
    await clearNpControlMessages(queue);

    const emptyembed = new EmbedBuilder()
        .setAuthor({ name: player.client.user.tag, iconURL: player.client.user.displayAvatarURL() })
        .setThumbnail(queue.guild.iconURL({ dynamic: true }))
        .setColor(client.config.embedColour)
        .setTitle(`Ending playback 🛑`)
        .setDescription(`Nobody is in the voice channel!`)
        .setTimestamp();

    if (!queue.guild.members.me.permissionsIn(queue.metadata.channel).has(PermissionFlagsBits.SendMessages)) {
        return console.log(`No Perms! (ID: ${queue.guild.id})`);
    }
    queue.metadata.channel.send({ embeds: [emptyembed] });
});

player.events.on("emptyQueue", async (queue) => {
    await clearNpControlMessages(queue);

    const endembed = new EmbedBuilder()
        .setAuthor({ name: player.client.user.tag, iconURL: player.client.user.displayAvatarURL() })
        .setThumbnail(queue.guild.iconURL({ dynamic: true }))
        .setColor(client.config.embedColour)
        .setTitle(`Queue Finished 🛑`)
        .setDescription(`The music queue has been finished!`)
        .setTimestamp();

    if (!queue.guild.members.me.permissionsIn(queue.metadata.channel).has(PermissionFlagsBits.SendMessages)) {
        return console.log(`No Perms! (ID: ${queue.guild.id})`);
    }
    queue.metadata.channel.send({ embeds: [endembed] });
});

// Only registers discord-player listeners, skip the Discord.js client event loader.
module.exports = { skipDiscordEventRegistration: true };
