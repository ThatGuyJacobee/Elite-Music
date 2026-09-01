const { MessageFlags } = require("discord.js");
const { translate } = require("./botText");

function ephemeralReply(options) {
    if (typeof options === "string") {
        return { content: options, flags: MessageFlags.Ephemeral };
    }

    return { ...options, flags: MessageFlags.Ephemeral };
}

async function sendEphemeralError(interaction, options) {
    const payload = ephemeralReply(options);

    if (!interaction.deferred && !interaction.replied) {
        return interaction.reply(payload);
    }

    // Discord locks ephemeral on the first response, so a public defer cannot be
    // converted with editReply. Drop that message and follow up privately instead.
    if (interaction.deferred) {
        await interaction.deleteReply().catch(() => null);
    }

    return interaction.followUp(payload);
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

async function ensureJellyfinEnabled(interaction) {
    if (client.config.enableJellyfin) return true;

    await interaction.reply(
        ephemeralReply({
            content: translate(interaction, "feature.jellyfinDisabled"),
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
    ensureJellyfinEnabled,
    ephemeralReply,
    sendEphemeralError,
    getQueueEmptyResponse,
    getQueueNotPlayingResponse,
};
