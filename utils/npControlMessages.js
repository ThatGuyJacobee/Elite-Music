const NP_AUTO_REFRESH_MS = 10_000;

function ensureRegistry(queue) {
    if (!queue.metadata) return null;
    if (!queue.metadata.npControlMessageIds) queue.metadata.npControlMessageIds = new Set();
    return queue.metadata;
}

function stopNpAutoRefresh(queue) {
    const meta = queue?.metadata;
    if (!meta) return;
    if (meta.npAutoRefreshInterval != null) {
        clearInterval(meta.npAutoRefreshInterval);
        meta.npAutoRefreshInterval = null;
    }

    meta.npAutoRefreshMessageId = null;
}

async function stripComponents(channel, messageId, guildId) {
    try {
        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (message) await message.edit({ components: [] });
    } catch {
        console.log(`Now playing msg no longer exists! (ID: ${guildId})`);
    }
}

async function clearNpControlMessages(queue) {
    if (!queue?.metadata) return;
    stopNpAutoRefresh(queue);

    const channel = queue.metadata.channel;
    const messageIds = queue.metadata.npControlMessageIds;
    if (channel && messageIds && messageIds.size > 0) {
        for (const id of messageIds) {
            await stripComponents(channel, id, queue.guild.id);
        }
    }

    queue.metadata.npControlMessageIds = new Set();
}

function registerNpControlMessage(queue, messageId) {
    const meta = ensureRegistry(queue);
    if (!meta || !messageId) return;
    meta.npControlMessageIds.add(messageId);
}

function startNpAutoRefresh(queue, message, getEditOptions) {
    stopNpAutoRefresh(queue);

    const meta = ensureRegistry(queue);
    if (!meta || !message?.id) return;
    const targetId = message.id;

    meta.npAutoRefreshMessageId = targetId;
    meta.npAutoRefreshInterval = setInterval(async () => {
        if (meta.npAutoRefreshMessageId !== targetId) return;
        const channel = queue.metadata?.channel;
        if (!channel) return;

        try {
            const currentMessage = await channel.messages.fetch(targetId).catch(() => null);
            if (!currentMessage || !queue.currentTrack) {
                stopNpAutoRefresh(queue);
                return;
            }
            const opts = await getEditOptions(queue);
            await currentMessage.edit(opts);
        } catch (e) {
            console.log(`Now playing refresh failed (ID: ${queue.guild?.id}): ${e?.message || e}`);
        }
    }, NP_AUTO_REFRESH_MS);
}

module.exports = {
    NP_AUTO_REFRESH_MS,
    stopNpAutoRefresh,
    clearNpControlMessages,
    registerNpControlMessage,
    startNpAutoRefresh,
};
