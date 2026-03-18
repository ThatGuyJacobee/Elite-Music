require("dotenv").config();
const musicFuncs = require('../../utils/sharedFunctions.js')
const { SlashCommandBuilder } = require("@discordjs/builders");
const { ActionRowBuilder, ButtonBuilder, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");
const { useMainPlayer, Track, QueryType } = require('discord-player');
const { buildImageAttachment } = require('../../utils/utilityFunctions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("plex")
        .setDescription("Play music from your Plex server")
        .addSubcommand((subcommand) => subcommand
            .setName("play")
            .setDescription("Search and play songs from your Plex server")
            .addStringOption((option) => option
                .setName("query")
                .setDescription("Search for a song by name or artist")
                .setRequired(true))
            .addBooleanOption(option =>
                option.setName("playnext")
                    .setDescription("Add song to the front of the queue")
                    .setRequired(false)))
        .addSubcommand((subcommand) => subcommand
            .setName("albums")
            .setDescription("Search and play full albums from your Plex server")
            .addStringOption((option) => option
                .setName("query")
                .setDescription("Search for an album by name or artist")
                .setRequired(true)))
        .addSubcommand((subcommand) => subcommand
            .setName("playlists")
            .setDescription("View and play your Plex playlists")),
    cooldown: 5,
    async execute(interaction) {
        if (client.config.enableDjMode) {
            if (!interaction.member.roles.cache.has(client.config.djRole)) {
                return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
            }
        }

        await interaction.deferReply();

        if (!client.config.enablePlex) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Plex Disabled')
                .setDescription('Plex integration is not enabled on this bot.')
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (!member.voice.channel) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Not in Voice Channel')
                .setDescription('You need to be in a voice channel to play music!')
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'play') {
            await handlePlay(interaction, member);
        } else if (subcommand === 'albums') {
            await handleAlbums(interaction, member);
        } else if (subcommand === 'playlists') {
            await handlePlaylists(interaction, member);
        }
    }
};

