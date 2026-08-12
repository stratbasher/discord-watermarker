const crypto = require('crypto');
const fs = require('fs');
const sharp = require('sharp');
const config = require('../../../config');
const logger = require('../../../utils/logger');
const { createJobDir, cleanupJobDir } = require('../../../utils/tempFiles');
const { downloadImage } = require('../../../services/imageDownloader');
const { applyWatermark } = require('../../../services/watermark');
const { postViaWebhook } = require('../../../services/webhookPoster');
const WatermarkJob = require('../../../database/models/WatermarkJob');
const { stripCommandSwitches } = require('../parsers/stripper');

/**
 * Execute the full watermark job pipeline: download, process, post via webhook, and update DB.
 *
 * @param {import('discord.js').Message} message - The originating message.
 * @param {import('discord.js').Collection<string, import('discord.js').MessageAttachment>} images - Filtered image attachments.
 * @param {object} options - Parsed watermark options.
 * @param {string} [options.textColor] - Hex color for the watermark text.
 * @param {number} [options.textOpacity] - Opacity value (0.0-1.0).
 * @param {number} [options.quality] - Output quality (1-100).
 * @param {string} [options.customText] - Custom watermark text.
 * @param {(message, content: string) => Promise<import('discord.js').Message>} sendUserReply - Reply helper that may DM.
 * @returns {Promise<void>}
 */
async function executeWatermarkJob(message, images, options, sendUserReply) {
  const { formatErrorReply } = require('../parsers/stripper');

  const textColor = options.textColor || config.watermarkTextColor;
  const textOpacity = options.textOpacity !== undefined ? options.textOpacity : config.watermarkTextOpacity;
  const quality = options.quality ?? config.watermarkQuality;
  const customText = options.customText;

  const jobId = crypto.randomUUID();
  await createJobDir(jobId);
  let processingMsg = null;
  const imageHashes = [];

  let jobRecord = null;
  try {
    processingMsg = await message.channel.send({ content: `Processing ${images.size} image(s)...` });
    jobRecord = await WatermarkJob.create({
      id: jobId,
      userId: message.author.id,
      username: message.author.username,
      guildId: message.guild?.id,
      guildName: message.guild?.name,
      channelId: message.channel.id,
      originalMessageContent: message.content,
      imageCount: images.size,
      status: 'processing',
    });

    const downloadedImages = [];
    let idx = 0;

    const dlStart = Date.now();
    const downloadPromises = [];
    for (const attachment of images.values()) {
      const originalName = attachment.name || `image-${idx}.jpg`;
      const baseName = originalName.replace(/\.[^.]+$/, '');
      logger.debug(`[messageCreate] Downloading attachment: url=${attachment.url}, name=${attachment.name}, size=${attachment.size}, contentType=${attachment.contentType}`);
      downloadPromises.push(
        downloadImage(attachment.url, jobId, `input-${idx}.png`)
          .then(inputPath => fs.promises.readFile(inputPath))
          .then(inputBuffer => ({ inputBuffer, idx, originalName, baseName }))
      );
      idx++;
    }

    const downloadedResults = await Promise.all(downloadPromises);
    downloadedImages.push(...downloadedResults);
    logger.debug(`[${jobId}] Downloaded ${downloadedImages.length} images in ${Date.now() - dlStart}ms`);

    await message.delete().catch(() => {});

    const watermarkedBuffers = [];
    const outputFilenames = [];

    const processingPromises = downloadedImages.map(async ({ inputBuffer, idx, baseName }) => {
      const t0 = Date.now();
      logger.debug(`[${jobId}] [${idx}] input ${inputBuffer.length} bytes`);

      const t1 = Date.now();
      const watermarkedBuffer = await applyWatermark(
        inputBuffer,
        message.author.username,
        message.guild?.name,
        { textColor, textOpacity, quality, customText }
      );
      const watermarkedMeta = await sharp(watermarkedBuffer).metadata();
      logger.debug(`[${jobId}] [${idx}] watermarked ${watermarkedMeta.width}x${watermarkedMeta.height} ${watermarkedBuffer.length} bytes in ${Date.now() - t1}ms`);

      logger.debug(`[${jobId}] [${idx}] total image processing ${Date.now() - t0}ms`);

      return {
        finalBuffer: watermarkedBuffer,
        hash: crypto.createHash('sha256').update(watermarkedBuffer).digest('hex'),
        filename: `${baseName}.webp`,
      };
    });

    const t4 = Date.now();
    const processingResults = await Promise.all(processingPromises);
    logger.debug(`[${jobId}] All images processed in ${Date.now() - t4}ms`);

    for (const result of processingResults) {
      imageHashes.push(result.hash);
      watermarkedBuffers.push(result.finalBuffer);
      outputFilenames.push(result.filename);
    }

    const t5 = Date.now();
    const cleanContent = stripCommandSwitches(
      message.content.replace(/<@!?[\d]+>/g, '').trim()
    );
    const webhookMsgId = await postViaWebhook(message.channel, message.author, cleanContent, watermarkedBuffers, outputFilenames);
    logger.debug(`[${jobId}] Webhook send in ${Date.now() - t5}ms`);

    logger.info(`[${jobId}] Job completed in ${Date.now() - dlStart}ms`);

    await jobRecord.update({
      status: 'completed',
      imageHashes,
      messageId: webhookMsgId,
    });
  } catch (err) {
    logger.error(`Job ${jobId} failed: ${err.message}`, { stack: err.stack });
    if (jobRecord) {
      await jobRecord.update({ status: 'failed', errorMessage: err.message });
    }
    if (processingMsg) {
      await processingMsg.edit('Failed to process images. Please try again later.').catch(() => {});
    }
  } finally {
    await cleanupJobDir(jobId);
    if (processingMsg) {
      processingMsg.delete().catch(() => {});
    }
  }
}

module.exports = { executeWatermarkJob };
