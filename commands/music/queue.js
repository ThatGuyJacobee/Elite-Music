require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ActionRowBuilder } = require("discord.js");
const { Player, QueryType } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queue")
        .setDescription("Check the current music that is in the queue!"),
    async execute(interaction) {
        if (process.env.ENABLE_DJMODE == true) {
            if (!interaction.member.roles.cache.has(process.env.DJ_ROLE)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${process.env.DJ_ROLE}> to use any music commands!`, ephemeral: true });
        }

        if (!interaction.member.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.followUp({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        
        const player = Player.singleton();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });
        
        const queuedTracks = queue.tracks.toArray();
        if (!queuedTracks[0]) return interaction.reply({ content: `❌ | There is no music is currently in the queue!`, ephemeral: true });
        
        const queueembed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(process.env.EMBED_COLOUR)
        .setTitle(`Current Music Queue 🎵`)
        .setTimestamp()
        .setFooter({ text: `Requested by: ${interaction.user.tag}` })

        var curPage = 1;
        var i = (curPage * 10) - 10;
        var curTracks = [];

        curTracks.push({ name: 'Now Playing ▶️', value: `**${queue.currentTrack.title}** ([Link](${queue.currentTrack.url}))` },)

        for (i; i < curPage * 10; i++) {
            if (queuedTracks[i]) {
                curTracks.push({ name: `${i + 1}. ${queuedTracks[i].title}`, value: `**${queuedTracks[i].author}** ([Link](${queuedTracks[i].url}))` },)
            }
        }

        queueembed.addFields(curTracks);

        var timestamp = Date.now();
        var finalComponents = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`queue-${timestamp}-delete`)
                .setStyle(4)
                .setLabel("🗑️"),
                //.addOptions(options)
            new ButtonBuilder()
                .setCustomId(`queue-${timestamp}-previous`)
                .setStyle(1)
                .setLabel("⬅️"),
            new ButtonBuilder()
                .setCustomId(`queue-${timestamp}-next`)
                .setStyle(1)
                .setLabel("➡️")
        )

        interaction.reply({ embeds: [queueembed], components: [finalComponents] })

        const filter = (interaction) => interaction.customId.includes(`queue-${timestamp}`)
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 })

        collector.on('collect', async (buttonResponse) => {
			if (buttonResponse.customId.includes('delete')) {
				return buttonResponse.message.delete()
			}

			const player = Player.singleton()
			var queue = player.nodes.get(interaction.guild.id)
			const queuedTracks = queue.tracks.toArray()

			if (!queuedTracks[0]) {
				return interaction.editReply({ content: `❌ | There is no music is currently in the queue!`, components: [] })
			}

			const queueembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL({dynamic: true}))
            .setColor(process.env.EMBED_COLOUR)
            .setTitle(`Current Music Queue 🎵`)
            .setTimestamp()

			if (buttonResponse.customId.includes('next')) {
				var size = queuedTracks.length
				if (curPage == Math.ceil(size / 10)) return buttonResponse.deferUpdate()
				curPage++
			}

			else if (buttonResponse.customId.includes('previous')) {
				if (curPage == 1) return buttonResponse.deferUpdate()
				curPage--
			}

			var i = (curPage * 10) - 10
			var curTracks = []

			curTracks.push({ name: 'Now Playing ▶️', value: `**${queue.currentTrack.title}** ([Link](${queue.currentTrack.url}))` },)

			for (i; i < curPage * 10; i++) {
				if (queuedTracks[i]) {
					curTracks.push({ name: `${i + 1}. ${queuedTracks[i].title}`, value: `**${queuedTracks[i].author}** ([Link](${queuedTracks[i].url}))` },)
				}
			}

			queueembed.addFields(curTracks)
			queueembed.setFooter({ text: `Requested by: ${interaction.user.tag} - Page ${curPage}` })
			interaction.editReply({ embeds: [queueembed] })
			buttonResponse.deferUpdate()
		})

		//Remove the buttons once it expires
		collector.on('end', async () => {
			interaction.editReply({ content: 'Please use **/queue** again to show the embed again.', components: [] })
		})
    }
}