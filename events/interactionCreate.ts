import "dotenv/config";
import {
    EmbedBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    Collection,
    StringSelectMenuBuilder,
    TextInputBuilder,
    ModalBuilder,
    AttachmentBuilder,
    MessageFlags,
    GuildMember,
    Guild,
} from "discord.js";
import { useMainPlayer, QueueRepeatMode } from "discord-player";
import { clearNpControlMessages } from "../utils/npControlMessages";
import { readdirSync } from "fs";
import type { ButtonInteraction, StringSelectMenuInteraction, ChatInputCommandInteraction } from "discord.js";
import type { ExtendedClient } from "../types";
import { buildRequestedByFooter, buildTrackLinkText, getDisplayName, translate } from "../utils/botText";
import {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    ephemeralReply,
} from "../utils/interactionGuards";

const client = (globalThis as any).client as ExtendedClient;

const cooldowns = new Map<string, Collection<string, number>>();

export default {
    name: "interactionCreate",
    async execute(
        interaction: ButtonInteraction | StringSelectMenuInteraction | ChatInputCommandInteraction,
    ): Promise<void> {
        if (interaction.isChatInputCommand()) {
            const command = (interaction.client as ExtendedClient).commands.get(interaction.commandName);

            if (!command) return;
            if (!cooldowns.has(command.data.name)) {
                cooldowns.set(command.data.name, new Collection());
            }

            const curtime = Date.now();
            const timestamp = cooldowns.get(command.data.name)!;
            const coolamount = (command as any).cooldown * 1000;

            if (timestamp.has(interaction.user.id)) {
                const expiration = timestamp.get(interaction.user.id)! + coolamount;

                if (curtime < expiration) {
                    const timeleft = Math.ceil((expiration - curtime) / 1000);

                    await interaction.reply({
                        content: translate(interaction, "errors.cooldown", {
                            time: timeleft,
                            command: command.data.name,
                        }),
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
            }

            timestamp.set(interaction.user.id, curtime);
            setTimeout(() => timestamp.delete(interaction.user.id), coolamount);

            try {
                await command.execute(interaction as any);
            } catch (err) {
                if (err) console.error(err);

                await interaction.reply({
                    content: translate(interaction, "errors.generic"),
                    flags: MessageFlags.Ephemeral,
                });
            }
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "select") {
                await handleHelpSelectMenu(interaction);
            }
        } else if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        }
    },
};

async function handleHelpSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    const value = interaction.values[0];
    const guildid = interaction.guild!.id;
    const dirs: string[] = [];
    const categories: any[][] = [];

    readdirSync("./commands/").forEach((dir) => {
        const commands = readdirSync(`./commands/${dir}`).filter(
            (file) => file.endsWith(".js") || file.endsWith(".ts"),
        );
        const cmds: any[] = [];

        commands.map((command) => {
            const filePath = `../commands/${dir}/${command}`;
            const file = require(filePath);

            if (dir === "configuration" || dir === "utilities") {
                cmds.push({
                    name: dir,
                    commands: {
                        name: file.data.name,
                        description: file.data.description,
                    },
                });
            } else {
                if (file.data.options.length === 0 || file.data.options[0].type !== null) {
                    cmds.push({
                        name: dir,
                        commands: {
                            name: file.data.name,
                            description: file.data.description,
                        },
                    });
                } else {
                    file.data.options.forEach((id: any) => {
                        cmds.push({
                            name: dir,
                            commands: {
                                name: `${file.data.name} ${id.name}`,
                                description: id.description,
                            },
                        });
                    });
                }
            }
        });

        categories.push(cmds.filter((categ: any) => categ.name === dir));
    });

    let page = 0;
    const emojis: Record<string, string> = {
        music: "🎵",
        utilities: "🛄",
    };

    const description: Record<string, string> = {
        music: translate(interaction, "help.musicDescription"),
        utilities: translate(interaction, "help.utilitiesDescription"),
    };

    const menuoptions: any[] = [
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
            name: interaction.client.user!.tag,
            iconURL: interaction.client.user!.displayAvatarURL(),
        })
        .setColor(client.config.embedColour as any)
        .setTitle(translate(interaction, "help.title"))
        .setDescription(translate(interaction, "help.homeDescription"))
        .setTimestamp()
        .setFooter({
            text: translate(interaction, "help.footer", { user: getDisplayName(interaction.user) }),
        });

    dirs.forEach((dir) => {
        menuoptions.push({
            label: `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()}`,
            description: `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()} commands page`,
            emoji: `${emojis[dir] || ""}`,
            value: `${page++}`,
        });
    });

    if (value && value !== "home") {
        embed.setTitle(
            `${translate(interaction, "help.categoryTitle", { category: categories[parseInt(value)][0].name.charAt(0).toUpperCase() + categories[parseInt(value)][0].name.slice(1).toLowerCase() })} ${emojis[categories[parseInt(value)][0].name] ? emojis[categories[parseInt(value)][0].name] : ""}`,
        );

        categories[parseInt(value)].forEach((cmd: any) => {
            embed.addFields({
                name: `\`/${cmd.commands.name}\``,
                value: `${cmd.commands.description || translate(interaction, "help.noDescription")}`,
                inline: true,
            });
        });

        const getchannel = interaction.guild!.channels.cache.find((channel) => channel.id === interaction.channelId);

        if (getchannel) {
            if (
                !(interaction.guild as Guild).members
                    .me!.permissionsIn(interaction.channel!.id)
                    .has(PermissionFlagsBits.ViewChannel)
            ) {
                console.log(`No Perms! (ID: ${guildid})`);
                await interaction.reply({
                    content: translate(interaction, "errors.noChannelPerms"),
                    flags: MessageFlags.Ephemeral,
                });
                return;
            } else {
                const channel = getchannel as any;
                await channel.messages
                    .fetch(interaction.message.id)
                    .then(async (msg: any) => await msg.edit({ embeds: [embed], fetchReply: true }));
            }
        } else {
            console.log(`Cannot find the channel! (ID: ${guildid})`);
        }
    }

    if (value === "home") {
        embed.setTitle(translate(interaction, "help.title"));

        dirs.forEach((dir) => {
            embed.addFields({
                name: `${emojis[dir] || ""} ${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()}`,
                value: `${description[dir] ? description[dir] : `${dir.charAt(0).toUpperCase() + dir.slice(1).toLowerCase()} Commands`}`,
                inline: false,
            });
        });

        const getchannel = interaction.guild!.channels.cache.find((channel) => channel.id === interaction.channelId);

        if (getchannel) {
            if (
                !(interaction.guild as Guild).members
                    .me!.permissionsIn(interaction.channel!.id)
                    .has(PermissionFlagsBits.ViewChannel)
            ) {
                console.log(`No Perms! (ID: ${guildid})`);
                await interaction.reply({
                    content: translate(interaction, "errors.noChannelPerms"),
                    flags: MessageFlags.Ephemeral,
                });
                return;
            } else {
                const channel = getchannel as any;
                await channel.messages
                    .fetch(interaction.message.id)
                    .then(async (msg: any) => await msg.edit({ embeds: [embed], fetchReply: true }));
            }
        } else {
            console.log(`Cannot find the channel! (ID: ${guildid})`);
        }
    }

    await interaction.deferUpdate();
}

