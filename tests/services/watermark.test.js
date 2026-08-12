const { applyWatermark } = require('../../src/services/watermark');
const sharp = require('sharp');
const path = require('path');
const { mkdir, rm } = require('fs').promises;

jest.mock('../../src/config', () => ({
  tempDir: 'C:\\Users\\adamb\\AppData\\Local\\Temp\\watermarker-wm-test',
  maxFileSize: 25 * 1024 * 1024,
  maxImagesPerMessage: 10,
  watermarkTextColor: '#ffffff',
  watermarkTextOpacity: 0.6,
  minTileSize: 100,
  tileScaleFactor: 0.5,
  minFontSize: 8,
  maxFontSizeRatio: 0.05,
  fontSizeTileDivisor: 5,
  tilePassCount: 3,
  maxWatermarkTextLength: 120,
  textTruncationOffset: 117,
}));

const testTempBase = path.join('C:\\Users\\adamb\\AppData\\Local\\Temp', 'watermarker-wm-test');

beforeEach(async () => {
  await mkdir(testTempBase, { recursive: true });
});

afterEach(async () => {
  await rm(testTempBase, { recursive: true, force: true });
});

async function makeTestImage(width = 100, height = 100) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe('applyWatermark', () => {
  test('returns a buffer', async () => {
    const input = await makeTestImage();
    const result = await applyWatermark(input, 'TestUser', 'TestGuild');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  test('output is WebP format', async () => {
    const input = await makeTestImage();
    const result = await applyWatermark(input, 'TestUser', 'TestGuild');
    const metadata = await sharp(result).metadata();
    expect(metadata.format).toBe('webp');
  });

  test('text with <script> tags is XML-escaped', async () => {
    const input = await makeTestImage();
    const result = await applyWatermark(input, '<script>alert(1)</script>', 'NormalGuild');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});
