const config = require('../../../config');

/**
 * Remove all Discord mention syntax from text.
 *
 * @param {string} text - Raw message content.
 * @returns {string} Text with mentions stripped.
 */
function stripDiscordMentions(text) {
  return text
    .replace(/<@!?[\d]+>\s*/g, '')
    .replace(/<@&[\d]+>\s*/g, '')
    .replace(/<#[\d]+>/g, '')
    .replace(/\b@everyone\b/gi, '')
    .replace(/\b@here\b/gi, '');
}

/**
 * Format validation errors as a markdown-code-block reply.
 *
 * @param {string[]} errors - List of error messages.
 * @param {string} messageContent - Original message content to echo in code block.
 * @returns {string} Formatted error reply.
 */
function formatErrorReply(errors, messageContent) {
  let escapedContent = messageContent
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\u200B`')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\~')
    .replace(/\n/g, '\\n');
  return errors.join('\n') + '\n\nOriginal message:\n```\n' + escapedContent + '\n```';
}

/**
 * Strip command switches and mentions from message content for the final watermark caption.
 *
 * @param {string} content - Raw message content.
 * @returns {string} Content with switches and mentions removed.
 */
function stripCommandSwitches(content) {
  return content
    .replace(/(?:textcolor|color)\s*:\s*[^ ]+/gi, '')
    .replace(/opacity\s*:\s*(?:\d+(?:\.\d+)?%?)\s*/gi, '')
    .replace(/transparency\s*:\s*(?:\d+(?:\.\d+)?%?)\s*/gi, '')
    .replace(/quality\s*:\s*\d+\s*/gi, '')
    .replace(/text\s*:\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/<@!?[\d]+>\s*/g, '')
    .replace(/<@&[\d]+>\s*/g, '')
    .replace(/<#[\d]+>/g, '')
    .replace(/\b@everyone\b/gi, '')
    .replace(/\b@here\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

module.exports = {
  stripDiscordMentions,
  formatErrorReply,
  stripCommandSwitches,
};
