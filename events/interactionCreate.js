require("dotenv").config();
const {
    EmbedBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    Collection,
    StringSelectMenuBuilder,
    TextInputBuilder,
    ModalBuilder,
    AttachmentBuilder,
} = require("discord.js");
const { useMainPlayer, QueueRepeatMode } = require("discord-player");
const { clearNpControlMessages } = require("../utils/npControlMessages");
const fs = require("fs");
const { buildRequestedByFooter, buildTrackLinkText, getDisplayName, translate } = require("../utils/botText");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueEmptyResponse,
    getQueueNotPlayingResponse,
} = require("../utils/interactionGuards");
const cooldowns = new Map();

module.exports = {
    name: "interactionCreate",
    async execute(interaction) {
        //Generate all of the commands
        if (interaction.isCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) return;
            if (!cooldowns.has(command.data.name)) {
                cooldowns.set(command.data.name, new Collection());
            }

            const curtime = Date.now();
            const timestamp = cooldowns.get(command.data.name);
            const coolamount = command.cooldown * 1000;

            if (timestamp.has(interaction.user.id)) {
                const expiration = timestamp.get(interaction.user.id) + coolamount;

                if (curtime < expiration) {
                    const timeleft = (expiration - curtime) / 1000;

                    return interaction.reply({
                        content: translate(interaction, "errors.cooldown", {
                            seconds: Math.ceil(timeleft),
                            command: command.data.name,
                        }),
                        ephemeral: true,
                    });
                }
            }

            timestamp.set(interaction.user.id, curtime);
            setTimeout(() => timestamp.delete(interaction.user.id), coolamount);

            try {
                await command.execute(interaction);
            } catch (err) {
                if (err) console.error(err);

                await interaction.reply({
                    content: translate(interaction, "errors.commandExecution"),
                    ephemeral: true,
                });
            }
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.customId == "select") {
                //console.log(interaction.values);
                //console.log(interaction)
                const value = interaction.values[0];
                //console.log(value)

                const guildid = interaction.guild.id;
                const dirs = [];
                const categories = [];

                fs.readdirSync("./commands/").forEach((dir) => {
                    let commands = fs.readdirSync(`./commands/${dir}`).filter((file) => file.endsWith(".js"));
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
                                    description: file.data.description,
                                },
                            });
                        } else {
                            //Finished code for displaying each subcommand
                            if (file.data.options.length == 0 || file.data.options[0].type != null) {
                                cmds.push({
                                    name: dir,
                                    commands: {
                                        name: file.data.name,
                                        description: file.data.description,
                                    },
                                });
                            } else {
                                file.data.options.forEach((id) => {
                                    cmds.push({
                                        name: dir,
                                        commands: {
                                            name: file.data.name + " " + id.name,
                                            description: id.description,
                                        },
                                    });
                                });
                            }
                        }
                    });

                    //console.log(cmds);
                    categories.push(cmds.filter((categ) => categ.name === dir));
                });

                let page = 0;
                const emojis = {
                    music: "🎵",
                    utilities: "🛄",
                };

                const description = {
                    music: translate(interaction, "help.musicDescription"),
                    utilities: translate(interaction, "help.utilitiesDescription"),
                };

                const menuoptions = [
                    {
                        label: translate(interaction, "help.homeOptionLabel"),
                        description: translate(interaction, "help.homeOptionDescription"),
                        emoji: "🏡",
                        value: "home",
                    },
                ];

                categories.forEach((cat) => {
                    dirs.push(cat[0].name);
                });

                const embed = new EmbedBuilder()
                    .setAuthor({
                        name: interaction.client.user.tag,
                        iconURL: interaction.client.user.displayAvatarURL(),
                    })
                    .setColor(client.config.embedColour)
                    .setTitle(translate(interaction, "help.title"))
                    .setDescription(translate(interaction, "help.homeDescription"))
                    .setTimestamp()
                    .setFooter({
                        text: translate(interaction, "help.footer", { user: getDisplayName(interaction.user) }),
                    });

                dirs.forEach((dir, index) => {
                    menuoptions.push({
                        label: `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()}`,
                        description: translate(interaction, "help.categoryPageDescription", {
                            category: dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase(),
                        }),
                        emoji: `${emojis[dir] || ""}`,
                        value: `${page++}`,
                    });
                });

                if (value && value !== "home") {
                    embed.fields = [];
                    embed.setTitle(
                        translate(interaction, "help.categoryTitle", {
                            category:
                                categories[value][0].name.charAt(0).toUpperCase() +
                                categories[value][0].name.slice(1).toLowerCase(),
                            emoji: emojis[categories[value][0].name] ? emojis[categories[value][0].name] : "",
                        }),
                    );

                    categories[value].forEach((cmd) => {
                        embed.addFields({
                            name: `\`/${cmd.commands.name}\``,
                            value: `${cmd.commands.description || translate(interaction, "help.noDescription")}`,
                            inline: true,
                        });
                    });

                    var getchannel = interaction.guild.channels.cache.find(
                        (channel) => channel.id === interaction.channelId,
                    );

                    if (getchannel) {
                        //Check if bot has view channel perms
                        if (
                            !interaction.guild.members.me
                                .permissionsIn(interaction.channel.id)
                                .has(PermissionFlagsBits.ViewChannel)
                        ) {
                            console.log(`No Perms! (ID: ${guildid})`);
                            interaction.reply({
                                content: translate(interaction, "errors.noViewChannel"),
                                ephemeral: true,
                            });
                            return;
                        } else {
                            getchannel.messages
                                .fetch(interaction.message.id)
                                .then(async (msg) => await msg.edit({ embeds: [embed], fetchReply: true }));
                        }
                    } else {
                        console.log(`Cannot find the channel! (ID: ${guildid})`);
                    }
                }

                if (value === "home") {
                    embed.fields = [];
                    embed.setTitle(translate(interaction, "help.title"));

                    dirs.forEach((dir) => {
                        embed.addFields({
                            name: `${emojis[dir] || ""} ${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()}`,
                            value: `${
                                description[dir]
                                    ? description[dir]
                                    : translate(interaction, "help.categoryFallback", {
                                          category: dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase(),
                                      })
                            }`,
                            inline: false,
                        });
                    });

                    var getchannel = interaction.guild.channels.cache.find(
                        (channel) => channel.id === interaction.channelId,
                    );

                    if (getchannel) {
                        //Check if bot has view channel perms
                        if (
                            !interaction.guild.members.me
                                .permissionsIn(interaction.channel.id)
                                .has(PermissionFlagsBits.ViewChannel)
                        ) {
                            console.log(`No Perms! (ID: ${guildid})`);
                            interaction.reply({
                                content: translate(interaction, "errors.noViewChannel"),
                                ephemeral: true,
                            });
                            return;
                        } else {
                            getchannel.messages
                                .fetch(interaction.message.id)
                                .then(async (msg) => await msg.edit({ embeds: [embed], fetchReply: true }));
                        }
                    } else {
                        console.log(`Cannot find the channel! (ID: ${guildid})`);
                    }
                }

                interaction.deferUpdate();
            }
        }

        //Check for button interactions
        else if (interaction.isButton()) {
            if (interaction.customId == "queue-delete") {
                if (!(await ensureDjAccess(interaction))) return;

                interaction.message.delete();
            }

            if (interaction.customId == "queue-pageleft") {
                const player = useMainPlayer();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

                if (!(await ensureDjAccess(interaction))) return;

                if (global.page == 1)
                    return interaction.reply({
                        content: translate(interaction, "queue.alreadyFirstPage"),
                        ephemeral: true,
                    });
                global.page = page - 1;
                interaction.message.delete();

                const pageStart = 10 * (page - 1);
                const pageEnd = pageStart + 10;
                const currentMusic = queue.current;
                const musiclist = queue.tracks.slice(pageStart, pageEnd).map((m, i) => {
                    return `${i + pageStart + 1}# **${m.title}** ([link](${m.url}))`;
                });

                const queueembed = new EmbedBuilder()
                    .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                    .setColor(client.config.embedColour)
                    .setTitle(translate(interaction, "queue.title"))
                    .setDescription(
                        `${musiclist.join("\n")}${queue.tracks.length > pageEnd ? `\n${translate(interaction, "queue.moreTracks", { count: queue.tracks.length - pageEnd })}` : ""}`,
                    )
                    .addField(
                        translate(interaction, "queue.nowPlayingField"),
                        `**${currentMusic.title}** ${buildTrackLinkText(currentMusic)}`,
                    )
                    .setTimestamp()
                    .setFooter(buildRequestedByFooter(interaction, interaction.user));

                const components = [
                    (actionbutton = new MessageActionRow().addComponents(
                        new MessageButton().setCustomId("queue-delete").setStyle("DANGER").setLabel("🗑️"),
                        //.addOptions(options)
                        new MessageButton()
                            .setCustomId("queue-pageleft")
                            .setStyle("PRIMARY")
                            .setLabel(translate(interaction, "queue.previousPage")),
                        new MessageButton()
                            .setCustomId("queue-pageright")
                            .setStyle("PRIMARY")
                            .setLabel(translate(interaction, "queue.nextPage")),
                    )),
                ];

                interaction.reply({ embeds: [queueembed], components });
            }

            if (interaction.customId == "queue-pageright") {
                const player = useMainPlayer();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

                if (!(await ensureDjAccess(interaction))) return;

                var pageStart = 10 * (page - 1);
                var pageEnd = pageStart + 10;

                if (queue.tracks.length <= pageEnd)
                    return interaction.reply({
                        content: translate(interaction, "queue.alreadyLastPage"),
                        ephemeral: true,
                    });
                global.page = page + 1;
                pageStart = 10 * (page - 1);
                pageEnd = pageStart + 10;
                interaction.message.delete();

                const currentMusic = queue.current;
                const musiclist = queue.tracks.slice(pageStart, pageEnd).map((m, i) => {
                    return `${i + pageStart + 1}# **${m.title}** ([link](${m.url}))`;
                });

                const queueembed = new EmbedBuilder()
                    .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                    .setColor(client.config.embedColour)
                    .setTitle(translate(interaction, "queue.title"))
                    .setDescription(
                        `${musiclist.join("\n")}${queue.tracks.length > pageEnd ? `\n${translate(interaction, "queue.moreTracks", { count: queue.tracks.length - pageEnd })}` : ""}`,
                    )
                    .addField(
                        translate(interaction, "queue.nowPlayingField"),
                        `**${currentMusic.title}** ${buildTrackLinkText(currentMusic)}`,
                    )
                    .setTimestamp()
                    .setFooter(buildRequestedByFooter(interaction, interaction.user));

                const components = [
                    (actionbutton = new MessageActionRow().addComponents(
                        new MessageButton().setCustomId("queue-delete").setStyle("DANGER").setLabel("🗑️"),
                        //.addOptions(options)
                        new MessageButton()
                            .setCustomId("queue-pageleft")
                            .setStyle("PRIMARY")
                            .setLabel(translate(interaction, "queue.previousPage")),
                        new MessageButton()
                            .setCustomId("queue-pageright")
                            .setStyle("PRIMARY")
                            .setLabel(translate(interaction, "queue.nextPage")),
                    )),
                ];

                interaction.reply({ embeds: [queueembed], components });
            }

            if (interaction.customId == "np-delete") {
                if (!(await ensureDjAccess(interaction))) return;

                interaction.message.delete();
            }

            if (interaction.customId == "np-back") {
                if (!(await ensureDjAccess(interaction))) return;

                if (!(await ensureInVoiceChannel(interaction))) return;
                if (!(await ensureSameVoiceChannel(interaction))) return;

                const player = useMainPlayer();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

                const previousTracks = queue.history.tracks.toArray();
                if (!previousTracks[0])
                    return interaction.reply({
                        content: translate(interaction, "np.backMissing"),
                        ephemeral: true,
                    });

                const backembed = new EmbedBuilder()
                    .setAuthor({
                        name: interaction.client.user.tag,
                        iconURL: interaction.client.user.displayAvatarURL(),
                    })
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                    .setColor(client.config.embedColour)
                    .setTitle(translate(interaction, "np.backTitle"))
                    .setDescription(
                        translate(interaction, "np.backDescription", {
                            title: previousTracks[0].title,
                            link: buildTrackLinkText(previousTracks[0]),
                        }),
                    )
                    .setTimestamp()
                    .setFooter(buildRequestedByFooter(interaction, interaction.user));

                try {
                    queue.history.back();
                    interaction.reply({ embeds: [backembed] });
                } catch (err) {
                    interaction.reply({
                        content: translate(interaction, "errors.genericAction", {
                            action: "returning to the previous song",
                        }),
                        ephemeral: true,
                    });
                }
            }

            if (interaction.customId == "np-pauseresume") {
                if (!(await ensureDjAccess(interaction))) return;
                if (!(await ensureInVoiceChannel(interaction))) return;
                if (!(await ensureSameVoiceChannel(interaction))) return;

                const player = useMainPlayer();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));
                var checkPause = queue.node.isPaused();

                var coverImage = new AttachmentBuilder(queue.currentTrack.thumbnail, {
                    name: "coverimage.jpg",
                    description: `Song Cover Image for ${queue.currentTrack.title}`,
                });
                const pauseembed = new EmbedBuilder()
                    .setAuthor({
                        name: interaction.client.user.tag,
                        iconURL: interaction.client.user.displayAvatarURL(),
                    })
                    .setThumbnail("attachment://coverimage.jpg")
                    .setColor(client.config.embedColour)
                    .setTitle(translate(interaction, "np.pauseTitle"))
                    .setDescription(
                        translate(interaction, "np.pauseDescription", {
                            state: translate(interaction, checkPause ? "np.pauseStateResumed" : "np.pauseStatePaused"),
                            title: queue.currentTrack.title,
                            link: buildTrackLinkText(queue.currentTrack),
                        }),
                    )
                    .setTimestamp()
                    .setFooter(buildRequestedByFooter(interaction, interaction.user));

                try {
                    queue.node.setPaused(!queue.node.isPaused());
                    interaction.reply({ embeds: [pauseembed], files: [coverImage] });
                } catch (err) {
                    interaction.reply({
                        content: translate(interaction, "errors.genericAction", {
                            action: checkPause ? "resuming" : "pausing",
                        }),
                        ephemeral: true,
                    });
                }
            }

            if (interaction.customId == "np-skip") {
                if (!(await ensureDjAccess(interaction))) return;
                if (!(await ensureInVoiceChannel(interaction))) return;
                if (!(await ensureSameVoiceChannel(interaction))) return;

                const player = useMainPlayer();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

                const queuedTracks = queue.tracks.toArray();
                if (!queuedTracks[0]) return interaction.reply(getQueueEmptyResponse(interaction));

                var coverImage = new AttachmentBuilder(queuedTracks[0].thumbnail, {
                    name: "coverimage.jpg",
                    description: `Song Cover Image for ${queuedTracks[0].title}`,
                });
                const skipembed = new EmbedBuilder()
                    .setAuthor({
                        name: interaction.client.user.tag,
                        iconURL: interaction.client.user.displayAvatarURL(),
                    })
                    .setThumbnail("attachment://coverimage.jpg")
                    .setColor(client.config.embedColour)
                    .setTitle(translate(interaction, "np.skipTitle"))
                    .setDescription(
                        translate(interaction, "np.skipDescription", {
                            title: queuedTracks[0].title,
                            link: buildTrackLinkText(queuedTracks[0]),
                        }),
                    )
                    .setTimestamp()
                    .setFooter(buildRequestedByFooter(interaction, interaction.user));

                try {
                    queue.node.skip();
                    interaction.reply({ embeds: [skipembed], files: [coverImage] });
                } catch (err) {
                    interaction.reply({
                        content: translate(interaction, "errors.genericAction", { action: "skipping the song" }),
                        ephemeral: true,
                    });
                }
            }

            if (interaction.customId == "np-clear") {
                if (!(await ensureDjAccess(interaction))) return;
                if (!(await ensureInVoiceChannel(interaction))) return;
                if (!(await ensureSameVoiceChannel(interaction))) return;

                const player = useMainPlayer();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));
                if (queue.tracks.size == 0)
                    return interaction.reply({
                        content: translate(interaction, "queue.emptyQueued"),
                        ephemeral: true,
                    });

                const clearembed = new EmbedBuilder()
                    .setAuthor({
                        name: interaction.client.user.tag,
                        iconURL: interaction.client.user.displayAvatarURL(),
                    })
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                    .setColor(client.config.embedColour)
                    .setTitle(translate(interaction, "queue.clearTitle"))
                    .setDescription(translate(interaction, "queue.clearDescription"))
                    .setTimestamp()
                    .setFooter(buildRequestedByFooter(interaction, interaction.user));

                try {
                    queue.tracks.clear();
                    interaction.reply({ embeds: [clearembed] });
                } catch (err) {
                    interaction.reply({
                        content: translate(interaction, "errors.genericAction", { action: "clearing the queue" }),
                        ephemeral: true,
                    });
                }
            }

            if (interaction.customId == "np-volumeadjust") {
                if (!(await ensureDjAccess(interaction))) return;
                if (!(await ensureInVoiceChannel(interaction))) return;
                if (!(await ensureSameVoiceChannel(interaction))) return;

                const player = useMainPlayer();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

                //
                const modal = new ModalBuilder()
                    .setCustomId(`adjust_volume_${interaction.guild.id}`)
                    .setTitle(translate(interaction, "np.volumeModalTitle", { volume: queue.node.volume }))
                    .addComponents([
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId("volume-input")
                                .setLabel(translate(interaction, "np.volumeModalLabel"))
                                .setStyle(1)
                                .setMinLength(1)
                                .setMaxLength(6)
                                .setPlaceholder(translate(interaction, "np.volumeModalPlaceholder"))
                                .setRequired(true),
                        ),
                    ]);

                await interaction.showModal(modal);

                const filter = (interaction) => interaction.customId.includes(`adjust_volume_${interaction.guild.id}`);
                interaction
                    .awaitModalSubmit({ filter, time: 240000 })
                    .then(async (submit) => {
                        var userResponse = submit.fields.getTextInputValue("volume-input");

                        if (userResponse < 0 || userResponse > 100 || isNaN(userResponse))
                            return submit.reply({
                                content: translate(submit, "np.volumeModalInvalid"),
                                ephemeral: true,
                            });

                        const volumeembed = new EmbedBuilder()
                            .setAuthor({
                                name: interaction.client.user.tag,
                                iconURL: interaction.client.user.displayAvatarURL(),
                            })
                            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                            .setColor(client.config.embedColour)
                            .setTitle(translate(interaction, "np.volumeTitle"))
                            .setDescription(translate(interaction, "np.volumeDescription", { volume: userResponse }))
                            .setTimestamp()
                            .setFooter(buildRequestedByFooter(interaction, interaction.user));

                        try {
                            queue.node.setVolume(Number(userResponse));
                            submit.reply({ embeds: [volumeembed] });
                        } catch (err) {
                            console.log(err);
                            submit.reply({
                                content: translate(interaction, "errors.genericAction", {
                                    action: "adjusting the volume",
                                }),
                                ephemeral: true,
                            });
                        }
                    })
                    .catch(console.error);
            }

            if (interaction.customId == "np-loop") {
                if (!(await ensureDjAccess(interaction))) return;
                if (!(await ensureInVoiceChannel(interaction))) return;
                if (!(await ensureSameVoiceChannel(interaction))) return;

                const player = useMainPlayer();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

                if (queue.repeatMode === QueueRepeatMode.TRACK) {
                    const loopmode = QueueRepeatMode.OFF;
                    queue.setRepeatMode(loopmode);

                    const loopembed = new EmbedBuilder()
                        .setAuthor({
                            name: interaction.client.user.tag,
                            iconURL: interaction.client.user.displayAvatarURL(),
                        })
                        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                        .setColor(client.config.embedColour)
                        .setTitle(translate(interaction, "np.loopOffTitle"))
                        .setDescription(translate(interaction, "np.loopOffDescription"))
                        .setTimestamp()
                        .setFooter(buildRequestedByFooter(interaction, interaction.user));

                    interaction.reply({ embeds: [loopembed] });
                } else {
                    const loopmode = QueueRepeatMode.TRACK;
                    queue.setRepeatMode(loopmode);

                    const loopembed = new EmbedBuilder()
                        .setAuthor({
                            name: interaction.client.user.tag,
                            iconURL: interaction.client.user.displayAvatarURL(),
                        })
                        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                        .setColor(client.config.embedColour)
                        .setTitle(translate(interaction, "np.loopTrackTitle"))
                        .setDescription(translate(interaction, "np.loopTrackDescription"))
                        .setTimestamp()
                        .setFooter(buildRequestedByFooter(interaction, interaction.user));

                    interaction.reply({ embeds: [loopembed] });
                }
            }

            if (interaction.customId == "np-shuffle") {
                if (!(await ensureDjAccess(interaction))) return;
                if (!(await ensureInVoiceChannel(interaction))) return;
                if (!(await ensureSameVoiceChannel(interaction))) return;

                const player = useMainPlayer();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));
                if (queue.tracks.size == 0)
                    return interaction.reply({
                        content: translate(interaction, "queue.emptyQueued"),
                        ephemeral: true,
                    });

                const shuffleembed = new EmbedBuilder()
                    .setAuthor({
                        name: interaction.client.user.tag,
                        iconURL: interaction.client.user.displayAvatarURL(),
                    })
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                    .setColor(client.config.embedColour)
                    .setTitle(translate(interaction, "queue.shuffleTitle"))
                    .setDescription(translate(interaction, "queue.shuffleDescription"))
                    .setTimestamp()
                    .setFooter(buildRequestedByFooter(interaction, interaction.user));

                try {
                    queue.tracks.shuffle();
                    interaction.reply({ embeds: [shuffleembed] });
                } catch (err) {
                    interaction.reply({
                        content: translate(interaction, "errors.genericAction", { action: "shuffling the queue" }),
                        ephemeral: true,
                    });
                }
            }

            if (interaction.customId == "np-stop") {
                if (!(await ensureDjAccess(interaction))) return;
                if (!(await ensureInVoiceChannel(interaction))) return;
                if (!(await ensureSameVoiceChannel(interaction))) return;

                const player = useMainPlayer();
                var queue = player.nodes.get(interaction.guild.id);
                if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

                const stopembed = new EmbedBuilder()
                    .setAuthor({
                        name: interaction.client.user.tag,
                        iconURL: interaction.client.user.displayAvatarURL(),
                    })
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                    .setColor(client.config.embedColour)
                    .setTitle(translate(interaction, "np.stopTitle"))
                    .setDescription(translate(interaction, "np.stopDescription"))
                    .setTimestamp()
                    .setFooter(buildRequestedByFooter(interaction, interaction.user));

                try {
                    await clearNpControlMessages(queue);
                    queue.delete();
                    interaction.reply({ embeds: [stopembed] });
                } catch (err) {
                    interaction.reply({
                        content: translate(interaction, "errors.genericAction", { action: "stopping the queue" }),
                        ephemeral: true,
                    });
                }
            }
        }
    },
};
