require("dotenv").config();
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder } = require("discord.js");
const { Player } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queuehistory")
        .setDescription("Check the past history of the queue within the guild!"),
    async execute(interaction) {
        if (client.config.enableDjMode) {
            if (!interaction.member.roles.cache.has(client.config.djRole)) return interaction.reply({ content: `❌ | DJ Mode is active! You must have the DJ role <@&${client.config.djRole}> to use any music commands!`, ephemeral: true });
        }
        
        if (!interaction.member.voice.channelId) return await interaction.reply({ content: "❌ | You are not in a voice channel!", ephemeral: true });
        if (interaction.guild.members.me.voice.channelId && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId) return await interaction.reply({ content: "❌ | You are not in my voice channel!", ephemeral: true });
        
        const player = Player.singleton();
        var queue = player.nodes.get(interaction.guild.id);
        if (!queue || !queue.isPlaying()) return interaction.reply({ content: `❌ | No music is currently being played!`, ephemeral: true });
        
        const previousTracks = queue.history.tracks.toArray();
        if (!previousTracks[0]) return interaction.reply({ content: `❌ | There is no music history prior to the current song. Please try again.`, ephemeral: true });

        const historyembed = new EmbedBuilder()
        .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
        .setThumbnail(interaction.guild.iconURL({dynamic: true}))
        .setColor(client.config.embedColour)
        .setTitle(`Past Music Queue History 🔙`)
        //.setDescription(`${musiclist.join('\n')}${queue.previousTracks.length > (pageStart * -1) ? `\n...and ${(queue.previousTracks.length + pageStart)} more track(s)` : ''}`)
        //.addField('Now Playing ▶️', `**${currentMusic.title}** | ([Link](${currentMusic.url}))`)
        .setTimestamp()
        .setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username}` })

        var curPage = 1;
        var i = (curPage * 10) - 10;
        var curTracks = [];

        curTracks.push({ name: 'Now Playing ▶️', value: `**${queue.currentTrack.title}** ${queue.currentTrack.queryType != 'arbitrary' ? `([Link](${queue.currentTrack.url}))` : ''}` },)

        for (i; i < curPage * 10; i++) {
            if (previousTracks[i]) {
                curTracks.push({ name: `${i + 1}. ${previousTracks[i].title}`, value: `**${previousTracks[i].author}** ${previousTracks[i].queryType != 'arbitrary' ? `([Link](${previousTracks[i].url}))` : ''}` },)
            }
        }

        historyembed.addFields(curTracks);

        var timestamp = Date.now();
        var finalComponents = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`queuehistory-${timestamp}-delete`)
                .setStyle(4)
                .setLabel("🗑️"),
                //.addOptions(options)
            new ButtonBuilder()
                .setCustomId(`queuehistory-${timestamp}-previous`)
                .setStyle(1)
                .setLabel("⬅️"),
            new ButtonBuilder()
                .setCustomId(`queuehistory-${timestamp}-next`)
                .setStyle(1)
                .setLabel("➡️")
        )

        interaction.reply({ embeds: [historyembed], components: [finalComponents] })

        const filter = (interaction) => interaction.customId.includes(`queuehistory-${timestamp}`)
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 300000 })

        collector.on('collect', async (buttonResponse) => {
			if (buttonResponse.customId.includes('delete')) {
				return buttonResponse.message.delete()
			}

			const player = Player.singleton()
			var queue = player.nodes.get(interaction.guild.id)
			const previousTracks = queue.history.tracks.toArray();

			if (!previousTracks[0]) {
				return interaction.editReply({ content: '❌ | There is no music history prior to the current song. Please try again.', components: [] })
			}

			const queueembed = new EmbedBuilder()
            .setAuthor({ name: interaction.client.user.tag, iconURL: interaction.client.user.displayAvatarURL() })
            .setThumbnail(interaction.guild.iconURL({dynamic: true}))
            .setColor(client.config.embedColour)
            .setTitle(`Past Music Queue History 🔙`)
            .setTimestamp()

			if (buttonResponse.customId.includes('next')) {
				var size = previousTracks.length
				if (curPage == Math.ceil(size / 10)) return buttonResponse.deferUpdate()
				curPage++
			}

			else if (buttonResponse.customId.includes('previous')) {
				if (curPage == 1) return buttonResponse.deferUpdate()
				curPage--
			}

			var i = (curPage * 10) - 10
			var curTracks = []

			curTracks.push({ name: 'Now Playing ▶️', value: `**${queue.currentTrack.title}** ${queue.currentTrack.queryType != 'arbitrary' ? `([Link](${queue.currentTrack.url}))` : ''}` },)

			for (i; i < curPage * 10; i++) {
				if (previousTracks[i]) {
					curTracks.push({ name: `${i + 1}. ${previousTracks[i].title}`, value: `**${previousTracks[i].author}** ${previousTracks[i].queryType != 'arbitrary' ? `([Link](${previousTracks[i].url}))` : ''}` },)
				}
			}

			queueembed.addFields(curTracks)
			queueembed.setFooter({ text: `Requested by: ${interaction.user.discriminator != 0 ? interaction.user.tag : interaction.user.username} - Page ${curPage}` })
			interaction.editReply({ embeds: [queueembed] })
			buttonResponse.deferUpdate()
		})

		//Remove the buttons once it expires
		collector.on('end', async () => {
			interaction.editReply({ content: 'Please use **/queuehistory** again to show the embed again.', components: [] })
		})
    }
}