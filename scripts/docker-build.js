const { spawnSync } = require("child_process");
require("dotenv").config();

const DEFAULT_IMAGE_REPO = "thatguyjacobee/elitemusic";

const imageRepo = process.env.DOCKER_IMAGE_REPO || process.env.IMAGE_REPO || DEFAULT_IMAGE_REPO;
const latestRequested = process.argv.includes("--latest");
const tagFromArg = process.argv.find((arg) => arg.startsWith("--tag="))?.slice(6);
const tag = latestRequested
    ? "latest"
    : tagFromArg || process.env.npm_config_tag || process.env.DOCKER_IMAGE_TAG;

if (!tag) {
    console.error("Missing tag. Use --tag=... (example: npm run docker:build --tag=v1.2.3)");
    console.error("Or set DOCKER_IMAGE_TAG in your environment.");
    process.exit(1);
}

const result = spawnSync("docker", ["build", "-t", `${imageRepo}:${tag}`, "."], {
    stdio: "inherit",
});

if (result.error) {
    console.error(`Failed to run docker build: ${result.error.message}`);
    process.exit(1);
}

process.exit(result.status ?? 1);
