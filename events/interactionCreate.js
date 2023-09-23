require("dotenv").config();
const { EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, Collection, StringSelectMenuBuilder, AttachmentBuilder } = require("discord.js");
const { Player, QueueRepeatMode } = require('discord-player');
const fs = require("fs");
const cooldowns = new Map();

module.exports = {
    name: "interactionCreate",
    async execute (interaction){
        //Generate all of the commands
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) return;
            if (!cooldowns.has(command.data.name)) {
                cooldowns.set(command.data.name, new Collection());
            }

            const curtime = Date.now();
            const timestamp = cooldowns.get(command.data.name);
            const coolamount = (command.cooldown) * 1000;

            if (timestamp.has(interaction.user.id)) {
                const expiration = timestamp.get(interaction.user.id) + coolamount;

                if (curtime < expiration) {
                    const timeleft = (expiration - curtime) / 1000;

                    return interaction.reply({ content: `⏱️ | Cooldown Alert: Please wait **${Match.ceil(timeleft)}** more seconds before using the **/${command.data.name}** command again!`, ephemeral: true })
                }
            }

            timestamp.set(interaction.user.id, curtime);
            setTimeout(() => timestamp.delete(interaction.user.id), coolamount);
        
            try {
                await command.execute(interaction);
            } 
            
            catch(err) {
                if (err) console.error(err);
        
                await interaction.reply({ content: "❌ | Apologies, an error occurred while executing your command. Check the logs for the error.", ephemeral: true });
            }
        }

        else if (interaction.isStringSelectMenu()) {
            if (interaction.customId == "select") {
                //console.log(interaction.values);
                //console.log(interaction)
                const value = interaction.values[0];
                //console.log(value)
    
                const guildid = interaction.guild.id;
                const dirs = [];
                const categories = [];
    
                fs.readdirSync("./commands/").forEach((dir) => {
                    let commands = fs.readdirSync(`./commands/${dir}`).filter(file => file.endsWith(".js"));
                    var cmds = [];
                    commands.map((command) => {
                        let file = require(`../commands/${dir}/${command}`);
                        //console.log(file.data.options.length)
                        //console.log(file.data.options)
    
                        if (dir == "configuration" || dir == "utilities") {
                            cmds.push({
                                name: dir,
                                commands: {
                                    name: file.data.name,
                                    description: file.data.description
                                }
                            })
                        }
    
                        else {
                            //Finished code for displaying each subcommand
                            if (file.data.options.length == 0 || file.data.options[0].type != null) {
                                cmds.push({
                                    name: dir,
                                    commands: {
                                        name: file.data.name,
                                        description: file.data.description
                                    }
                                })
                            }
    
                            else {
                                file.data.options.forEach(id => {
                                    cmds.push({
                                        name: dir,
                                        commands: {
                                            name: file.data.name + " " + id.name,
                                            description: id.description
                                        }
                                    })
                                })
                            }
                        }
                    });
    
                    //console.log(cmds);
                    categories.push(cmds.filter(categ => categ.name === dir));
                })
    
                let page = 0;
                const emojis = {
                    "music": "🎵",
                    "utilities": "🛄",
                };
        
                const description = {
                    "music": "Music commands.",
                    "utilities": "Generally useful commands to use.",
                }
    
                const menuoptions = [
                    {
                        label: "Home",
                        description: "Home Page",
                        emoji: "🏡",
                        value: "home"
                    }
                ]
    
                categories.forEach(cat => {
                    dirs.push(cat[0].name);
                });
    
                const embed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                //.setThumbnail(interaction.client.user.displayAvatarURL({dynamic: true}))
                .setColor(client.config.embedColour)
                .setTitle('Elite Bot - Help Menu')
                .setDescription(`Select a category via the menu below to view the commands available. 📢 \n\nIf you require assistance or are experiencing a persistant bug, please create a bug report using **/elitebot bugreport** or by joining the **[Support Discord Server](https://discord.elitegami.ng)**. 🆘\n\nFor more in-depth guides and help setting things up, please head over to the documentation which is always up-to-date and heavily detailed. 📄\n\n<:Rules:1039597018064093325> Docs & Invite: __**https://elite-bot.com**__\n<:LockedChannel:1039597788931035237> Privacy Policy: __**https://elite-bot.com/docs/privacy-policy**__\n<:HammerAction:1040729990876119050> Terms of Service: __**https://elite-bot.com/docs/terms-of-service/**__`)
                .setTimestamp()
                .setFooter({ text: `/help | Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })
    
                dirs.forEach((dir, index) => {
                    /*embed.addFields({
                        name: `${emojis[dir] ||''} ${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()}`,
                        value: `${description[dir] ? description[dir] : `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()} Commands`}`, inline: false
                    })*/
        
                    menuoptions.push({
                        label: `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()}`,
                        description: `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()} commands page`,
                        emoji: `${emojis[dir] || ''}`,
                        value: `${page++}`
                    })
                });
        
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                    .setCustomId('select')
                    .setPlaceholder('Click to see all the categories')
                    .addOptions(menuoptions)
                )
    
                if(value && value !== 'home') {
                    embed.fields = [];
                    embed.setTitle(`Help Menu - ${categories[value][0].name.charAt(0).toUpperCase() + categories[value][0].name.slice(1).toLowerCase()} Category! ${emojis[categories[value][0].name] ? emojis[categories[value][0].name]: ''}`)
    
                    categories[value].forEach(cmd => {
                        embed.addFields({
                            name: `\`/${cmd.commands.name}\``,
                            value: `${cmd.commands.description || 'No description'}`,
                            inline: true
                        })
                    });
    
                    var getchannel = interaction.guild.channels.cache.find(channel => channel.id === (interaction.channelId))
    
                    if (getchannel) {
                        //Check if bot has view channel perms
                        if (!interaction.guild.members.me.permissionsIn(interaction.channel.id).has(PermissionFlagsBits.ViewChannel)) {
                            console.log(`No Perms! (ID: ${guildid})`);
                            interaction.reply({ content: `Error: I do not have permission to view this channel and cannot edit the help message!`, ephemeral: true });
                            return;
                        }
    
                        else {
                            getchannel.messages.fetch(interaction.message.id)
                            .then(async msg => await msg.edit({ embeds: [embed], components: [row], fetchReply: true }));
                        }
                    }
    
                    else {
                        console.log(`Cannot find the channel! (ID: ${guildid})`)
                    }
                }
    
                if (value === 'home') {
                    embed.fields = [];
                    embed.setTitle('Elite Bot - Help Menu')
    
                    dirs.forEach(dir => {
                        embed.addFields({
                            name: `${emojis[dir] ||''} ${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()}`,
                            value: `${description[dir] ? description[dir] : `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()} Commands`}`, inline: false
                        })
                    });
                    
                    var getchannel = interaction.guild.channels.cache.find(channel => channel.id === (interaction.channelId))
    
                    if (getchannel) {
                        //Check if bot has view channel perms
                        if (!interaction.guild.members.me.permissionsIn(interaction.channel.id).has(PermissionFlagsBits.ViewChannel)) {
                            console.log(`No Perms! (ID: ${guildid})`);
                            interaction.reply({ content: `Error: I do not have permission to view this channel and cannot edit the help message!`, ephemeral: true });
                            return;
                        }
    
                        else {
                            getchannel.messages.fetch(interaction.message.id)
                            .then(async msg => await msg.edit({ embeds: [embed], components: [row], fetchReply: true }));
                        }
                    }
    
                    else {
                        console.log(`Cannot find the channel! (ID: ${guildid})`)
                    }
                }
    
                interaction.deferUpdate();
            }
        }
        
        //Check for button interactions
        else if (interaction.isButton()) {
            if (interaction.customId == "queue-delete") {
                if (client.config.enableDjMode) {
                    if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
                }

                interaction.message.delete()
            }

            if (interaction.customId == "queue-pageleft") {
                const player = Player.singleton();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });

                if (client.config.enableDjMode) {
                    if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
                }

                if (global.page == 1) return interaction.reply({ content: "❌ | The queue is already on the first page!", ephemeral: true })
                global.page = (page - 1)
                interaction.message.delete()

                const pageStart = 10 * (page - 1);
                const pageEnd = pageStart + 10;
                const currentMusic = queue.current;
                const musiclist = queue.tracks.slice(pageStart, pageEnd).map((m, i) => {
                    return `${i + pageStart + 1}# **${m.title}** ([link](${m.url}))`;
                });

                const queueembed = new MessageEmbed()
                .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setColor(client.config.embedColour)
                .setTitle(`Current Music Queue 🎵`)
                .setDescription(`${musiclist.join('\n')}${queue.tracks.length > pageEnd ? `\n...and ${queue.tracks.length - pageEnd} more track(s)` : ''}`)
                .addField('Now Playing ▶️', `**${currentMusic.title}** ${currentMusic.queryType != 'arbitrary' ? `([Link](${currentMusic.url}))` : ''}`)
                .setTimestamp()
                .setFooter(`Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}`)

                const components = [
                    actionbutton = new MessageActionRow().addComponents(
                        new MessageButton()
                            .setCustomId("queue-delete")
                            .setStyle("DANGER")
                            .setLabel("🗑️"),
                            //.addOptions(options)
                        new MessageButton()
                            .setCustomId("queue-pageleft")
                            .setStyle("PRIMARY")
                            .setLabel("⬅️ Previous Page"),
                        new MessageButton()
                            .setCustomId("queue-pageright")
                            .setStyle("PRIMARY")
                            .setLabel("➡️ Next Page")
                    )
                ];

                interaction.reply({ embeds: [queueembed], components })
            }

            if (interaction.customId == "queue-pageright") {
                const player = Player.singleton();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });
                
                if (client.config.enableDjMode) {
                    if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
                }

                var pageStart = 10 * (page - 1);
                var pageEnd = pageStart + 10;

                if (queue.tracks.length <= pageEnd) return interaction.reply({ content: "❌ | The queue is already on the last page!", ephemeral: true })
                global.page = (page + 1)
                pageStart = 10 * (page - 1);
                pageEnd = pageStart + 10;
                interaction.message.delete()

                const currentMusic = queue.current;
                const musiclist = queue.tracks.slice(pageStart, pageEnd).map((m, i) => {
                    return `${i + pageStart + 1}# **${m.title}** ([link](${m.url}))`;
                });

                const queueembed = new MessageEmbed()
                .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setColor(client.config.embedColour)
                .setTitle(`Current Music Queue 🎵`)
                .setDescription(`${musiclist.join('\n')}${queue.tracks.length > pageEnd ? `\n...and ${queue.tracks.length - pageEnd} more track(s)` : ''}`)
                .addField('Now Playing ▶️', `**${currentMusic.title}** ${currentMusic.queryType != 'arbitrary' ? `([Link](${currentMusic.url}))` : ''}`)
                .setTimestamp()
                .setFooter(`Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}`)

                const components = [
                    actionbutton = new MessageActionRow().addComponents(
                        new MessageButton()
                            .setCustomId("queue-delete")
                            .setStyle("DANGER")
                            .setLabel("🗑️"),
                            //.addOptions(options)
                        new MessageButton()
                            .setCustomId("queue-pageleft")
                            .setStyle("PRIMARY")
                            .setLabel("⬅️ Previous Page"),
                        new MessageButton()
                            .setCustomId("queue-pageright")
                            .setStyle("PRIMARY")
                            .setLabel("➡️ Next Page")
                    )
                ];

                interaction.reply({ embeds: [queueembed], components })
            }

            if (interaction.customId == "np-delete") {
                if (client.config.enableDjMode) {
                    if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
                }

                interaction.message.delete()
            }

            if (interaction.customId == "np-back") {
                if (client.config.enableDjMode) {
                    if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
                }
                
                if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
                if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        
                const player = Player.singleton();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });

                const previousTracks = queue.history.tracks.toArray();
                if (!previousTracks[0]) return interaction.reply({ content: `❌ | There is no music history prior to the current song. Please try again.`, ephemeral: true });
        
                const backembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setColor(client.config.embedColour)
                .setTitle(`Playing previous song ⏮️`)
                .setDescription(`Returning next to the previous song ${previousTracks[0].title} ${queuedTracks[0].queryType != 'arbitrary' ? `([Link](${previousTracks[0].url}))` : ''}!`)
                .setTimestamp()
                .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                try {
                    queue.history.back();
                    interaction.reply({ embeds: [backembed] })
                }

                catch (err) {
                    interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error returning to the previous song. Please try again.`, ephemeral: true });
                }
            }

            if (interaction.customId == "np-pauseresume") {
                if (client.config.enableDjMode) {
                    if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
                }

                if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
                if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });

                const player = Player.singleton();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });
                var checkPause = queue.node.isPaused();

                var coverImage = new AttachmentBuilder(queue.currentTrack.thumbnail, { name: 'coverimage.jpg', description: `Song Cover Image for ${queue.currentTrack.title}` })
                const pauseembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail('attachment://coverimage.jpg')
                .setColor(client.config.embedColour)
                .setTitle(`Song paused ⏸️`)
                .setDescription(`Playback has been **${checkPause ? 'resumed' : 'paused'}**. Currently playing ${queue.currentTrack.title} ${queue.currentTrack.queryType != 'arbitrary' ? `([Link](${queue.currentTrack.url}))` : ''}!`)
                .setTimestamp()
                .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                try {
                    queue.node.setPaused(!queue.node.isPaused());
                    interaction.reply({ embeds: [pauseembed], files: [coverImage] })
                }
        
                catch (err) {
                    interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error ${checkPause ? 'resuming' : 'pausing'} the song. Please try again.`, ephemeral: true });
                }
            }

            if (interaction.customId == "np-skip") {
                if (client.config.enableDjMode) {
                    if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
                }

                if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
                if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });

                const player = Player.singleton();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });

                const queuedTracks = queue.tracks.toArray();
                if (!queuedTracks[0]) return interaction.reply({ content: `❌ | There is no music is currently in the queue!`, ephemeral: true });

                var coverImage = new AttachmentBuilder(queuedTracks[0].thumbnail, { name: 'coverimage.jpg', description: `Song Cover Image for ${queuedTracks[0].title}` })
                const skipembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail('attachment://coverimage.jpg')
                .setColor(client.config.embedColour)
                .setTitle(`Song skipped ⏭️`)
                .setDescription(`Now playing: ${queuedTracks[0].title} ${queuedTracks[0].queryType != 'arbitrary' ? `([Link](${queuedTracks[0].url}))` : ''}`)
                .setTimestamp()
                .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                try {
                    queue.node.skip();
                    interaction.reply({ embeds: [skipembed], files: [coverImage] })
                }
                
                catch (err) {
                    interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error skipping the song. Please try again.`, ephemeral: true });
                }
            }

            if (interaction.customId == "np-clear") {
                if (client.config.enableDjMode) {
                    if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
                }

                if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
                if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });

                const player = Player.singleton();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });

                const clearembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setColor(client.config.embedColour)
                .setTitle(`Queue clear 🧹`)
                .setDescription(`The entire music queue has been cleared!`)
                .setTimestamp()
                .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                try {
                    queue.tracks.clear();
                    interaction.reply({ embeds: [clearembed] })
                }

                catch (err) {
                    interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error clearing the queue. Please try again.`, ephemeral: true });
                }
            }

            if (interaction.customId == "np-volumeup") {
                if (client.config.enableDjMode) {
                    if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
                }

                if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
                if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });

                const player = Player.singleton();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });

                var totalVol = queue.node.volume + 10
                if (totalVol > 100) return interaction.reply({ content: "❌ | The volume is already set to the max!", ephemeral: true })

                const volumeembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setColor(client.config.embedColour)
                .setTitle(`Volume increased 🎧`)
                .setDescription(`The volume has been set to **${totalVol}%**!`)
                .setTimestamp()
                .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                try {
                    queue.node.setVolume(totalVol);
                    interaction.reply({ embeds: [volumeembed] })
                }
        
                catch (err) {
                    interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error adjusting the volume. Please try again.`, ephemeral: true });
                }
            }

            if (interaction.customId == "np-volumedown") {
                if (client.config.enableDjMode) {
                    if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
                }

                if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
                if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });

                const player = Player.singleton();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });

                var totalVol = queue.node.volume - 10
                if (totalVol < 0) return interaction.reply({ content: "❌ | The volume is already set to the max!", ephemeral: true })

                const volumeembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setColor(client.config.embedColour)
                .setTitle(`Volume decreased 🎧`)
                .setDescription(`The volume has been set to **${totalVol}%**!`)
                .setTimestamp()
                .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                try {
                    queue.node.setVolume(totalVol);
                    interaction.reply({ embeds: [volumeembed] })
                }
        
                catch (err) {
                    interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error adjusting the volume. Please try again.`, ephemeral: true });
                }
            }

            if (interaction.customId == "np-loop") {
                if (client.config.enableDjMode) {
                    if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
                }

                if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
                if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });

                const player = Player.singleton();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });

                if (queue.repeatMode === QueueRepeatMode.TRACK) {
                    const loopmode = QueueRepeatMode.OFF;
                    queue.setRepeatMode(loopmode);

                    const mode = 'Loop mode off 📴';
                    const loopembed = new EmbedBuilder()
                    .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                    .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                    .setColor(client.config.embedColour)
                    .setTitle(mode)
                    .setDescription(`The loop mode has been set to **off**!`)
                    .setTimestamp()
                    .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                    interaction.reply({ embeds: [loopembed] })
                }

                else {
                    const loopmode = QueueRepeatMode.TRACK;
                    queue.setRepeatMode(loopmode);

                    const mode = 'Loop mode on 🔂';
                    const loopembed = new EmbedBuilder()
                    .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                    .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                    .setColor(client.config.embedColour)
                    .setTitle(mode)
                    .setDescription(`The loop mode has been set to the **current track**!`)
                    .setTimestamp()
                    .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                    interaction.reply({ embeds: [loopembed] })
                }
            }

            if (interaction.customId == "np-shuffle") {
                if (client.config.enableDjMode) {
                    if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
                }

                if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
                if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });

                const player = Player.singleton();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });

                const shuffleembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setColor(client.config.embedColour)
                .setTitle(`Queue shuffle 🔀`)
                .setDescription(`The entire music queue has been shuffled!`)
                .setTimestamp()
                .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                try {
                    queue.tracks.shuffle();
                    interaction.reply({ embeds: [shuffleembed] })
                }

                catch (err) {
                    interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error shuffling the queue. Please try again.`, ephemeral: true });
                }
            }

            if (interaction.customId == "np-stop") {
                if (client.config.enableDjMode) {
                    if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
                }

                if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
                if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });

                const player = Player.singleton();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });

                const stopembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setColor(client.config.embedColour)
                .setTitle(`Stopped music 🛑`)
                .setDescription(`Music has been stopped... leaving the channel!`)
                .setTimestamp()
                .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

                try {
                    queue.delete();
                    interaction.reply({ embeds: [stopembed] })
                }

                catch (err) {
                    interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error stopping the queue. Please try again.`, ephemeral: true });
                }
            }
        }
    }
}