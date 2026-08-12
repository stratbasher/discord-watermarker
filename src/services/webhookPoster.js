const { Collection, AttachmentBuilder } = require('discord.js');
const config = require('../config');

const webhookCache = new Collection();

/**
 * Get an existing Watermarker webhook from the channel cache, or create a new one.
 *
 * @param {import('discord.js').TextChannel} channel - Discord text channel.
 * @returns {Promise<import('discord.js').Webhook>}
 */
async function getOrCreateWebhook(channel) {
  const cached = webhookCache.get(channel.id);
  if (cached) return cached;

  if (webhookCache.size >= config.maxWebhookCacheSize) {
    const firstKey = webhookCache.keys().next().value;
    webhookCache.delete(firstKey);
  }

  const webhooks = await channel.fetchWebhooks();
  let webhook = webhooks.find(w => w.name === 'Watermarker');

  if (!webhook) {
    webhook = await channel.createWebhook({ name: 'Watermarker', avatar: channel.client.user.displayAvatarURL() });
  }

  webhookCache.set(channel.id, webhook);
  return webhook;
}

/**
 * Post watermarked images to a channel via webhook.
 *
 * @param {import('discord.js').TextChannel} channel - Target channel.
 * @param {import('discord.js').User} user - Original message author (for username/avatar).
 * @param {string} messageContent - Caption text.
 * @param {Buffer[]} imageBuffers - Watermarked image buffers.
 * @param {string[]} filenames - Output filenames.
 * @returns {Promise<string>} Webhook message ID.
 */
async function postViaWebhook(channel, user, messageContent, imageBuffers, filenames) {
  const webhook = await getOrCreateWebhook(channel);

  const files = imageBuffers.map((buffer, i) => {
    if (buffer.length > config.maxFileSize) {
      throw new Error(`Output file ${filenames[i]} is too large: ${buffer.length} bytes`);
    }
    return new AttachmentBuilder(Buffer.from(buffer), { name: filenames[i] || `watermarked-${i + 1}.png` });
  });

  const webhookMsg = await webhook.send({
    content: messageContent,
    username: user.username,
    avatarURL: user.displayAvatarURL(),
    files,
  });

  return webhookMsg.id;
}

module.exports = {
  getOrCreateWebhook,
  postViaWebhook,
};