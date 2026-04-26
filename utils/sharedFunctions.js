require("dotenv").config();
const { EmbedBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { buildImageAttachment } = require("../utils/utilityFunctions");
const { clearNpControlMessages } = require("./npControlMessages");

//Core music functions
async function getQueue(interaction) {
    const player = useMainPlayer();
    var checkqueue = player.nodes.get(interaction.guild.id);

    if (!checkqueue) {
        player.nodes.create(interaction.guild.id, {
            leaveOnEmpty: client.config.leaveOnEmpty,
            leaveOnEmptyCooldown: client.config.leaveOnEmptyCooldown,
            leaveOnEnd: client.config.leaveOnEnd,
            leaveOnEndCooldown: client.config.leaveOnEndCooldown,
            leaveOnStop: client.config.leaveOnStop,
            leaveOnStopCooldown: client.config.leaveOnStopCooldown,
            selfDeaf: client.config.selfDeafen,
            skipOnNoStream: true,
            metadata: {
                channel: interaction.channel,
                requestedBy: interaction.user,
                client: interaction.guild.members.me,
            },
        });
    }

    return player.nodes.get(interaction.guild.id);
}

async function addTracks(interaction, nextSong, search, responseType) {
    try {
        let queue = await getQueue(interaction);

        if (nextSong) {
            queue.insertTrack(search.tracks[0]);
        } else {
            queue.addTrack(search.tracks);
        }

        await queuePlay(interaction, responseType, search, nextSong);
    } catch (err) {
        console.log(err);
        return interaction.followUp({
            content: `❌ | Ooops... something went wrong, failed to add the track(s) to the queue.`,
            ephemeral: true,
        });
    }
}

async function queuePlay(interaction, responseType, search, nextSong) {
    var queue = await getQueue(interaction);

    try {
        if (!queue.connection) await queue.connect(interaction.member.voice.channel);
    } catch (err) {
        await clearNpControlMessages(queue);
        queue.delete();
        return interaction.followUp({
            content: `❌ | Ooops... something went wrong, couldn't join your channel.`,
            ephemeral: true,
        });
    }

    // Handle the song/playlist cover image
    let imageAttachment = await buildImageAttachment(search.tracks[0].thumbnail, {
        name: "coverimage.jpg",
        description: search.playlist
            ? `Playlist Cover Image for ${search.tracks[0].playlist.title}`
            : `Song Cover Image for ${search.tracks[0].title}`,
    });

    const embed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail("attachment://coverimage.jpg")
        .setColor(client.config.embedColour)
        .setTimestamp()
        .setFooter({
            text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}`,
        });

    if (!queue.isPlaying()) {
        try {
            await queue.node.play(queue.tracks[0]);
            queue.node.setVolume(client.config.defaultVolume);
        } catch (err) {
            return interaction.followUp({
                content: `❌ | Ooops... something went wrong, there was a playback related error. Please try again.`,
                ephemeral: true,
            });
        }

        if (search.playlist) {
            embed.setDescription(
                `Imported the **${search.tracks[0].playlist.title} ([Link](${search.tracks[0].playlist.url})) playlist** with **${search.tracks.length}** songs and started to play the queue!`,
            );
        } else {
            embed.setDescription(
                `Began playing the song **${search.tracks[0].title}** ${search.tracks[0].queryType != "arbitrary" ? `([Link](${search.tracks[0].url}))` : ""}!`,
            );
        }

        embed.setTitle(`Started playback ▶️`);
    } else {
        if (search.playlist) {
            embed.setDescription(
                `Imported the **${search.tracks[0].playlist.title} ([Link](${search.tracks[0].playlist.url})) playlist** with **${search.tracks.length}** songs!`,
            );
        } else {
            if (nextSong) {
                embed.setDescription(
                    `Added song **${search.tracks[0].title}** ${search.tracks[0].queryType != "arbitrary" ? `([Link](${search.tracks[0].url}))` : ""} to the top of the queue (playing next)!`,
                );
                embed.setTitle(`Added to the top of the queue ⏱️`);
            } else {
                embed.setDescription(
                    `Began playing the song **${search.tracks[0].title}** ${search.tracks[0].queryType != "arbitrary" ? `([Link](${search.tracks[0].url}))` : ""}!`,
                );
                embed.setTitle(`Added to queue ⏱️`);
            }
        }
    }

    if (responseType == "edit") {
        interaction.message.edit({ embeds: [embed], files: [imageAttachment], components: [] });
    } else {
        interaction.followUp({ embeds: [embed], files: [imageAttachment] });
    }
}

module.exports = {
    getQueue,
    addTracks,
    queuePlay,
};
