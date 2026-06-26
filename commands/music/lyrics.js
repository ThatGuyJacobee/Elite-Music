require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, MessageFlags } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { lyricsExtractor } = require("@discord-player/extractor");
const { buildRequestedByFooter, translate } = require("../../utils/botText");
const { ensureDjAccess } = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lyrics")
        .setDescription("Get the lyrics for a song!")
        .addStringOption((option) =>
            option.setName("query").setDescription("Enter the name of the song.").setRequired(true),
        ),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;

        var query = interaction.options.getString("query");
        const extractor = lyricsExtractor();

        var findLyrics = await extractor.search(query).catch((err) => {});

        if (!findLyrics)
            return interaction.reply({
                content: translate(interaction, "lyrics.notFound"),
                flags: MessageFlags.Ephemeral,
            });
        let splicedLyrics = findLyrics.lyrics.slice(0, 4000);

        const lyricsembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setColor(client.config.embedColour)
            .setTitle(
                translate(interaction, "lyrics.title", {
                    title: findLyrics.title,
                    artist: findLyrics.artist.name,
                }),
            )
            .setDescription(
                findLyrics.lyrics.length > 4000
                    ? splicedLyrics + translate(interaction, "lyrics.truncatedSuffix")
                    : findLyrics.lyrics,
            )
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        var actionbuttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("np-delete").setStyle(4).setLabel("🗑️"),
            new ButtonBuilder()
                .setURL(findLyrics.url)
                .setStyle(5)
                .setLabel(translate(interaction, "lyrics.fullLyricsButton")),
        );

        interaction.reply({ embeds: [lyricsembed], components: [actionbuttons] });
    },
};
