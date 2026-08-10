const { safePath, createJobDir, cleanupJobDir } = require('../../src/utils/tempFiles');
const { readdir, rm } = require('fs').promises;

jest.mock('../../src/config', () => ({
  tempDir: 'C:\\Users\\adamb\\AppData\\Local\\Temp\\watermarker-test-tmp',
  maxFileSize: 25 * 1024 * 1024,
  maxImagesPerMessage: 10,
  watermarkTextColor: '#ffffff',
  watermarkTextOpacity: 0.6,
}));

const path = require('path');
const testTempBase = path.join('C:\\Users\\adamb\\AppData\\Local\\Temp', 'watermarker-test-tmp');

afterEach(async () => {
  await rm(testTempBase, { recursive: true, force: true });
});

describe('safePath', () => {
  test('prevents path traversal (../../../etc/passwd throws)', () => {
    expect(() => safePath('job123', '../../../etc/passwd')).toThrow('Path traversal detected');
    expect(() => safePath('job123', '..\\..\\..\\windows\\system32')).toThrow('Path traversal detected');
  });

  test('allows normal filenames', () => {
    const result = safePath('job123', 'image.png');
    expect(result).toContain('job123');
    expect(result).toContain('image.png');
  });
});

describe('createJobDir', () => {
  test('creates a directory for the job id', async () => {
    const jobDir = await createJobDir('abc123');
    const entries = await readdir(testTempBase);
    expect(entries).toContain('abc123');
    expect(jobDir).toContain('abc123');
  });
});

describe('cleanupJobDir', () => {
  test('removes the job directory', async () => {
    await createJobDir('toRemove');
    await cleanupJobDir('toRemove');
    const entries = await readdir(testTempBase);
    expect(entries).not.toContain('toRemove');
  });

  test('does not throw if directory does not exist', async () => {
    await expect(cleanupJobDir('nonexistent')).resolves.not.toThrow();
  });
});
