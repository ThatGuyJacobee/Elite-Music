const { spawnSync } = require("child_process");
require("dotenv").config();

const DEFAULT_IMAGE_REPO = "thatguyjacobee/elitemusic";
const SUPPORTED_PLATFORMS = new Set(["linux/amd64", "linux/arm64"]);
const MULTI_PLATFORM_TARGET = [...SUPPORTED_PLATFORMS].join(",");

const imageRepo = process.env.DOCKER_IMAGE_REPO || process.env.IMAGE_REPO || DEFAULT_IMAGE_REPO;
const latestRequested = process.argv.includes("--latest");
const multiPlatformRequested = process.argv.includes("--multi-platform");
const pushRequested = process.argv.includes("--push");
const tagFromArg = process.argv.find((arg) => arg.startsWith("--tag="))?.slice(6);
const platformFromArg = process.argv.find((arg) => arg.startsWith("--platform="))?.slice(11);
const tag = latestRequested
    ? "latest"
    : tagFromArg || process.env.npm_config_tag || process.env.DOCKER_IMAGE_TAG;
const platform = multiPlatformRequested
    ? MULTI_PLATFORM_TARGET
    : platformFromArg || process.env.DOCKER_PLATFORM || null;

if (!tag) {
    console.error("Missing tag. Use --tag=... (example: npm run docker:build -- --tag=v1.2.3)");
    console.error("Or set DOCKER_IMAGE_TAG in your environment.");
    process.exit(1);
}

if (multiPlatformRequested && platformFromArg) {
    console.error("Use either --multi-platform or --platform, not both.");
    process.exit(1);
}

if (multiPlatformRequested && !pushRequested) {
    console.error("Multi-platform builds must use --push so Docker can publish the manifest.");
    process.exit(1);
}

if (platform && !multiPlatformRequested && !SUPPORTED_PLATFORMS.has(platform)) {
    console.error(`Unsupported platform: ${platform}`);
    console.error(`Supported platforms: ${[...SUPPORTED_PLATFORMS].join(", ")}`);
    process.exit(1);
}

const imageRef = `${imageRepo}:${tag}`;
const dockerArgs = multiPlatformRequested ? ["buildx", "build"] : ["build"];
dockerArgs.push("-t", imageRef);

if (platform) {
    dockerArgs.push("--platform", platform);
    console.log(`Building ${imageRef} for ${platform}`);
} else {
    console.log(`Building ${imageRef} for the host platform`);
}

if (pushRequested) {
    dockerArgs.push("--push");
    console.log(`Publishing ${imageRef}`);
}

dockerArgs.push(".");

const result = spawnSync("docker", dockerArgs, {
    stdio: "inherit",
});

if (result.error) {
    console.error(`Failed to run docker build: ${result.error.message}`);
    process.exit(1);
}

process.exit(result.status ?? 1);
