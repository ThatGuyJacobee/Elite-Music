const { EmbedBuilder, MessageFlags } = require("discord.js");
const { buildRequestedByFooter, translate } = require("./botText");

async function sendRadioStartedMessage(interaction, itemMetadata, playbackContext, imageAttachment) {
    const provider = translate(interaction, `radio.providers.${playbackContext.provider}`);
    const order = translate(interaction, `slash.choices.order.${playbackContext.order}`);

    const embed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail("attachment://coverimage.jpg")
        .setColor(client.config.embedColour)
        .setTitle(translate(interaction, "radio.startedTitle"))
        .setDescription(
            translate(interaction, "radio.startedDescription", {
                title: itemMetadata.title,
                provider,
                order,
                count: itemMetadata.leafCount,
                channel: `<#${interaction.member.voice.channelId}>`,
            }),
        )
        .setTimestamp()
        .setFooter(buildRequestedByFooter(interaction, interaction.user));

    return interaction.editReply({ embeds: [embed], files: [imageAttachment] });
}

async function sendRadioErrorMessage(interaction, content) {
    if (interaction.deferred) {
        await interaction.deleteReply().catch(() => null);
        return interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

module.exports = {
    sendRadioStartedMessage,
    sendRadioErrorMessage,
};
