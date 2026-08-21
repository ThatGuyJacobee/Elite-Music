const { spawnSync } = require("child_process");
require("dotenv").config();

const DEFAULT_IMAGE_REPO = "thatguyjacobee/elitemusic";
const SUPPORTED_PLATFORMS = new Set(["linux/amd64", "linux/arm64"]);

const imageRepo = process.env.DOCKER_IMAGE_REPO || process.env.IMAGE_REPO || DEFAULT_IMAGE_REPO;
const latestRequested = process.argv.includes("--latest");
const tagFromArg = process.argv.find((arg) => arg.startsWith("--tag="))?.slice(6);
const platformFromArg = process.argv.find((arg) => arg.startsWith("--platform="))?.slice(11);
const tag = latestRequested
    ? "latest"
    : tagFromArg || process.env.npm_config_tag || process.env.DOCKER_IMAGE_TAG;
const platform = platformFromArg || process.env.DOCKER_PLATFORM || null;

if (!tag) {
    console.error("Missing tag. Use --tag=... (example: npm run docker:build -- --tag=v1.2.3)");
    console.error("Or set DOCKER_IMAGE_TAG in your environment.");
    process.exit(1);
}

if (platform && !SUPPORTED_PLATFORMS.has(platform)) {
    console.error(`Unsupported platform: ${platform}`);
    console.error(`Supported platforms: ${[...SUPPORTED_PLATFORMS].join(", ")}`);
    process.exit(1);
}

const imageRef = `${imageRepo}:${tag}`;
const buildArgs = ["build", "-t", imageRef];

if (platform) {
    buildArgs.push("--platform", platform);
    console.log(`Building ${imageRef} for ${platform}`);
} else {
    console.log(`Building ${imageRef} for the host platform`);
}

buildArgs.push(".");

const result = spawnSync("docker", buildArgs, {
    stdio: "inherit",
});

if (result.error) {
    console.error(`Failed to run docker build: ${result.error.message}`);
    process.exit(1);
}

process.exit(result.status ?? 1);
