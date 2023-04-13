const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageEmbed, MessageActionRow, MessageButton, Permissions } = require("discord.js");
const ebmusic = require("../../models/ebmusic.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queue")
        .setDescription("Check the current music that is in the queue!")
        .addIntegerOption((option) => option
            .setName("page")
            .setDescription("What page number from the queue?")
            .setRequired(false)
        ),
    async execute(interaction) {
        const guildid = interaction.guild.id;
        const DJCheck = await ebmusic.findOne({
            where: {
                GuildID: guildid
            }
        });

        if (DJCheck) {
            if (DJCheck.DJToggle == true && !interaction.member.roles.cache.has(DJCheck.DJRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${DJCheck.DJRole}> to use any music commands!`, ephemeral: true });
        }

        global.page = interaction.options.getInteger("page");
        const queue = player.getQueue(interaction.guild)
        if (!queue || !queue.playing) return interaction.reply({ content: `❌ | No music is currently being played!` });
        if (!interaction.member.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        if (!page) global.page = 1;
        const pageStart = 10 * (page - 1);
        const pageEnd = pageStart + 10;
        const currentMusic = queue.current;
        const musiclist = queue.tracks.slice(pageStart, pageEnd).map((m, i) => {
            return `${i + pageStart + 1}# **${m.title}** ([Link](${m.url}))`;
        });

        const queueembed = new MessageEmbed()
        .setAuthor(interaction.client.user.tag, interaction.client.user.displayAvatarURL())
        .setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(0xFF0000)
        .setTitle(`Current Music Queue 🎵`)
        .setDescription(`${musiclist.join('\n')}${queue.tracks.length > pageEnd ? `\n...and ${queue.tracks.length - pageEnd} more track(s)` : ''}`)
        .addField('Now Playing ▶️', `**${currentMusic.title}** | ([Link](${currentMusic.url}))`)
        .setTimestamp()
        .setFooter(`Requested by: ${interaction.user.tag}`)

        const components = [
            actionbutton = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId("queue-delete")
                    .setStyle("DANGER")
                    .setLabel("🗑️"),
                    //.addOptions(options)
                new MessageButton()
                    .setCustomId("queue-pageleft")
                    .setStyle("PRIMARY")
                    .setLabel("⬅️"),
                new MessageButton()
                    .setCustomId("queue-pageright")
                    .setStyle("PRIMARY")
                    .setLabel("➡️")
            )
        ];

        interaction.reply({ embeds: [queueembed], components })
    }
}