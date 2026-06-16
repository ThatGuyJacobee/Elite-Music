require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder } = require("discord.js");
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
    getQueueEmptyResponse,
    getQueueNotPlayingResponse,
} = require("../../utils/interactionGuards");

module.exports = {
    data: new SlashCommandBuilder().setName("queue").setDescription("Check the current music that is in the queue!"),
    async execute(interaction) {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply(getQueueNotPlayingResponse(interaction));

        const queuedTracks = queue.tracks.toArray();
        if (!queuedTracks[0]) return interaction.reply(getQueueEmptyResponse(interaction));

        const queueembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
            .setColor(client.config.embedColour)
            .setTitle(translate(interaction, "queue.title"))
            .setTimestamp()
            .setFooter(buildRequestedByFooter(interaction, interaction.user));

        var curPage = 1;
        var i = curPage * 10 - 10;
        var curTracks = [];

        curTracks.push({
            name: translate(interaction, "queue.nowPlayingField"),
            value: `**${queue.currentTrack.title}** ${buildTrackLinkText(queue.currentTrack)}`,
        });

        for (i; i < curPage * 10; i++) {
            if (queuedTracks[i]) {
                curTracks.push({
                    name: `${i + 1}. ${queuedTracks[i].title}`,
                    value: `**${queuedTracks[i].author}** ${buildTrackLinkText(queuedTracks[i])}`,
                });
            }
        }

        queueembed.addFields(curTracks);

        var timestamp = Date.now();
        var finalComponents = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`queue-${timestamp}-delete`).setStyle(4).setLabel("🗑️"),
            new ButtonBuilder().setCustomId(`queue-${timestamp}-previous`).setStyle(1).setLabel("⬅️"),
            new ButtonBuilder().setCustomId(`queue-${timestamp}-next`).setStyle(1).setLabel("➡️"),
        );

        interaction.reply({ embeds: [queueembed], components: [finalComponents] });

        const filter = (interaction) => interaction.customId.includes(`queue-${timestamp}`);
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 });

        collector.on("collect", async (buttonResponse) => {
            if (buttonResponse.customId.includes("delete")) {
                return buttonResponse.message.delete();
            }

            const player = useMainPlayer();
            var queue = player.nodes.get(interaction.guild.id);
            const queuedTracks = queue.tracks.toArray();

            if (!queuedTracks[0]) {
                return interaction.editReply({
                    content: translate(interaction, "queue.empty"),
                    components: [],
                });
            }

            const queueembed = new EmbedBuilder()
                .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setColor(client.config.embedColour)
                .setTitle(translate(interaction, "queue.title"))
                .setTimestamp();

            if (buttonResponse.customId.includes("next")) {
                var size = queuedTracks.length;
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
                value: `**${queue.currentTrack.title}** ${buildTrackLinkText(queue.currentTrack)}`,
            });

            for (i; i < curPage * 10; i++) {
                if (queuedTracks[i]) {
                    curTracks.push({
                        name: `${i + 1}. ${queuedTracks[i].title}`,
                        value: `**${queuedTracks[i].author}** ${buildTrackLinkText(queuedTracks[i])}`,
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
                content: translate(interaction, "queue.expired"),
                components: [],
            });
        });
    },
};
