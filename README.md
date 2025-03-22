# Elite Music 🎵
Elite Music is a feature-packed Discord Music Bot built on top of [discord.js](https://discord.js.org/) & using the latest [discord-player](https://discord-player.js.org/) package.

Loving this open-source project? Leaving a ⭐ on the repository would be much appreciated! ❤️

## Features 💡
- Wide range of commands.
- Easy to setup, customise and edit.
- Slash commands (djs v14).
- Support for various streaming platforms.
- Wide range of audio filters.
- Docker Support.
- Awesome playback UI.
- Additional features including plex media server support.
- And much more!

Elite Music was originally a part of my verified Discord bot... [Elite Bot](https://elite-bot.com/), but the music section had to be removed due to verification issues. Therefore, in a win situation, I decided to open-source the bot's music code in this repository. And even better, I decided to rewrite the entire bot to improve the code's feature set and overall quality.

# Installation 🔌
## Prerequisites 🛂
In order for the bot to function correctly, there are a few prerequisites that you must have on your system.

- [NodeJS](https://nodejs.org/en) - For the bot to function, it must be running in a NodeJS environment running on v16.9.0 or higher. It is highly recommended that you download the LTS build which is available for your OS to remain on the latest stable version. Head over to the [NodeJS Download website](https://nodejs.org/en/download) to download and install an appropriate version.

- [FFmpeg](https://ffmpeg.org/) or Avconv - You will require either of these for transcoding. It is recommended to use FFmpeg. By default, the bot comes with the `ffmpeg-static` binaries as a dependency which allows the bot to work out of the box. Alternatively, you may decide to set your own ffmpeg binaries. In this case, head over to the [FFmpeg Download website](https://ffmpeg.org/download.html), select your OS and download the appropriate package. You can then place `FFMPEG_PATH` as a new option into your `.ENV` file stating the custom path to your custom FFmpeg binaries.

- [Discord Bot Account](https://discord.com/developers/applications) - You must register a bot on the Discord Developer site to access a token to run the bot. Head over to the [Developer website](https://discord.com/developers/applications) and click on `New Application` button. Provide a name and press `Create`. Next on the left-hand menu, select the `Bot` section and press `Add Bot` alongside the confirmation. Finally, press `Reset Token` and finally copy the token and keep it safe. This is what you will have to place into your `.ENV` file for the bot to function.

## Setup 🔧
The first step is to clone the repository or download it manually as a folder to host it directly. The Git option is recommended for more advanced users and for users who already have it installed.

### Regular Installation
#### Basic download
Head over to the download page and download the .zip source code. Next, using a tool such as [7-Zip](https://www.7-zip.org/), extract the files from the .zip folder. You can now move on to the following steps.

#### Download using Git
An alternative way to download the repository is through the usage of [Git](https://git-scm.com/). If you do not have Git installed, please use the basic download method. Git users can run the command `git clone https://github.com/ThatGuyJacobee/Elite-Bot-Music/tree/main` to automatically clone the repository to a new folder.

#### Continuing the Setup
Now that you have downloaded the repository, you can continue with the following steps.

1. Open a new command/shell/terminal window within your new folder. You should be able to right-click and open the Windows terminal/command prompt if on Windows.
2. Run the command `npm install` to download all of the module dependencies.
3. Rename the file `.env.example` to simply `.env`. Once down, edit the `.env` file with the configuration options that you would like!
4. Finally, run your bot using `node .` within a command/shell/terminal window. The bot should now become online and provide a success message if everything was configured correctly. 🎉

> [!TIP]
> To help with development, you can use the `npm run dev` within your IDE to active nodemon. This will automatically restart the bot each time that a file is saved with new changes, making it easy to work with!

Of course, you need to add your bot to your server now in order to use it. Follow this [useful guide](https://discordjs.guide/preparations/adding-your-bot-to-servers.html#bot-invite-links) from the discord.js Guide which explains how to do this with great detail if you need help understanding how to do this.

#### YouTube Token Setup (Optional)

Elite Music now has the ability to use a YouTube token from a Google Account to significantly improve the reliability of the YouTube extractor. This is fully optional, as the bot can continue running in scraping mode otherwise.

Typically the YouTube extractor scrapes data anonymously from YouTube thus the chance of your requests being blocked has become increased more recently as YouTube continues to crack down on bot requests. With a token, the bot can instead access the YouTube account and access music data whilst logged in, which significantly reduces the chances of being blocked by YouTube.

> [!TIP]
> This is especially recommended if you are facing YouTube search and playback issues frequently with your bot, due to YouTube blocking your anonymous requests.

1. Run the command `npx --no discord-player-youtubei` in your prompt.
2. Follow the instructions that are printed to your console. Mainly, access the provided link, input the code and login with a Google Account.

> [!IMPORTANT]
> It is highly recommended to use a random throwaway/alternative Google Account for this. Using your main account might put you at risk of a suspension or ban, better to be safe than sorry!

3. Once you completed the Google Account flow, a cookie string will be printed to your console.
4. Copy the **full** string from start to finish. Paste this into the `YT_CREDENTIALS` field within your `.env` file.
5. Save the file and restart the bot.

### Installation via Docker
Elite Music now has Docker image and Docker Compose support, allowing you to simply install and use the bot through Docker.

You can access the [Docker Image via Docker Hub](https://hub.docker.com/r/thatguyjacobee/elitemusic) which provides the image and the instructions within the description. The instructions to either install via Docker Run or Docker Compose are also provided below. Once you have installed and configured your bot, you will need to add your bot to your server now in order to use it. Follow this [useful guide](https://discordjs.guide/preparations/adding-your-bot-to-servers.html#bot-invite-links) from the discord.js Guide which explains how to do this with great detail if you need help understanding how to do this.

#### Docker Run Command
You should use the following command to download the image and run it:
```docker
docker run -d \
--name=elite-music \
--env-file /path/to/.env \
--restart unless-stopped \
thatguyjacobee/elitemusic:latest
```

Note: The `--env-file` path is relative to the directory you are running your docker run command from. 

See the [.env.sample file](https://github.com/ThatGuyJacobee/Elite-Music/blob/main/.env.example) on the GitHub repository to view and copy over all of the environmental options into your target .env file for the bot.

#### Docker Compose
Use the following for your `docker-compose.yml` file:
```yml
version: '3'
services:
    elitemusic:
        container_name: 'elite-music'
        image: 'thatguyjacobee/elitemusic:latest'
        env_file: 
           - /path/to/.env
        restart: unless-stopped
```

Once again, see the [.env.sample file](https://github.com/ThatGuyJacobee/Elite-Music/blob/main/.env.example) on the GitHub repository to view and copy over all of the environmental options into your target .env file for the bot.

## Optional Features ✅
You may decide to want to enable additional optional features for your bot. Follow the appropriate sub-heading to learn how to set up and enable the selected feature!

If you are missing the relevant option in your environmental (`.env`) file, make sure to check the latest [`.env.sample` file](https://github.com/ThatGuyJacobee/Elite-Music/blob/main/.env.example) to ensure you are on the latest version.

Once you have followed the appropriate steps for the optional feature that you want to enable, you should start the bot and ensure that the configuration option returns as `true` when the configuration loads. If the feature still shows as disabled, this suggests that you have a configuration error. Follow the error logs that are provided in your console to resolve this. If you are still having trouble with your issue, feel free to create an issue on the [repository](https://github.com/ThatGuyJacobee/Elite-Music/issues/new) or join the [Support Discord server](https://discord.elite-bot.com).

### Plex Media Server playback
The Plex optional feature when enabled, allows you to stream music directly from your Plex Media Server through the /plex command. In order to enable the Plex feature, you must go into your `.env` file and set up the configuration to your own Plex Media Server.

1. Firstly, set `ENABLE_PLEX` to `true`.
2. Next, you must provide a direct URL to your Plex Media Center. The default port that Plex Media Server runs on is `32400`. You can test that your `PLEX_SERVER` URL is correct, by pasting it into any web browser, and it should load successfully with a login page.
3. Finally, you must place your plex authentication token into the `PLEX_AUTHTOKEN` field. You can do this by browsing the XML file for a library item. Please follow the [official Plex Support article](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/) to access your token. Once you have access to it, place it into your .env file.

### DJ Mode
Elite Music comes with a DJ Mode optional feature, which locks down the use of commands and interactions to members who have the specified DJ Role.

1. Firstly, set `ENABLE_DJMODE` to `true`.
2. Now create a role on your server which you wish to be used as the DJ Role. Copy the ID of the role and place it into the `DJ_ROLE` field.

## Support 🆘
Need help setting up the bot or experiencing some trouble? Feel free to head over to the [Support Discord server](https://discord.elite-bot.com) and let me know!

Found a bug or issue with the latest build? Feel free to open an issue on this [repository](https://github.com/ThatGuyJacobee/Elite-Music/issues/new)! I will respond as soon as possible.

## Elite Bot - Verified Multi-Purpose Bot 💪
Looking for a multi-purpose Discord Bot for your server? Look no further, check out Elite Bot to fulfil all of your server needs including moderation, logging, external server status and much more!

Check the bot out via the dedicated documentation website or top.gg today! 🚀
- https://elite-bot.com
- https://top.gg/bot/723275350922100840

## License 📄
[Apache © ThatGuyJacobee](./LICENSE.md)
