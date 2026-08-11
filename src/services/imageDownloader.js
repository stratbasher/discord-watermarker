const { request } = require('undici');
const fsp = require('fs').promises;
const { pipeline } = require('stream/promises');
const { createWriteStream } = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

const ALLOWED_HOSTNAMES = ['cdn.discordapp.com', 'media.discordapp.net'];

async function downloadImage(url, jobId, filename) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!ALLOWED_HOSTNAMES.includes(parsed.hostname)) {
    throw new Error(`URL hostname not allowed: ${parsed.hostname}`);
  }

  const response = await request(url, {
    timeout: 30000,
  });

  if (response.statusCode !== 200) {
    const safeHeaders = {
      'content-type': response.headers['content-type'],
      'content-length': response.headers['content-length'],
      server: response.headers['server'],
    };
    logger.error(`[imageDownloader] url=${url}, statusCode=${response.statusCode}, headers=${JSON.stringify(safeHeaders)}`);
    throw new Error(`Download failed with status ${response.statusCode}`);
  }

  const contentType = response.headers['content-type'];
  if (!contentType || !contentType.startsWith('image/')) {
    throw new Error(`Invalid content type: ${contentType}`);
  }

  const contentLength = response.headers['content-length'];
  if (contentLength && parseInt(contentLength, 10) > config.maxFileSize) {
    throw new Error(`File exceeds maximum size of ${config.maxFileSize} bytes`);
  }

  const filePath = path.resolve(config.tempDir, jobId, filename);
  await pipeline(response.body, createWriteStream(filePath));

  // Validate downloaded size matches Content-Length
  const actualSize = await fsp.stat(filePath).then(s => s.size);
  const expectedSize = parseInt(contentLength, 10);
  if (contentLength && expectedSize && actualSize > expectedSize * 1.1) {
    await fsp.unlink(filePath).catch(() => {});
    throw new Error(`Downloaded file size (${actualSize} bytes) exceeds Content-Length (${expectedSize} bytes)`);
  }

  return filePath;
}

module.exports = {
  downloadImage,
};