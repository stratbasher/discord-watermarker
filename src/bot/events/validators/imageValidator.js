const config = require('../../../config');

/**
 * Check if the message author is a bot owner.
 *
 * @param {import('discord.js').Message} message - The message to check.
 * @returns {boolean}
 */
function isOwner(message) {
  return message.client.ownerIDs?.has(message.author.id) || false;
}

/**
 * Validate that attachments are valid images for watermarking.
 *
 * @param {import('discord.js').Collection<string, import('discord.js').MessageAttachment>} images - Filtered image attachments.
 * @param {string} rawContent - Original message content (with mentions) for error formatting.
 * @returns {{ errors: string[], valid: boolean }}
 */
function validateImages(images, messageContent) {
  const errors = [];
  const { formatErrorReply } = require('../parsers/stripper');

  if (images.size === 0) {
    errors.push('Please attach at least one image to watermark.');
    return { errors: [formatErrorReply(errors, messageContent)], valid: false };
  }

  if (images.size > config.maxImagesPerMessage) {
    errors.push(`You can only process up to ${config.maxImagesPerMessage} images at once.`);
    return { errors: [formatErrorReply(errors, messageContent)], valid: false };
  }

  for (const attachment of images.values()) {
    if (attachment.size > config.maxFileSize) {
      const { stripDiscordMentions } = require('../parsers/stripper');
      const safeName = stripDiscordMentions(attachment.name);
      errors.push(`Image "${safeName}" exceeds the 25 MB limit.`);
      return { errors: [formatErrorReply(errors, messageContent)], valid: false };
    }
  }

  return { errors: [], valid: true };
}

module.exports = {
  isOwner,
  validateImages,
};
