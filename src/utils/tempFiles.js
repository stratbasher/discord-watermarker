const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

async function ensureTempDir() {
  await fs.mkdir(config.tempDir, { recursive: true });
}

async function createJobDir(jobId) {
  const jobDir = path.resolve(config.tempDir, jobId);
  await fs.mkdir(jobDir, { recursive: true });
  return jobDir;
}

async function cleanupJobDir(jobId) {
  const jobDir = path.resolve(config.tempDir, jobId);
  try {
    await fs.rm(jobDir, { recursive: true, force: true });
  } catch (err) {
    // ignore cleanup errors
  }
}

function safePath(jobId, filename) {
  const resolved = path.resolve(config.tempDir, jobId, filename);
  if (!resolved.startsWith(path.resolve(config.tempDir, jobId))) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

module.exports = {
  ensureTempDir,
  createJobDir,
  cleanupJobDir,
  safePath,
};