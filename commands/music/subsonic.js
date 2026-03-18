const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { getSubsonicClient, isSubsonicEnabled } = require('../../utils/subsonicAPI');
const { useMainPlayer, Track, QueryType } = require('discord-player');
const { buildImageAttachment } = require('../../utils/utilityFunctions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("subsonic")
        .setDescription("Play music from your Subsonic server")
        .addSubcommand(subcommand =>
            subcommand
                .setName("play")
                .setDescription("Search and play songs from your Subsonic server")
                .addStringOption(option =>
                    option.setName("query")
                        .setDescription("Search for a song, album, or artist")
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName("playnext")
                        .setDescription("Add song to the front of the queue")
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName("playlists")
                .setDescription("View and play your Subsonic playlists"))
        .addSubcommand(subcommand =>
            subcommand
                .setName("albums")
                .setDescription("Search and play full albums from your Subsonic server")
                .addStringOption(option =>
                    option.setName("query")
                        .setDescription("Search for an album by name or artist")
                        .setRequired(true))),
    cooldown: 5,
    async execute(interaction) {
        if (client.config.enableDjMode) {
            if (!interaction.member.roles.cache.has(client.config.djRole)) {
                return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
            }
        }

        await interaction.deferReply();

        if (!isSubsonicEnabled()) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Subsonic Disabled')
                .setDescription('Subsonic integration is not enabled on this bot.')
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        const subsonicClient = getSubsonicClient();
        if (!subsonicClient) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Configuration Error')
                .setDescription('Subsonic is not properly configured. Please check the bot configuration.')
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
            await handlePlay(interaction, subsonicClient, member);
        } else if (subcommand === 'playlists') {
            await handlePlaylists(interaction, subsonicClient, member);
        } else if (subcommand === 'albums') {
            await handleAlbums(interaction, subsonicClient, member);
        }
    }
};

