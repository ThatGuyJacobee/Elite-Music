import "dotenv/config";
import { SlashCommandBuilder } from "@discordjs/builders";
import {
    ActionRowBuilder,
    ButtonBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
} from "discord.js";
import type { GuildCommandInteraction } from "../../types/discord";
import type { ExtendedClient } from "../../types";
import { buildRequestedByFooter, translate, translateSearchMediaType } from "../../utils/botText";
import {
    ensureDjAccess,
    ensureInVoiceChannel,
    ensureSameVoiceChannel,
    ensureJellyfinEnabled,
    ephemeralReply,
} from "../../utils/interactionGuards";
import { getQueue } from "../../utils/sharedFunctions";
import { formatDurationMs } from "../../utils/utilityFunctions";
import {
    jellyfinSearchQuery,
    jellyfinAddPlaylist,
    jellyfinAddAlbum,
    jellyfinAddTrack,
} from "../../utils/jellyfinFunctions";

const client = (globalThis as any).client as ExtendedClient;
const pickerEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

const jellyfinScopeSlashOption = (option: any) =>
    option
        .setName("scope")
        .setDescription("Pick what type of content to search for.")
        .setRequired(false)
        .addChoices(
            { name: "Auto (all types)", value: "auto" },
            { name: "Tracks only", value: "track" },
            { name: "Playlists only", value: "playlist" },
            { name: "Albums only", value: "album" },
        );

const jellyfinOrderSlashOption = (option: any) =>
    option
        .setName("order")
        .setDescription("Order used when adding multiple tracks from a playlist or album.")
        .setRequired(false)
        .addChoices(
            { name: "Sequential", value: "sequential" },
            { name: "Shuffle", value: "shuffle" },
            { name: "Reverse", value: "reverse" },
        );

export default {
    data: new SlashCommandBuilder()
        .setName("jellyfin")
        .setDescription("Play music from your Jellyfin library into the queue!")
        .addSubcommand((subcommand: any) =>
            subcommand
                .setName("play")
                .setDescription("Play a track, playlist, or album from your Jellyfin server.")
                .addStringOption((option: any) =>
                    option
                        .setName("music")
                        .setDescription("Search query for a track, playlist, or album.")
                        .setRequired(true),
                )
                .addStringOption(jellyfinScopeSlashOption)
                .addStringOption(jellyfinOrderSlashOption),
        )
        .addSubcommand((subcommand: any) =>
            subcommand
                .setName("search")
                .setDescription("Search tracks, playlists, and albums.")
                .addStringOption((option: any) =>
                    option
                        .setName("music")
                        .setDescription("Search query for a track, playlist, or album.")
                        .setRequired(true),
                )
                .addStringOption(jellyfinScopeSlashOption)
                .addStringOption(jellyfinOrderSlashOption),
        )
        .addSubcommand((subcommand: any) =>
            subcommand
                .setName("playnext")
                .setDescription("Add a track, playlist, or album from your Jellyfin server to play next.")
                .addStringOption((option: any) =>
                    option
                        .setName("music")
                        .setDescription("Search query for a track, playlist, or album.")
                        .setRequired(true),
                )
                .addStringOption(jellyfinScopeSlashOption)
                .addStringOption(jellyfinOrderSlashOption),
        ),
    async execute(interaction: GuildCommandInteraction): Promise<void> {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "play" || subcommand === "playnext" || subcommand === "search") {
            return runJellyfinFlow(interaction, {
                subcommand,
                forcePicker: subcommand === "search",
            });
        }
    },
};

async function assertJellyfinSlashGuards(interaction: GuildCommandInteraction): Promise<boolean> {
    if (!(await ensureDjAccess(interaction))) return false;
    if (!(await ensureJellyfinEnabled(interaction))) return false;
    if (!(await ensureInVoiceChannel(interaction))) return false;
    if (!(await ensureSameVoiceChannel(interaction))) return false;
    return true;
}

