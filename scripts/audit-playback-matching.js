require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { Player } = require("discord-player");
const { getInnertube } = require("discord-player-youtubei");
const subsonicAPI = require("../utils/subsonicAPI");
const { normalizeArtist, normalizeText, normalizeTitle, removeArtistPrefix } = require("../utils/playbackMatching");

const DEFAULT_SAMPLE_FILE = path.join(__dirname, ".cache", "playback-sample.json");
const VERSION_PATTERN =
    /\b(remix|mix|edit|live|version|instrumental|acoustic|bootleg|remake|rework|sped\s*up|slowed|extended|radio)\b/i;

class MockClient extends EventEmitter {
    constructor(config) {
        super();
        this.user = { id: "0", tag: "audit#0000", displayAvatarURL: () => "" };
        this.options = { intents: [] };
        this.users = { resolve: (user) => user };
        this.guilds = { cache: new Map() };
        this.config = config;
    }

    incrementMaxListeners() {}
}

function parseArgs(argv) {
    const options = { limit: 50, from: null, save: DEFAULT_SAMPLE_FILE, json: null, delay: 150 };
    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index];
        const value = argv[index + 1];
        if (argument === "--limit") options.limit = Math.max(1, Number(value) || options.limit);
        else if (argument === "--from") options.from = value;
        else if (argument === "--save") options.save = value;
        else if (argument === "--json") options.json = value;
        else if (argument === "--delay") options.delay = Math.max(0, Number(value) || 0);
        else if (argument === "--help" || argument === "-h") options.help = true;
    }
    return options;
}

function printHelp() {
    console.log(`Usage: npm run audit:playback -- [options]

  --limit <n>    tracks to sample from Subsonic (default 50)
  --from <file>  reuse a previously saved sample
  --save <file>  where to cache a freshly sampled set (default scripts/.cache/playback-sample.json)
  --json <file>  write the full results to a JSON file
  --delay <ms>   pause between YouTube lookups (default 150)

The audit samples tracks from your Subsonic library, simulates a pasted YouTube
link for each one, and runs the real playback resolver against the library.
It is read-only and never changes the queue.`);
}

function readSubsonicConfig() {
    const config = {
        subsonicServer: process.env.SUBSONIC_SERVER,
        subsonicUser: process.env.SUBSONIC_USER,
        subsonicPass: process.env.SUBSONIC_PASS,
        subsonicAppName: process.env.SUBSONIC_APP_NAME || "Elite-Music-Bot",
        subsonicApiVersion: process.env.SUBSONIC_API_VERSION || "1.16.0",
    };

    if (!config.subsonicServer || !config.subsonicUser || !config.subsonicPass) {
        console.log("Subsonic is not configured in .env; the audit needs it to sample and search your library.");
        process.exit(1);
    }

    return config;
}

function formatDuration(ms) {
    const seconds = Math.round((ms || 0) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function loadSample(file) {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(data.tracks) || data.tracks.length === 0) {
        throw new Error(`${file} does not contain any tracks`);
    }
    return data.tracks;
}

function saveSample(file, tracks) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), tracks }, null, 2));
}

async function sampleTracks(config, limit) {
    const response = await subsonicAPI.subsonicRequest(config, "getRandomSongs", { size: Math.max(limit * 3, limit) });
    const songs = (response.randomSongs && response.randomSongs.song) || [];
    const seen = new Set();
    const tracks = [];

    for (const song of songs) {
        const key = `${normalizeArtist(song.artist)}|${normalizeTitle(song.title, song.artist)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        tracks.push({
            id: song.id,
            title: song.title,
            artist: song.artist,
            album: song.album,
            duration: Number(song.duration || 0) * 1000,
        });
        if (tracks.length >= limit) break;
    }

    return tracks;
}

async function findYoutubeHit(tube, track) {
    const query = [track.artist, track.title].filter(Boolean).join(" ");
    const result = await tube.search(query);
    const video = result.videos && result.videos[0];
    if (!video) return null;

    const seconds = video.duration ? video.duration.seconds : 0;
    return {
        title: video.title ? video.title.toString() : "",
        author: video.author ? video.author.name : "",
        duration: formatDuration(seconds * 1000),
        rawDuration: seconds * 1000,
        url: `https://www.youtube.com/watch?v=${video.video_id}`,
    };
}

function isFairLink(expectedTitle, youtubeTitle) {
    if (!expectedTitle) return false;
    if (youtubeTitle.includes(expectedTitle) || expectedTitle.includes(youtubeTitle)) return true;
    if (expectedTitle.length <= 6) return false;

    for (let length = expectedTitle.length - 1; length >= 6; length--) {
        if (youtubeTitle.includes(expectedTitle.slice(0, length))) return true;
    }

    return false;
}

