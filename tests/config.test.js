const path = require('path');
const os = require('os');
const { mkdir, rm, writeFile, unlink } = require('fs').promises;

const testDotEnvPath = path.join(os.tmpdir(), 'watermarker-dotenv-test');

afterAll(async () => {
  await unlink(testDotEnvPath).catch(() => {});
});

function parseEnvFile(contents) {
  const parsed = {};
  contents.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq !== -1) {
        parsed[trimmed.substring(0, eq).trim()] = trimmed.substring(eq + 1).trim();
      }
    }
  });
  return parsed;
}

describe('config', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('throws if DISCORD_TOKEN is missing', async () => {
    await writeFile(testDotEnvPath, 'WATERMARK_KEY=RSP36JX8ueXhpsj7ArtwTD8k\nNODE_ENV=test\n');
    delete process.env.DISCORD_TOKEN;
    const mockParsed = parseEnvFile(require('fs').readFileSync(testDotEnvPath, 'utf-8'));
    jest.doMock('dotenv', () => ({
      config: jest.fn(() => {
        Object.assign(process.env, mockParsed);
        return { parsed: mockParsed };
      }),
    }));
    jest.isolateModules(() => {
      expect(() => require('../src/config')).toThrow('DISCORD_TOKEN is required');
    });
  });

  test('exports correct defaults (maxFileSize: 25MB, maxImagesPerMessage: 10)', async () => {
    await writeFile(testDotEnvPath, 'DISCORD_TOKEN=fake_token\n');
    delete process.env.DISCORD_TOKEN;
    const mockParsed = parseEnvFile(require('fs').readFileSync(testDotEnvPath, 'utf-8'));
    jest.doMock('dotenv', () => ({
      config: jest.fn(() => {
        Object.assign(process.env, mockParsed);
        return { parsed: mockParsed };
      }),
    }));
    jest.isolateModules(async () => {
      const config = require('../src/config');
      expect(config.maxFileSize).toBe(25 * 1024 * 1024);
      expect(config.maxImagesPerMessage).toBe(10);
    });
  });

  test('respects NODE_ENV override', async () => {
    await writeFile(testDotEnvPath, 'DISCORD_TOKEN=fake_token\nNODE_ENV=production\n');
    delete process.env.DISCORD_TOKEN;
    delete process.env.LOG_LEVEL;
    const mockParsed = parseEnvFile(require('fs').readFileSync(testDotEnvPath, 'utf-8'));
    jest.doMock('dotenv', () => ({
      config: jest.fn(() => {
        Object.assign(process.env, mockParsed);
        return { parsed: mockParsed };
      }),
    }));
    jest.isolateModules(async () => {
      const config = require('../src/config');
      expect(config.nodeEnv).toBe('production');
      expect(config.logLevel).toBe('info');
    });
  });
});
