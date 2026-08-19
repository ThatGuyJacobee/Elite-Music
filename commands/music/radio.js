require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
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
        await interaction.deferReply();

        try {
            return await radioFuncs.startRadio(interaction, orderMode);
        } catch (err) {
            console.log(err);

            const errorKey =
                err?.code === "RADIO_PLAYLIST_NOT_FOUND"
                    ? "errors.radioPlaylistNotFound"
                    : err?.code === "RADIO_PLAYLIST_EMPTY"
                      ? "errors.emptyPlaylist"
                      : "errors.radioStart";

            return sendRadioErrorMessage(interaction, translate(interaction, errorKey));
        }
    },
};
