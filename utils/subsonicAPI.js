const crypto = require('crypto');
const axios = require('axios');

/**
 * Subsonic API Client for interacting with Subsonic-compatible music servers
 */
class SubsonicAPI {
    constructor(baseUrl, username, password) {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this.username = username;
        this.password = password;
        this.client = 'EliteMusic';
        this.version = '1.16.1'; // Subsonic API version
    }

    /**
     * Generate authentication parameters using token-based auth (more secure)
     */
    getAuthParams() {
        const salt = crypto.randomBytes(16).toString('hex');
        const token = crypto.createHash('md5').update(this.password + salt).digest('hex');
        
        return {
            u: this.username,
            t: token,
            s: salt,
            v: this.version,
            c: this.client,
            f: 'json'
        };
    }

    /**
     * Make a request to the Subsonic API
     */
    async request(endpoint, params = {}) {
        try {
            const authParams = this.getAuthParams();
            const allParams = { ...authParams, ...params };
            
            const response = await axios.get(`${this.baseUrl}/rest/${endpoint}`, {
                params: allParams,
                timeout: 10000
            });

            if (response.data['subsonic-response'].status === 'ok') {
                return response.data['subsonic-response'];
            } else {
                throw new Error(response.data['subsonic-response'].error.message);
            }
        } catch (error) {
            if (error.response) {
                throw new Error(`Subsonic API Error: ${error.response.data?.['subsonic-response']?.error?.message || error.message}`);
            }
            throw new Error(`Connection Error: ${error.message}`);
        }
    }

    /**
     * Test connection and credentials (ping)
     */
    async ping() {
        try {
            await this.request('ping');
            return true;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get all playlists for the authenticated user
     */
    async getPlaylists() {
        try {
            const response = await this.request('getPlaylists');
            return response.playlists?.playlist || [];
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get playlist details with all songs
     */
    async getPlaylist(playlistId) {
        try {
            const response = await this.request('getPlaylist', { id: playlistId });
            return response.playlist;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Search for songs, albums, or artists
     */
    async search(query, artistCount = 10, albumCount = 10, songCount = 20) {
        try {
            const response = await this.request('search3', {
                query: query,
                artistCount: artistCount,
                albumCount: albumCount,
                songCount: songCount
            });
            return response.searchResult3 || {};
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get a stream URL for a song
     */
    getStreamUrl(songId) {
        const authParams = this.getAuthParams();
        const params = new URLSearchParams({
            ...authParams,
            id: songId
        });
        
        return `${this.baseUrl}/rest/stream?${params.toString()}`;
    }

    /**
     * Get song details
     */
    async getSong(songId) {
        try {
            const response = await this.request('getSong', { id: songId });
            return response.song;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get album details
     */
    async getAlbum(albumId) {
        try {
            const response = await this.request('getAlbum', { id: albumId });
            return response.album;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get cover art URL
     */
    getCoverArtUrl(coverArtId, size = 300) {
        if (!coverArtId) return null;
        
        const authParams = this.getAuthParams();
        const params = new URLSearchParams({
            ...authParams,
            id: coverArtId,
            size: size
        });
        
        return `${this.baseUrl}/rest/getCoverArt?${params.toString()}`;
    }

    /**
     * Get random songs
     */
    async getRandomSongs(count = 10, genre = null) {
        try {
            const params = { size: count };
            if (genre) params.genre = genre;
            
            const response = await this.request('getRandomSongs', params);
            return response.randomSongs?.song || [];
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get starred songs (favorites)
     */
    async getStarred() {
        try {
            const response = await this.request('getStarred');
            return response.starred || {};
        } catch (error) {
            throw error;
        }
    }
}

/**
 * Check if Subsonic is enabled in the configuration
 */
function isSubsonicEnabled() {
    const enabled = process.env.ENABLE_SUBSONIC;
    return enabled && (enabled.toLowerCase() === 'true' || enabled === '1');
}

/**
 * Get Subsonic client instance from environment variables
 */
function getSubsonicClient() {
    if (!isSubsonicEnabled()) {
        return null;
    }

    const url = process.env.SUBSONIC_URL;
    const username = process.env.SUBSONIC_USERNAME;
    const password = process.env.SUBSONIC_PASSWORD;

    if (!url || !username || !password) {
        console.error('[SUBSONIC] Missing configuration in .env file');
        return null;
    }

    return new SubsonicAPI(url, username, password);
}

module.exports = {
    SubsonicAPI,
    isSubsonicEnabled,
    getSubsonicClient
};
