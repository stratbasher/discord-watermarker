const { Client, GatewayIntentBits } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Set bot owner for /reload command (replace with your Discord user ID)
client.ownerIDs = new Set(['YOUR_DISCORD_USER_ID']);

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', require('./events/messageCreate'));

const start = () => client.login(config.discordToken);

module.exports = { client, start };
