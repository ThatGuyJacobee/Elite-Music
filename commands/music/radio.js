require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { InteractionContextType } = require("discord.js");
const radioFuncs = require("../../utils/radioFunctions");
const { translate } = require("../../utils/botText");
const {
    ensureRadioEnabled,
    ensureRadioAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
} = require("../../utils/interactionGuards");
const { sendRadioErrorMessage } = require("../../utils/radioUi");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("radio")
        .setDescription("Start the administrator-configured radio playlist!")
        .setContexts(InteractionContextType.Guild)
        .addStringOption((option) =>
            option
                .setName("order")
                .setDescription("Order used when starting the radio playlist.")
                .setRequired(false)
                .addChoices({ name: "Shuffle", value: "shuffle" }, { name: "Sequential", value: "sequential" }),
        ),
    async execute(interaction) {
        if (!(await ensureRadioEnabled(interaction))) return;
        if (!(await ensureRadioAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const orderMode = interaction.options.getString("order") ?? "shuffle";
        const voiceChannelId = interaction.member.voice.channelId;
        await interaction.deferReply();

        try {
            return await radioFuncs.startRadio(interaction, orderMode, voiceChannelId);
        } catch (err) {
            console.log(err);

            const errorKey =
                err?.code === "RADIO_PLAYLIST_NOT_FOUND"
                    ? "errors.failedToFindMediaQuery"
                    : err?.code === "RADIO_PLAYLIST_EMPTY"
                      ? "errors.emptyPlaylist"
                      : err?.code === "RADIO_START_IN_PROGRESS"
                        ? "radio.startInProgress"
                        : err?.code === "RADIO_VOICE_STATE_CHANGED"
                          ? "radio.voiceChannelChanged"
                          : err?.code === "RADIO_ADD_TRACKS"
                            ? "errors.addTracks"
                            : err?.code === "RADIO_JOIN_VOICE"
                              ? "errors.joinVoiceChannel"
                              : err?.code === "RADIO_PLAYBACK"
                                ? "errors.playback"
                                : "errors.playRequest";

            return sendRadioErrorMessage(interaction, translate(interaction, errorKey));
        }
    },
};
