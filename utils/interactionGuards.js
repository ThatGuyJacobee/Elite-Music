const { translate } = require("./botText");

async function ensureDjAccess(interaction) {
    if (!client.config.enableDjMode) return true;
    if (interaction.member.roles.cache.has(client.config.djRole)) return true;

    await interaction.reply({
        content: translate(interaction, "guards.djMode", { role: `<@&${client.config.djRole}>` }),
        ephemeral: true,
    });
    return false;
}

async function ensureInVoiceChannel(interaction) {
    if (interaction.member.voice.channelId) return true;

    await interaction.reply({
        content: translate(interaction, "guards.notInVoice"),
        ephemeral: true,
    });
    return false;
}

async function ensureSameVoiceChannel(interaction) {
    if (
        !interaction.guild.members.me.voice.channelId ||
        interaction.member.voice.channelId === interaction.guild.members.me.voice.channelId
    ) {
        return true;
    }

    await interaction.reply({
        content: translate(interaction, "guards.notInBotVoice"),
        ephemeral: true,
    });
    return false;
}

function getQueueNotPlayingResponse(interaction) {
    return {
        content: translate(interaction, "queue.nothingPlaying"),
        ephemeral: true,
    };
}

function getQueueEmptyResponse(interaction) {
    return {
        content: translate(interaction, "queue.empty"),
        ephemeral: true,
    };
}

module.exports = {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueEmptyResponse,
    getQueueNotPlayingResponse,
};
