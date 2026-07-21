# syntax=docker/dockerfile:1

FROM node:24-alpine

# Install build dependencies for native modules
RUN apk --no-cache add --virtual .builds-deps build-base python3

WORKDIR /elite-music
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Start the bot CMD
CMD ["node", "index.js"]