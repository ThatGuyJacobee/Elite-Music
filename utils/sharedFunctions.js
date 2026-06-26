require("dotenv").config();
const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { buildImageAttachment } = require("../utils/utilityFunctions");
const { clearNpControlMessages } = require("./npControlMessages");
const { getQueueEmptyResponse, ephemeralReply } = require("./interactionGuards");
const {
    buildRequestedByFooter,
    buildCoverImageDescription,
    buildTrackLinkText,
    buildUrlLinkText,
    translate,
    translateGenericAction,
} = require("./botText");

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
                locale: interaction.locale,
            },
        });
    }

    const queue = player.nodes.get(interaction.guild.id);
    if (queue?.metadata) {
        queue.metadata.channel = interaction.channel;
        queue.metadata.requestedBy = interaction.user;
        queue.metadata.client = interaction.guild.members.me;
        queue.metadata.locale = interaction.locale;
    }

    return queue;
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
        return interaction.followUp(
            ephemeralReply({
                content: translate(interaction, "errors.addTracks"),
            }),
        );
    }
}

async function queuePlay(interaction, responseType, search, nextSong) {
    var queue = await getQueue(interaction);

    try {
        if (!queue.connection) await queue.connect(interaction.member.voice.channel);
    } catch (err) {
        await clearNpControlMessages(queue);
        queue.delete();
        return interaction.followUp(
            ephemeralReply({
                content: translate(interaction, "errors.joinVoice"),
            }),
        );
    }

    // Handle the song/playlist cover image
    let imageAttachment = await buildImageAttachment(search.tracks[0].thumbnail, {
        name: "coverimage.jpg",
        description: buildCoverImageDescription(
            interaction,
            search.playlist ? "playlist" : "song",
            search.playlist ? search.tracks[0].playlist.title : search.tracks[0].title,
        ),
        source: interaction,
    });

    const embed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail("attachment://coverimage.jpg")
        .setColor(client.config.embedColour)
        .setTimestamp()
        .setFooter(buildRequestedByFooter(interaction, interaction.user));

    if (!queue.isPlaying()) {
        try {
            await queue.node.play(queue.tracks[0]);
            queue.node.setVolume(client.config.defaultVolume);
        } catch (err) {
            return interaction.followUp(
                ephemeralReply({
                    content: translate(interaction, "errors.playback"),
                }),
            );
        }

        if (search.playlist) {
            embed.setDescription(
                translate(interaction, "playback.importedPlaylistStart", {
                    title: search.tracks[0].playlist.title,
                    link: buildUrlLinkText(interaction, search.tracks[0].playlist.url),
                    count: search.tracks.length,
                }),
            );
        } else {
            embed.setDescription(
                translate(interaction, "playback.startedSong", {
                    title: search.tracks[0].title,
                    link: buildTrackLinkText(search.tracks[0], interaction),
                }),
            );
        }

        embed.setTitle(translate(interaction, "playback.startedTitle"));
    } else {
        if (search.playlist) {
            embed.setDescription(
                translate(interaction, "playback.importedPlaylistQueued", {
                    title: search.tracks[0].playlist.title,
                    link: buildUrlLinkText(interaction, search.tracks[0].playlist.url),
                    count: search.tracks.length,
                }),
            );
        } else {
            if (nextSong) {
                embed.setDescription(
                    translate(interaction, "playback.queuedSongTop", {
                        title: search.tracks[0].title,
                        link: buildTrackLinkText(search.tracks[0], interaction),
                    }),
                );
                embed.setTitle(translate(interaction, "playback.addedTopTitle"));
            } else {
                embed.setDescription(
                    translate(interaction, "playback.queuedSong", {
                        title: search.tracks[0].title,
                        link: buildTrackLinkText(search.tracks[0], interaction),
                    }),
                );
                embed.setTitle(translate(interaction, "playback.addedTitle"));
            }
        }
    }

    if (responseType == "edit") {
        interaction.message.edit({ embeds: [embed], files: [imageAttachment], components: [] });
    } else {
        interaction.followUp({ embeds: [embed], files: [imageAttachment] });
    }
}

function skipCurrentTrack(interaction, queue, user) {
    const nextTrack = queue.tracks.toArray()[0];
    if (!nextTrack) return getQueueEmptyResponse(interaction);

    const coverImage = new AttachmentBuilder(nextTrack.thumbnail, {
        name: "coverimage.jpg",
        description: buildCoverImageDescription(interaction, "song", nextTrack.title),
    });

    const skipembed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail("attachment://coverimage.jpg")
        .setColor(client.config.embedColour)
        .setTitle(translate(interaction, "np.skipTitle"))
        .setDescription(
            translate(interaction, "np.skipDescription", {
                title: nextTrack.title,
                link: buildTrackLinkText(nextTrack, interaction),
            }),
        )
        .setTimestamp()
        .setFooter(buildRequestedByFooter(interaction, user));

    try {
        queue.node.skip();
        return { embeds: [skipembed], files: [coverImage] };
    } catch (err) {
        return ephemeralReply({
            content: translateGenericAction(interaction, "skippingSong"),
        });
    }
}

module.exports = {
    getQueue,
    addTracks,
    queuePlay,
    skipCurrentTrack,
};
