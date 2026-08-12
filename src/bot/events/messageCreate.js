const config = require('../../config');
const logger = require('../../utils/logger');
const { parseMessageOptions, formatErrorReply } = require('./parsers');
const { isOwner, validateImages } = require('./validators');
const { handleHelp, handleReload } = require('./handlers');
const { executeWatermarkJob } = require('./orchestrator/watermarkJob');

/**
 * Send a reply to the user, via DM if enabled, falling back to in-channel.
 *
 * @param {import('discord.js').Message} message - The original message.
 * @param {string} content - Reply content.
 * @returns {Promise<import('discord.js').Message>}
 */
async function sendUserReply(message, content) {
  if (!config.sendDMs) {
    return await message.reply({ content });
  }
  try {
    await message.author.send(content);
    logger.debug(`DM sent to ${message.author.tag}`);
  } catch (err) {
    if (err.code === 50007) {
      logger.info(`DMs blocked for ${message.author.tag}, replying in-channel`);
    } else {
      logger.error(`DM send failed for ${message.author.tag}: ${err.message}`);
    }
    await message.reply({ content });
  }
}

/**
 * Handle the /delete command: find and delete the target watermark message by reply reference.
 *
 * @param {import('discord.js').Message} message - The message triggering the delete.
 * @param {(message, content: string) => Promise<void>} sendUserReply - Reply helper.
 */
async function handleDelete(message, sendUserReply) {
  const { Op } = require('sequelize');
  const WatermarkJob = require('../../database/models/WatermarkJob');
  const ref = message.reference;
  if (!ref?.messageId) {
    await sendUserReply(message, 'You must reply to the watermark message you want to delete.');
    return;
  }

  const jobId = ref.messageId;

  const job = await WatermarkJob.findOne({
    where: { messageId: jobId, status: { [Op.ne]: 'deleted' } },
  });

  if (!job) {
    await sendUserReply(message, 'That message is not a recognized watermark from this bot.');
    return;
  }

  if (job.userId !== message.author.id) {
    await sendUserReply(message, 'You can only delete watermarks you created.');
    return;
  }

  try {
    const channel = await message.client.channels.fetch(job.channelId);
    const webhookMsg = await channel.messages.fetch(jobId);

    await webhookMsg.delete();
    await job.update({ status: 'deleted' });
    await sendUserReply(message, 'Watermarked image has been deleted.');
  } catch {
    await sendUserReply(message, 'Could not delete the watermark message. It may no longer exist.');
  }
}

/**
 * Main message handler: parse, validate, and dispatch watermark jobs.
 *
 * @param {import('discord.js').Message} message - Incoming Discord message.
 */
module.exports = async function messageCreate(message) {
  if (message.author.bot) return;

  const rawContent = message.content;
  const strippedContent = rawContent.replace(/<@!?[\d]+>/g, '').trim();

  if (message.mentions.has(message.client.user) && isOwner(message)) {
    if (strippedContent === '/reload' || strippedContent.startsWith('/reload ')) {
      await handleReload(message, sendUserReply);
      return;
    }
    if (strippedContent === '/help' || strippedContent.startsWith('/help ')) {
      await handleHelp(message, sendUserReply);
      return;
    }
  }

  if (message.mentions.has(message.client.user) && strippedContent === '/delete') {
    await handleDelete(message, sendUserReply);
    return;
  }

  if (!message.mentions.has(message.client.user)) return;

  if (message.reference?.messageId && strippedContent === 'delete') {
    await handleDelete(message, sendUserReply);
    return;
  }

  const messageContent = rawContent.replace(/<@!?[\d]+>/g, '').trim();

  const { errors, options } = parseMessageOptions(messageContent);
  if (errors.length > 0) {
    await sendUserReply(message, formatErrorReply(errors, rawContent));
    await message.delete().catch(() => {});
    return;
  }

  const images = message.attachments.filter(a => a.contentType?.startsWith('image/'));
  const validation = validateImages(images, rawContent);
  if (!validation.valid) {
    await sendUserReply(message, validation.errors[0]);
    await message.delete().catch(() => {});
    return;
  }

  await executeWatermarkJob(message, images, options, sendUserReply);
};
