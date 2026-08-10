# Plan: Final Review — Bug Fixes, Inefficiencies, Security

## Scope

Apply fixes for identified bugs, inefficiencies, and security concerns in the Watermarker Discord bot.

## 1. Priority Fixes (Must Address)

### B1: `processingMsg` TDZ Error — `src/bot/events/messageCreate.js`

**Problem**: `processingMsg` is declared with `let` on line 38 inside the `try` block, but referenced in the `finally` block (line 164). If the `try` never reaches line 38 before an error, `finally` hits the TDZ and throws.

**Fix**: Initialize `let processingMsg = null;` before the `try` block.

```js
// Before (line 36-38):
const jobId = crypto.randomUUID();
await createJobDir(jobId);
const processingMsg = await message.reply(...)

// After:
const jobId = crypto.randomUUID();
await createJobDir(jobId);
let processingMsg = null;
processingMsg = await message.reply(...)
```

### I1: Missing `undici` Dependency — `package.json`

**Problem**: `src/services/imageDownloader.js` imports `undici` but it is not listed in `package.json` dependencies. It may work as a transitive dependency of `discord.js`, but this is fragile and will break on fresh installs.

**Fix**: Add `"undici": "^7.0.0"` (or latest stable) to `dependencies` in `package.json`.

## 2. Nice-to-Have Fixes

### B4: Redundant WebP Encoding — `src/services/metadata.js`

**Problem**: `embedMetadata()` re-encodes to WebP with quality 80, but `applyWatermark()` already does this. Double encoding wastes CPU and loses quality.

**Fix**: Remove `.webp({ quality: 80 })` from `embedMetadata()` and use the buffer directly:

```js
// src/services/metadata.js
async function embedMetadata(imageBuffer) {
  return imageBuffer; // Already WebP from applyWatermark + encodeWatermark
}
```

Also update the caller in `messageCreate.js` to pass `stegoBuffer` directly as `finalBuffer` instead of calling `embedMetadata()`, or keep the function as a no-op passthrough for future extensibility.

### B3: Partial Stego Payload Storage — `src/bot/events/messageCreate.js:154`

**Problem**: Only the first image's payload is stored in `steganographyPayload`. If multiple images are processed, payloads for images 2+ are lost.

**Fix**: Store all payloads as a JSON array:

```js
// Change line 154 from:
steganographyPayload: JSON.stringify(stegoPayloads[0]),
// To:
steganographyPayload: JSON.stringify(stegoPayloads),
```

### I3: Redundant `sharp()` Calls — `src/services/watermark.js`

**Problem**: `sharp(inputBuffer)` is called twice — once for metadata (line 42) and once for processing (line 69).

**Fix**: Call `sharp().metadata()` once, store dimensions, reuse `inputBuffer` for the composite pipeline:

```js
async function applyWatermark(inputBuffer, username, guildName) {
  const { width, height } = await sharp(inputBuffer).metadata();
  // ... build composites ...
  const outputBuffer = await sharp(inputBuffer)  // already has inputBuffer
    .composite(composites)
    .webp({ quality: 80 })
    .toBuffer();
  return outputBuffer;
}
```

This is already partially the case — the fix is to avoid passing `inputBuffer` through a second `sharp()` metadata call elsewhere. Verify `messageCreate.js` does not re-read dimensions.

### I5: Unbounded Webhook Cache — `src/services/webhookPoster.js`

**Problem**: `webhookCache` grows indefinitely as messages are processed across channels.

**Fix**: Add a size limit (e.g., 100 entries) with LRU eviction, or accept as low-risk since channel count is naturally bounded.

```js
const MAX_CACHE_SIZE = 100;
// In getOrCreateWebhook:
if (webhookCache.size >= MAX_CACHE_SIZE) {
  const firstKey = webhookCache.keySet().next().value;
  webhookCache.delete(firstKey);
}
```

## 3. Security (Already Handled)

- **S2** (Steganographic PII): Documented in the Documentation plan — this is a documentation concern, not a code fix.
- **S5** (SVG injection): Confirmed safe — `escapeXml` is applied to user data before SVG insertion.
- **S6** (Path traversal): Confirmed safe — `safePath()` validates path prefix.
- **S8** (Command injection): Confirmed safe — `execFile` with array arguments.

## 4. Ordered Task List

1. Fix `processingMsg` TDZ error in `src/bot/events/messageCreate.js`
2. Add `undici` to `package.json` dependencies
3. Remove redundant WebP encoding in `src/services/metadata.js`
4. Store all stego payloads as JSON array in `src/bot/events/messageCreate.js`
5. Reduce redundant `sharp()` calls in `src/services/watermark.js`
6. Add webhook cache size limit in `src/services/webhookPoster.js`
7. Run `npm test` — confirm all tests pass

## 5. Risk Assessment

- All fixes are well-contained to specific functions/files
- B1 fix prevents a crash in the `finally` block — high impact, low risk
- B4 fix removes redundant work — no behavior change, low risk
- B3 fix changes DB column content — harmless expansion from single object to array
