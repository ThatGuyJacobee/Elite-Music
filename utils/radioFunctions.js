const { useMainPlayer } = require("discord-player");
const { getPlaylists: subsonicGetPlaylists } = require("./subsonicAPI");
const { getItem: jellyfinGetItem } = require("./jellyfinAPI");
const plexFuncs = require("./plexFunctions");
const subsonicFuncs = require("./subsonicFunctions");
const jellyfinFuncs = require("./jellyfinFunctions");
const { clearNpControlMessages } = require("./npControlMessages");
const { clear } = require("./softTransitions");

const RADIO_REQUEST_TIMEOUT_MS = 10000;
const radioStartsInProgress = new Set();

function radioPlaylistError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

async function resolvePlexPlaylist(playlistId, init = {}) {
    const playlist = await plexFuncs.plexGetPlaylist(playlistId, init);
    if (Number(playlist.leafCount) === 0) {
        throw radioPlaylistError("RADIO_PLAYLIST_EMPTY", `Plex playlist ${playlistId} is empty`);
    }

    return playlist;
}

async function resolveSubsonicPlaylist(playlistId, init = {}) {
    const playlists = await subsonicGetPlaylists(client.config, init);
    const playlist = playlists.find((item) => String(item.id) === String(playlistId));
    if (!playlist) {
        throw radioPlaylistError("RADIO_PLAYLIST_NOT_FOUND", `Subsonic playlist ${playlistId} was not found`);
    }
    if (Number(playlist.songCount) === 0) {
        throw radioPlaylistError("RADIO_PLAYLIST_EMPTY", `Subsonic playlist ${playlistId} is empty`);
    }

    return {
        type: "playlist",
        id: playlist.id,
        title: playlist.name,
        leafCount: playlist.songCount,
    };
}

async function resolveJellyfinPlaylist(playlistId, init = {}) {
    let playlist;
    try {
        playlist = await jellyfinGetItem(client.config, playlistId, init);
    } catch (err) {
        if (err?.status === 404) {
            throw radioPlaylistError("RADIO_PLAYLIST_NOT_FOUND", `Jellyfin playlist ${playlistId} was not found`);
        }
        throw err;
    }

    if (!playlist || playlist.Type !== "Playlist") {
        throw radioPlaylistError("RADIO_PLAYLIST_NOT_FOUND", `Jellyfin playlist ${playlistId} was not found`);
    }
    if (Number(playlist.ChildCount) === 0) {
        throw radioPlaylistError("RADIO_PLAYLIST_EMPTY", `Jellyfin playlist ${playlistId} is empty`);
    }

    return {
        type: "playlist",
        id: playlist.Id,
        title: playlist.Name,
        leafCount: playlist.ChildCount,
        imageItemId: playlist.Id,
    };
}

async function resolveRadioPlaylist(provider, playlistId, init = {}) {
    if (provider === "plex") return resolvePlexPlaylist(playlistId, init);
    if (provider === "subsonic") return resolveSubsonicPlaylist(playlistId, init);
    if (provider === "jellyfin") return resolveJellyfinPlaylist(playlistId, init);
    throw radioPlaylistError("RADIO_PROVIDER_INVALID", `Radio provider ${provider} is not supported`);
}

async function prepareRadioPlaylist(interaction, provider, itemMetadata, orderMode, init = {}) {
    if (provider === "plex") {
        return plexFuncs.plexPreparePlaylist(interaction, itemMetadata, orderMode, {
            ...init,
            validateResponse: true,
        });
    }
    if (provider === "subsonic") {
        return subsonicFuncs.subsonicPreparePlaylist(interaction, itemMetadata, orderMode, init);
    }
    return jellyfinFuncs.jellyfinPreparePlaylist(interaction, itemMetadata, orderMode, init);
}

async function playPreparedRadioPlaylist(interaction, provider, preparedPlaylist, playbackContext) {
    if (provider === "plex") {
        return plexFuncs.plexAddPreparedPlaylist(interaction, preparedPlaylist, "send", false, playbackContext);
    }
    if (provider === "subsonic") {
        return subsonicFuncs.subsonicAddPreparedPlaylist(interaction, preparedPlaylist, "send", false, playbackContext);
    }
    return jellyfinFuncs.jellyfinAddPreparedPlaylist(interaction, preparedPlaylist, "send", false, playbackContext);
}

async function replaceExistingQueue(interaction) {
    const player = useMainPlayer();
    const queue = player.nodes.get(interaction.guild.id);
    if (!queue) return;

    await clearNpControlMessages(queue);
    clear(queue);
    queue.delete();
}

function assertRadioVoiceState(interaction, expectedVoiceChannelId) {
    const memberVoiceChannelId = interaction.member.voice.channelId;
    const botVoiceChannelId = interaction.guild.members.me.voice.channelId;
    if (
        !memberVoiceChannelId ||
        memberVoiceChannelId !== expectedVoiceChannelId ||
        (botVoiceChannelId && botVoiceChannelId !== expectedVoiceChannelId)
    ) {
        throw radioPlaylistError(
            "RADIO_VOICE_STATE_CHANGED",
            "The voice channel changed while the radio playlist was loading",
        );
    }
}

async function startRadio(interaction, orderMode, expectedVoiceChannelId = interaction.member.voice.channelId) {
    const guildId = interaction.guild.id;
    if (radioStartsInProgress.has(guildId)) {
        throw radioPlaylistError(
            "RADIO_START_IN_PROGRESS",
            `A radio start is already in progress for guild ${guildId}`,
        );
    }

    radioStartsInProgress.add(guildId);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("Radio playlist request timed out"), RADIO_REQUEST_TIMEOUT_MS);

    try {
        const provider = client.config.radioProvider;
        const itemMetadata = await resolveRadioPlaylist(provider, client.config.radioPlaylistId, {
            signal: controller.signal,
        });
        const preparedPlaylist = await prepareRadioPlaylist(interaction, provider, itemMetadata, orderMode, {
            signal: controller.signal,
        });
        if (!preparedPlaylist.tracks.length) {
            throw radioPlaylistError("RADIO_PLAYLIST_EMPTY", `${provider} radio playlist is empty`);
        }
        if (controller.signal.aborted) {
            throw radioPlaylistError("RADIO_REQUEST_TIMEOUT", "The radio playlist request timed out");
        }

        clearTimeout(timeout);
        assertRadioVoiceState(interaction, expectedVoiceChannelId);
        await replaceExistingQueue(interaction);

        const playbackContext = {
            type: "radio",
            provider,
            order: orderMode,
        };

        return await playPreparedRadioPlaylist(interaction, provider, preparedPlaylist, playbackContext);
    } catch (err) {
        if (controller.signal.aborted) {
            throw radioPlaylistError("RADIO_REQUEST_TIMEOUT", "The radio playlist request timed out");
        }
        if (err?.code === "RADIO_ADD_TRACKS") {
            await replaceExistingQueue(interaction);
        }
        throw err;
    } finally {
        clearTimeout(timeout);
        radioStartsInProgress.delete(guildId);
    }
}

module.exports = {
    resolveRadioPlaylist,
    prepareRadioPlaylist,
    replaceExistingQueue,
    assertRadioVoiceState,
    startRadio,
};
