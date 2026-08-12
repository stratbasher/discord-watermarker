const sharp = require('sharp');
const config = require('../config');

function escapeXml(str) {
  return String(str)
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildTileSVG(tileSize, fontSize, textColor, textOpacity, watermarkText) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + tileSize + '" height="' + tileSize + '">' +
    '<text x="' + (tileSize / 2) + '" y="' + (tileSize / 2) + '" ' +
    'font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="' + fontSize + '" ' +
    'fill="' + textColor + '" fill-opacity="' + textOpacity + '" text-anchor="middle" dominant-baseline="middle" ' +
    'transform="rotate(-45, ' + (tileSize / 2) + ', ' + (tileSize / 2) + ')">' +
    watermarkText + '</text></svg>';
}

function calculateFontSize(watermarkText, width, height, tileSize) {
  const estimatedTextWidth = watermarkText.length * 0.55;
  const fontSizeByHeight = Math.round(tileSize / config.fontSizeTileDivisor);
  const fontSizeByWidth = Math.round(tileSize / estimatedTextWidth);
  const maxFontSize = Math.round(height * config.maxFontSizeRatio);

  return Math.max(config.minFontSize, Math.min(fontSizeByHeight, fontSizeByWidth, maxFontSize));
}

function buildComposites(width, height, tileSize) {
  const composites = [];
  const startOffset = -tileSize;
  const passes = [];

  for (let i = 0; i < config.tilePassCount; i++) {
    passes.push({
      offsetX: Math.round((tileSize * (i + 1)) / config.tilePassCount),
      offsetY: Math.round((tileSize * (i + 1)) / config.tilePassCount),
    });
  }

  for (const pass of passes) {
    for (let y = startOffset + pass.offsetY; y < height + tileSize; y += tileSize) {
      for (let x = startOffset + pass.offsetX; x < width + tileSize; x += tileSize) {
        composites.push({
          input: null,
          top: Math.round(y),
          left: Math.round(x),
          blend: 'over',
        });
      }
    }
  }

  return composites;
}

/**
 * Apply a watermark tile pattern to an image.
 *
 * @param {Buffer} inputBuffer - Raw image buffer.
 * @param {string} username - Username to display in watermark.
 * @param {string} guildName - Guild name to display in watermark.
 * @param {object} options - Watermark configuration.
 * @param {string} [options.textColor] - Hex color for the watermark text.
 * @param {number} [options.textOpacity] - Opacity value (0.0-1.0).
 * @param {number} [options.quality] - Output quality (1-100).
 * @param {string} [options.customText] - Custom watermark text.
 * @returns {Promise<Buffer>} Watermarked image buffer.
 */
async function applyWatermark(inputBuffer, username, guildName, options = {}) {
  const baseImage = sharp(inputBuffer);
  const { width, height } = await baseImage.metadata();

  if (!width || !height) {
    throw new Error('Unable to read image dimensions.');
  }

  let watermarkText;
  if (options.customText) {
    watermarkText = escapeXml(options.customText);
  } else {
    const escapedUsername = escapeXml(username);
    const escapedGuildName = escapeXml(guildName || 'DM');
    const combined = escapedUsername + ' | ' + escapedGuildName;
    watermarkText = combined.length > config.maxWatermarkTextLength
      ? combined.slice(0, config.textTruncationOffset) + '...'
      : combined;
  }

  const baseTileSize = Math.min(width, height);
  const tileSize = Math.max(config.minTileSize, Math.round(baseTileSize * config.tileScaleFactor));

  const fontSize = calculateFontSize(watermarkText, width, height, tileSize);

  const textColor = options.textColor || config.watermarkTextColor;
  const textOpacity = options.textOpacity !== undefined ? options.textOpacity : config.watermarkTextOpacity;

  const svgTile = buildTileSVG(tileSize, fontSize, textColor, textOpacity, watermarkText);
  const tileBuffer = Buffer.from(svgTile);
  const composites = buildComposites(width, height, tileSize);

  for (const composite of composites) {
    composite.input = tileBuffer;
  }

  const outputBuffer = await sharp(inputBuffer)
    .composite(composites)
    .webp({ quality: options.quality ?? 90 })
    .toBuffer();

  return outputBuffer;
}

module.exports = {
  applyWatermark,
  calculateFontSize,
  buildTileSVG,
  escapeXml,
};
