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
        .setName("playnext")
        .setDescription("Add a song to the top of the queue!")
        .addStringOption((option) =>
            option
                .setName("music")
                .setDescription("Either the name or URL of the song you want to play (no playlists).")
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

            if (search.playlist) {
                return interaction.reply({
                    content: translate(interaction, "errors.playNextPlaylistOnly"),
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.deferReply();

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
                );

                for (var result of search.tracks) {
                    if (count > 10) break;
                    if (result.playlist) return;
                    foundItems.push({
                        name: translate(interaction, "search.songResult", { index: count, duration: result.duration }),
                        value: `${result.description}`,
                    });

                    actionmenu.components[0].addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(result.title.length > 100 ? `${result.title.substring(0, 97)}...` : result.title)
                            .setValue(`song_true_url=${result.url}`)
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
            } else {
                await musicFuncs.addTracks(interaction, true, search, "send");
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