async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    const member = interaction.member as GuildMember;
    const guild = interaction.guild as Guild;

    // DJ Mode check helper
    const checkDjMode = async (): Promise<boolean> => {
        if (client.config.enableDjMode) {
            if (!member.roles.cache.has(client.config.djRole)) {
                await interaction.reply({
                    content: translate(interaction, "guards.djMode", { role: `<@&${client.config.djRole}>` }),
                    flags: MessageFlags.Ephemeral,
                });
                return false;
            }
        }
        return true;
    };

    // Voice channel check helper
    const checkVoiceChannel = async (): Promise<boolean> => {
        if (!member.voice.channelId) {
            await interaction.reply({
                content: translate(interaction, "guards.notInVoice"),
                flags: MessageFlags.Ephemeral,
            });
            return false;
        }
        if (guild.members.me!.voice.channelId && member.voice.channelId !== guild.members.me!.voice.channelId) {
            await interaction.reply({
                content: translate(interaction, "guards.notInBotVoice"),
                flags: MessageFlags.Ephemeral,
            });
            return false;
        }
        return true;
    };

    // Queue check helper
    const checkQueue = async () => {
        const player = useMainPlayer();
        const queue = player.nodes.get(guild.id);
        if (!queue || !queue.isPlaying()) {
            await interaction.reply({
                content: translate(interaction, "queue.nothingPlaying"),
                flags: MessageFlags.Ephemeral,
            });
            return null;
        }
        return queue;
    };

    if (customId === "queue-delete") {
        if (!(await checkDjMode())) return;
        await interaction.message.delete();
    }

    if (customId === "np-delete") {
        if (!(await checkDjMode())) return;
        await interaction.message.delete();
    }

    if (customId === "np-back") {
        if (!(await checkDjMode())) return;
        if (!(await checkVoiceChannel())) return;
        const queue = await checkQueue();
        if (!queue) return;

        const previousTracks = queue.history.tracks.toArray();
        if (!previousTracks[0]) {
            await interaction.reply(
                ephemeralReply({
                    content: translate(interaction, "np.backMissing"),
                }),
            );
            return;
        }

        const backembed = new EmbedBuilder()
            .setAuthor({
                name: interaction.client.user!.tag,
                iconURL: interaction.client.user!.displayAvatarURL(),
            })
            .setThumbnail(interaction.guild!.iconURL())
            .setColor(client.config.embedColour as any)
            .setTitle(translate(interaction, "np.backTitle"))
            .setDescription(
                translate(interaction, "np.backDescription", {
                    title: previousTracks[0].title,
                    link: buildTrackLinkText(previousTracks[0], interaction),
                }),
            )
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.history.back();
            await interaction.reply({ embeds: [backembed] });
        } catch {
            await interaction.reply(
                ephemeralReply({
                    content: translate(interaction, "errors.failedToBack"),
                }),
            );
        }
    }

    if (customId === "np-pauseresume") {
        if (!(await checkDjMode())) return;
        if (!(await checkVoiceChannel())) return;
        const queue = await checkQueue();
        if (!queue) return;

        const checkPause = queue.node.isPaused();

        const coverImage = new AttachmentBuilder(queue.currentTrack!.thumbnail, {
            name: "coverimage.jpg",
            description: `Song Cover Image for ${queue.currentTrack!.title}`,
        });

        const pauseembed = new EmbedBuilder()
            .setAuthor({
                name: interaction.client.user!.tag,
                iconURL: interaction.client.user!.displayAvatarURL(),
            })
            .setThumbnail("attachment://coverimage.jpg")
            .setColor(client.config.embedColour as any)
            .setTitle(translate(interaction, checkPause ? "np.resumedTitle" : "np.pausedTitle"))
            .setDescription(
                translate(interaction, "np.pauseResumeDescription", {
                    state: checkPause ? "resumed" : "paused",
                    title: queue.currentTrack!.title,
                    link: buildTrackLinkText(queue.currentTrack!, interaction),
                }),
            )
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.node.setPaused(!queue.node.isPaused());
            await interaction.reply({ embeds: [pauseembed], files: [coverImage] });
        } catch {
            await interaction.reply(
                ephemeralReply({
                    content: translate(interaction, "errors.failedToPauseResume", {
                        action: checkPause ? "resuming" : "pausing",
                    }),
                }),
            );
        }
    }

    if (customId === "np-skip") {
        if (!(await checkDjMode())) return;
        if (!(await checkVoiceChannel())) return;
        const queue = await checkQueue();
        if (!queue) return;

        const queuedTracks = queue.tracks.toArray();
        if (!queuedTracks[0]) {
            await interaction.reply(
                ephemeralReply({
                    content: translate(interaction, "queue.empty"),
                }),
            );
            return;
        }

        const coverImage = new AttachmentBuilder(queuedTracks[0].thumbnail, {
            name: "coverimage.jpg",
            description: `Song Cover Image for ${queuedTracks[0].title}`,
        });

        const skipembed = new EmbedBuilder()
            .setAuthor({
                name: interaction.client.user!.tag,
                iconURL: interaction.client.user!.displayAvatarURL(),
            })
            .setThumbnail("attachment://coverimage.jpg")
            .setColor(client.config.embedColour as any)
            .setTitle(translate(interaction, "np.skipTitle"))
            .setDescription(
                translate(interaction, "np.skipDescription", {
                    title: queuedTracks[0].title,
                    link: buildTrackLinkText(queuedTracks[0], interaction),
                }),
            )
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.node.skip();
            await interaction.reply({ embeds: [skipembed], files: [coverImage] });
        } catch {
            await interaction.reply(
                ephemeralReply({
                    content: translate(interaction, "errors.failedToSkip"),
                }),
            );
        }
    }

    if (customId === "np-clear") {
        if (!(await checkDjMode())) return;
        if (!(await checkVoiceChannel())) return;
        const queue = await checkQueue();
        if (!queue) return;

        if (queue.tracks.size === 0) {
            await interaction.reply(
                ephemeralReply({
                    content: translate(interaction, "queue.empty"),
                }),
            );
            return;
        }

        const clearembed = new EmbedBuilder()
            .setAuthor({
                name: interaction.client.user!.tag,
                iconURL: interaction.client.user!.displayAvatarURL(),
            })
            .setThumbnail(interaction.guild!.iconURL())
            .setColor(client.config.embedColour as any)
            .setTitle(translate(interaction, "np.clearTitle"))
            .setDescription(translate(interaction, "np.clearDescription"))
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.tracks.clear();
            await interaction.reply({ embeds: [clearembed] });
        } catch {
            await interaction.reply(
                ephemeralReply({
                    content: translate(interaction, "errors.failedToClear"),
                }),
            );
        }
    }

    if (customId === "np-volumeadjust") {
        if (!(await checkDjMode())) return;
        if (!(await checkVoiceChannel())) return;
        const queue = await checkQueue();
        if (!queue) return;

        const modal = new ModalBuilder()
            .setCustomId(`adjust_volume_${guild.id}`)
            .setTitle(translate(interaction, "np.adjustVolumeTitle", { volume: queue.node.volume })) as any;
        (modal as any).addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId("volume-input")
                    .setLabel(translate(interaction, "np.volumeInputLabel"))
                    .setStyle(1)
                    .setMinLength(1)
                    .setMaxLength(6)
                    .setPlaceholder(translate(interaction, "np.volumeInputPlaceholder"))
                    .setRequired(true),
            ),
        );

        await interaction.showModal(modal);

        const filter = (i: any) => i.customId.includes(`adjust_volume_${guild.id}`);
        interaction
            .awaitModalSubmit({ filter, time: 240000 })
            .then(async (submit) => {
                const userResponse = submit.fields.getTextInputValue("volume-input");

                if (Number(userResponse) < 0 || Number(userResponse) > 100 || isNaN(Number(userResponse))) {
                    await submit.reply({
                        content: translate(submit, "volume.invalidRange"),
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                const volumeembed = new EmbedBuilder()
                    .setAuthor({
                        name: interaction.client.user!.tag,
                        iconURL: interaction.client.user!.displayAvatarURL(),
                    })
                    .setThumbnail(interaction.guild!.iconURL())
                    .setColor(client.config.embedColour as any)
                    .setTitle(translate(submit, "np.volumeAdjustedTitle"))
                    .setDescription(translate(submit, "np.volumeAdjustedDescription", { volume: userResponse }))
                    .setTimestamp()
                    .setFooter(buildRequestedByFooter(submit, submit.user));

                try {
                    queue.node.setVolume(Number(userResponse));
                    await submit.reply({ embeds: [volumeembed] });
                } catch (err) {
                    console.log(err);
                    await submit.reply({
                        content: translate(submit, "errors.failedToAdjustVolume"),
                        flags: MessageFlags.Ephemeral,
                    });
                }
            })
            .catch(console.error);
    }

    if (customId === "np-loop") {
        if (!(await checkDjMode())) return;
        if (!(await checkVoiceChannel())) return;
        const queue = await checkQueue();
        if (!queue) return;

        if (queue.repeatMode === QueueRepeatMode.TRACK) {
            const loopmode = QueueRepeatMode.OFF;
            queue.setRepeatMode(loopmode);

            const loopembed = new EmbedBuilder()
                .setAuthor({
                    name: interaction.client.user!.tag,
                    iconURL: interaction.client.user!.displayAvatarURL(),
                })
                .setThumbnail(interaction.guild!.iconURL())
                .setColor(client.config.embedColour as any)
                .setTitle(translate(interaction, "np.loopOffTitle"))
                .setDescription(translate(interaction, "np.loopOffDescription"))
                .setTimestamp()
                .setFooter(buildRequestedByFooter(interaction, interaction.user));

            await interaction.reply({ embeds: [loopembed] });
        } else {
            const loopmode = QueueRepeatMode.TRACK;
            queue.setRepeatMode(loopmode);

            const loopembed = new EmbedBuilder()
                .setAuthor({
                    name: interaction.client.user!.tag,
                    iconURL: interaction.client.user!.displayAvatarURL(),
                })
                .setThumbnail(interaction.guild!.iconURL())
                .setColor(client.config.embedColour as any)
                .setTitle(translate(interaction, "np.loopOnTitle"))
                .setDescription(translate(interaction, "np.loopOnDescription"))
                .setTimestamp()
                .setFooter(buildRequestedByFooter(interaction, interaction.user));

            await interaction.reply({ embeds: [loopembed] });
        }
    }

    if (customId === "np-shuffle") {
        if (!(await checkDjMode())) return;
        if (!(await checkVoiceChannel())) return;
        const queue = await checkQueue();
        if (!queue) return;

        if (queue.tracks.size === 0) {
            await interaction.reply(
                ephemeralReply({
                    content: translate(interaction, "queue.empty"),
                }),
            );
            return;
        }

        const shuffleembed = new EmbedBuilder()
            .setAuthor({
                name: interaction.client.user!.tag,
                iconURL: interaction.client.user!.displayAvatarURL(),
            })
            .setThumbnail(interaction.guild!.iconURL())
            .setColor(client.config.embedColour as any)
            .setTitle(translate(interaction, "np.shuffleTitle"))
            .setDescription(translate(interaction, "np.shuffleDescription"))
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.tracks.shuffle();
            await interaction.reply({ embeds: [shuffleembed] });
        } catch {
            await interaction.reply(
                ephemeralReply({
                    content: translate(interaction, "errors.failedToShuffle"),
                }),
            );
        }
    }

    if (customId === "np-stop") {
        if (!(await checkDjMode())) return;
        if (!(await checkVoiceChannel())) return;
        const queue = await checkQueue();
        if (!queue) return;

        const stopembed = new EmbedBuilder()
            .setAuthor({
                name: interaction.client.user!.tag,
                iconURL: interaction.client.user!.displayAvatarURL(),
            })
            .setThumbnail(interaction.guild!.iconURL())
            .setColor(client.config.embedColour as any)
            .setTitle(translate(interaction, "np.stopTitle"))
            .setDescription(translate(interaction, "np.stopDescription"))
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            await clearNpControlMessages(queue);
            queue.delete();
            await interaction.reply({ embeds: [stopembed] });
        } catch {
            await interaction.reply(
                ephemeralReply({
                    content: translate(interaction, "errors.failedToStop"),
                }),
            );
        }
    }
}
