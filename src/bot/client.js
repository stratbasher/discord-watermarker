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

// Set bot owner for /reload command
const ownerId = process.env.OWNER_ID?.trim();
if (!ownerId) {
  logger.error('OWNER_ID is not set in .env. The /reload command will not work.');
}
client.ownerIDs = new Set(ownerId ? [ownerId] : []);

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

const _messageHandlers = [];

function attachMessageHandler() {
  const handler = require('./events/messageCreate');
  client.on('messageCreate', handler);
  _messageHandlers.push(handler);
  return handler;
}

function detachMessageHandler() {
  for (const handler of _messageHandlers) {
    client.removeListener('messageCreate', handler);
  }
  _messageHandlers.length = 0;
}

const start = async () => {
  attachMessageHandler();
  client.login(config.discordToken);
};

module.exports = { client, start, attachMessageHandler, detachMessageHandler };
