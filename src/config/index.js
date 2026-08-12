const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const config = {
  // Discord limits
  maxFileSize: 25 * 1024 * 1024,
  maxImagesPerMessage: 10,

  // Watermark defaults
  watermarkTextColor: process.env.WATERMARK_TEXT_COLOR || '#ffffff',
  watermarkTextOpacity: parseFloat(process.env.WATERMARK_TEXT_OPACITY || '0.6'),
  watermarkQuality: parseInt(process.env.WATERMARK_QUALITY || '90', 10),

  // Watermark constants
  minTileSize: 100,
  tileScaleFactor: 0.5,
  minFontSize: 8,
  maxFontSizeRatio: 0.05,
  fontSizeTileDivisor: 5,
  tilePassCount: 3,
  maxWatermarkTextLength: 120,
  textTruncationOffset: 117,
  maxCustomTextLength: 30,
  textTruncateTo: 27,

  // Webhook
  maxWebhookCacheSize: 100,

  // General
  discordToken: process.env.DISCORD_TOKEN,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  dbPath: process.env.DB_PATH || path.join(__dirname, '../../data/watermarker.sqlite'),
  tempDir: process.env.TEMP_DIR || path.join(__dirname, '../../tmp'),
  sendDMs: process.env.SEND_DMS === 'true',
};

if (!config.discordToken) {
  throw new Error('DISCORD_TOKEN is required in environment variables');
}

module.exports = Object.freeze(config);