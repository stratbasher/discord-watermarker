const { Collection, AttachmentBuilder } = require('discord.js');

const MAX_WEBHOOK_CACHE_SIZE = 100;
const webhookCache = new Collection();

async function getOrCreateWebhook(channel) {
  const cached = webhookCache.get(channel.id);
  if (cached) return cached;

  if (webhookCache.size >= MAX_WEBHOOK_CACHE_SIZE) {
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

async function postViaWebhook(channel, user, messageContent, imageBuffers, filenames) {
  const webhook = await getOrCreateWebhook(channel);

  const files = imageBuffers.map((buffer, i) => {
    if (buffer.length > 25 * 1024 * 1024) {
      throw new Error(`Output file ${filenames[i]} is too large: ${buffer.length} bytes`);
    }
    return new AttachmentBuilder(Buffer.from(buffer), { name: filenames[i] || `watermarked-${i + 1}.png` });
  });

  await webhook.send({
    content: messageContent,
    username: user.username,
    avatarURL: user.displayAvatarURL(),
    files,
  });
}

module.exports = {
  getOrCreateWebhook,
  postViaWebhook,
};