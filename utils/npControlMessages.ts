import type { TextChannel, Message } from "discord.js";

const NP_AUTO_REFRESH_MS = 10_000;

interface ExtendedQueueMetadata {
    channel: TextChannel;
    npControlMessageIds?: Set<string>;
    npAutoRefreshInterval?: ReturnType<typeof setInterval> | null;
    npAutoRefreshMessageId?: string | null;
}

type QueueLike = {
    metadata: ExtendedQueueMetadata;
    guild: { id: string };
    currentTrack?: { title: string; requestedBy?: any } | null;
    node: any;
};

function ensureRegistry(queue: QueueLike): ExtendedQueueMetadata | null {
    if (!queue.metadata) return null;
    if (!queue.metadata.npControlMessageIds) queue.metadata.npControlMessageIds = new Set();
    return queue.metadata;
}

export function stopNpAutoRefresh(queue: QueueLike): void {
    const meta = queue?.metadata;
    if (!meta) return;
    if (meta.npAutoRefreshInterval != null) {
        clearInterval(meta.npAutoRefreshInterval);
        meta.npAutoRefreshInterval = null;
    }

    meta.npAutoRefreshMessageId = null;
}

async function stripComponents(channel: TextChannel, messageId: string, guildId: string): Promise<void> {
    try {
        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (message) await message.edit({ components: [] as any });
    } catch {
        console.log(`Now playing msg no longer exists! (ID: ${guildId})`);
    }
}

export async function clearNpControlMessages(queue: QueueLike): Promise<void> {
    if (!queue?.metadata) return;
    stopNpAutoRefresh(queue);

    const channel = queue.metadata.channel;
    const messageIds = queue.metadata.npControlMessageIds!;
    if (channel && messageIds && messageIds.size > 0) {
        for (const id of messageIds) {
            await stripComponents(channel, id, queue.guild.id);
        }
    }

    queue.metadata.npControlMessageIds = new Set();
}

export function registerNpControlMessage(queue: QueueLike, messageId: string): void {
    const meta = ensureRegistry(queue);
    if (!meta || !messageId) return;
    meta.npControlMessageIds!.add(messageId);
}

type EditOptionsCallback = (queue: QueueLike) => Promise<{
    embeds: any[];
    components: any[];
}>;

export function startNpAutoRefresh(queue: QueueLike, message: Message, getEditOptions: EditOptionsCallback): void {
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
            await currentMessage.edit(opts as any);
        } catch (e: unknown) {
            console.log(`Now playing refresh failed (ID: ${queue.guild?.id}): ${e instanceof Error ? e.message : e}`);
        }
    }, NP_AUTO_REFRESH_MS);
}
