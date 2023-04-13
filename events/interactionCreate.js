const { MessageActionRow, Modal, TextInputComponent, MessageEmbed, MessageButton, Collection } = require("discord.js");
const ebmusic = require("../models/ebmusic.js");
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

                    return interaction.reply({ content: `❌ | Cooldown Alert: Please wait **${timeleft.toFixed(0)}** more seconds before using the **/${command.data.name}** command again!`, ephemeral: true })
                }
            }

            timestamp.set(interaction.user.id, curtime);
            setTimeout(() => timestamp.delete(interaction.user.id), coolamount);
        
            try {
                await command.execute(interaction);
            } 
            
            catch(err) {
                if (err) console.error(err);
        
                //await interaction.reply({
                    //content: "❌ | Apologies, an error occurred while executing your command. A log has already been sent to the developer :D",
                    //ephemeral: true
                //});
            }
        }
        
        //Check for select menu interactions
        else if (interaction.isSelectMenu()) {
            
        }
        
        //Check for button interactions
        else if (interaction.isButton()) {
            if (interaction.customId == "queue-delete") {
                const guildid = interaction.guild.id;
                const DJCheck = await ebmusic.findOne({
                    where: {
                        GuildID: guildid
                    }
                });

                if (DJCheck) {
                    if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
                }

                interaction.message.delete()
            }

            if (interaction.customId == "queue-pageleft") {
                const queue = player.getQueue(interaction.guild)
                if (global.page == null) return interaction.reply({ content: "❌ | The queue has already ended!", ephemeral: true })

                const guildid = interaction.guild.id;
                const DJCheck = await ebmusic.findOne({
                    where: {
                        GuildID: guildid
                    }
                });

                if (DJCheck) {
                    if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
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
                .setColor(0xFF0000)
                .setTitle(`Current Music Queue 🎵`)
                .setDescription(`${musiclist.join('\n')}${queue.tracks.length > pageEnd ? `\n...and ${queue.tracks.length - pageEnd} more track(s)` : ''}`)
                .addField('Now Playing ▶️', `**${currentMusic.title}** | ([Link](${currentMusic.url}))`)
                .setTimestamp()
                .setFooter(`Requested by: ${interaction.user.tag}`)

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
                const queue = player.getQueue(interaction.guild)
                if (global.page == null) return interaction.reply({ content: "❌ | The queue has already ended!", ephemeral: true })
                
                const guildid = interaction.guild.id;
                const DJCheck = await ebmusic.findOne({
                    where: {
                        GuildID: guildid
                    }
                });

                if (DJCheck) {
                    if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
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
                .setColor(0xFF0000)
                .setTitle(`Current Music Queue 🎵`)
                .setDescription(`${musiclist.join('\n')}${queue.tracks.length > pageEnd ? `\n...and ${queue.tracks.length - pageEnd} more track(s)` : ''}`)
                .addField('Now Playing ▶️', `**${currentMusic.title}** | ([Link](${currentMusic.url}))`)
                .setTimestamp()
                .setFooter(`Requested by: ${interaction.user.tag}`)

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
                const guildid = interaction.guild.id;
                const DJCheck = await ebmusic.findOne({
                    where: {
                        GuildID: guildid
                    }
                });

                if (DJCheck) {
                    if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
                }

                interaction.message.delete()
            }

            if (interaction.customId == "np-back") {
                const queue = player.getQueue(interaction.guild);
                if (queue == null) return interaction.reply({ content: "❌ | The queue has already ended!", ephemeral: true })
                
                const guildid = interaction.guild.id;
                const DJCheck = await ebmusic.findOne({
                    where: {
                        GuildID: guildid
                    }
                });

                if (DJCheck) {
                    if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
                }

                await queue.back()
        
                const backembed = new MessageEmbed()
                .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setColor(0xFF0000)
                .setTitle(`Playing previous song ⏮️`)
                .setDescription(`Now playing: ${queue.current.title} ([Link](${queue.current.url}))!`)
                .setTimestamp()
                .setFooter(`Requested by: ${interaction.user.tag}`)

                interaction.reply({ embeds: [backembed] })
            }

            if (interaction.customId == "np-pauseresume") {
                const queue = player.getQueue(interaction.guild);
                if (queue == null) return interaction.reply({ content: "❌ | The queue has already ended!", ephemeral: true })

                const guildid = interaction.guild.id;
                const DJCheck = await ebmusic.findOne({
                    where: {
                        GuildID: guildid
                    }
                });

                if (DJCheck) {
                    if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
                }

                if (queue.setPaused() == true) {
                    queue.setPaused(false);

                    const resumeembed = new MessageEmbed()
                    .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                    .setThumbnail(queue.current.thumbnail)
                    .setColor(0xFF0000)
                    .setTitle(`Song resumed ▶️`)
                    .setDescription(`The current song ${queue.current.title} ([Link](${queue.current.url})) has been resumed!`)
                    .setTimestamp()
                    .setFooter(`Requested by: ${interaction.user.tag}`)

                    interaction.reply({ embeds: [resumeembed] })
                }

                else {
                    queue.setPaused(true);

                    const pauseembed = new MessageEmbed()
                    .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                    .setThumbnail(queue.current.thumbnail)
                    .setColor(0xFF0000)
                    .setTitle(`Song paused ⏸️`)
                    .setDescription(`The current song ${queue.current.title} ([Link](${queue.current.url})) has been paused!`)
                    .setTimestamp()
                    .setFooter(`Requested by: ${interaction.user.tag}`)

                    interaction.reply({ embeds: [pauseembed] })
                }
            }

            if (interaction.customId == "np-skip") {
                const queue = player.getQueue(interaction.guild);
                if (queue == null) return interaction.reply({ content: "❌ | The queue has already ended!", ephemeral: true })
                
                const guildid = interaction.guild.id;
                const DJCheck = await ebmusic.findOne({
                    where: {
                        GuildID: guildid
                    }
                });

                if (DJCheck) {
                    if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
                }

                interaction.message.delete()
                queue.skip();

                const skipembed = new MessageEmbed()
                .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                .setThumbnail(queue.tracks[0].thumbnail)
                .setColor(0xFF0000)
                .setTitle(`Song skipped ⏭️`)
                .setDescription(`Now playing: ${queue.tracks[0]} ([Link](${queue.tracks[0].url}))`)
                .setTimestamp()
                .setFooter(`Requested by: ${interaction.user.tag}`)

                interaction.reply({ embeds: [skipembed] })
            }

            if (interaction.customId == "np-clear") {
                const queue = player.getQueue(interaction.guild);
                if (queue == null) return interaction.reply({ content: "❌ | The queue has already ended!", ephemeral: true })

                const guildid = interaction.guild.id;
                const DJCheck = await ebmusic.findOne({
                    where: {
                        GuildID: guildid
                    }
                });

                if (DJCheck) {
                    if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
                }

                await queue.clear();
        
                const clearembed = new MessageEmbed()
                .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setColor(0xFF0000)
                .setTitle(`Queue clear 🧹`)
                .setDescription(`The entire music queue has been cleared!`)
                .setTimestamp()
                .setFooter(`Requested by: ${interaction.user.tag}`)

                interaction.reply({ embeds: [clearembed] })
            }

            if (interaction.customId == "np-volumeup") {
                const queue = player.getQueue(interaction.guild);
                if (queue == null) return interaction.reply({ content: "❌ | The queue has already ended!", ephemeral: true })
                
                const guildid = interaction.guild.id;
                const DJCheck = await ebmusic.findOne({
                    where: {
                        GuildID: guildid
                    }
                });

                if (DJCheck) {
                    if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
                }

                if (queue.volume == 100) return interaction.reply({ content: "❌ | The volume is already set to the max!", ephemeral: true })
                var totalvol = queue.volume + 10
                queue.setVolume(totalvol);

                const volumeembed = new MessageEmbed()
                .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setColor(0xFF0000)
                .setTitle(`Volume increased 🎧`)
                .setDescription(`The volume has been set to **${totalvol}%**!`)
                .setTimestamp()
                .setFooter(`Requested by: ${interaction.user.tag}`)

                interaction.reply({ embeds: [volumeembed] })
            }

            if (interaction.customId == "np-volumedown") {
                const queue = player.getQueue(interaction.guild);
                if (queue == null) return interaction.reply({ content: "❌ | The queue has already ended!", ephemeral: true })
                
                const guildid = interaction.guild.id;
                const DJCheck = await ebmusic.findOne({
                    where: {
                        GuildID: guildid
                    }
                });

                if (DJCheck) {
                    if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
                }

                if (queue.volume == 0) return interaction.reply({ content: "❌ | The volume is already set to the minimum!", ephemeral: true })
                var totalvol = queue.volume - 10
                queue.setVolume(totalvol);

                const volumeembed = new MessageEmbed()
                .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setColor(0xFF0000)
                .setTitle(`Volume decreased 🎧`)
                .setDescription(`The volume has been set to **${totalvol}%**!`)
                .setTimestamp()
                .setFooter(`Requested by: ${interaction.user.tag}`)

                interaction.reply({ embeds: [volumeembed] })
            }

            if (interaction.customId == "np-loop") {
                const { QueueRepeatMode } = require('discord-player');
                const queue = player.getQueue(interaction.guild);

                if (queue == null) return interaction.reply({ content: "❌ | The queue has already ended!", ephemeral: true })
                
                const guildid = interaction.guild.id;
                const DJCheck = await ebmusic.findOne({
                    where: {
                        GuildID: guildid
                    }
                });

                if (DJCheck) {
                    if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
                }

                if (queue.repeatMode === QueueRepeatMode.TRACK) {
                    const loopmode = QueueRepeatMode.OFF;
                    queue.setRepeatMode(loopmode);

                    const mode = 'Loop mode off 📴';
                    const loopembed = new MessageEmbed()
                    .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                    .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                    .setColor(0xFF0000)
                    .setTitle(mode)
                    .setDescription(`The loop mode has been set to **off**!`)
                    .setTimestamp()
                    .setFooter(`Requested by: ${interaction.user.tag}`)

                    interaction.reply({ embeds: [loopembed] })
                }

                else {
                    const loopmode = QueueRepeatMode.TRACK;
                    queue.setRepeatMode(loopmode);

                    const mode = 'Loop mode on 🔂';
                    const loopembed = new MessageEmbed()
                    .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                    .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                    .setColor(0xFF0000)
                    .setTitle(mode)
                    .setDescription(`The loop mode has been set to the **current track**!`)
                    .setTimestamp()
                    .setFooter(`Requested by: ${interaction.user.tag}`)

                    interaction.reply({ embeds: [loopembed] })
                }
            }

            if (interaction.customId == "np-shuffle") {
                const queue = player.getQueue(interaction.guild);
                if (queue == null) return interaction.reply({ content: "❌ | The queue has already ended!", ephemeral: true })
                
                const guildid = interaction.guild.id;
                const DJCheck = await ebmusic.findOne({
                    where: {
                        GuildID: guildid
                    }
                });

                if (DJCheck) {
                    if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
                }

                await queue.shuffle();
        
                const shuffleembed = new MessageEmbed()
                .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setColor(0xFF0000)
                .setTitle(`Queue shuffle 🔀`)
                .setDescription(`The entire music queue has been shuffled!`)
                .setTimestamp()
                .setFooter(`Requested by: ${interaction.user.tag}`)

                interaction.reply({ embeds: [shuffleembed] })
            }

            if (interaction.customId == "np-stop") {
                const queue = player.getQueue(interaction.guild);
                if (queue == null) return interaction.reply({ content: "❌ | The queue has already ended!", ephemeral: true })
                
                const guildid = interaction.guild.id;
                const DJCheck = await ebmusic.findOne({
                    where: {
                        GuildID: guildid
                    }
                });

                if (DJCheck) {
                    if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
                }

                await queue.destroy();
                global.page = null

                const stopembed = new MessageEmbed()
                .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                .setThumbnail(interaction.guild.iconURL({dynamic: true}))
                .setColor(0xFF0000)
                .setTitle(`Stopped music 🛑`)
                .setDescription(`Music has been stopped... leaving the channel!`)
                .setTimestamp()
                .setFooter(`Requested by: ${interaction.user.tag}`)

                interaction.reply({ embeds: [stopembed] })
            }
        }
    }
}