async function runJellyfinFlow(
    interaction: GuildCommandInteraction,
    { subcommand, forcePicker }: { subcommand: string; forcePicker?: boolean },
): Promise<void> {
    const guardsOk = await assertJellyfinSlashGuards(interaction);
    if (!guardsOk) return;

    const query = interaction.options.getString("music")!;
    const searchScope = interaction.options.getString("scope") ?? "auto";
    const playlistOrder = interaction.options.getString("order") ?? "sequential";
    await getQueue(interaction);

    try {
        const results = await jellyfinSearchQuery(query, { scope: searchScope });
        if (!results) {
            await interaction.reply(
                ephemeralReply({
                    content: translate(interaction, "errors.failedToFindMediaQuery"),
                }),
            );
            return;
        }

        await interaction.deferReply();

        const playNextFlag = subcommand === "playnext";
        const shouldShowPicker = forcePicker || results.size >= 2;

        if (shouldShowPicker) {
            const embedFields: { name: string; value: string }[] = [];
            let count = 1;

            const actionmenu = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("jellyfinsearch")
                    .setMinValues(1)
                    .setMaxValues(1)
                    .setPlaceholder(translate(interaction, "search.placeholder")),
            );

            if (results.songs) {
                for (const item of results.songs) {
                    if (count > 10) break;

                    const durationLabel = formatDurationMs((item as any).RunTimeTicks ?? 0);
                    const songTitle = `${(item as any).Album ?? "Unknown Album"} - ${item.Name}`;
                    embedFields.push({
                        name: translate(interaction, "search.mediaResult", {
                            index: count,
                            type: translateSearchMediaType(interaction, "track"),
                            suffix: durationLabel,
                        }),
                        value: songTitle,
                    });

                    (actionmenu.components[0] as StringSelectMenuBuilder).addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(songTitle.length > 100 ? `${songTitle.substring(0, 97)}...` : songTitle)
                            .setValue(`song|${playNextFlag}|${playlistOrder}|${item.Id}`)
                            .setDescription(translate(interaction, "search.duration", { duration: durationLabel }))
                            .setEmoji(pickerEmojis[count - 1]),
                    );
                    count++;
                }
            }

            if (results.albums) {
                for (const item of results.albums) {
                    if (count > 10) break;

                    const albumSongCount = Number((item as any).ChildCount ?? 0);
                    const albumSongCountLabel =
                        Number.isFinite(albumSongCount) && albumSongCount > 0
                            ? translate(interaction, "search.songCount", { count: albumSongCount })
                            : "";

                    const albumTitle = (item as any).AlbumArtist
                        ? `${item.Name as string} - ${(item as any).AlbumArtist as string}`
                        : (item.Name as string);
                    embedFields.push({
                        name: albumSongCountLabel
                            ? translate(interaction, "search.mediaResult", {
                                  index: count,
                                  type: translateSearchMediaType(interaction, "album"),
                                  suffix: albumSongCountLabel,
                              })
                            : translate(interaction, "search.mediaResultNoSuffix", {
                                  index: count,
                                  type: translateSearchMediaType(interaction, "album"),
                              }),
                        value: albumTitle,
                    });

                    (actionmenu.components[0] as StringSelectMenuBuilder).addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(albumTitle.length > 100 ? `${albumTitle.substring(0, 97)}...` : albumTitle)
                            .setValue(`album|${playNextFlag}|${playlistOrder}|${item.Id}`)
                            .setDescription(albumSongCountLabel || translate(interaction, "search.album"))
                            .setEmoji(pickerEmojis[count - 1]),
                    );
                    count++;
                }
            }

            if (results.playlists) {
                for (const item of results.playlists) {
                    if (count > 10) break;

                    const playlistSongCount = Number((item as any).ChildCount ?? 0);
                    const playlistSongCountLabel =
                        Number.isFinite(playlistSongCount) && playlistSongCount > 0
                            ? translate(interaction, "search.songCount", { count: playlistSongCount })
                            : "";

                    embedFields.push({
                        name: playlistSongCountLabel
                            ? translate(interaction, "search.mediaResult", {
                                  index: count,
                                  type: translateSearchMediaType(interaction, "playlist"),
                                  suffix: playlistSongCountLabel,
                              })
                            : translate(interaction, "search.mediaResultNoSuffix", {
                                  index: count,
                                  type: translateSearchMediaType(interaction, "playlist"),
                              }),
                        value: item.Name as string,
                    });

                    (actionmenu.components[0] as StringSelectMenuBuilder).addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(
                                (item.Name as string).length > 100
                                    ? `${(item.Name as string).substring(0, 97)}...`
                                    : (item.Name as string),
                            )
                            .setValue(`playlist|${playNextFlag}|${playlistOrder}|${item.Id}`)
                            .setDescription(playlistSongCountLabel || translate(interaction, "search.playlist"))
                            .setEmoji(pickerEmojis[count - 1]),
                    );
                    count++;
                }
            }

            const searchEmbedDescription =
                results.size >= 2
                    ? translate(interaction, "search.multipleResults")
                    : translate(interaction, "search.singleResult");

            const searchEmbed = new EmbedBuilder()
                .setAuthor({
                    name: interaction.client.user!.tag,
                    iconURL: interaction.client.user!.displayAvatarURL(),
                })
                .setThumbnail(interaction.guild.iconURL())
                .setTitle(translate(interaction, "search.jellyfinTitle"))
                .setDescription(searchEmbedDescription)
                .addFields(embedFields)
                .setColor(client.config.embedColour as any)
                .setTimestamp()
                .setFooter(buildRequestedByFooter(interaction, interaction.user));

            const actionbutton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("np-delete")
                    .setStyle(4)
                    .setLabel(translate(interaction, "search.cancel")),
            );

            await interaction.followUp({ embeds: [searchEmbed], components: [actionmenu, actionbutton] as any });
            return;
        }

        const itemFound =
            (results.songs && results.songs[0]) ||
            (results.playlists && results.playlists[0]) ||
            (results.albums && results.albums[0]);

        if (itemFound.type === "playlist" || (itemFound as any).Type === "Playlist") {
            await jellyfinAddPlaylist(interaction, itemFound, "send", playlistOrder, playNextFlag);
        } else if (itemFound.type === "album" || (itemFound as any).Type === "MusicAlbum") {
            await jellyfinAddAlbum(interaction, itemFound, "send", playlistOrder, playNextFlag);
        } else {
            await jellyfinAddTrack(interaction, playNextFlag, itemFound, "send");
        }
    } catch (err) {
        console.log(err);
        const errorMessage = translate(interaction, "errors.playRequest");
        if (interaction.deferred) {
            await interaction
                .followUp({ content: errorMessage, flags: MessageFlags.Ephemeral })
                .catch(() => interaction.editReply({ content: errorMessage }));
        } else {
            await interaction.reply(ephemeralReply({ content: errorMessage }));
        }
    }
}
