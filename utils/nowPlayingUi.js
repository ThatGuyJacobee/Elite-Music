const { EmbedBuilder, ButtonBuilder, ActionRowBuilder } = require("discord.js");

// Now Playing UI Constants
const NP_PLAYER_START_TITLE = "Starting next song... Now Playing 🎵";
const NP_SLASH_TITLE = "Now playing 🎵";

function buildNpComponents() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("np-delete").setStyle(4).setLabel("🗑️"),
            new ButtonBuilder().setCustomId("np-back").setStyle(1).setLabel("⏮️ Previous"),
            new ButtonBuilder().setCustomId("np-pauseresume").setStyle(1).setLabel("⏯️ Play/Pause"),
            new ButtonBuilder().setCustomId("np-skip").setStyle(1).setLabel("⏭️ Skip"),
            new ButtonBuilder().setCustomId("np-clear").setStyle(1).setLabel("🧹 Clear Queue"),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("np-volumeadjust").setStyle(1).setLabel("🔊 Adjust Volume"),
            new ButtonBuilder().setCustomId("np-loop").setStyle(1).setLabel("🔂 Loop Once"),
            new ButtonBuilder().setCustomId("np-shuffle").setStyle(1).setLabel("🔀 Shuffle Queue"),
            new ButtonBuilder().setCustomId("np-stop").setStyle(1).setLabel("🛑 Stop Queue"),
        ),
    ];
}

function buildNpEmbed(queue, { title, footerMember = null }) {
    const currentTrack = queue.currentTrack;
    if (!currentTrack) return null;

    const bot = queue.guild.client;
    const progress = queue.node.createProgressBar();
    const createBar = progress.replace(/ 0:00/g, " ◉ LIVE");

    const npembed = new EmbedBuilder()
        .setAuthor({ name: bot.user.tag, iconURL: bot.user.displayAvatarURL() })
        .setThumbnail("attachment://coverimage.jpg")
        .setColor(client.config.embedColour)
        .setTitle(title)
        .setDescription(
            `${currentTrack.title} ${currentTrack.queryType != "arbitrary" ? `([Link](${currentTrack.url}))` : ""}\n${createBar}`,
        )
        .setTimestamp();

    if (footerMember != null) {
        const user = footerMember.user ?? footerMember;
        npembed.setFooter({
            text: `Requested by: ${user.discriminator != 0 ? user.tag : user.username}`,
        });
    }

    return npembed;
}

function buildPlayerStartNpEmbed(queue) {
    const currentTrack = queue.currentTrack;
    if (!currentTrack) return null;

    return buildNpEmbed(queue, {
        title: NP_PLAYER_START_TITLE,
        footerMember: currentTrack.requestedBy != null ? currentTrack.requestedBy : null,
    });
}

function buildPlayerStartNpRefreshEditOptions(queue) {
    const currentTrack = queue.currentTrack;

    return {
        embeds: [
            buildNpEmbed(queue, {
                title: NP_PLAYER_START_TITLE,
                footerMember: currentTrack?.requestedBy != null ? currentTrack.requestedBy : null,
            }),
        ],
        components: buildNpComponents(),
    };
}

module.exports = {
    NP_PLAYER_START_TITLE,
    NP_SLASH_TITLE,
    buildNpComponents,
    buildNpEmbed,
    buildPlayerStartNpEmbed,
    buildPlayerStartNpRefreshEditOptions,
};