function classify(expected, item) {
    const chosenTitle = removeArtistPrefix(normalizeText(item.title), expected.artist);
    const chosenArtist = normalizeArtist(item.grandparentTitle);

    if (chosenArtist === expected.artist && chosenTitle === expected.title) return "exact";
    if (
        (chosenArtist === expected.artist ||
            chosenArtist.includes(expected.artist) ||
            expected.artist.includes(chosenArtist)) &&
        (chosenTitle.includes(expected.title) || expected.title.includes(chosenTitle)) &&
        VERSION_PATTERN.test(`${chosenTitle} ${expected.title}`)
    ) {
        return "version";
    }

    return "wrong";
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const config = { enableSubsonic: true, enablePlex: false, enableJellyfin: false, ...readSubsonicConfig() };
    config.playbackSourceOrder = ["subsonic"];

    global.client = new MockClient(config);
    new Player(global.client, {});
    const { resolvePlaybackSource } = require("../utils/playbackResolver");

    const tracks = options.from ? loadSample(options.from) : await sampleTracks(config, options.limit);
    if (!options.from) saveSample(options.save, tracks);

    const tube = await getInnertube({});
    const rows = [];
    let unrelated = 0;

    for (let index = 0; index < tracks.length; index++) {
        const track = tracks[index];
        const expected = {
            title: normalizeTitle(track.title, track.artist),
            artist: normalizeArtist(track.artist),
        };

        let hit = null;
        try {
            hit = await findYoutubeHit(tube, track);
        } catch (error) {
            rows.push({ track, expected, verdict: "youtube-error", detail: error.message });
            continue;
        }

        if (!hit) {
            rows.push({ track, expected, verdict: "youtube-empty" });
            continue;
        }

        if (!isFairLink(expected.title, normalizeText(hit.title))) {
            unrelated++;
            continue;
        }

        let resolution = null;
        try {
            resolution = await resolvePlaybackSource({ tracks: [hit] }, hit.url, config, "subsonic");
        } catch (error) {
            rows.push({ track, expected, hit, verdict: "resolver-error", detail: error.message });
            continue;
        }

        const results = (resolution && resolution.results) || [];
        const chosen = results[0] ? results[0].item : null;
        const verdict = chosen ? classify(expected, chosen) : "none";
        const instant =
            resolution && typeof resolution.autoPlay === "boolean" ? resolution.autoPlay : results.length === 1;

        rows.push({
            track,
            expected,
            hit,
            chosen: chosen ? { title: chosen.title, artist: chosen.grandparentTitle, duration: chosen.duration } : null,
            score: results[0] ? results[0].score : 0,
            verdict,
            instant,
        });

        if ((index + 1) % 10 === 0) console.log(`...${index + 1}/${tracks.length}`);
        if (options.delay) await sleep(options.delay);
    }

    for (const row of rows) {
        if (row.verdict === "exact" && row.instant) continue;
        const label = { exact: "OK  ", version: "VER ", wrong: "WRG ", none: "NONE" }[row.verdict] || row.verdict;
        const local = `${row.track.title} / ${row.track.artist} (${formatDuration(row.track.duration)})`;
        const youtube = row.hit ? `${row.hit.author} / ${row.hit.title}` : "-";
        const pick = row.chosen
            ? `${row.chosen.title} / ${row.chosen.artist} (${formatDuration(row.chosen.duration)}) score=${row.score.toFixed(3)}`
            : "-";
        console.log(`${label} | ${local} || yt: ${youtube} || pick: ${pick}`);
    }

    const counts = {};
    for (const row of rows) counts[row.verdict] = (counts[row.verdict] || 0) + 1;
    const instant = rows.filter((row) => row.verdict === "exact" && row.instant).length;
    const usable = rows.filter((row) => row.verdict === "exact" || row.verdict === "version").length;

    console.log("=============================================================");
    console.log(`sampled=${tracks.length} fair=${rows.length} unrelated=${unrelated}`);
    console.log(`verdicts: ${JSON.stringify(counts)}`);
    console.log(`usable: ${usable}/${rows.length} (${Math.round((usable / Math.max(1, rows.length)) * 100)}%)`);
    console.log(`instant: ${instant}/${rows.length} (${Math.round((instant / Math.max(1, rows.length)) * 100)}%)`);

    if (options.json) {
        fs.writeFileSync(options.json, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
        console.log(`results written to ${options.json}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
