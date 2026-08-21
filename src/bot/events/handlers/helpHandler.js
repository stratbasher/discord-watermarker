/**
 * Handle the /help command: send help instructions to the user.
 *
 * @param {import('discord.js').Message} message - The message triggering the help command.
 */
const logger = require('../../../utils/logger');

async function handleHelp(message) {
  try {
    await message.author.send([
      'Hey! Here\'s how to use me:',
      '',
      'Just mention me (@Watermarker) with up to 10 images attached and I\'ll add a watermark to them.',
      '',
      '**Basic usage:**',
      '@Watermarker <attach an image>',
      '',
      '**Customize the watermark:**',
      '\u2022 `textcolor:red` / `color:red` \u2014 change the text color (use hex codes like `#ff0000` or color names like `red`, `blue`, `gold`) ',
      '\u2022 `opacity:50%` \u2014 adjust how opaque the watermark is (0-100% or 0.0-1.0) ',
      '\u2022 `transparency:50%` \u2014 adjust how transparent the watermark is (0-100% or 0.0-1.0, inverse of opacity) ',
      '\u2022 `quality:80` \u2014 set image quality (1-100) ',
      '\u2022 `text:"my custom text"` \u2014 replace the default watermark text with anything you want ',
      '',
      'Example: @Watermarker textcolor:gold opacity:30% <attach an image>',
      'Example: @Watermarker text:"Made with love" <attach an image>',
      '',
      'Drop an image, mention me, and you\'ll get a watermarked version back!',
    ].join('\n'));
  } catch (err) {
    if (err.code === 50007) {
      logger.info(`DMs blocked for ${message.author.tag}, unable to send help`);
    } else {
      logger.error(`Help DM send failed for ${message.author.tag}: ${err.message}`);
    }
  }
  await message.delete().catch(() => {});
}

module.exports = { handleHelp };
