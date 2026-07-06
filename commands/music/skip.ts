import "dotenv/config";
import { SlashCommandBuilder } from "@discordjs/builders";
import { useMainPlayer } from "discord-player";
import type { GuildCommandInteraction } from "../../types/discord";
import {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    getQueueNotPlayingResponse,
} from "../../utils/interactionGuards";
import { skipCurrentTrack } from "../../utils/sharedFunctions";

export default {
    data: new SlashCommandBuilder().setName("skip").setDescription("Skip the current song!"),
    async execute(interaction: GuildCommandInteraction): Promise<void> {
        if (!(await ensureDjAccess(interaction))) return;
        if (!(await ensureInVoiceChannel(interaction))) return;
        if (!(await ensureSameVoiceChannel(interaction))) return;

        const player = useMainPlayer();
        const queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) {
            await interaction.reply(getQueueNotPlayingResponse(interaction));
            return;
        }

        await interaction.reply(skipCurrentTrack(interaction, queue, interaction.user));
    },
};
