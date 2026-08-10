# Replace imgconceal with `steg` + Node `crypto`

## Summary
Remove the `imgconceal` C binary (Linux-only, ARM64-incompatible) and replace with:
- **Steganography**: Extract the core LSB encoding/decoding algorithms from the `steg` npm package (by paulmillr) — `hideBlob`/`revealBlob`/`RawFile` — which operate on raw `Uint8Array` pixel data, pure JS, no native deps.
- **Encryption**: Node's built-in `crypto` module for AES-256-GCM + scrypt key derivation (battle-tested, same algorithm family as `steg`'s `micro-aes-gcm` dependency).
- **Image pipeline**: All images normalized to PNG via `sharp`. Watermark output changes from WebP to PNG.
- **Dockerfile**: Simplified to Node.js-only with zero native build steps.

## Current State
- `src/services/steganography.js` calls external `/usr/local/bin/imgconceal` binary via `execFile`
- `Dockerfile` has 3 stages: node-deps, imgconceal-src (git clone), builder (gcc compile), final
- `.github/workflows/docker-publish.yml` has no imgconceal references — only triggers on Dockerfile changes
- `watermark.js` outputs WebP (lossy) — needs PNG (lossless)
- `messageCreate.js` invokes `encodeWatermark` at line 104; `decodeWatermark` is defined but never called
- No existing tests for `steganography.js`
- `steg` npm package (by paulmillr v0.1.5) has browser-dependent `StegImage` class (Canvas/Image/Blob), but its **core algorithms** (`RawFile`, `hideBlob`, `revealBlob`, `createView`, `readBit`, `clearBits`) operate on `Uint8Array` — pure JS, no browser deps
- `micro-aes-gcm` (steg's crypto dependency) is deprecated; use Node `crypto` instead

## Design Decisions
1. **Steganography**: Reuse `steg`'s battle-tested LSB algorithms (`RawFile` packing, `hideBlob`/`revealBlob` encoding/decoding on raw pixel arrays). These are just TypedArray manipulations — no Canvas needed.
2. **Encryption**: Node `crypto.scryptSync` (key derivation) + `crypto.createCipheriv('aes-256-gcm')` (same AES-256-GCM mode as steg uses). This is the standard library — audited, maintained, FIPS-capable.
3. **Image pipeline**: All images normalized to PNG via `sharp`. Watermark output changes from WebP to PNG.
4. **Binary format**: Match `steg`'s internal structure — `RawFile` header (1-byte name length + name + 4-byte size) encrypted with AES-256-GCM, producing `[IV(12) | ciphertext | authTag(16)]` prepended to LSB-embedded pixel data.

## Affected Files

| File | Change |
|---|---|
| `package.json` | Add `sharp` is already present; no new deps needed — `sharp` handles PNG I/O and pixel data extraction. The `steg` core algorithms are extracted inline (they're ~100 lines of pure JS). |
| `src/services/steganography.js` | **Complete rewrite.** Remove `child_process.execFile`. Extract `steg`'s core LSB algorithms (`RawFile` packing, `hideBlob`/`revealBlob` encoding on pixel arrays, `createView`, `readBit`, `clearBits`, `isAlpha`). Use Node `crypto` for AES-256-GCM + scrypt. Use `sharp` for PNG buffer → raw pixel data. |
| `src/services/watermark.js` | Change `.webp({ quality: 80 })` to `.png()` for lossless output. |
| `src/bot/events/messageCreate.js` | Update output filename extension from `.webp` to `.png` (line 124). |
| `Dockerfile` | **Dramatically simplified.** Remove imgconceal clone + C build stages (9 lines). Final stage needs only `node:24-alpine` with existing deps. |
| `docker-compose.yml` | No changes needed (just references Dockerfile). |
| `README.md` | Update all imgconceal references (11 occurrences) to `steg` + Node crypto steganography. Update architecture diagram. Update limitations. Update troubleshooting. |
| `.env.example` | No changes — `WATERMARK_KEY` env var still used (now for AES key derivation via scrypt). |
| `.github/workflows/docker-publish.yml` | **No changes.** Already multi-arch, no imgconceal references. |

## Implementation Tasks (in order)

### 1. Add `steg` dependency
Add `"steg": "^0.1.5"` to `dependencies` in `package.json`. This is the only new dependency. `steg` itself depends on `micro-aes-gcm` (deprecated), but we will NOT use its crypto — only its pixel manipulation algorithms.

### 2. Rewrite `src/services/steganography.js`
Replace the entire file. Extract the following pure-JS algorithms from `steg` (from `steg`'s `index.js` source at https://github.com/paulmillr/steg):

**Extracted functions from `steg` (inlined as standalone, NOT imported):**
The `steg` package exports `hideBlob` and `revealBlob` as instance methods on `StegImage` — they operate on `this.imageData.data`. We cannot call these directly on a `Uint8Array`. Instead, we inline the algorithm logic as standalone functions in our module:

- `clearBits(n, bits)` — clears least significant bits of a byte
- `readBit(byte, pos)` — reads a single bit from a byte
- `isAlpha(pixel)` — checks if pixel index is alpha channel (index % 4 === 3)
- `createView(arr)` — creates `DataView` from `Uint8Array`
- `getRandomByte()` — CSPRNG random byte via `crypto.randomBytes(1)[0]`
- `RawFile` class — packs file data with metadata header (used for payload structuring)
- `hideBlob(data, bitsTaken, channels)` — standalone function that writes encrypted blob into pixel channels via LSB
- `revealBitsTaken(channels)` — standalone function that reads bitsTaken from first 3 channels
- `revealBlob(channels, bitsTaken)` — standalone function that extracts hidden blob from pixel channels

The inlined `hideBlob`/`revealBlob` take a `Uint8Array` (channels) as first argument instead of `this.imageData.data`. The algorithm logic is identical to steg's source — just refactored from class methods to standalone functions.

**Encryption (Node `crypto`, NOT steg's micro-aes-gcm):**
- Key derivation: `crypto.scryptSync(passphrase, salt, { N: 2**14, r: 8, p: 1, keylen: 32 })`
- IV generation: `crypto.randomBytes(12)`
- Encryption: `crypto.createCipheriv('aes-256-gcm', derivedKey, iv)`
- Decryption: `crypto.createDecipheriv('aes-256-gcm', derivedKey, iv)`

**`encodeWatermark(watermarkBuffer, payload, jobId, index)` pipeline:**
1. Convert watermark PNG buffer to RGBA pixel data: `sharp(watermarkBuffer).raw().toBuffer()`
2. Serialize payload: `JSON.stringify(payload)` → Buffer
3. Generate salt: `crypto.randomBytes(16)`
4. Wrap in `RawFile` struct (steg's format): `[nameLen(1) | name(N) | size(4) | salt(16) | iv(12) | encryptedData]`
5. Pad to match image capacity (steg's `packWithPadding` logic)
6. Derive AES key: `scryptSync(WATERMARK_KEY, salt, {N: 2**14, r: 8, p: 1, keylen: 32})`
7. Generate IV: `crypto.randomBytes(12)`
8. Encrypt payload: `aes-256-gcm` → `[IV(12) | ciphertext | authTag(16)]`
9. Write encrypted blob into pixel data using inlined `hideBlob` (steg's LSB algorithm)
10. Convert RGBA pixel data back to PNG: `sharp(rgbaBuffer, {width, height, channels: 4}).png().toBuffer()`
11. Return final PNG buffer

**`decodeWatermark(imageBuffer, jobId, index)` pipeline:**
1. Convert PNG to RGBA pixel data: `sharp(imageBuffer).raw().toBuffer()`
2. Read `bitsTaken` from first 3 channels using inlined `revealBitsTaken` (steg)
3. Extract encrypted blob using inlined `revealBlob` (steg)
4. Parse `RawFile.fromPacked` → extract name + data buffer
5. Slice data buffer: `salt(0-15) | iv(16-27) | ciphertext+authTag(28+)`
6. Derive AES key: `scryptSync(WATERMARK_KEY, salt, {N: 2**14, r: 8, p: 1, keylen: 32})`
7. Decrypt with auth tag verification: `aes-256-gcm decrypt(iv, ciphertext+authTag)`
8. Parse JSON payload and return

**Pixel data flow (sharp integration):**
```js
// Encode: sharp → raw pixels → steg hideBlob → sharp → PNG
const rgba = await sharp(buffer).raw().toBuffer();
// ... modify rgba buffer in-place via hideBlob ...
const output = await sharp(rgba, { width, height, channels: 4 }).png().toBuffer();

// Decode: sharp → raw pixels → steg revealBlob → sharp → raw
const rgba = await sharp(buffer).raw().toBuffer();
// ... extract from rgba buffer via revealBlob ...
```

Key implementation details:
- Use `sharp(...).raw().toBuffer()` to get a `Buffer` of RGBA bytes (4 bytes per pixel)
- Wrap buffer in `Uint8Array` for steg algorithm compatibility
- steg's `hideBlob`/`revealBlob` iterate channels 0..N, skipping alpha channels (index % 4 === 3)
- Default `bitsTaken = 1` (1 bit per channel) — produces minimal visible distortion
- Capacity at 1 bit: `width × height × 3` bits (3 RGB channels per pixel, skip alpha)
- Example: 1920×1080 → 6,220,800 bits = 777,600 bytes payload capacity
- Padding: remaining capacity filled with random bytes (steg's `getRandomByte` logic) to resist detection

### 3. Update `src/services/watermark.js`
Change line 71 from:
```js
.webp({ quality: 80 })
```
to:
```js
.png()
```

This ensures the visible watermark output is lossless before steganographic encoding.

### 4. Update `src/bot/events/messageCreate.js`
Change line 124 from:
```js
filename: `${baseName}.webp`,
```
to:
```js
filename: `${baseName}.png`,
```

### 5. Simplify `Dockerfile`
Replace the entire Dockerfile with:

```dockerfile
# Stage 1: Install Node dependencies
FROM node:24-alpine AS node-deps
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm install --omit=dev

# Final image
FROM node:24-alpine
WORKDIR /app

RUN apk add --no-cache dumb-init fontconfig ttf-dejavu

COPY --from=node-deps /app/node_modules ./node_modules
COPY src ./src

RUN mkdir -p /app/data /app/logs /app/tmp

USER node
ENV NODE_ENV=production

CMD ["dumb-init", "node", "src/index.js"]
```

This removes:
- `imgconceal-src` build stage (git clone)
- `builder` stage (gcc, libsodium, libjpeg, libpng, libwebp, zlib)
- `imgconceal` binary installation (chmod, COPY)

### 6. Update `README.md`
Replace all 11 imgconceal references with descriptions of the new pure JS steganography:

| Location | Change |
|---|---|
| Line 12 (Overview) | "uses the `imgconceal` binary" → "uses a pure JavaScript LSB steganography implementation with AES-256-GCM encryption" |
| Line 24 (Important Limitations) | Replace imgconceal payload description with new AES-256-GCM encrypted payload description |
| Line 51 (Prerequisites) | "imgconceal binary (Linux-only) or Docker" → "Node.js runtime with Docker" (no binary prerequisite) |
| Line 102 (Config table) | WATERMARK_KEY description → "Passphrase for AES-256-GCM encryption with scrypt key derivation" |
| Line 108 (Deployment) | "imgconceal binary" → "no native binary dependencies" |
| Line 181 (Architecture diagram) | "imgconceal steganography" → "pure JS AES-256-GCM + LSB steganography" |
| Line 210 (Known Limitations) | Remove "Linux-only for imgconceal" — now cross-platform |
| Line 214 (Known Limitations) | Remove "imgconceal availability" note |
| Line 220 (Security) | Replace "imgconceal key encryption" → "AES-256-GCM with scrypt key derivation" |
| Line 221 (Security) | Update PII risk text — payload is now AES-256-GCM encrypted |
| Line 231 (Troubleshooting) | Remove `imgconceal: not found` entry |

### 7. Update `docker-compose.yml` if needed
Review for any imgconceal references. Likely no changes.

## Data Flow (New)

**Encode:**
```
Input image (JPG/WEBP/PNG)
  → sharp: normalize to RGBA buffer
  → watermark.js: apply visible SVG watermark (sharp + PNG output)
  → sharp: convert to PNG buffer
  → sharp: extract raw RGBA pixel data
  → steg RawFile: pack payload as [nameLen | name | size | data]
  → crypto: scrypt(SALT, passphrase) → AES key, randomBytes(12) → IV
  → crypto: aes-256-gcm encrypt → [IV(12) | ciphertext | authTag(16)]
  → steg hideBlob: embed encrypted blob into RGBA pixels via LSB (1 bit/channel)
  → sharp: encode RGBA pixels → PNG buffer output
```

**Decode:**
```
Input PNG stego image
  → sharp: extract raw RGBA pixel data
  → steg revealBitsTaken: read bitsTaken from first 3 channels
  → steg revealBlob: extract encrypted blob from RGBA pixels
  → steg RawFile.fromPacked: extract data buffer (salt + iv + ciphertext + authTag)
  → Parse: salt(0-15), iv(16-27), ciphertext+authTag(28+)
  → crypto: scrypt(SALT, passphrase) → AES key
  → crypto: aes-256-gcm decrypt(iv, ciphertext+authTag) → payload JSON
```

## Payload Binary Format (in steg pixel data)
```
RawFile Header (steg format):
  Byte 0:         Name length (1 byte, max 255 chars)
  Bytes 1..N:     Name string ("watermark-payload")
  Bytes N+1..N+4: File size (4 bytes, uint32 LE)
  Bytes N+5..end: File contents (encrypted payload)

Encrypted payload structure (what RawFile.data contains):
  Bytes 0-15:   Salt (16 bytes, from crypto.randomBytes, for scrypt)
  Bytes 16-27:  IV (12 bytes, from crypto.randomBytes)
  Bytes 28..M:  Ciphertext (variable length, aes-256-gcm)
  Bytes M+1..M+16: Auth tag (16 bytes, aes-256-gcm)

Key derivation uses the salt (bytes 0-15 of encrypted payload).
Decryption: extract salt → scrypt(salt, passphrase) → AES key → decrypt(iv, authTag)
```

## Capacity Calculation
- At 1 bit per channel (3 channels per pixel): `width × height × 3` bits
- Example: 1920×1080 image = 6,220,800 bits = 777,600 bytes payload capacity
- Current payload (~200 bytes JSON) fits easily in any standard image

## Risks & Mitigations
| Risk | Mitigation |
|---|---|
| `steg` package crypto is deprecated | We use Node `crypto` for AES-GCM + scrypt (standard library, audited). Only steg's pixel algorithms are reused. |
| `steg`'s `micro-aes-gcm` deprecated | Not used — Node `crypto.createCipheriv`/`createDecipheriv` replaces it entirely |
| PNG file size increase | LSB encoding modifies existing pixel data; no size increase |
| Payload exceeds capacity | Validate capacity (`width × height × 3` bits) before encoding; throw descriptive error |
| Auth tag mismatch on decode | AES-GCM auth tag verification catches tampered/stripped payloads |
| Watermark output format mismatch | PNG output from sharp is lossless; verified in watermark.js |
| Large image processing memory | Sharp raw buffers for large images (~30MB RGBA at 4096×4096) within Node.js heap limits |
| `steg` API compatibility | Core functions (`hideBlob`, `revealBlob`, `RawFile`, `readBit`, `clearBits`, `isAlpha`, `createView`) are exported and documented in steg's source code |

## Validation
1. `npm test` — all existing tests pass (watermark.js, imageDownloader.js, webhookPoster.js, tempFiles.js, config.js)
2. Manual encode test: pass JPG input → verify PNG output contains no visible changes → verify decode recovers original payload
3. Manual decode test: pass PNG stego image → verify recovered JSON matches original payload
4. Docker build test: `docker build -t watermarker:test .` — succeeds with simplified Dockerfile
5. ARM64 test: `docker build --platform linux/arm64 -t watermarker:test .` — succeeds (no native deps)
6. steg API verification: confirm extracted `hideBlob`/`revealBlob` functions produce roundtrip data on test images (e.g., 100×100 solid-color PNG)

## Out of Scope
- `decodeWatermark` is currently unused in the codebase — implemented for completeness but not integrated into any bot command
- `metadata.js` remains a no-op stub (unchanged)
- `webhookPoster.js` attachment naming: already defaults to `.png` when no filename provided; updated `messageCreate.js` explicitly sets `.png` extension
