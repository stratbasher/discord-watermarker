const sharp = require('sharp')
const config = require('../config')

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildComposites(width, height, tileSize, tileBuffer) {
  const composites = []
  const startOffset = -tileSize

  // Base the pass shift math strictly on the 33% increments of your tileSize
  const passes = [
    { offsetX: 0, offsetY: 0 },
    { offsetX: Math.round(tileSize / 3), offsetY: Math.round(tileSize / 3) },
    { offsetX: Math.round((tileSize * 2) / 3), offsetY: Math.round((tileSize * 2) / 3) }
  ]

  for (const pass of passes) {
    // Step exactly by the tileSize so tiles sit perfectly edge-to-edge on each pass
    for (let y = startOffset + pass.offsetY; y < height + tileSize; y += tileSize) {
      for (let x = startOffset + pass.offsetX; x < width + tileSize; x += tileSize) {
        composites.push({
          input: tileBuffer,
          top: Math.round(y),
          left: Math.round(x),
          blend: 'over'
        })
      }
    }
  }

  return composites
}

async function applyWatermark(inputBuffer, username, guildName, options = {}) {
  const baseImage = sharp(inputBuffer)
  const { width, height } = await baseImage.metadata()

  if (!width || !height) {
    throw new Error("Unable to read image dimensions.")
  }

  const escapedUsername = escapeXml(username)
  const escapedGuildName = escapeXml(guildName || 'DM')
  const combined = escapedUsername + ' | ' + escapedGuildName
  const watermarkText = combined.length > 120 ? combined.slice(0, 117) + '...' : combined

  const tileSize = Math.round(height / 2)
  const fontSizeByHeight = Math.round(tileSize / 5)
  const fontSizeByWidth = Math.round(tileSize / (watermarkText.length * 0.55))
  const fontSize = Math.max(10, Math.min(fontSizeByHeight, fontSizeByWidth))

  const textColor = options.textColor || config.watermarkTextColor
  const textOpacity = options.textOpacity !== undefined ? options.textOpacity : config.watermarkTextOpacity

  const svgTile = '<svg xmlns="http://www.w3.org/2000/svg" width="' + tileSize + '" height="' + tileSize + '">' +
    '<text x="' + (tileSize / 2) + '" y="' + (tileSize / 2) + '" ' +
    'font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="' + fontSize + '" ' +
    'fill="' + textColor + '" fill-opacity="' + textOpacity + '" text-anchor="middle" dominant-baseline="middle" ' +
    'transform="rotate(-45, ' + (tileSize / 2) + ', ' + (tileSize / 2) + ')">' +
    watermarkText + '</text></svg>'

  const tileBuffer = Buffer.from(svgTile)
  const composites = buildComposites(width, height, tileSize, tileBuffer)

  const outputBuffer = await sharp(inputBuffer)
    .composite(composites)
    .webp({ quality: options.quality ?? 90 })
    .toBuffer()

  return outputBuffer
}

module.exports = {
  applyWatermark
}
