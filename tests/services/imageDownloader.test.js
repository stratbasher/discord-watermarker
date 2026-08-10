const { downloadImage } = require('../../src/services/imageDownloader');
const { request } = require('undici');
const path = require('path');
const { mkdir, rm } = require('fs').promises;

jest.mock('../../src/config', () => ({
  tempDir: 'C:\\Users\\adamb\\AppData\\Local\\Temp\\watermarker-downloader-test',
  maxFileSize: 25 * 1024 * 1024,
  maxImagesPerMessage: 10,
  watermarkTextColor: '#ffffff',
  watermarkTextOpacity: 0.6,
}));

const testTempBase = path.join('C:\\Users\\adamb\\AppData\\Local\\Temp', 'watermarker-downloader-test');

beforeEach(async () => {
  await mkdir(testTempBase, { recursive: true });
});

afterEach(async () => {
  await rm(testTempBase, { recursive: true, force: true });
});

describe('downloadImage', () => {
  test('rejects non-discord hostnames (evil.com)', async () => {
    await expect(downloadImage('https://evil.com/image.png', 'job1', 'image.png')).rejects.toThrow(/hostname not allowed/i);
  });

  test('throws on invalid URL', async () => {
    await expect(downloadImage('not-a-url', 'job1', 'image.png')).rejects.toThrow('Invalid URL');
  });

  test('throws on non-200 status (mocked undici.request)', async () => {
    const originalRequest = require('undici').request;
    require('undici').request = jest.fn().mockResolvedValue({
      statusCode: 404,
      headers: {},
      body: null,
    });

    await expect(
      downloadImage('https://cdn.discordapp.com/image.png', 'job1', 'image.png')
    ).rejects.toThrow(/status/i);

    require('undici').request = originalRequest;
  });
});
