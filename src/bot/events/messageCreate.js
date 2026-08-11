const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const config = require('../../config');
const logger = require('../../utils/logger');
const { clearSrcCache } = require('../../utils/reload');
const { createJobDir, cleanupJobDir } = require('../../utils/tempFiles');
const { downloadImage } = require('../../services/imageDownloader');
const { applyWatermark } = require('../../services/watermark');
const { postViaWebhook } = require('../../services/webhookPoster');
const WatermarkJob = require('../../database/models/WatermarkJob');
const { detachMessageHandler, attachMessageHandler } = require('../../bot/client');

const CSS_BASIC_COLORS = {
  'aliceblue': '#f0f8ff', 'antiquewhite': '#faebd7', 'aqua': '#00ffff',
  'aquamarine': '#7fffd4', 'azure': '#f0ffff', 'beige': '#f5f5dc',
  'bisque': '#ffe4c4', 'black': '#000000', 'blanchedalmond': '#ffebcd',
  'blue': '#0000ff', 'blueviolet': '#8a2be2', 'brown': '#a52a2a',
  'burlywood': '#deb887', 'cadetblue': '#5f9ea0', 'chartreuse': '#7fff00',
  'chocolate': '#d2691e', 'coral': '#ff7f50', 'cornflowerblue': '#6495ed',
  'cornsilk': '#fff8dc', 'crimson': '#dc143c', 'cyan': '#00ffff',
  'darkblue': '#00008b', 'darkcyan': '#008b8b', 'darkgoldenrod': '#b8860b',
  'darkgray': '#a9a9a9', 'darkgreen': '#006400', 'darkgrey': '#a9a9a9',
  'darkkhaki': '#bdb76b', 'darkmagenta': '#8b008b', 'darkolivegreen': '#556b2f',
  'darkorange': '#ff8c00', 'darkorchid': '#9932cc', 'darkred': '#8b0000',
  'darksalmon': '#e9967a', 'darkseagreen': '#8fbc8f', 'darkslateblue': '#483d8b',
  'darkslategray': '#2f4f4f', 'darkslategrey': '#2f4f4f', 'darkturquoise': '#00ced1',
  'darkviolet': '#9400d3', 'deeppink': '#ff1493', 'deepskyblue': '#00bfff',
  'dimgray': '#696969', 'dimgrey': '#696969', 'dodgerblue': '#1e90ff',
  'firebrick': '#b22222', 'floralwhite': '#fffaf0', 'forestgreen': '#228b22',
  'fuchsia': '#ff00ff', 'gainsboro': '#dcdcdc', 'ghostwhite': '#f8f8ff',
  'gold': '#ffd700', 'goldenrod': '#daa520', 'gray': '#808080',
  'green': '#008000', 'greenyellow': '#adff2f', 'grey': '#808080',
  'honeydew': '#f0fff0', 'hotpink': '#ff69b4', 'indianred': '#cd5c5c',
  'indigo': '#4b0082', 'ivory': '#fffff0', 'khaki': '#f0e68c',
  'lavender': '#e6e6fa', 'lavenderblush': '#fff0f5', 'lawngreen': '#7cfc00',
  'lemonchiffon': '#fffacd', 'lightblue': '#add8e6', 'lightcoral': '#f08080',
  'lightcyan': '#e0ffff', 'lightgoldenrodyellow': '#fafad2', 'lightgray': '#d3d3d3',
  'lightgreen': '#90ee90', 'lightgrey': '#d3d3d3', 'lightpink': '#ffb6c1',
  'lightsalmon': '#ffa07a', 'lightseagreen': '#20b2aa', 'lightskyblue': '#87cefa',
  'lightslategray': '#778899', 'lightslategrey': '#778899', 'lightsteelblue': '#b0c4de',
  'lightyellow': '#ffffe0', 'lime': '#00ff00', 'limegreen': '#32cd32',
  'linen': '#faf0e6', 'magenta': '#ff00ff', 'maroon': '#800000',
  'mediumaquamarine': '#66cdaa', 'mediumblue': '#0000cd', 'mediumorchid': '#ba55d3',
  'mediumpurple': '#9370db', 'mediumseagreen': '#3cb371', 'mediumslateblue': '#7b68ee',
  'mediumspringgreen': '#00fa9a', 'mediumturquoise': '#48d1cc', 'mediumvioletred': '#c71585',
  'midnightblue': '#191970', 'mintcream': '#f5fffa', 'mistyrose': '#ffe4e1',
  'moccasin': '#ffe4b5', 'navajowhite': '#ffdead', 'navy': '#000080',
  'oldlace': '#fdf5e6', 'olive': '#808000', 'olivedrab': '#6b8e23',
  'orange': '#ffa500', 'orangered': '#ff4500', 'orchid': '#da70d6',
  'palegoldenrod': '#eee8aa', 'palegreen': '#98fb98', 'paleturquoise': '#afeeee',
  'palevioletred': '#db7093', 'papayawhip': '#ffefd5', 'peachpuff': '#ffdab9',
  'peru': '#cd853f', 'pink': '#ffc0cb', 'plum': '#dda0dd',
  'powderblue': '#b0e0e6', 'purple': '#800080', 'rebeccapurple': '#663399',
  'red': '#ff0000', 'rosybrown': '#bc8f8f', 'royalblue': '#4169e1',
  'saddlebrown': '#8b4513', 'salmon': '#fa8072', 'sandybrown': '#f4a460',
  'seagreen': '#2e8b57', 'seashell': '#fff5ee', 'sienna': '#a0522d',
  'silver': '#c0c0c0', 'skyblue': '#87ceeb', 'slateblue': '#6a5acd',
  'slategray': '#708090', 'slategrey': '#708090', 'snow': '#fffafa',
  'springgreen': '#00ff7f', 'steelblue': '#4682b4', 'tan': '#d2b48c',
  'teal': '#008080', 'thistle': '#d8bfd8', 'tomato': '#ff6347',
  'turquoise': '#40e0d0', 'violet': '#ee82ee', 'wheat': '#f5deb3',
  'white': '#ffffff', 'whitesmoke': '#f5f5f5', 'yellow': '#ffff00',
  'yellowgreen': '#9acd32',
};

