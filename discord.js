require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, Permissions } = require('discord.js');
const client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]});

client.on("ready", ()=> {
	console.log("Bot is ready")
	client.user.setActivity("subscribe to kimchi ")
})

client.login(process.env.DISCORD_TOKEN);
