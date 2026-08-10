const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const config = {
  discordToken: process.env.DISCORD_TOKEN,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../data/watermarker.sqlite'),
  tempDir: process.env.TEMP_DIR || path.join(__dirname, '../../tmp'),
  maxFileSize: 25 * 1024 * 1024,
  maxImagesPerMessage: 10,
  watermarkTextColor: process.env.WATERMARK_TEXT_COLOR || '#ffffff',
  watermarkTextOpacity: parseFloat(process.env.WATERMARK_TEXT_OPACITY || '0.6'),
};

if (!config.discordToken) {
  throw new Error('DISCORD_TOKEN is required in environment variables');
}

module.exports = Object.freeze(config);