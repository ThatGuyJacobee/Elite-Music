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
    MessageFlags,
} = require("discord.js");
const { useMainPlayer, QueueRepeatMode } = require("discord-player");
const { clearNpControlMessages } = require("../utils/npControlMessages");
const {
    buildRequestedByFooter,
    buildCoverImageDescription,
    buildTrackLinkText,
    getDisplayName,
    translate,
    translateGenericAction,
    translateHelpCategory,
} = require("../utils/botText");
const { HELP_CATEGORY_EMOJIS, loadHelpCommandCategories } = require("../utils/helpCommands");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueEmptyResponse,
    getQueueNotPlayingResponse,
} = require("../utils/interactionGuards");
const { skipCurrentTrack } = require("../utils/sharedFunctions");
const {
    cancel,
    clear,
    getIntendedVolume,
    setIntendedVolume,
    startNaturalMonitor,
    transition,
} = require("../utils/softTransitions");
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
            const coolamount = Number(command.cooldown) > 0 ? command.cooldown * 1000 : 0;

            if (coolamount > 0) {
                if (timestamp.has(interaction.user.id)) {
                    const expiration = timestamp.get(interaction.user.id) + coolamount;

                    if (curtime < expiration) {
                        const timeleft = (expiration - curtime) / 1000;

                        return interaction.reply({
                            content: translate(interaction, "errors.cooldown", {
                                seconds: Math.ceil(timeleft),
                                command: command.data.name,
                            }),
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                }

                timestamp.set(interaction.user.id, curtime);
                setTimeout(() => timestamp.delete(interaction.user.id), coolamount);
            }

            try {
                await command.execute(interaction);
            } catch (err) {
                if (err) console.error(err);

                await interaction.reply({
                    content: translate(interaction, "errors.commandExecution"),
                    flags: MessageFlags.Ephemeral,
                });
            }
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.customId == "select") {
                //console.log(interaction.values);
                //console.log(interaction)
                const value = interaction.values[0];
                //console.log(value)

                const guildid = interaction.guild.id;
                const categories = loadHelpCommandCategories(interaction);
                const dirs = categories.map((cat) => cat[0].name);
                let page = 0;

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
                    const categoryLabel = translateHelpCategory(interaction, dir);

                    menuoptions.push({
                        label: categoryLabel,
                        description: translate(interaction, "help.categoryPageDescription", {
                            category: categoryLabel,
                        }),
                        emoji: `${HELP_CATEGORY_EMOJIS[dir] || ""}`,
                        value: `${page++}`,
                    });
                });

                if (value && value !== "home") {
                    embed.fields = [];
                    embed.setTitle(
                        translate(interaction, "help.categoryTitle", {
                            category: translateHelpCategory(interaction, categories[value][0].name),
                            emoji: HELP_CATEGORY_EMOJIS[categories[value][0].name]
                                ? HELP_CATEGORY_EMOJIS[categories[value][0].name]
                                : "",
                        }),
                    );

                    categories[value].forEach((cmd) => {
                        embed.addFields({
                            name: `\`/${cmd.commands.name}\``,
                            value: cmd.commands.description,
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
                                flags: MessageFlags.Ephemeral,
                            });
                            return;
                        } else {
                            getchannel.messages
                                .fetch(interaction.message.id)
                                .then(async (msg) => await msg.edit({ embeds: [embed] }));
                        }
                    } else {
                        console.log(`Cannot find the channel! (ID: ${guildid})`);
                    }
                }

                if (value === "home") {
                    embed.fields = [];
                    embed.setTitle(translate(interaction, "help.title"));

                    dirs.forEach((dir) => {
                        const categoryLabel = translateHelpCategory(interaction, dir);

                        embed.addFields({
                            name: `${HELP_CATEGORY_EMOJIS[dir] || ""} ${categoryLabel}`,
                            value: `${
                                description[dir]
                                    ? description[dir]
                                    : translate(interaction, "help.categoryFallback", {
                                          category: categoryLabel,
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
                                flags: MessageFlags.Ephemeral,
                            });
                            return;
                        } else {
                            getchannel.messages
                                .fetch(interaction.message.id)
                                .then(async (msg) => await msg.edit({ embeds: [embed] }));
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
                        flags: MessageFlags.Ephemeral,
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
                        `**${currentMusic.title}** ${buildTrackLinkText(currentMusic, interaction)}`,
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
                        flags: MessageFlags.Ephemeral,
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
                        `**${currentMusic.title}** ${buildTrackLinkText(currentMusic, interaction)}`,
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
                        flags: MessageFlags.Ephemeral,
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
                            link: buildTrackLinkText(previousTracks[0], interaction),
                        }),
                    )
                    .setTimestamp()
                    .setFooter(buildRequestedByFooter(interaction, interaction.user));

                await interaction.reply({ embeds: [backembed] });
                try {
                    const returned = await transition(queue, () => queue.history.back());
                    if (returned === false)
                        return interaction.editReply({
                            content: translate(interaction, "errors.transitionInProgress"),
                            embeds: [],
                        });
                } catch (err) {
                    interaction.editReply({
                        content: translateGenericAction(interaction, "returningToPreviousSong"),
                        embeds: [],
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
                    description: buildCoverImageDescription(interaction, "song", queue.currentTrack.title),
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
                            link: buildTrackLinkText(queue.currentTrack, interaction),
                        }),
                    )
                    .setTimestamp()
                    .setFooter(buildRequestedByFooter(interaction, interaction.user));

                try {
                    cancel(queue);
                    queue.node.setPaused(!queue.node.isPaused());
                    if (checkPause) startNaturalMonitor(queue);
                    interaction.reply({ embeds: [pauseembed], files: [coverImage] });
                } catch (err) {
                    interaction.reply({
                        content: translateGenericAction(interaction, checkPause ? "resuming" : "pausing"),
                        flags: MessageFlags.Ephemeral,
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

                return skipCurrentTrack(interaction, queue, interaction.user);
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
                        flags: MessageFlags.Ephemeral,
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
                        content: translateGenericAction(interaction, "clearingQueue"),
                        flags: MessageFlags.Ephemeral,
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
                    .setTitle(translate(interaction, "np.volumeModalTitle", { volume: getIntendedVolume(queue) }))
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
                                flags: MessageFlags.Ephemeral,
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
                            setIntendedVolume(queue, Number(userResponse));
                            submit.reply({ embeds: [volumeembed] });
                        } catch (err) {
                            console.log(err);
                            submit.reply({
                                content: translateGenericAction(interaction, "adjustingVolume"),
                                flags: MessageFlags.Ephemeral,
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
                        flags: MessageFlags.Ephemeral,
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
                        content: translateGenericAction(interaction, "shufflingQueue"),
                        flags: MessageFlags.Ephemeral,
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
                    clear(queue);
                    queue.delete();
                    interaction.reply({ embeds: [stopembed] });
                } catch (err) {
                    interaction.reply({
                        content: translateGenericAction(interaction, "stoppingQueue"),
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }
        }
    },
};
