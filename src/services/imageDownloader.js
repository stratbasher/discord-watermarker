const { request } = require('undici');
const fs = require('fs').promises;
const { pipeline } = require('stream/promises');
const { createWriteStream } = require('fs');
const path = require('path');
const config = require('../config');

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

  return filePath;
}

module.exports = {
  downloadImage,
};