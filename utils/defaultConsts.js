//Defaul configruations to use for undefined/incorrect values in the .env file.
const defaultConsts = {
    config: {
        embedColour: '#FF0000',
        presence: '/help | elite-bot.com',
        leaveOnEmpty: false,
        leaveOnEmptyCooldown: 0,
        leaveOnEnd: false,
        leaveOnEndCooldown: 0,
        leaveOnStop: false,
        leaveOnStopCooldown: 0,
        selfDeafen: true,
        defaultVolume: 50,
        smoothVolume: true,
        enableDjMode: false,
        djRole: 1234567891011,
        enablePlex: false,
        plexServer: '',
        plexAuthtoken: ''
    },
    ytdlOptions: {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 30,
        dlChunkSize: 0,
    }
}

module.exports = defaultConsts;