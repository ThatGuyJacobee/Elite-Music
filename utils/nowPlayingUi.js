const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, escapeMarkdown } = require("discord.js");
const { buildRequestedByFooter, buildTrackLinkText, translate } = require("./botText");

// Now Playing UI Constants
const NP_PLAYER_START_TITLE_KEY = "np.titleStarting";
const NP_SLASH_TITLE_KEY = "np.titleCurrent";
const UNKNOWN_ARTISTS = new Set(["attachment", "n/a", "none", "null", "unknown", "unknown artist"]);

function getDisplayArtist(track) {
    const artist = String(track?.author || "").trim();
    if (!artist) return "";

    const isDirectStream = track?.raw?.eliteDirectStream === true;
    if (isDirectStream && track.raw?.eliteAuthorIsArtist !== true) return "";
    if (UNKNOWN_ARTISTS.has(artist.toLowerCase())) return "";

    const escaped = escapeMarkdown(artist);
    if (escaped.toLowerCase() === String(track?.title || "").toLowerCase()) return "";

    return escaped;
}

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
    const progress = queue.node.createProgressBar() || "";
    const durationMs = Number(currentTrack.durationMS);
    const hasDuration = Number.isFinite(durationMs) && durationMs > 0;
    const unknownLabel = translate(queue, currentTrack.live ? "np.liveIndicator" : "np.unknownDuration");
    const createBar = hasDuration ? progress : progress.replace(/ 0:00$/, unknownLabel);
    const artist = getDisplayArtist(currentTrack);
    const description = [`${currentTrack.title} ${buildTrackLinkText(currentTrack, queue)}`.trim()];
    if (artist) description.push(translate(queue, "np.byArtist", { artist }));
    description.push(createBar);

    const npembed = new EmbedBuilder()
        .setAuthor({ name: bot.user.tag, iconURL: bot.user.displayAvatarURL() })
        .setThumbnail("attachment://coverimage.jpg")
        .setColor(client.config.embedColour)
        .setTitle(translate(queue, title))
        .setDescription(description.filter(Boolean).join("\n"))
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
    getDisplayArtist,
};
