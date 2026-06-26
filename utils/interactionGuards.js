const { MessageFlags } = require("discord.js");
const { translate } = require("./botText");

function ephemeralReply(options) {
    if (typeof options === "string") {
        return { content: options, flags: MessageFlags.Ephemeral };
    }

    return { ...options, flags: MessageFlags.Ephemeral };
}

async function ensureDjAccess(interaction) {
    if (!client.config.enableDjMode) return true;
    if (interaction.member.roles.cache.has(client.config.djRole)) return true;

    await interaction.reply(
        ephemeralReply({
            content: translate(interaction, "guards.djMode", { role: `<@&${client.config.djRole}>` }),
        }),
    );
    return false;
}

async function ensureInVoiceChannel(interaction) {
    if (interaction.member.voice.channelId) return true;

    await interaction.reply(
        ephemeralReply({
            content: translate(interaction, "guards.notInVoice"),
        }),
    );
    return false;
}

async function ensureSameVoiceChannel(interaction) {
    if (
        !interaction.guild.members.me.voice.channelId ||
        interaction.member.voice.channelId === interaction.guild.members.me.voice.channelId
    ) {
        return true;
    }

    await interaction.reply(
        ephemeralReply({
            content: translate(interaction, "guards.notInBotVoice"),
        }),
    );
    return false;
}

function getQueueNotPlayingResponse(interaction) {
    return ephemeralReply({
        content: translate(interaction, "queue.nothingPlaying"),
    });
}

function getQueueEmptyResponse(interaction) {
    return ephemeralReply({
        content: translate(interaction, "queue.empty"),
    });
}

async function ensurePlexEnabled(interaction) {
    if (client.config.enablePlex) return true;

    await interaction.reply(
        ephemeralReply({
            content: translate(interaction, "feature.plexDisabled"),
        }),
    );
    return false;
}

async function ensureSubsonicEnabled(interaction) {
    if (client.config.enableSubsonic) return true;

    await interaction.reply(
        ephemeralReply({
            content: translate(interaction, "feature.subsonicDisabled"),
        }),
    );
    return false;
}

module.exports = {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    ensurePlexEnabled,
    ensureSubsonicEnabled,
    ephemeralReply,
    getQueueEmptyResponse,
    getQueueNotPlayingResponse,
};
