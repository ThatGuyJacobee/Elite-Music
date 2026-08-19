const { useMainPlayer } = require("discord-player");
const { getPlaylists: subsonicGetPlaylists } = require("./subsonicAPI");
const { getItem: jellyfinGetItem } = require("./jellyfinAPI");
const plexFuncs = require("./plexFunctions");
const subsonicFuncs = require("./subsonicFunctions");
const jellyfinFuncs = require("./jellyfinFunctions");
const { clearNpControlMessages } = require("./npControlMessages");
const { clear } = require("./softTransitions");

function radioPlaylistError(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

async function resolvePlexPlaylist(playlistId) {
    const playlist = await plexFuncs.plexGetPlaylist(playlistId);
    if (Number(playlist.leafCount) === 0) {
        throw radioPlaylistError("RADIO_PLAYLIST_EMPTY", `Plex playlist ${playlistId} is empty`);
    }

    return playlist;
}

async function resolveSubsonicPlaylist(playlistId) {
    const playlists = await subsonicGetPlaylists(client.config);
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

async function resolveJellyfinPlaylist(playlistId) {
    let playlist;
    try {
        playlist = await jellyfinGetItem(client.config, playlistId);
    } catch (err) {
        if (err?.status === 404) {
            throw radioPlaylistError("RADIO_PLAYLIST_NOT_FOUND", `Jellyfin playlist ${playlistId} was not found`);
        }
        throw err;
    }

    if (!playlist || playlist.Type !== "Playlist") {
        throw radioPlaylistError("RADIO_PLAYLIST_NOT_FOUND", `Jellyfin playlist ${playlistId} was not found`);
    }

    return {
        type: "playlist",
        id: playlist.Id,
        title: playlist.Name,
        leafCount: playlist.ChildCount,
        imageItemId: playlist.Id,
    };
}

async function resolveRadioPlaylist(provider, playlistId) {
    if (provider === "plex") return resolvePlexPlaylist(playlistId);
    if (provider === "subsonic") return resolveSubsonicPlaylist(playlistId);
    if (provider === "jellyfin") return resolveJellyfinPlaylist(playlistId);
    throw radioPlaylistError("RADIO_PROVIDER_INVALID", `Radio provider ${provider} is not supported`);
}

async function replaceExistingQueue(interaction) {
    const player = useMainPlayer();
    const queue = player.nodes.get(interaction.guild.id);
    if (!queue) return;

    await clearNpControlMessages(queue);
    clear(queue);
    queue.delete();
}

async function startRadio(interaction, orderMode) {
    const provider = client.config.radioProvider;
    const itemMetadata = await resolveRadioPlaylist(provider, client.config.radioPlaylistId);

    await replaceExistingQueue(interaction);

    const playbackContext = {
        type: "radio",
        provider,
        order: orderMode,
    };

    if (provider === "plex") {
        return plexFuncs.plexAddPlaylist(interaction, itemMetadata, "radio", orderMode, false, playbackContext);
    }
    if (provider === "subsonic") {
        return subsonicFuncs.subsonicAddPlaylist(interaction, itemMetadata, "radio", orderMode, false, playbackContext);
    }
    return jellyfinFuncs.jellyfinAddPlaylist(interaction, itemMetadata, "radio", orderMode, false, playbackContext);
}

module.exports = {
    resolveRadioPlaylist,
    replaceExistingQueue,
    startRadio,
};
