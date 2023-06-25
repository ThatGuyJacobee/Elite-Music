require("dotenv").config();

module.exports = {
    name: "ready",
    once: true,
    async execute (client, commands){
        client.user.setActivity(process.env.PRESENCE, { type: 2 });

        //Configuration checks & initialisation
        const defaultConsts = require(`../utils/defaultConsts`);
        client.config = defaultConsts.config;

        new Promise((resolve, reject) => {
            client.config.embedColour = typeof (process.env.EMBED_COLOUR) === 'undefined'
                ? client.config.embedColour
                : ((/(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i).test(process.env.EMBED_COLOUR) ? process.env.EMBED_COLOUR : client.config.embedColour);

            client.config.presence = typeof (process.env.PRESENCE) === 'undefined'
                ? client.config.presence
                : (String(process.env.PRESENCE) ? process.env.PRESENCE : client.config.presence);
            
            client.config.enableDjMode = typeof (process.env.ENABLE_DJMODE) === 'undefined'
                ? client.config.enableDjMode
                : (String(process.env.ENABLE_DJMODE) === 'true' ? true : false);
            
            client.config.djRole = typeof (process.env.DJ_ROLE) === 'undefined'
                ? client.config.djRole
                : (Number(process.env.DJ_ROLE) ? process.env.DJ_ROLE : client.config.djRole);

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
                : (Number(process.env.DEFAULT_VOLUME <= 100) && Number(process.env.DEFAULT_VOLUME >= 0) ? process.env.DEFAULT_VOLUME : client.config.defaultVolume);

            client.config.smoothVolume = typeof (process.env.SMOOTH_VOLUME) === 'undefined'
                ? client.config.smoothVolume
                : (String(process.env.SMOOTH_VOLUME) === 'true' ? true : false);

            console.log(`[ELITE_CONFIG] Configuration loading... Current config:\n${JSON.stringify(client.config, null, 3)}`)
            console.log(`Note: If some configuration option is incorrect, please double check that it is correctly set within your .ENV file!\nOtherwise, where a configuraiton option is invalid, the default from defaultConsts.js will be used.`)
            resolve();
        })

        console.log("[ELITE_STATUS] Loading successful. Core of the bot is ready!");
    }
}