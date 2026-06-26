require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, MessageFlags } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const {
    buildRequestedByFooter,
    buildRequestedByPageFooter,
    buildTrackLinkText,
    translate,
} = require("../../utils/botText");
const {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueNotPlayingResponse,
} = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queuehistory")
        .setDescription("Check the past history of the queue within the guild!"),
    async execute(interaction) {
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

        const historyembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setColor(client.config.embedColour)
            .setTitle(translate(interaction, "queue.historyTitle"))
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        var curPage = 1;
        var i = curPage * 10 - 10;
        var curTracks = [];

        curTracks.push({
            name: translate(interaction, "queue.nowPlayingField"),
            value: `**${queue.currentTrack.title}** ${buildTrackLinkText(queue.currentTrack, interaction)}`,
        });

        for (i; i < curPage * 10; i++) {
            if (previousTracks[i]) {
                curTracks.push({
                    name: `${i + 1}. ${previousTracks[i].title}`,
                    value: `**${previousTracks[i].author}** ${buildTrackLinkText(previousTracks[i], interaction)}`,
                });
            }
        }

        historyembed.addFields(curTracks);

        var timestamp = Date.now();
        var finalComponents = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`queuehistory-${timestamp}-delete`).setStyle(4).setLabel("🗑️"),
            new ButtonBuilder()
                .setCustomId(`queuehistory-${timestamp}-previous`)
                .setStyle(1)
                .setLabel(translate(interaction, "queue.previousPage")),
            new ButtonBuilder()
                .setCustomId(`queuehistory-${timestamp}-next`)
                .setStyle(1)
                .setLabel(translate(interaction, "queue.nextPage")),
        );

        interaction.reply({ embeds: [historyembed], components: [finalComponents] });

        const filter = (interaction) => interaction.customId.includes(`queuehistory-${timestamp}`);
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });

        collector.on("collect", async (buttonResponse) => {
            if (buttonResponse.customId.includes("delete")) {
                return buttonResponse.message.delete();
            }

            const player = useMainPlayer();
            var queue = player.nodes.get(interaction.guild.id);
            const previousTracks = queue.history.tracks.toArray();

            if (!previousTracks[0]) {
                return interaction.editReply({
                    content: translate(interaction, "np.backMissing"),
                    components: [],
                });
            }

            const queueembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setColor(client.config.embedColour)
                .setTitle(translate(interaction, "queue.historyTitle"))
                .setTimestamp();

            if (buttonResponse.customId.includes("next")) {
                var size = previousTracks.length;
                if (curPage == Math.ceil(size / 10)) return buttonResponse.deferUpdate();
                curPage++;
            } else if (buttonResponse.customId.includes("previous")) {
                if (curPage == 1) return buttonResponse.deferUpdate();
                curPage--;
            }

            var i = curPage * 10 - 10;
            var curTracks = [];

            curTracks.push({
                name: translate(interaction, "queue.nowPlayingField"),
                value: `**${queue.currentTrack.title}** ${buildTrackLinkText(queue.currentTrack, interaction)}`,
            });

            for (i; i < curPage * 10; i++) {
                if (previousTracks[i]) {
                    curTracks.push({
                        name: `${i + 1}. ${previousTracks[i].title}`,
                        value: `**${previousTracks[i].author}** ${buildTrackLinkText(previousTracks[i], interaction)}`,
                    });
                }
            }

            queueembed.addFields(curTracks);
            queueembed.setFooter(buildRequestedByPageFooter(interaction, interaction.user, curPage));
            interaction.editReply({ embeds: [queueembed] });
            buttonResponse.deferUpdate();
        });

        collector.on("end", async () => {
            interaction.editReply({
                content: translate(interaction, "queue.historyExpired"),
                components: [],
            });
        });
    },
};
