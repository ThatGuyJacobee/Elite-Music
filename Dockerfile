# syntax=docker/dockerfile:1

# Build production dependencies, including native modules
FROM node:24-bookworm-slim AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /elite-music
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Create the runtime image without build tools
FROM node:24-bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /elite-music
COPY --from=builder --chown=node:node /elite-music ./

# Allow the app to write its error logs
RUN chown node:node /elite-music
USER node

# Use the bundled ffmpeg-static binary
CMD ["node", "index.js"]
