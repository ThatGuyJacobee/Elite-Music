const { translate } = require("./botText");
const { ephemeralReply } = require("./interactionGuards");
const { getPlaybackSourceAvailability } = require("./playbackResolver");

const PLAYBACK_CHOICES = [
    { name: "Auto (server order)", value: "auto" },
    { name: "YouTube", value: "youtube" },
    { name: "Plex", value: "plex" },
    { name: "Subsonic", value: "subsonic" },
    { name: "Jellyfin", value: "jellyfin" },
];

function playbackSlashOption(option) {
    return option
        .setName("playback")
        .setDescription("Which audio source to use for this request. Ignored for playlists and direct links.")
        .setRequired(false)
        .addChoices(...PLAYBACK_CHOICES);
}

async function ensurePlaybackSourceAvailable(interaction, source) {
    if (!source || source === "auto") return true;

    const availability = getPlaybackSourceAvailability(interaction.client.config, source);
    if (availability === "available") return true;

    if (availability === "disabled") {
        console.log(`[ELITE_PLAYBACK] ${interaction.commandName} playback:${source} rejected: source is disabled.`);
        await interaction.reply(
            ephemeralReply({
                content: translate(interaction, `feature.${source}Disabled`),
            }),
        );
        return false;
    }

    console.log(
        `[ELITE_PLAYBACK] ${interaction.commandName} playback:${source} rejected: source is not in PLAYBACK_SOURCE_ORDER.`,
    );
    await interaction.reply(
        ephemeralReply({
            content: translate(interaction, "errors.playbackSourceNotInOrder", {
                source: translate(interaction, `playback.sources.${source}`),
            }),
        }),
    );
    return false;
}

module.exports = {
    ensurePlaybackSourceAvailable,
    playbackSlashOption,
};
