require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { Player } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("audiofilter")
        .setDescription("Check or toggle audio filters!")
        .addStringOption((option) => option
            .setName("filter")
            .setDescription("What filter do you want to toggle?")
            .setRequired(false)
            .addChoices(
                {
                    name: "Bassboost",
                    value: "bassboost"
                },
                {
                    name: "8D",
                    value: "8D"
                },
                {
                    name: "Subboost",
                    value: "subboost"
                },
                {
                    name: "Nightcore",
                    value: "nightcore"
                },
                {
                    name: "Surrounding",
                    value: "surrounding"
                },
                {
                    name: "Vaporwave",
                    value: "vaporwave"
                },
                {
                    name: "Normalizer",
                    value: "normalizer"
                },
                {
                    name: "Lofi",
                    value: "lofi"
                },
                {
                    name: "Fadein",
                    value: "fadein"
                }
            )
        ),
    async execute(interaction) {
        const filter = interaction.options.getString("filter");
        if (client.config.enableDjMode) {
            if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
        }

        if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });

        const player = Player.singleton();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });

        if (!filter) {
            var curFilters = queue.filters.ffmpeg.getFiltersEnabled();

            if (curFilters.length == 0) {
                interaction.reply({ content: `There are currently no audio filters enabled!` });
            }

            else {
                interaction.reply({ content: `The currently enabled audio filters are:\n- ${curFilters.join("\n- ")}` });
            }
        }

        else {
            const bassboostembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL({dynamic: true}))
            .setColor(client.config.embedColour)
            .setTitle(`Audio filter toggled 🎵`)
            .setDescription(`The **${filter}** audio filter has been ${queue.filters.ffmpeg.getFiltersEnabled().includes(filter) ? 'Disabled' : 'Enabled'}!`)
            .setTimestamp()
            .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

            try {
                queue.filters.ffmpeg.toggle(filter);
                interaction.reply({ embeds: [bassboostembed] })
            }

            catch (err) {
                interaction.reply({ content: `❌ | Ooops... something went wrong, there was an error adjusting bassboost option. Please try again.`, ephemeral: true });
            }
        }
    }
}