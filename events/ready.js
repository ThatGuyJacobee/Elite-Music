require("dotenv").config();

module.exports = {
    name: "ready",
    once: true,
    async execute (client, commands){
        //Configuration checks & initialisation
        const defaultConsts = require(`../utils/defaultConsts`);
        client.config = defaultConsts.config;

        new Promise(async (resolve, reject) => {
            client.config.embedColour = typeof (process.env.EMBED_COLOUR) === 'undefined'
                ? client.config.embedColour
                : ((/(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i).test(process.env.EMBED_COLOUR) ? process.env.EMBED_COLOUR : client.config.embedColour);

            client.config.presence = typeof (process.env.PRESENCE) === 'undefined'
                ? client.config.presence
                : (String(process.env.PRESENCE) ? process.env.PRESENCE : client.config.presence);

            client.config.leaveOnEmpty = typeof (process.env.LEAVE_ON_EMPTY) === 'undefined'
                ? client.config.leaveOnEmpty
                : (String(process.env.LEAVE_ON_EMPTY) === 'true' ? true : false);

            client.config.leaveOnEmptyCooldown = typeof (process.env.LEAVE_ON_EMPTY_COOLDOWN) === 'undefined'
                ? client.config.leaveOnEmptyCooldown
                : (Number(process.env.LEAVE_ON_EMPTY_COOLDOWN) ? process.env.LEAVE_ON_EMPTY_COOLDOWN : client.config.leaveOnEmptyCooldown);

            client.config.leaveOnEnd = typeof (process.env.LEAVE_ON_END) === 'undefined'
                ? client.config.leaveOnEnd
                : (String(process.env.LEAVE_ON_END) === 'true' ? true : false);

            client.config.leaveOnEndCooldown = typeof (process.env.LEAVE_ON_END_COOLDOWN) === 'undefined'
                ? client.config.leaveOnEndCooldown
                : (Number(process.env.LEAVE_ON_END_COOLDOWN) ? process.env.LEAVE_ON_END_COOLDOWN : client.config.leaveOnEndCooldown);

            client.config.leaveOnStop = typeof (process.env.LEAVE_ON_STOP) === 'undefined'
                ? client.config.leaveOnStop
                : (String(process.env.LEAVE_ON_STOP) === 'true' ? true : false);

            client.config.leaveOnStopCooldown = typeof (process.env.LEAVE_ON_STOP_COOLDOWN) === 'undefined'
                ? client.config.leaveOnStopCooldown
                : (Number(process.env.LEAVE_ON_STOP_COOLDOWN) ? process.env.LEAVE_ON_STOP_COOLDOWN : client.config.leaveOnStopCooldown);

            client.config.selfDeafen = typeof (process.env.SELF_DEAFEN) === 'undefined'
                ? client.config.selfDeafen
                : (String(process.env.SELF_DEAFEN) === 'true' ? true : false);

            client.config.defaultVolume = typeof (process.env.DEFAULT_VOLUME) === 'undefined'
                ? client.config.defaultVolume
                : (Number(process.env.DEFAULT_VOLUME <= 100) && Number(process.env.DEFAULT_VOLUME >= 0) ? Number(process.env.DEFAULT_VOLUME) : client.config.defaultVolume);

            client.config.smoothVolume = typeof (process.env.SMOOTH_VOLUME) === 'undefined'
                ? client.config.smoothVolume
                : (String(process.env.SMOOTH_VOLUME) === 'true' ? true : false);

            client.config.enableDjMode = typeof (process.env.ENABLE_DJMODE) === 'undefined'
                ? client.config.enableDjMode
                : (String(process.env.ENABLE_DJMODE) === 'true' ? true : false);
            
            client.config.djRole = typeof (process.env.DJ_ROLE) === 'undefined'
                ? client.config.djRole
                : (Number(process.env.DJ_ROLE) ? process.env.DJ_ROLE : client.config.djRole);

            client.config.enablePlex = typeof (process.env.ENABLE_PLEX) === 'undefined'
                ? client.config.enablePlex
                : (String(process.env.ENABLE_PLEX) === 'true' ? true : false);

            client.config.plexServer = typeof (process.env.PLEX_SERVER) === 'undefined'
                ? client.config.plexServer
                : (String(process.env.PLEX_SERVER) ? process.env.PLEX_SERVER : client.config.plexServer);

            client.config.plexAuthtoken = typeof (process.env.PLEX_AUTHTOKEN) === 'undefined'
                ? client.config.plexAuthtoken
                : (String(process.env.PLEX_AUTHTOKEN) ? process.env.PLEX_AUTHTOKEN : client.config.plexAuthtoken);

            //Perform validation checks
            if (client.config.enablePlex) {
                //Abort fetch after 3 seconds
                const controller = new AbortController();
                setTimeout(() => controller.abort("Fetch aborted: Plex Server URL must be invalid as request received no response."), 3000);

                await fetch(`${client.config.plexServer}/search/?X-Plex-Token=${client.config.plexAuthtoken}&query=test&limit=1`, {
                    method: 'GET',
                    headers: { accept: 'application/json'},
                    signal: controller.signal
                })
                .then(search => {
                    //401 = Unauthorized, 404 = Not Found, 200 = OK
                    if (search.status == 401) {
                        console.log(`[ELITE_CONFIG] Plex configuration is invalid. Disabling Plex feature... Your Plex Authentication token is not valid.`)
                        client.config.enablePlex = false;
                    }

                    else if (search.status != 200) {
                        console.log(`[ELITE_CONFIG] Plex configuration is invalid. Disabling Plex feature... Generic error.`)
                        client.config.enablePlex = false;
                    }
                })
                .catch(err => {
                    if (controller.signal.aborted) {
                        console.log(`[ELITE_CONFIG] Plex configuration is invalid. Disabling Plex feature... Read more in the trace below:\n${controller.signal.reason}`)
                    }
                    
                    else {
                        console.log(`[ELITE_CONFIG] Plex configuration is invalid. Disabling Plex feature... Read more in the trace below:\n${err}`)
                    }
                    client.config.enablePlex = false;
                })
            }

            if (process.env.CFG_VERSION == null || process.env.CFG_VERSION != 1.3) {
                console.log(`[ELITE_CONFIG] Your .ENV configuration file is outdated. This could mean that you may lose out on new functionality or new customisation options. Please check the latest config via https://github.com/ThatGuyJacobee/Elite-Music/blob/main/.env.example or the .env.example file as your bot version is ahead of your configuration version.`)
            }
            resolve();
        })
        .then(() => {
            console.log(`[ELITE_CONFIG] Configuration loaded... Current config:\n${JSON.stringify(client.config, null, 3)}`)
            console.log(`Note: If some configuration option is incorrect, please double check that it is correctly set within your .ENV file!\nOtherwise, where a configuraiton option is invalid, the default from defaultConsts.js will be used.`)
            console.log("\n[ELITE_STATUS] Loading successful. Core of the bot is ready!");
        })

        client.user.setActivity(client.config.presence, { type: 2 });
    }
}