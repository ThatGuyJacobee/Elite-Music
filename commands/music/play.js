require("dotenv").config();
const musicFuncs = require("../../utils/sharedFunctions.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const {
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
} = require("discord.js");
const { useMainPlayer, QueryType } = require("discord-player");
const { buildRequestedByFooter, translate } = require("../../utils/botText");
const { ensureDjAccess, ensureInVoiceChannel, ensureSameVoiceChannel } = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Place a song into the queue!")
        .addStringOption((option) =>
            option
                .setName("music")
                .setDescription("Either the name, URL or playlist URL you want to play.")
                .setRequired(true),
        ),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const query = interaction.options.getString("music");
        const player = useMainPlayer();
        await musicFuncs.getQueue(interaction);

        try {
            const search = await player.search(query, {
                requestedBy: interaction.user,
                searchEngine: QueryType.AUTO,
            });

            if (!search || search.tracks.length == 0 || !search.tracks) {
                return interaction.reply({
                    content: translate(interaction, "errors.failedToFindSongQuery"),
                    flags: MessageFlags.Ephemeral,
                });
            }

            //Otherwise it has found so defer reply
            await interaction.deferReply();

            //If there is more than one search result
            if (search.tracks.length >= 2 && !search.playlist) {
                var foundItems = [];
                let count = 1;
                let emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

                var actionmenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("playsearch")
                        .setMinValues(1)
                        .setMaxValues(1)
                        .setPlaceholder(translate(interaction, "search.placeholder")),
                    //.addOptions(options)
                );

                for (var result of search.tracks) {
                    if (count > 10) break;
                    foundItems.push({
                        name: translate(interaction, result.playlist ? "search.playlistResult" : "search.songResult", {
                            index: count,
                            duration: result.duration,
                        }),
                        value: `${result.description}`,
                    });

                    actionmenu.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(result.title.length > 100 ? `${result.title.substring(0, 97)}...` : result.title)
                            .setValue(`${!result.playlist ? "song" : "playlist"}_false_url=${result.url}`) // Schema: [type]_[playnext]_[url=track]...
                            .setDescription(translate(interaction, "search.duration", { duration: result.duration }))
                            .setEmoji(emojis[count - 1]),
                    );
                    count++;
                }

                const searchembed = new EmbedBuilder()
                    .setAuthor({
                        name: interaction.client.user.tag,
                        iconURL: interaction.client.user.displayAvatarURL(),
                    })
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                    .setTitle(translate(interaction, "search.resultsTitle"))
                    .setDescription(translate(interaction, "search.resultsDescription"))
                    .addFields(foundItems)
                    .setColor(client.config.embedColour)
                    .setTimestamp()
                    .setFooter(buildRequestedByFooter(interaction, interaction.user));

                let actionbutton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId("np-delete")
                        .setStyle(4)
                        .setLabel(translate(interaction, "search.cancel")),
                );

                interaction.followUp({ embeds: [searchembed], components: [actionmenu, actionbutton] });
            }

            //There is only one search result, play it direct
            else {
                await musicFuncs.addTracks(interaction, false, search, "send");
            }
        } catch (err) {
            console.log(err);
            return interaction.followUp({
                content: translate(interaction, "errors.playRequest"),
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId == "playsearch") {
        const player = useMainPlayer();
        await musicFuncs.getQueue(interaction);
        var allcomponents = interaction.values; // Schema: [type]_[playnext]_[url=track]...
        var getPlayNext =
            allcomponents[0].split("_")[1] != null && allcomponents[0].split("_")[1] == "true" ? true : false;
        //console.log(allcomponents)

        try {
            const search = await player.search(allcomponents[0].split("url=")[1], {
                requestedBy: interaction.user,
                searchEngine: QueryType.AUTO,
            });

            if (!search || search.tracks.length == 0 || !search.tracks) {
                return interaction.reply({
                    content: translate(interaction, "errors.failedToFindSong"),
                    flags: MessageFlags.Ephemeral,
                });
            }

            //Defer update from menu interaction
            await interaction.deferUpdate();

            await musicFuncs.addTracks(interaction, getPlayNext, search, "edit");
        } catch (err) {
            console.log(err);
            return interaction.followUp({
                content: translate(interaction, "errors.playRequest"),
                flags: MessageFlags.Ephemeral,
            });
        }
    }
});
