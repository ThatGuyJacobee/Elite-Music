const { ActionRowBuilder, ButtonBuilder, EmbedBuilder } = require("discord.js");
const { useMainPlayer } = require("discord-player");
const { buildRequestedByPageFooter, buildTrackLinkText, translate } = require("./botText");
const { ensureDjAccess, getQueueNotPlayingResponse } = require("./interactionGuards");
const { getDisplayArtist } = require("./nowPlayingUi");

const PAGE_SIZE = 10;
const QUEUE_BUTTON_PATTERN = /^(queue|queuehistory):(page|refresh|delete)(?::(\d+))?$/;

function parseQueueButton(customId) {
    const match = QUEUE_BUTTON_PATTERN.exec(String(customId || ""));
    if (!match) return null;

    return {
        kind: match[1],
        action: match[2],
        page: Number(match[3] || 1),
    };
}

function buildQueuePage(source, queue, page, options = {}) {
    const history = options.history === true;
    const tracks = history ? queue.history.tracks.toArray() : queue.tracks.toArray();
    const totalPages = Math.max(1, Math.ceil(tracks.length / PAGE_SIZE));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const user = options.user ?? source.user;
    const prefix = history ? "queuehistory" : "queue";

    const embed = new EmbedBuilder()
        .setAuthor({ name: source.client.user.tag, iconURL: source.client.user.displayAvatarURL() })
        .setThumbnail(source.guild.iconURL({ dynamic: true }))
        .setColor(client.config.embedColour)
        .setTitle(translate(source, history ? "queue.historyTitle" : "queue.title"))
        .setTimestamp()
        .setFooter(buildRequestedByPageFooter(source, user, currentPage));

    const fields = [];
    if (queue.currentTrack) {
        const currentArtist = getDisplayArtist(queue.currentTrack);
        const currentValue = `**${queue.currentTrack.title}** ${buildTrackLinkText(queue.currentTrack, source)}`;
        fields.push({
            name: translate(source, "queue.nowPlayingField"),
            value: currentArtist ? `${currentValue}\n**${currentArtist}**` : currentValue,
        });
    }

    for (let index = start; index < start + PAGE_SIZE && index < tracks.length; index++) {
        const track = tracks[index];
        fields.push({
            name: `${index + 1}. ${track.title}`,
            value: `**${track.author}** ${buildTrackLinkText(track, source)}`,
        });
    }

    embed.addFields(fields);

    const components = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${prefix}:delete`).setStyle(4).setLabel("🗑️"),
        new ButtonBuilder()
            .setCustomId(`${prefix}:page:${Math.max(1, currentPage - 1)}`)
            .setStyle(1)
            .setLabel(translate(source, "queue.previousPage"))
            .setDisabled(currentPage <= 1),
        new ButtonBuilder().setCustomId(`${prefix}:refresh:${currentPage}`).setStyle(2).setLabel("🔄"),
        new ButtonBuilder()
            .setCustomId(`${prefix}:page:${Math.min(totalPages, currentPage + 1)}`)
            .setStyle(1)
            .setLabel(translate(source, "queue.nextPage"))
            .setDisabled(currentPage >= totalPages),
    );

    return { embed, components: [components], page: currentPage, totalPages };
}

async function handleQueueButton(interaction) {
    const parsed = parseQueueButton(interaction.customId);
    if (!parsed) return false;

    if (parsed.action === "delete") {
        if (!(await ensureDjAccess(interaction))) return true;

        await interaction.deferUpdate().catch(() => null);
        await interaction.message.delete().catch(() => null);
        return true;
    }

    try {
        const player = useMainPlayer();
        const queue = player.nodes.get(interaction.guildId);

        if (!queue || !queue.currentTrack) {
            await interaction.reply(getQueueNotPlayingResponse(interaction));
            return true;
        }

        const history = parsed.kind === "queuehistory";
        const tracks = history ? queue.history.tracks.toArray() : queue.tracks.toArray();
        if (tracks.length === 0) {
            await interaction.update({
                content: translate(interaction, history ? "np.backMissing" : "queue.empty"),
                embeds: [],
                components: [],
            });
            return true;
        }

        const { embed, components } = buildQueuePage(interaction, queue, parsed.page, {
            history,
            user: interaction.user,
        });

        await interaction.update({ embeds: [embed], components });
    } catch (error) {
        if (error?.code !== 10008 && error?.code !== 40060) {
            console.log(`[ELITE_QUEUE] Failed to update the queue page: ${error?.message || error}`);
        }
    }

    return true;
}

module.exports = {
    PAGE_SIZE,
    buildQueuePage,
    handleQueueButton,
    parseQueueButton,
};
