jest.mock('discord.js', () => {
  const realDiscord = jest.requireActual('discord.js');
  return {
    ...realDiscord,
    Collection: realDiscord.Collection || Map,
  };
});

const { getOrCreateWebhook } = require('../../src/services/webhookPoster');

describe('getOrCreateWebhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates a webhook if none exists', async () => {
    const emptyMap = new Map();
    emptyMap.find = () => undefined;

    const mockChannel = {
      id: 'channel1',
      fetchWebhooks: jest.fn().mockResolvedValue(emptyMap),
      createWebhook: jest.fn().mockResolvedValue({ name: 'Watermarker' }),
      client: {
        user: {
          displayAvatarURL: jest.fn().mockReturnValue('https://example.com/avatar.png'),
        },
      },
    };

    const result = await getOrCreateWebhook(mockChannel);
    expect(result).toEqual({ name: 'Watermarker' });
    expect(mockChannel.createWebhook).toHaveBeenCalledTimes(1);
    expect(mockChannel.fetchWebhooks).toHaveBeenCalledTimes(1);
  });

  test('reuses existing webhook', async () => {
    const existingWebhook = { name: 'Watermarker', id: 'webhook1' };
    const collection = new Map([['webhook1', existingWebhook]]);
    collection.find = (fn) => {
      for (const [, val] of collection) {
        if (fn(val)) return val;
      }
      return undefined;
    };

    const mockChannel = {
      id: 'channel2',
      fetchWebhooks: jest.fn().mockResolvedValue(collection),
      createWebhook: jest.fn().mockResolvedValue({ name: 'Watermarker' }),
      client: {
        user: {
          displayAvatarURL: jest.fn().mockReturnValue('https://example.com/avatar.png'),
        },
      },
    };

    const result = await getOrCreateWebhook(mockChannel);
    expect(result).toBe(existingWebhook);
    expect(mockChannel.createWebhook).not.toHaveBeenCalled();
    expect(mockChannel.fetchWebhooks).toHaveBeenCalledTimes(1);
  });
});
