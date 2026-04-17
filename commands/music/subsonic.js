require("dotenv").config();
const musicFuncs = require("../../utils/sharedFunctions.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const {
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require("discord.js");

function subsonicSelectValue(kind, playNext, id) {
    return `${kind}|${playNext ? "true" : "false"}|${id}`;
}

function parseSubsonicSelectValue(option) {
    const parts = String(option).split("|");
    const kind = parts[0];
    const playNext = parts[1] === "true";
    const id = parts.slice(2).join("|");
    return { kind, playNext, id };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("subsonic")
        .setDescription("Play a song from your Subsonic library into the queue!")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("play")
                .setDescription("Play a song from your Subsonic server.")
                .addStringOption((option) =>
                    option
                        .setName("music")
                        .setDescription("Name of the song you want to play.")
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("search")
                .setDescription("Search songs and playlists.")
                .addStringOption((option) =>
                    option
                        .setName("music")
                        .setDescription("Search query for a single song or playlist.")
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("playnext")
                .setDescription("Add a song from your Subsonic server to the top of the queue.")
                .addStringOption((option) =>
                    option
                        .setName("music")
                        .setDescription("Search query for a single song or playlist.")
                        .setRequired(true)
                )
        ),
    async execute(interaction) {
        if (interaction.options.getSubcommand() === "play" || interaction.options.getSubcommand() === "playnext") {
            if (client.config.enableDjMode) {
                if (!interaction.member.roles.cache.has(client.config.djRole))
                    return interaction.reply({
                        content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`,
                        ephemeral: true,
                    });
            }

            if (!client.config.enableSubsonic) {
                return interaction.reply({
                    content: `❌ | Subsonic is currently disabled! Ask the server admin to enable and configure this in the environment file.`,
                    ephemeral: true,
                });
            }

            if (!interaction.member.voice.channelId)
                return await interaction.reply({
                    content: "❌ | You are not in a voice channel!",
                    ephemeral: true,
                });
            if (
                interaction.guild.members.me.voice.channelId &&
                interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId
            )
                return await interaction.reply({
                    content: "❌ | You are not in my voice channel!",
                    ephemeral: true,
                });

            const query = interaction.options.getString("music");
            await musicFuncs.getQueue(interaction);

            try {
                var results = await musicFuncs.subsonicSearchQuery(query);
                if (!results || (!results.songs?.length && !results.playlists?.length)) {
                    return interaction.reply({
                        content: `❌ | Ooops... something went wrong, couldn't find the song or playlist with the requested query.`,
                        ephemeral: true,
                    });
                }

                await interaction.deferReply();

                if (results.size >= 2) {
                    var embedFields = [];
                    let count = 1;
                    let emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

                    var actionmenu = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId("subsonicsearch")
                            .setMinValues(1)
                            .setMaxValues(1)
                            .setPlaceholder("Add an item to queue 👈"),
                    );

                    const playNextFlag = interaction.options.getSubcommand() == "playnext";

                    if (results.songs) {
                        for (let item of results.songs) {
                            if (count > 10) break;

                            let date = new Date(item.duration);
                            let songTitle = `${item.parentTitle} - ${item.grandparentTitle}`;
                            embedFields.push({
                                name: `[${count}] ${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Result (${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()})`,
                                value: songTitle,
                            });

                            actionmenu.components[0].addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel(songTitle.length > 100 ? `${songTitle.substring(0, 97)}...` : songTitle)
                                    .setValue(subsonicSelectValue("song", playNextFlag, item.id))
                                    .setDescription(
                                        `Duration - ${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`,
                                    )
                                    .setEmoji(emojis[count - 1]),
                            );
                            count++;
                        }
                    }

                    if (results.playlists && interaction.options.getSubcommand() != "playnext") {
                        for (var item of results.playlists) {
                            if (count > 10) break;

                            let date = new Date(item.duration || 0);
                            embedFields.push({
                                name: `[${count}] ${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Result (${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()})`,
                                value: `${item.title}`,
                            });

                            actionmenu.components[0].addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel(
                                        item.title.length > 100 ? `${item.title.substring(0, 97)}...` : item.title,
                                    )
                                    .setValue(subsonicSelectValue("playlist", false, item.id))
                                    .setDescription(
                                        `Duration - ${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`,
                                    )
                                    .setEmoji(emojis[count - 1]),
                            );
                            count++;
                        }
                    }

                    const searchembed = new EmbedBuilder()
                        .setAuthor({
                            name: interaction.client.user.tag,
                            iconURL: interaction.client.user.displayAvatarURL(),
                        })
                        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                        .setTitle(`Subsonic Search Results 🎵`)
                        .setDescription(
                            "Found multiple songs matching the provided search query, select one form the menu below.",
                        )
                        .addFields(embedFields)
                        .setColor(client.config.embedColour)
                        .setTimestamp()
                        .setFooter({
                            text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}`,
                        });

                    let actionbutton = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId("np-delete").setStyle(4).setLabel("Cancel Search 🗑️"),
                    );

                    interaction.followUp({ embeds: [searchembed], components: [actionmenu, actionbutton] });
                } else {
                    var itemFound = (results.songs && results.songs[0]) || (results.playlists && results.playlists[0]);

                    if (itemFound.type == "playlist") {
                        await musicFuncs.subsonicAddPlaylist(interaction, itemFound, "send");
                    } else {
                        await musicFuncs.subsonicAddTrack(
                            interaction,
                            interaction.options.getSubcommand() == "playnext" ? true : false,
                            itemFound,
                            "send",
                        );
                    }
                }
            } catch (err) {
                console.log(err);
                return interaction.followUp({
                    content: `❌ | Ooops... something went wrong whilst attempting to play the requested song. Please try again.`,
                    ephemeral: true,
                });
            }
        } else if (interaction.options.getSubcommand() === "search") {
            if (client.config.enableDjMode) {
                if (!interaction.member.roles.cache.has(client.config.djRole))
                    return interaction.reply({
                        content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`,
                        ephemeral: true,
                    });
            }

            if (!client.config.enableSubsonic) {
                return interaction.reply({
                    content: `❌ | Subsonic is currently disabled! Ask the server admin to enable and configure this in the environment file.`,
                    ephemeral: true,
                });
            }

            if (!interaction.member.voice.channelId)
                return await interaction.reply({
                    content: "❌ | You are not in a voice channel!",
                    ephemeral: true,
                });
            if (
                interaction.guild.members.me.voice.channelId &&
                interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId
            )
                return await interaction.reply({
                    content: "❌ | You are not in my voice channel!",
                    ephemeral: true,
                });

            const query = interaction.options.getString("music");
            await musicFuncs.getQueue(interaction);

            try {
                var results = await musicFuncs.subsonicSearchQuery(query);
                if (!results || (!results.songs?.length && !results.playlists?.length)) {
                    return interaction.reply({
                        content: `❌ | Ooops... something went wrong, couldn't find the song or playlist with the requested query.`,
                        ephemeral: true,
                    });
                }

                await interaction.deferReply();

                var embedFields = [];
                let count = 1;
                let emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

                var actionmenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("subsonicsearch")
                        .setMinValues(1)
                        .setMaxValues(1)
                        .setPlaceholder("Add an item to queue 👈"),
                );

                if (results.songs) {
                    for (let item of results.songs) {
                        if (count > 10) break;

                        let date = new Date(item.duration);
                        let songTitle = `${item.parentTitle} - ${item.grandparentTitle}`;
                        embedFields.push({
                            name: `[${count}] ${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Result (${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()})`,
                            value: songTitle,
                        });

                        actionmenu.components[0].addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel(songTitle.length > 100 ? `${songTitle.substring(0, 97)}...` : songTitle)
                                .setValue(subsonicSelectValue("song", false, item.id))
                                .setDescription(
                                    `Duration - ${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`,
                                )
                                .setEmoji(emojis[count - 1]),
                        );
                        count++;
                    }
                }

                if (results.playlists) {
                    for (var item of results.playlists) {
                        if (count > 10) break;

                        let date = new Date(item.duration || 0);
                        embedFields.push({
                            name: `[${count}] ${item.type.charAt(0).toUpperCase() + item.type.slice(1)} Result (${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()})`,
                            value: `${item.title}`,
                        });

                        actionmenu.components[0].addOptions(
                            new StringSelectMenuOptionBuilder()
                                .setLabel(item.title.length > 100 ? `${item.title.substring(0, 97)}...` : item.title)
                                .setValue(subsonicSelectValue("playlist", false, item.id))
                                .setDescription(
                                    `Duration - ${date.getMinutes()}:${date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()}`,
                                )
                                .setEmoji(emojis[count - 1]),
                        );
                        count++;
                    }
                }

                const searchembed = new EmbedBuilder()
                    .setAuthor({
                        name: interaction.client.user.tag,
                        iconURL: interaction.client.user.displayAvatarURL(),
                    })
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                    .setTitle(`Subsonic Search Results 🎵`)
                    .addFields(embedFields)
                    .setColor(client.config.embedColour)
                    .setTimestamp()
                    .setFooter({
                        text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}`,
                    });

                let actionbutton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId("np-delete").setStyle(4).setLabel("Cancel Search 🗑️"),
                );

                interaction.followUp({ embeds: [searchembed], components: [actionmenu, actionbutton] });
            } catch (err) {
                console.log(err);
                return interaction.followUp({
                    content: `❌ | Ooops... something went wrong whilst attempting to play the requested song. Please try again.`,
                    ephemeral: true,
                });
            }
        }
    },
};

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId == "subsonicsearch") {
        await musicFuncs.getQueue(interaction);
        const allcomponents = interaction.values;

        await interaction.deferUpdate();

        for await (const option of allcomponents) {
            const { kind, playNext, id } = parseSubsonicSelectValue(option);

            if (kind === "playlist") {
                await musicFuncs.subsonicAddPlaylist(interaction, { type: "playlist", id }, "edit");
            } else {
                await musicFuncs.subsonicAddTrack(interaction, playNext, { type: "track", id }, "edit");
            }
        }
    }
});
