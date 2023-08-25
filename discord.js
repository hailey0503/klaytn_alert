require("dotenv").config();
const {Client, GatewayIntentBits, EmbedBuilder, PermissionBitField, Permissions} = require('discord.js');
const discordClient = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]});
let channel;

discordClient.on("ready", (x) => {
	console.log(`${x.user.tag} is ready!`);
	channel = discordClient.channels.cache.get(process.env.DISCORD_CHANNELID);
	discordClient.user.setActivity('Subscribe to kimchiAlert');
})

const sendDiscordMessage = async (text) => {
	
	const embed = new EmbedBuilder()
		.setTitle("Kimchi Alert!")
		.setDescription(text)
		.setColor('Random')
		.addFields({ 
			name: 'Field title', 
			value: 'Some random value',
			inline: true,
		})
	channel.send({ embeds: [embed] }); 
	
}

discordClient.login(process.env.DISCORD_TOKEN)
module.exports = { discordClient, sendDiscordMessage }