async function handlePlay(interaction, subsonicClient, member) {
    const query = interaction.options.getString('query');
    const playNext = interaction.options.getBoolean('playnext') || false;

    try {
        const searchResults = await subsonicClient.search(query);

        if (!searchResults.song || searchResults.song.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🔍 No Results Found')
                .setDescription(`No songs found for: **${query}**`)
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        const songs = searchResults.song.slice(0, 25);

        if (songs.length === 1) {
            return await playSong(interaction, subsonicClient, songs[0], member.voice.channel, playNext);
        }

        const options = songs.map((song, index) => ({
            label: song.title.substring(0, 100),
            description: `${song.artist || 'Unknown'} • ${song.album || 'Unknown Album'}`.substring(0, 100),
            value: song.id
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('subsonic_song_select')
            .setPlaceholder('Select a song to play')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor(client.config.embedColour)
            .setTitle('🔍 Search Results')
            .setDescription(`Found **${songs.length}** song${songs.length !== 1 ? 's' : ''} for: **${query}**`)
            .addFields(
                songs.slice(0, 10).map((song, index) => ({
                    name: `${index + 1}. ${song.title}`,
                    value: `${song.artist || 'Unknown Artist'} • ${song.album || 'Unknown Album'}`,
                    inline: false
                }))
            )
            .setFooter({ text: 'Select a song from the menu below' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [row] });

        // Create collector for select menu
        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.customId === 'subsonic_song_select' && i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            await i.deferUpdate();
            
            const songId = i.values[0];
            const selectedSong = songs.find(s => s.id === songId);
            
            await playSong(i, subsonicClient, selectedSong, member.voice.channel, playNext);
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ components: [] }).catch(() => {});
            }
        });

    } catch (error) {
        console.error('[SUBSONIC_PLAY] Error:', error);

        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Search Error')
            .setDescription(`Could not search for songs: ${error.message}`)
            .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

async function handlePlaylists(interaction, subsonicClient, member) {
    try {
        const playlists = await subsonicClient.getPlaylists();

        if (!playlists || playlists.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('📋 No Playlists Found')
                .setDescription('You don\'t have any playlists on your Subsonic server.')
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        const options = playlists.slice(0, 25).map(playlist => ({
            label: playlist.name.substring(0, 100),
            description: `${playlist.songCount} songs • ${Math.floor(playlist.duration / 60)} min`,
            value: playlist.id
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('subsonic_playlist_select')
            .setPlaceholder('Select a playlist to play')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor(client.config.embedColour)
            .setTitle('🎵 Your Subsonic Playlists')
            .setDescription(`Found **${playlists.length}** playlist${playlists.length !== 1 ? 's' : ''}. Select one to play!`)
            .addFields(
                playlists.slice(0, 10).map(playlist => ({
                    name: playlist.name,
                    value: `${playlist.songCount} songs • ${Math.floor(playlist.duration / 60)} minutes`,
                    inline: true
                }))
            )
            .setFooter({ text: 'Select a playlist from the menu below' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [row] });

        // Create collector for select menu
        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.customId === 'subsonic_playlist_select' && i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            await i.deferUpdate();
            
            try {
                const playlistId = i.values[0];
                const playlist = await subsonicClient.getPlaylist(playlistId);

                if (!playlist.entry || playlist.entry.length === 0) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('❌ Empty Playlist')
                        .setDescription('This playlist has no songs.')
                        .setTimestamp();
                    
                    await i.editReply({ embeds: [errorEmbed], components: [] });
                    return;
                }

                const orderSelectMenu = new StringSelectMenuBuilder()
                    .setCustomId('subsonic_playlist_order')
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
                    .setDescription(`**${playlist.name}** (${playlist.entry.length} songs)\n\nChoose how you want to play this playlist:`)
                    .setFooter({ text: 'Will default to Regular Order in 30 seconds' })
                    .setTimestamp();
                
                await i.editReply({ embeds: [orderEmbed], components: [orderRow] });

                const orderCollector = interaction.channel.createMessageComponentCollector({
                    filter: col => col.customId === 'subsonic_playlist_order' && col.user.id === interaction.user.id,
                    time: 30000
                });

                orderCollector.on('collect', async orderInteraction => {
                    await orderInteraction.deferUpdate();
                    const order = orderInteraction.values[0];
                    await loadSubsonicPlaylist(orderInteraction, subsonicClient, playlist, member.voice.channel, order);
                    orderCollector.stop();
                });

                orderCollector.on('end', async (collected) => {
                    if (collected.size === 0) {
                        await loadSubsonicPlaylist(i, subsonicClient, playlist, member.voice.channel, 'regular');
                    }
                });
                
            } catch (error) {
                console.error('[SUBSONIC_PLAYLIST] Error:', error);
                
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ Error Loading Playlist')
                    .setDescription(`Failed to load playlist: ${error.message}`)
                    .setTimestamp();
                
                await i.editReply({ embeds: [errorEmbed], components: [] });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ components: [] }).catch(() => {});
            }
        });

    } catch (error) {
        console.error('[SUBSONIC_PLAYLISTS] Error:', error);

        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Error Fetching Playlists')
            .setDescription(`Could not fetch your playlists: ${error.message}`)
            .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

async function handleAlbums(interaction, subsonicClient, member) {
    const query = interaction.options.getString('query');

    try {
        const searchResults = await subsonicClient.search(query, 0, 25, 0);

        if (!searchResults.album || searchResults.album.length === 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('🔍 No Albums Found')
                .setDescription(`No albums found for: **${query}**`)
                .setTimestamp();
            
            return await interaction.editReply({ embeds: [errorEmbed] });
        }

        const albums = searchResults.album.slice(0, 25);

        if (albums.length === 1) {
            const album = await subsonicClient.getAlbum(albums[0].id);
            return await showAlbumOrderSelection(interaction, subsonicClient, album, member.voice.channel);
        }

        const options = albums.map((album, index) => ({
            label: album.name.substring(0, 100),
            description: `${album.artist || 'Unknown Artist'} • ${album.songCount || 0} songs`.substring(0, 100),
            value: album.id
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('subsonic_album_select')
            .setPlaceholder('Select an album to play')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setColor(client.config.embedColour)
            .setTitle('🔍 Album Search Results')
            .setDescription(`Found **${albums.length}** album${albums.length !== 1 ? 's' : ''} for: **${query}**`)
            .addFields(
                albums.slice(0, 10).map((album, index) => ({
                    name: `${index + 1}. ${album.name}`,
                    value: `${album.artist || 'Unknown Artist'} • ${album.songCount || 0} songs`,
                    inline: false
                }))
            )
            .setFooter({ text: 'Select an album from the menu below' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], components: [row] });

        const collector = interaction.channel.createMessageComponentCollector({
            filter: i => i.customId === 'subsonic_album_select' && i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async i => {
            await i.deferUpdate();
            
            const albumId = i.values[0];
            const album = await subsonicClient.getAlbum(albumId);
            
            await showAlbumOrderSelection(i, subsonicClient, album, member.voice.channel);
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ components: [] }).catch(() => {});
            }
        });

    } catch (error) {
        console.error('[SUBSONIC_ALBUMS] Error:', error);

        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Search Error')
            .setDescription(`Could not search for albums: ${error.message}`)
            .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

async function showAlbumOrderSelection(interaction, subsonicClient, album, voiceChannel) {
    const orderSelectMenu = new StringSelectMenuBuilder()
        .setCustomId('subsonic_album_order')
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
        .setDescription(`**${album.name}** by ${album.artist || 'Unknown Artist'}\\n${album.song?.length || 0} tracks\\n\\nChoose how you want to play this album:`)
        .setFooter({ text: 'Will default to Regular Order in 30 seconds' })
        .setTimestamp();
    
    await interaction.editReply({ embeds: [orderEmbed], components: [orderRow] });

    const orderCollector = interaction.channel.createMessageComponentCollector({
        filter: col => col.customId === 'subsonic_album_order' && col.user.id === interaction.user.id,
        time: 30000
    });

    orderCollector.on('collect', async orderInteraction => {
        await orderInteraction.deferUpdate();
        const order = orderInteraction.values[0];
        await loadSubsonicAlbum(orderInteraction, subsonicClient, album, voiceChannel, order);
        orderCollector.stop();
    });

    orderCollector.on('end', async (collected) => {
        if (collected.size === 0) {
            await loadSubsonicAlbum(interaction, subsonicClient, album, voiceChannel, 'regular');
        }
    });
}

async function loadSubsonicPlaylist(interaction, subsonicClient, playlist, voiceChannel, order = 'regular') {
    try {
        const loadingEmbed = new EmbedBuilder()
            .setColor(client.config.embedColour)
            .setTitle('⏳ Loading Playlist')
            .setDescription(`Loading **${playlist.name}** with ${playlist.entry.length} songs in **${order === 'shuffle' ? 'shuffled' : order}** order...`)
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

        let songsToAdd = [...playlist.entry];
        
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
                const streamUrl = subsonicClient.getStreamUrl(song.id);
                const duration = song.duration ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}` : '0:00';
                
                const newTrack = new Track(player, {
                    title: song.title,
                    author: song.artist || 'Unknown Artist',
                    url: streamUrl,
                    thumbnail: song.coverArt ? subsonicClient.getCoverArtUrl(song.coverArt) : null,
                    duration: duration,
                    views: 0,
                    playlist: null,
                    description: song.album || null,
                    requestedBy: interaction.user,
                    source: 'arbitrary',
                    engine: streamUrl,
                    queryType: QueryType.ARBITRARY
                });

                queue.addTrack(newTrack);
                addedCount++;
            } catch (error) {
                console.error(`[SUBSONIC] Failed to add song ${song.title}:`, error);
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
            .setTitle('✅ Playlist Added')
            .setDescription(`Added **${addedCount}** songs from **${playlist.name}** to the queue!`)
            .addFields(
                { name: '🎵 Now Playing', value: firstSong.title, inline: false },
                { name: '🎤 Artist', value: firstSong.artist || 'Unknown Artist', inline: true },
                { name: '📊 Total Songs', value: `${addedCount}`, inline: true },
                { name: '🔄 Order', value: orderText, inline: true }
            )
            .setTimestamp();

        let files = [];
        if (firstSong.coverArt) {
            const coverArtUrl = subsonicClient.getCoverArtUrl(firstSong.coverArt);
            const imageAttachment = await buildImageAttachment(coverArtUrl, { 
                name: 'coverimage.jpg', 
                description: `Cover art for ${playlist.name}` 
            });
            successEmbed.setThumbnail('attachment://coverimage.jpg');
            files.push(imageAttachment);
        }

        await interaction.editReply({ embeds: [successEmbed], files: files, components: [] });
        
    } catch (error) {
        console.error('[SUBSONIC_PLAYLIST_LOAD] Error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Error Loading Playlist')
            .setDescription(`Failed to load playlist: ${error.message}`)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [errorEmbed], components: [] });
    }
}

async function loadSubsonicAlbum(interaction, subsonicClient, album, voiceChannel, order = 'regular') {
    try {
        if (!album.song || album.song.length === 0) {
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
            .setDescription(`Loading **${album.name}** by ${album.artist || 'Unknown Artist'} with ${album.song.length} songs in **${order === 'shuffle' ? 'shuffled' : order}** order...`)
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

        let songsToAdd = [...album.song];
        
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
                const streamUrl = subsonicClient.getStreamUrl(song.id);
                const duration = song.duration ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}` : '0:00';
                
                const newTrack = new Track(player, {
                    title: song.title,
                    author: song.artist || album.artist || 'Unknown Artist',
                    url: streamUrl,
                    thumbnail: album.coverArt ? subsonicClient.getCoverArtUrl(album.coverArt) : null,
                    duration: duration,
                    views: 0,
                    playlist: null,
                    description: album.name || null,
                    requestedBy: interaction.user,
                    source: 'arbitrary',
                    engine: streamUrl,
                    queryType: QueryType.ARBITRARY
                });

                queue.addTrack(newTrack);
                addedCount++;
            } catch (error) {
                console.error(`[SUBSONIC] Failed to add song ${song.title}:`, error);
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
            .setDescription(`Added **${addedCount}** songs from **${album.name}** to the queue!`)
            .addFields(
                { name: '🎵 Now Playing', value: firstSong.title, inline: false },
                { name: '🎤 Artist', value: album.artist || 'Unknown Artist', inline: true },
                { name: '📊 Total Songs', value: `${addedCount}`, inline: true },
                { name: '🔄 Order', value: orderText, inline: true }
            )
            .setTimestamp();

        let files = [];
        if (album.coverArt) {
            const coverArtUrl = subsonicClient.getCoverArtUrl(album.coverArt);
            const imageAttachment = await buildImageAttachment(coverArtUrl, { 
                name: 'coverimage.jpg', 
                description: `Cover art for ${album.name}` 
            });
            successEmbed.setThumbnail('attachment://coverimage.jpg');
            files.push(imageAttachment);
        }

        await interaction.editReply({ embeds: [successEmbed], files: files, components: [] });
        
    } catch (error) {
        console.error('[SUBSONIC_ALBUM_LOAD] Error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Error Loading Album')
            .setDescription(`Failed to load album: ${error.message}`)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [errorEmbed], components: [] });
    }
}

async function playSong(interaction, subsonicClient, song, voiceChannel, playNext = false) {
    try {
        const streamUrl = subsonicClient.getStreamUrl(song.id);

        const loadingEmbed = new EmbedBuilder()
            .setColor(client.config.embedColour)
            .setTitle('⏳ Loading Song')
            .setDescription(`Loading **${song.title}** by ${song.artist || 'Unknown Artist'}...`)
            .setTimestamp();
        
        await interaction.editReply({ embeds: [loadingEmbed], components: [] });

        const player = useMainPlayer();
        const duration = song.duration ? `${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}` : '0:00';
        
        const newTrack = new Track(player, {
            title: song.title,
            author: song.artist || 'Unknown Artist',
            url: streamUrl,
            thumbnail: song.coverArt ? subsonicClient.getCoverArtUrl(song.coverArt) : null,
            duration: duration,
            views: 0,
            playlist: null,
            description: song.album || null,
            requestedBy: interaction.user,
            source: 'arbitrary',
            engine: streamUrl,
            queryType: QueryType.ARBITRARY
        });

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

        if (playNext) {
            queue.insertTrack(newTrack, 0);
        } else {
            queue.addTrack(newTrack);
        }

        if (!queue.connection) await queue.connect(voiceChannel);
        if (!queue.isPlaying()) {
            await queue.node.play();
            queue.node.setVolume(client.config.defaultVolume);
        }

        const queuePosition = playNext ? 'Next in queue' : `Position ${queue.tracks.size} in queue`;
        const successEmbed = new EmbedBuilder()
            .setColor(client.config.embedColour)
            .setTitle(playNext ? '⏭️ Added Next from Subsonic' : '🎵 Added to Queue from Subsonic')
            .setDescription(`**${song.title}**`)
            .addFields(
                { name: '🎤 Artist', value: song.artist || 'Unknown Artist', inline: true },
                { name: '💿 Album', value: song.album || 'Unknown Album', inline: true },
                { name: '⏱️ Duration', value: duration, inline: true },
                { name: '📍 Queue', value: queuePosition, inline: true }
            )
            .setTimestamp();

        let files = [];
        if (song.coverArt) {
            const coverArtUrl = subsonicClient.getCoverArtUrl(song.coverArt);
            const imageAttachment = await buildImageAttachment(coverArtUrl, { 
                name: 'coverimage.jpg', 
                description: `Cover art for ${song.title}` 
            });
            successEmbed.setThumbnail('attachment://coverimage.jpg');
            files.push(imageAttachment);
        }

        await interaction.editReply({ embeds: [successEmbed], files: files, components: [] });

    } catch (error) {
        console.error('[SUBSONIC_PLAY] Playback error:', error);

        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Playback Error')
            .setDescription(`Could not play the song: ${error.message}`)
            .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed], components: [] });
    }
}
