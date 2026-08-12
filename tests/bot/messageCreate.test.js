jest.mock('../../src/config', () => ({ sendDMs: false }));
jest.mock('../../src/utils/logger', () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../src/bot/events/parsers', () => ({
  parseMessageOptions: jest.fn(() => ({ errors: [], options: {} })),
  formatErrorReply: jest.fn((errors, content) => {
    const escaped = content
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\u200B`')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/~/g, '\\~')
      .replace(/\n/g, '\\n');
    return errors.join('\n') + '\n\nOriginal message:\n```\n' + escaped + '\n```';
  }),
}));
jest.mock('../../src/bot/events/validators', () => ({
  isOwner: jest.fn(),
  validateImages: jest.fn(() => ({ valid: true, errors: [] })),
}));
jest.mock('../../src/bot/events/handlers', () => ({
  handleHelp: jest.fn(),
  handleReload: jest.fn(),
}));
jest.mock('../../src/bot/events/orchestrator/watermarkJob', () => ({
  executeWatermarkJob: jest.fn(),
}));

const { parseMessageOptions, formatErrorReply } = require('../../src/bot/events/parsers');
const { isOwner, validateImages } = require('../../src/bot/events/validators');
const { handleHelp, handleReload } = require('../../src/bot/events/handlers');
const { executeWatermarkJob } = require('../../src/bot/events/orchestrator/watermarkJob');
const messageCreate = require('../../src/bot/events/messageCreate');

function makeMockCollection(entries) {
  const map = new Map(entries);
  map.filter = function (fn) {
    const result = new Map();
    for (const [k, v] of this.entries()) {
      if (fn(v, k, this)) result.set(k, v);
    }
    return result;
  };
  return map;
}

describe('messageCreate routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    parseMessageOptions.mockReturnValue({ errors: [], options: {} });
    validateImages.mockReturnValue({ valid: true, errors: [] });
    isOwner.mockReturnValue(false);
  });

  function makeMockMessage(opts = {}) {
    const {
      authorId = 'user1',
      isBot = false,
      content = '<@123> test',
      mentionsBot = true,
      hasReference = false,
      referenceId = null,
      attachments = [],
      ownerId = 'admin1',
    } = opts;

    const imageAttachments = attachments.filter((a) => a.contentType?.startsWith('image/'));
    const mockMsg = {
      author: { id: authorId, bot: isBot, username: 'TestUser' },
      content,
      channel: { id: 'ch1' },
      attachments: makeMockCollection(imageAttachments.map((a) => [a.name, a])),
      mentions: {
        has: jest.fn((u) => mentionsBot && u.id === '123'),
      },
      client: {
        user: { id: '123' },
        ownerIDs: new Set([ownerId]),
      },
      reference: hasReference ? { messageId: referenceId } : null,
      reply: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    };
    return mockMsg;
  }

  test('ignores bot messages', async () => {
    const msg = makeMockMessage({ isBot: true });
    await messageCreate(msg);
    expect(parseMessageOptions).not.toHaveBeenCalled();
  });

  test('ignores messages without bot mention', async () => {
    const msg = makeMockMessage({ mentionsBot: false, content: 'just text' });
    await messageCreate(msg);
    expect(parseMessageOptions).not.toHaveBeenCalled();
  });

  test('routes to executeWatermarkJob for valid mention with images', async () => {
    const msg = makeMockMessage({
      attachments: [{ name: 'img.png', contentType: 'image/png', size: 1000 }],
    });
    await messageCreate(msg);
    expect(executeWatermarkJob).toHaveBeenCalledTimes(1);
  });

  test('routes /reload to handleReload for owner', async () => {
    isOwner.mockImplementation(() => true);
    const msg = makeMockMessage({ ownerId: 'user1', content: '<@123> /reload' });
    await messageCreate(msg);
    expect(handleReload).toHaveBeenCalledTimes(1);
  });

  test('routes /help to handleHelp for owner', async () => {
    isOwner.mockImplementation(() => true);
    const msg = makeMockMessage({ ownerId: 'user1', content: '<@123> /help' });
    await messageCreate(msg);
    expect(handleHelp).toHaveBeenCalledTimes(1);
  });
});

describe('formatErrorReply', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('includes "Original message:" label before code block', () => {
    const result = formatErrorReply(['Error msg'], '<@bot1> textcolor:bad hello');
    expect(result).toContain('Original message:');
    expect(result).toContain('<@bot1>');
    expect(result).toContain('Error msg');
  });

  test('includes raw content with mention preserved', () => {
    formatErrorReply(['bad color'], '<@bot1> textcolor:xyz');
    expect(formatErrorReply).toHaveBeenCalledWith(['bad color'], '<@bot1> textcolor:xyz');
  });
});