const VALID_OPTIONS = ['textcolor', 'opacity', 'quality'];

function validateHexColor(color) {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return true;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) return true;
  return false;
}

function parseMessageOptions(content) {
  const errors = [];
  const options = {};

  const textcolorMatch = content.match(/textcolor:(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|[a-zA-Z]+)/i);
  if (textcolorMatch) {
    let color = textcolorMatch[1];
    if (color.length === 4) {
      color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    if (CSS_BASIC_COLORS[color.toLowerCase()]) {
      options.textColor = CSS_BASIC_COLORS[color.toLowerCase()];
    } else if (validateHexColor(color)) {
      options.textColor = color;
    } else {
      errors.push(`Invalid textcolor: "${textcolorMatch[1]}" — use hex (#fff, #ff0000) or a CSS color name`);
    }
  }

  const opacityMatch = content.match(/opacity:(\d+(?:\.\d+)?)(%)?/);
  if (opacityMatch) {
    let value = parseFloat(opacityMatch[1]);
    const isPercent = !!opacityMatch[2];
    if (isPercent) {
      if (value < 0 || value > 100) {
        errors.push(`Invalid opacity: ${value}% — must be 0 to 100`);
      } else {
        options.textOpacity = value / 100;
      }
    } else {
      if (value < 0 || value > 1) {
        errors.push(`Invalid opacity: ${value} — must be 0.0 to 1.0 (or use %, e.g. 50%)`);
      } else {
        options.textOpacity = value;
      }
    }
  }

  const qualityMatch = content.match(/quality:(\d+)/);
  if (qualityMatch) {
    const val = parseInt(qualityMatch[1], 10);
    if (val < 1 || val > 100) {
      errors.push(`Invalid quality: ${val} — must be 1 to 100`);
    } else {
      options.quality = val;
    }
  }

  const foundOptions = new Set();
  for (const match of content.matchAll(/([a-z]+):/gi)) {
    foundOptions.add(match[1].toLowerCase());
  }
  for (const opt of foundOptions) {
    if (!VALID_OPTIONS.includes(opt)) {
      errors.push(`Unknown option: "${opt}" — valid options are ${VALID_OPTIONS.join(', ')}`);
    }
  }

  return { errors, options };
}

function stripCommandSwitches(content) {
  return content
    .replace(/textcolor:[^ ]+/gi, '')
    .replace(/opacity:[^ ]+/gi, '')
    .replace(/quality:[^ ]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function isOwner(message) {
  return message.client.ownerIDs?.has(message.author.id) || false;
}

async function handleReload(message) {
  const start = Date.now();
  const cleared = clearSrcCache();

  if (cleared.length === 0) {
    await message.reply({ content: 'No modules to reload.', ephemeral: true });
    await message.delete().catch(() => {});
    return;
  }

  try {
    detachMessageHandler();
    const eventsPath = __dirname;
    for (const file of fs.readdirSync(eventsPath)) {
      if (file.endsWith('.js')) {
        require(path.join(eventsPath, file));
      }
    }
    attachMessageHandler();

    await message.reply({
      content: `Reloaded ${cleared.length} module(s) in ${Date.now() - start}ms:\n\`\`\`${cleared.slice(0, 20).join('\n')}${cleared.length > 20 ? '\n...(truncated)' : ''}\n\`\`\``,
      ephemeral: true,
    });
    await message.delete().catch(() => {});
    logger.info(`Reloaded ${cleared.length} modules in ${Date.now() - start}ms`);
  } catch (err) {
    logger.error(`Reload failed: ${err.message}`, { stack: err.stack });
    await message.reply({ content: `Reload failed: ${err.message}`, ephemeral: true });
    await message.delete().catch(() => {});
  }
}

module.exports = async function messageCreate(message) {
  if (message.author.bot) return;

  const rawContent = message.content;
  const strippedContent = rawContent.replace(/<@!?[\d]+>/g, '').trim();

  if (message.mentions.has(message.client.user) && isOwner(message)) {
    if (strippedContent === '/reload' || strippedContent.startsWith('/reload ')) {
      await handleReload(message);
      return;
    }
  }

  if (!message.mentions.has(message.client.user)) return;

  const messageContent = rawContent.replace(/<@!?[\d]+>/g, '').trim();

  const { errors, options } = parseMessageOptions(messageContent);
  if (errors.length > 0) {
    await message.reply({
      content: errors.join('\n'),
      ephemeral: true,
    });
    await message.delete().catch(() => {});
    return;
  }

  const images = message.attachments.filter(a => a.contentType?.startsWith('image/'));
  if (images.size === 0) {
    await message.reply({ content: 'Please attach at least one image to watermark.', ephemeral: true });
    await message.delete().catch(() => {});
    return;
  }

  if (images.size > config.maxImagesPerMessage) {
    await message.reply({ content: `You can only process up to ${config.maxImagesPerMessage} images at once.`, ephemeral: true });
    await message.delete().catch(() => {});
    return;
  }

  for (const attachment of images.values()) {
    if (attachment.size > config.maxFileSize) {
      await message.reply({ content: `Image "${attachment.name}" exceeds the 25 MB limit.`, ephemeral: true });
      await message.delete().catch(() => {});
      return;
    }
  }

  const textColor = options.textColor || config.watermarkTextColor;
  const textOpacity = options.textOpacity !== undefined ? options.textOpacity : config.watermarkTextOpacity;
  const quality = options.quality ?? config.watermarkQuality;

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
      const originalName = attachment.name || `image-${idx}.jpg`
      const baseName = originalName.replace(/\.[^.]+$/, '')
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
        { textColor, textOpacity, quality }
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
    const cleanContent = stripCommandSwitches(messageContent);
    await postViaWebhook(message.channel, message.author, cleanContent, watermarkedBuffers, outputFilenames);
    logger.debug(`[${jobId}] Webhook send in ${Date.now() - t5}ms`);

    logger.info(`[${jobId}] Job completed in ${Date.now() - dlStart}ms`);

    await jobRecord.update({
      status: 'completed',
      imageHashes,
    });
  } catch (err) {
    logger.error(`Job ${jobId} failed: ${err.message}`, { stack: err.stack });
    if (jobRecord) {
      await jobRecord.update({ status: 'failed', errorMessage: err.message });
    }
    if (processingMsg) {
      await processingMsg.edit(`Failed to process images: ${err.message}`).catch(() => {});
    }
  } finally {
    await cleanupJobDir(jobId);
    if (processingMsg) {
      processingMsg.delete().catch(() => {});
    }
  }
};
