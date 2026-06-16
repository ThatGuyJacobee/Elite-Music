const { EmbedBuilder, ButtonBuilder, ActionRowBuilder } = require("discord.js");
const { buildRequestedByFooter, buildTrackLinkText, translate } = require("./botText");

// Now Playing UI Constants
const NP_PLAYER_START_TITLE_KEY = "np.titleStarting";
const NP_SLASH_TITLE_KEY = "np.titleCurrent";

function buildNpComponents(source = null) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("np-delete").setStyle(4).setLabel("🗑️"),
            new ButtonBuilder().setCustomId("np-back").setStyle(1).setLabel(translate(source, "np.buttons.previous")),
            new ButtonBuilder()
                .setCustomId("np-pauseresume")
                .setStyle(1)
                .setLabel(translate(source, "np.buttons.pauseResume")),
            new ButtonBuilder().setCustomId("np-skip").setStyle(1).setLabel(translate(source, "np.buttons.skip")),
            new ButtonBuilder().setCustomId("np-clear").setStyle(1).setLabel(translate(source, "np.buttons.clear")),
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("np-volumeadjust")
                .setStyle(1)
                .setLabel(translate(source, "np.buttons.volume")),
            new ButtonBuilder().setCustomId("np-loop").setStyle(1).setLabel(translate(source, "np.buttons.loop")),
            new ButtonBuilder().setCustomId("np-shuffle").setStyle(1).setLabel(translate(source, "np.buttons.shuffle")),
            new ButtonBuilder().setCustomId("np-stop").setStyle(1).setLabel(translate(source, "np.buttons.stop")),
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
        .setTitle(translate(queue, title))
        .setDescription(`${currentTrack.title} ${buildTrackLinkText(currentTrack)}\n${createBar}`)
        .setTimestamp();

    if (footerMember != null) {
        npembed.setFooter(buildRequestedByFooter(queue, footerMember.user ?? footerMember));
    }

    return npembed;
}

function buildPlayerStartNpEmbed(queue) {
    const currentTrack = queue.currentTrack;
    if (!currentTrack) return null;

    return buildNpEmbed(queue, {
        title: NP_PLAYER_START_TITLE_KEY,
        footerMember: currentTrack.requestedBy != null ? currentTrack.requestedBy : null,
    });
}

function buildPlayerStartNpRefreshEditOptions(queue) {
    const currentTrack = queue.currentTrack;

    return {
        embeds: [
            buildNpEmbed(queue, {
                title: NP_PLAYER_START_TITLE_KEY,
                footerMember: currentTrack?.requestedBy != null ? currentTrack.requestedBy : null,
            }),
        ],
        components: buildNpComponents(queue),
    };
}

module.exports = {
    NP_PLAYER_START_TITLE_KEY,
    NP_SLASH_TITLE_KEY,
    buildNpComponents,
    buildNpEmbed,
    buildPlayerStartNpEmbed,
    buildPlayerStartNpRefreshEditOptions,
};
