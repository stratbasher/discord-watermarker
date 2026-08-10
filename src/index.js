const { client, start } = require('./bot/client');
const { initDatabase } = require('./database');
const { ensureTempDir } = require('./utils/tempFiles');
const logger = require('./utils/logger');

async function main() {
  try {
    await ensureTempDir();
    await initDatabase();
    start();
  } catch (err) {
    logger.error('Failed to start bot', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

main();

process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down...');
  await client.destroy();
  process.exit(0);
});