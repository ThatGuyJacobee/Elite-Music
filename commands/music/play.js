const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed, Permissions } = require("discord.js");
const { QueryType } = require('discord-player');
const ebmusic = require("../../models/ebmusic.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Plays a song!")
        .addStringOption((option) => option
            .setName("music")
            .setDescription("Either the name, URL or playlist URL you want to play.")
            .setRequired(true)
        ),
    async execute(interaction) {
        const guildid = interaction.guild.id;
        const DJCheck = await ebmusic.findOne({
            where: {
                GuildID: guildid
            }
        });

        if (DJCheck) {
            if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
        }

        await interaction.deferReply();
        if (!interaction.member.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId) return await interaction.followUp({ content: "You are not in my voice channel!", ephemeral: true });
        const query = interaction.options.getString("music");
        const queue = player.createQueue(interaction.guild, {
            ytdlOptions: {
                filter: 'audioonly',
                highWaterMark: 1 << 30,
                dlChunkSize: 0,
            },
            metadata: {
                channel: interaction.channel
            }
        });
        
        try {
            if (!queue.connection) await queue.connect(interaction.member.voice.channel);
        } catch {
            queue.destroy();
            return await interaction.followUp({ content: "Could not join your voice channel!", ephemeral: true });
        }

        const search = await player.search(query, {
            requestedBy: interaction.user,
            searchEngine: QueryType.AUTO
        });
        if (!search) return await interaction.followUp({ content: `❌ | Track **${query}** not found!` });

        search.playlist ? queue.addTracks(search.tracks) : queue.addTrack(search.tracks[0])
        queue.setVolume(50);

        if (!queue.playing) {
            await queue.play();
            if (search.playlist) {
                const playlistembed = new MessageEmbed()
                .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                .setThumbnail(search.tracks[0].thumbnail)
                .setColor(0xFF0000)
                .setTitle(`Started playback ▶️`)
                .setDescription(`Imported the **${search.tracks[0].playlist.title} ([Link](${search.tracks[0].playlist.url})) playlist** with **${search.tracks.length}** songs and started to play the queue!`)
                .setTimestamp()
                .setFooter(`Requested by: ${interaction.user.tag}`)

                interaction.followUp({ embeds: [playlistembed] })
                //return await interaction.followUp({ content: `▶️ | Imported the playlist and started playing the queue!` });
            }
            
            else {
                const playsongembed = new MessageEmbed()
                .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                .setThumbnail(search.tracks[0].thumbnail)
                .setColor(0xFF0000)
                .setTitle(`Started playback ▶️`)
                .setDescription(`Began playing the song **${search.tracks[0].title}** ([Link](${search.tracks[0].url}))!`)
                .setTimestamp()
                .setFooter(`Requested by: ${interaction.user.tag}`)

                interaction.followUp({ embeds: [playsongembed] })
                //return await interaction.followUp({ content: `▶️ | Started to play the song **${search.tracks[0].title}**!` });
            }
        }

        else {
            if (search.playlist) {
                const queueplaylistembed = new MessageEmbed()
                .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                .setThumbnail(search.tracks[0].thumbnail)
                .setColor(0xFF0000)
                .setTitle(`Added to queue ⏱️`)
                .setDescription(`Imported the **${search.tracks[0].playlist.title} ([Link](${search.tracks[0].playlist.url})) playlist** with **${search.tracks.length}** songs!`)
                .setTimestamp()
                .setFooter(`Requested by: ${interaction.user.tag}`)

                interaction.followUp({ embeds: [queueplaylistembed] })
                //return await interaction.followUp({ content: `⏱️ | Imported the playlist and songs have been added to the queue!` });
            }

            else {
                const queuesongembed = new MessageEmbed()
                .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                .setThumbnail(search.tracks[0].thumbnail)
                .setColor(0xFF0000)
                .setTitle(`Added to queue ⏱️`)
                .setDescription(`Added song **${search.tracks[0].title}** ([Link](${search.tracks[0].url})) to the queue!`)
                .setTimestamp()
                .setFooter(`Requested by: ${interaction.user.tag}`)

                interaction.followUp({ embeds: [queuesongembed] })
                //return await interaction.followUp({ content: `⏱️ | Added song **${search.tracks[0].title}** to the queue!` });
            }
        }
    }
}