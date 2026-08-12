const fs = require('fs');
const path = require('path');
const config = require('../../../config');
const logger = require('../../../utils/logger');
const { clearSrcCache } = require('../../../utils/reload');
const { detachMessageHandler, attachMessageHandler } = require('../../../bot/client');

/**
 * Handle the /reload command: clear require cache and re-attach message handlers.
 *
 * @param {import('discord.js').Message} message - The message triggering the reload.
 * @param {(message, content: string) => Promise<void>} sendUserReply - Reply helper.
 */
async function handleReload(message, sendUserReply) {
  const start = Date.now();
  const cleared = clearSrcCache();

  if (cleared.length === 0) {
    await sendUserReply(message, 'No modules to reload.');
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

    await sendUserReply(message, `Reloaded ${cleared.length} module(s) in ${Date.now() - start}ms:\n\`\`\`${cleared.slice(0, 20).join('\n')}${cleared.length > 20 ? '\n...(truncated)' : ''}\n\`\`\``);
    await message.delete().catch(() => {});
    logger.info(`Reloaded ${cleared.length} modules in ${Date.now() - start}ms`);
  } catch (err) {
    logger.error(`Reload failed: ${err.message}`, { stack: err.stack });
    await sendUserReply(message, 'Reload failed. Check logs for details.');
    await message.delete().catch(() => {});
  }
}

module.exports = { handleReload };
