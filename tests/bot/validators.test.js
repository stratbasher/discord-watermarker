const { isOwner, validateImages } = require('../../src/bot/events/validators/imageValidator');
const { formatErrorReply } = require('../../src/bot/events/parsers/stripper');

describe('isOwner', () => {
  test('returns true for owner', () => {
    const mockMsg = {
      client: { ownerIDs: new Set(['123456']) },
      author: { id: '123456' },
    };
    expect(isOwner(mockMsg)).toBe(true);
  });

  test('returns false for non-owner', () => {
    const mockMsg = {
      client: { ownerIDs: new Set(['111111']) },
      author: { id: '222222' },
    };
    expect(isOwner(mockMsg)).toBe(false);
  });

  test('handles missing ownerIDs', () => {
    const mockMsg = {
      client: {},
      author: { id: '123456' },
    };
    expect(isOwner(mockMsg)).toBe(false);
  });
});

describe('validateImages', () => {
  const mockContent = 'test message';

  test('rejects zero images', () => {
    const mockImages = { size: 0, values: () => [] };
    const result = validateImages(mockImages, mockContent);
    expect(result.valid).toBe(false);
  });

  test('rejects too many images', () => {
    const mockImages = {
      size: 15,
      values: () => [],
    };
    const result = validateImages(mockImages, mockContent);
    expect(result.valid).toBe(false);
  });

  test('rejects oversized image', () => {
    const mockImages = {
      size: 1,
      values: function* () {
        yield { name: 'big.png', size: 30 * 1024 * 1024 };
      },
    };
    const result = validateImages(mockImages, mockContent);
    expect(result.valid).toBe(false);
  });

  test('accepts valid images under limit', () => {
    const mockImages = {
      size: 2,
      values: function* () {
        yield { name: 'small.png', size: 1024 * 1024 };
        yield { name: 'also-small.png', size: 2 * 1024 * 1024 };
      },
    };
    const result = validateImages(mockImages, mockContent);
    expect(result.valid).toBe(true);
  });

  test('accepts exactly max images', () => {
    const mockImages = {
      size: 10,
      values: function* () {
        yield { name: 'img.png', size: 1024 };
      },
    };
    const result = validateImages(mockImages, mockContent);
    expect(result.valid).toBe(true);
  });
});
