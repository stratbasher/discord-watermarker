# Plan: Tests

## Approach

Simple Jest tests — no mocking frameworks, no integration tests. Static checks and basic unit tests for the 5 key modules. One file per module, 3-5 tests each.

## Setup

1. Add `"jest": "^29.7.0"` to `devDependencies` in `package.json`
2. Add `"test": "jest --forceExit"` to `scripts` in `package.json`
3. Create `jest.config.js`: `{ testEnvironment: 'node' }`
4. Delete `test-tile.js` stub

## Test Files (5 total)

### `tests/config.test.js`
- Config throws if `DISCORD_TOKEN` is missing
- Config throws if `WATERMARK_KEY` is still the default
- Config exports correct defaults (`maxFileSize: 25MB`, `maxImagesPerMessage: 10`)
- Config respects `NODE_ENV` override

### `tests/utils/tempFiles.test.js`
- `safePath` prevents path traversal (`../../../etc/passwd` throws)
- `ensureTempDir` / `createJobDir` / `cleanupJobDir` work as expected (create and remove dirs)

### `tests/services/watermark.test.js`
- `applyWatermark()` returns a buffer
- Output is WebP format (check sharp metadata)
- Text with `<script>` tags is XML-escaped (no raw HTML in output buffer)

### `tests/services/imageDownloader.test.js`
- `downloadImage()` rejects non-discord hostnames (`evil.com`)
- `downloadImage()` throws on invalid URL
- `downloadImage()` throws on non-200 status (mock undici.request)

### `tests/services/webhookPoster.test.js`
- `getOrCreateWebhook()` creates a webhook if none exists (mock channel.fetchWebhooks)
- `getOrCreateWebhook()` reuses existing webhook (mock channel.fetchWebhooks returns one)

## Validation

Run `npm test` — all 5 files, ~15 tests total, pass clean.
