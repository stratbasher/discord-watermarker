const { calculateFontSize, buildTileSVG, escapeXml } = require('../../src/services/watermark');

jest.mock('../../src/config', () => ({
  fontSizeTileDivisor: 5,
  minFontSize: 8,
  maxFontSizeRatio: 0.05,
  tilePassCount: 3,
  maxWatermarkTextLength: 120,
  textTruncationOffset: 117,
}));

describe('calculateFontSize', () => {
  test('returns reasonable font size for short text', () => {
    const size = calculateFontSize('A', 1920, 1080, 500);
    expect(typeof size).toBe('number');
    expect(size).toBeGreaterThan(0);
  });

  test('returns minimum font size for very long text on small tile', () => {
    const size = calculateFontSize('abcdefghijklmnopqrstuvwxyz', 200, 200, 100);
    expect(size).toBeGreaterThanOrEqual(8);
  });

  test('caps font size for large images', () => {
    // height=1080, maxFontSize = 1080*0.05 = 54
    const size = calculateFontSize('A', 1920, 1080, 900);
    expect(size).toBeLessThanOrEqual(54);
  });

  test('returns smaller font for wider text on same tile', () => {
    const shortSize = calculateFontSize('Hi', 800, 600, 400);
    const longSize = calculateFontSize('This is a very long watermark text string', 800, 600, 400);
    expect(longSize).toBeLessThanOrEqual(shortSize);
  });
});

describe('buildTileSVG', () => {
  test('returns valid SVG string', () => {
    const svg = buildTileSVG(200, 24, '#ff0000', 0.5, 'Test');
    expect(svg).toContain('<svg');
    expect(svg).toContain('Test');
    expect(svg).toContain('#ff0000');
    expect(svg).toContain('0.5');
  });

  test('rotates text at -45 degrees', () => {
    const svg = buildTileSVG(200, 24, '#ffffff', 0.6, 'test');
    expect(svg).toContain('rotate(-45');
  });
});

describe('escapeXml', () => {
  test('escapes ampersand', () => {
    expect(escapeXml('a&b')).toBe('a&amp;b');
  });

  test('escapes angle brackets', () => {
    expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
  });

  test('escapes quotes', () => {
    expect(escapeXml('"hello\'')).toBe('&quot;hello&apos;');
  });

  test('strips non-ASCII characters', () => {
    expect(escapeXml('héllo')).toBe('hllo');
  });

  test('passes through safe ASCII', () => {
    expect(escapeXml('Hello World 123')).toBe('Hello World 123');
  });
});