async function handlePlay(interaction, member) {
    const query = interaction.options.getString('query');
    const playNext = interaction.options.getBoolean('playnext') || false;

    try {
        const results = await musicFuncs.plexSearchQuery(query);
        
        if (!results || !results.songs || results.songs.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🔍 No Results Found')
                .setDescription(`No songs found for: **${query}**`)
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        const songs = results.songs.slice(0, 10);

        if (songs.length === 1) {
            await musicFuncs.plexAddTrack(interaction, playNext, songs[0], 'edit');
            return;
        }

        let embedFields = []
        let count = 1
        let emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣','5️⃣', '6️⃣', '7️⃣', '8️⃣','9️⃣', '🔟']

        const actionmenu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                .setCustomId(`plex_song_select_${playNext}`)
                .setMinValues(1)
                .setMaxValues(1)
                .setPlaceholder('Select a song to play')
            )

        for (let item of songs) {
            if (count > 10) break;

            let date = new Date(item.duration)
            let songTitle = `${item.parentTitle} - ${item.grandparentTitle}`
            embedFields.push({ name: `[${count}] ${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`, value: songTitle })
            
            actionmenu.components[0].addOptions(
                new StringSelectMenuOptionBuilder()
                .setLabel(songTitle.length > 100 ? `${songTitle.substring(0, 97)}...` : songTitle)
                .setValue(item.key)
                .setDescription(`Duration - ${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`)
                .setEmoji(emojis[count-1])
            )
            count++
        }

        const searchembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL({dynamic: true}))
            .setTitle(`Plex Search Results 🎵`)
            .setDescription('Found multiple songs matching the provided search query, select one from the menu below.')
            .addFields(embedFields)
            .setColor(client.config.embedColour)
            .setTimestamp()
            .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

        const actionbutton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("np-delete")
                .setStyle(4)
                .setLabel("Cancel Search 🗑️"),
        )
        
        await interaction.editReply({ embeds: [searchembed], components: [actionmenu, actionbutton] })

        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.customId === `plex_song_select_${playNext}` && i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const songKey = i.values[0];
            const selectedSong = songs.find(s => s.key === songKey);
            await musicFuncs.plexAddTrack(i, playNext, selectedSong, 'edit');
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ components: [] }).catch(() => {});
            }
        });

    } catch (error) {
        console.error('[PLEX_PLAY] Error:', error);

        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Search Error')
            .setDescription(`Could not search for songs: ${error.message}`)
            .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

async function handleAlbums(interaction, member) {
    const query = interaction.options.getString('query');

    try {
        const searchResults = await fetch(`${client.config.plexServer}/search?X-Plex-Token=${client.config.plexAuthtoken}&query=${encodeURIComponent(query)}&limit=25&type=9`, {
            method: 'GET',
            headers: { accept: 'application/json'}
        });

        const result = await searchResults.json();
        
        if (!result.MediaContainer.Metadata || result.MediaContainer.Metadata.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🔍 No Albums Found')
                .setDescription(`No albums found for: **${query}**`)
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        const albums = result.MediaContainer.Metadata.slice(0, 25);

        for (const album of albums) {
            try {
                const childrenResult = await fetch(`${client.config.plexServer}/library/metadata/${album.ratingKey}/children?X-Plex-Token=${client.config.plexAuthtoken}`, {
                    method: 'GET',
                    headers: { accept: 'application/json'}
                });
                const childrenData = await childrenResult.json();
                album.trackCount = childrenData.MediaContainer.Metadata ? childrenData.MediaContainer.Metadata.length : 0;
            } catch (error) {
                console.error(`[PLEX_ALBUMS] Error fetching track count for ${album.title}:`, error);
                album.trackCount = 0;
            }
        }

        if (albums.length === 1) {
            return await showAlbumOrderSelection(interaction, albums[0], member.voice.channel);
        }

        const options = albums.map((album, index) => ({
            label: album.title.substring(0, 100),
            description: `${album.parentTitle || 'Unknown Artist'} • ${album.trackCount || 0} songs`.substring(0, 100),
            value: album.ratingKey
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('plex_album_select')
            .setPlaceholder('Select an album to play')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor(client.config.embedColour)
            .setTitle('🔍 Album Search Results')
            .setDescription(`Found **${albums.length}** album${albums.length !== 1 ? 's' : ''} for: **${query}**`)
            .addFields(
                albums.slice(0, 10).map((album, index) => ({
                    name: `${index + 1}. ${album.title}`,
                    value: `${album.parentTitle || 'Unknown Artist'} • ${album.trackCount || 0} songs`,
                    inline: false
                }))
            )
            .setFooter({ text: 'Select an album from the menu below' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.customId === 'plex_album_select' && i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const albumKey = i.values[0];
            const album = albums.find(a => a.ratingKey === albumKey);
            await showAlbumOrderSelection(i, album, member.voice.channel);
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ components: [] }).catch(() => {});
            }
        });

    } catch (error) {
        console.error('[PLEX_ALBUMS] Error:', error);

        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Search Error')
            .setDescription(`Could not search for albums: ${error.message}`)
            .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

async function handlePlaylists(interaction, member) {
    try {
        const playlistsResult = await fetch(`${client.config.plexServer}/playlists?X-Plex-Token=${client.config.plexAuthtoken}&playlistType=audio`, {
            method: 'GET',
            headers: { accept: 'application/json'}
        });

        const result = await playlistsResult.json();

        if (!result.MediaContainer.Metadata || result.MediaContainer.Metadata.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('📋 No Playlists Found')
                .setDescription('You don\'t have any playlists on your Plex server.')
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        const playlists = result.MediaContainer.Metadata.slice(0, 25);

        const options = playlists.map(playlist => ({
            label: playlist.title.substring(0, 100),
            description: `${playlist.leafCount} songs • ${Math.floor(playlist.duration / 60000)} min`,
            value: playlist.ratingKey
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('plex_playlist_select')
            .setPlaceholder('Select a playlist to play')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor(client.config.embedColour)
            .setTitle('🎵 Your Plex Playlists')
            .setDescription(`Found **${playlists.length}** playlist${playlists.length !== 1 ? 's' : ''}. Select one to play!`)
            .addFields(
                playlists.slice(0, 10).map(playlist => ({
                    name: playlist.title,
                    value: `${playlist.leafCount} songs • ${Math.floor(playlist.duration / 60000)} minutes`,
                    inline: true
                }))
            )
            .setFooter({ text: 'Select a playlist from the menu below' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.customId === 'plex_playlist_select' && i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const playlistKey = i.values[0];
            const playlist = playlists.find(p => p.ratingKey === playlistKey);
            await showPlaylistOrderSelection(i, playlist, member.voice.channel);
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ components: [] }).catch(() => {});
            }
        });

    } catch (error) {
        console.error('[PLEX_PLAYLISTS] Error:', error);

        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Error Fetching Playlists')
            .setDescription(`Could not fetch your playlists: ${error.message}`)
            .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

async function showAlbumOrderSelection(interaction, album, voiceChannel) {
    const orderSelectMenu = new StringSelectMenuBuilder()
        .setCustomId(`plex_album_order_${album.ratingKey}`)
        .setPlaceholder('Select playback order')
        .addOptions(
            { label: 'Regular Order', description: 'Play in track number order', value: 'regular', emoji: '▶️' },
            { label: 'Reverse Order', description: 'Play in reverse order', value: 'reverse', emoji: '◀️' },
            { label: 'Shuffle', description: 'Play in random order', value: 'shuffle', emoji: '🔀' }
        );

    const orderRow = new ActionRowBuilder().addComponents(orderSelectMenu);

    const orderEmbed = new EmbedBuilder()
        .setColor(client.config.embedColour)
        .setTitle('🎵 Select Playback Order')
        .setDescription(`**${album.title}** by ${album.parentTitle || 'Unknown Artist'}\n${album.trackCount || 0} tracks\n\nChoose how you want to play this album:`)
        .setFooter({ text: 'Will default to Regular Order in 30 seconds' })
        .setTimestamp();
    
    await interaction.editReply({ embeds: [orderEmbed], components: [orderRow] });

    const orderCollector = interaction.channel.createMessageComponentCollector({
        filter: col => col.customId === `plex_album_order_${album.ratingKey}` && col.user.id === interaction.user.id,
        time: 30000
    });

    orderCollector.on('collect', async orderInteraction => {
        await orderInteraction.deferUpdate();
        const order = orderInteraction.values[0];
        await loadPlexAlbum(orderInteraction, album, voiceChannel, order);
        orderCollector.stop();
    });

    orderCollector.on('end', async (collected) => {
        if (collected.size === 0) {
            await loadPlexAlbum(interaction, album, voiceChannel, 'regular');
        }
    });
}

async function showPlaylistOrderSelection(interaction, playlist, voiceChannel) {
    const orderSelectMenu = new StringSelectMenuBuilder()
        .setCustomId(`plex_playlist_order_${playlist.ratingKey}`)
        .setPlaceholder('Select playback order')
        .addOptions(
            { label: 'Regular Order', description: 'Play in original order', value: 'regular', emoji: '▶️' },
            { label: 'Reverse Order', description: 'Play in reverse order', value: 'reverse', emoji: '◀️' },
            { label: 'Shuffle', description: 'Play in random order', value: 'shuffle', emoji: '🔀' }
        );

    const orderRow = new ActionRowBuilder().addComponents(orderSelectMenu);

    const orderEmbed = new EmbedBuilder()
        .setColor(client.config.embedColour)
        .setTitle('🎵 Select Playback Order')
        .setDescription(`**${playlist.title}**\n${playlist.leafCount} songs\n\nChoose how you want to play this playlist:`)
        .setFooter({ text: 'Will default to Regular Order in 30 seconds' })
        .setTimestamp();
    
    await interaction.editReply({ embeds: [orderEmbed], components: [orderRow] });

    const orderCollector = interaction.channel.createMessageComponentCollector({
        filter: col => col.customId === `plex_playlist_order_${playlist.ratingKey}` && col.user.id === interaction.user.id,
        time: 30000
    });

    orderCollector.on('collect', async orderInteraction => {
        await orderInteraction.deferUpdate();
        const order = orderInteraction.values[0];
        
        playlist.type = 'playlist';
        await musicFuncs.plexAddPlaylist(orderInteraction, playlist, 'edit', order);
        orderCollector.stop();
    });

    orderCollector.on('end', async (collected) => {
        if (collected.size === 0) {
            playlist.type = 'playlist';
            await musicFuncs.plexAddPlaylist(interaction, playlist, 'edit', 'regular');
        }
    });
}

async function loadPlexAlbum(interaction, album, voiceChannel, order = 'regular') {
    try {
        const albumDetailsResult = await fetch(`${client.config.plexServer}/library/metadata/${album.ratingKey}/children?X-Plex-Token=${client.config.plexAuthtoken}`, {
            method: 'GET',
            headers: { accept: 'application/json'}
        });

        const albumDetails = await albumDetailsResult.json();
        const songs = albumDetails.MediaContainer.Metadata;

        if (!songs || songs.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('❌ Empty Album')
                .setDescription('This album has no songs.')
                .setTimestamp();
            
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
            return;
        }

        const loadingEmbed = new EmbedBuilder()
            .setColor(client.config.embedColour)
            .setTitle('⏳ Loading Album')
            .setDescription(`Loading **${album.title}** by ${album.parentTitle || 'Unknown Artist'} with ${songs.length} songs in **${order === 'shuffle' ? 'shuffled' : order}** order...`)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [loadingEmbed], components: [] });

        const player = useMainPlayer();
        
        let queue = player.nodes.get(interaction.guild.id);
        if (!queue) {
            queue = player.nodes.create(interaction.guild, {
                metadata: {
                    channel: interaction.channel,
                    client: interaction.guild.members.me,
                    requestedBy: interaction.user
                },
                selfDeaf: true,
                volume: client.config.defaultVolume || 50,
                leaveOnEmpty: client.config.leaveOnEmpty || false,
                leaveOnEmptyCooldown: client.config.leaveOnEmptyCooldown || 300000,
                leaveOnEnd: client.config.leaveOnEnd || false,
                leaveOnEndCooldown: client.config.leaveOnEndCooldown || 300000
            });
        }

        let songsToAdd = [...songs];
        
        if (order === 'reverse') {
            songsToAdd.reverse();
        } else if (order === 'shuffle') {
            for (let i = songsToAdd.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [songsToAdd[i], songsToAdd[j]] = [songsToAdd[j], songsToAdd[i]];
            }
        }

        let addedCount = 0;
        for (const song of songsToAdd) {
            try {
                let date = new Date(song.duration);
                const newTrack = new Track(player, {
                    title: song.title,
                    author: song.grandparentTitle || album.parentTitle || 'Unknown Artist',
                    url: `${client.config.plexServer}${song.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
                    thumbnail: `${client.config.plexServer}${song.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
                    duration: `${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`,
                    views: 0,
                    playlist: null,
                    description: album.title || null,
                    requestedBy: interaction.user,
                    source: 'arbitrary',
                    engine: `${client.config.plexServer}${song.Media[0].Part[0].key}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`,
                    queryType: QueryType.ARBITRARY
                });

                queue.addTrack(newTrack);
                addedCount++;
            } catch (error) {
                console.error(`[PLEX] Failed to add song ${song.title}:`, error);
            }
        }

        if (!queue.connection) await queue.connect(voiceChannel);
        if (!queue.isPlaying()) {
            await queue.node.play();
            queue.node.setVolume(client.config.defaultVolume);
        }

        const firstSong = songsToAdd[0];
        const orderText = order === 'regular' ? '▶️ Regular' : order === 'reverse' ? '◀️ Reverse' : '🔀 Shuffled';
        const successEmbed = new EmbedBuilder()
            .setColor(client.config.embedColour)
            .setTitle('✅ Album Added')
            .setDescription(`Added **${addedCount}** songs from **${album.title}** to the queue!`)
            .addFields(
                { name: '🎵 Now Playing', value: firstSong.title, inline: false },
                { name: '🎤 Artist', value: album.parentTitle || 'Unknown Artist', inline: true },
                { name: '📊 Total Songs', value: `${addedCount}`, inline: true },
                { name: '🔄 Order', value: orderText, inline: true }
            )
            .setTimestamp();

        let files = [];
        if (album.thumb) {
            const imageAttachment = await buildImageAttachment(`${client.config.plexServer}${album.thumb}?download=1&X-Plex-Token=${client.config.plexAuthtoken}`, { 
                name: 'coverimage.jpg', 
                description: `Cover art for ${album.title}` 
            });
            successEmbed.setThumbnail('attachment://coverimage.jpg');
            files.push(imageAttachment);
        }

        await interaction.editReply({ embeds: [successEmbed], files: files, components: [] });
        
    } catch (error) {
        console.error('[PLEX_ALBUM_LOAD] Error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Error Loading Album')
            .setDescription(`Failed to load album: ${error.message}`)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [errorEmbed], components: [] });
    }
}
