require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const ms = require("ms");
const {
    buildRequestedByFooter,
    buildTrackLinkText,
    translate,
    translateGenericAction,
} = require("../../utils/botText");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueNotPlayingResponse,
} = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("seek")
        .setDescription("Seek to another time in the current song!")
        .addStringOption((option) =>
            option
                .setName("time")
                .setDescription("The time to seek the current song (Examples: 1s, 1m, 1h)!")
                .setRequired(true),
        ),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

        const removeamount = ms(interaction.options.getString("time"));

        const seekembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setColor(client.config.embedColour)
            .setTitle(translate(interaction, "seek.title"))
            .setDescription(
                translate(interaction, "seek.description", {
                    time: ms(removeamount),
                    title: queue.currentTrack.title,
                    link: buildTrackLinkText(queue.currentTrack, interaction),
                }),
            )
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        try {
            queue.node.seek(removeamount);
            interaction.reply({ embeds: [seekembed] });
        } catch (err) {
            interaction.reply({
                content: translateGenericAction(interaction, "seekingSong"),
                ephemeral: true,
            });
        }
    },
};
