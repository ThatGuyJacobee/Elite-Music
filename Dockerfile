# syntax=docker/dockerfile:1

FROM node:24-alpine

# Install build dependencies for native modules
RUN apk --no-cache add --virtual .builds-deps build-base python3

WORKDIR /elite-music
COPY package.json ./
RUN npm install

COPY . .

# Combine update, upgrade, and install to save image layers
RUN apk update && \
    apk upgrade && \
    apk add --no-cache ffmpeg

# Start the bot CMD
CMD ["node", "index.js"]