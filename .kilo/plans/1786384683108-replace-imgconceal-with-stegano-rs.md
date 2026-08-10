# Replace imgconceal with stegano-rs

## Summary
Replace the `imgconceal` C-based steganography tool (Linux-only, ARM64 build failures, endian.h issues) with `stegano-rs` (Rust, cross-platform, XChaCha20-Poly1305 + Argon2id encryption). Remove imgconceal build stages from the Dockerfile and simplify to a `cargo install` approach.

## Target tool: `steganogram/stegano-rs`
- **Binary name:** `stegano` (crate is `stegano-cli`)
- **CLI commands:**
  - Encode: `stegano hide --in <carrier> --data <data-file> -p <password> -o <output>`
  - Decode: `stegano unveil --in <carrier> -p <password> -o <output-dir>`
- **Carrier formats:** PNG and WAV only (no WebP)
- **Encryption:** XChaCha20-Poly1305 + Argon2id — no 16-char key limit, handles arbitrary-length passwords
- **Cross-platform:** AMD64, ARM64, macOS, Windows — no build issues

## Affected files

| File | Change |
|---|---|
| `src/services/steganography.js` | Rewrite `encodeWatermark` and `decodeWatermark` to use `stegano` CLI |
| `Dockerfile` | Remove imgconceal clone + C build stages; replace with `rust:alpine` + `cargo install stegano-cli` |
| `README.md` | Update all `imgconceal` references to `stegano-rs`; update architecture, limitations, troubleshooting |
| `.github/workflows/docker-publish.yml` | No change needed — workflow just triggers on Dockerfile, already uses Buildx for multi-arch |

## Tests
No test files import or test `src/services/steganography.js`. All 5 test files cover `watermark.js`, `imageDownloader.js`, `webhookPoster.js`, `tempFiles.js`, and `config.js` — none of which change. **No test modifications needed.**

## Implementation tasks (in order)

### 1. Rewrite `src/services/steganography.js`

**Current behavior (imgconceal):**
- Encode: `imgconceal -i carrier-{i}.webp -h payload-{i}.json -o stego-{i}.webp -p <key>`
- Decode: `imgconceal -e carrier-{i}.webp -p <key> --output <dir>`, then reads `<dir>/payload.json`

**New behavior (stegano-rs):**
- Encode: `stegano hide --in carrier-{i}.png --data payload-{i}.json -p <key> -o stego-{i}.png`
- Decode: `stegano unveil --in carrier-{i}.png -p <key> -o <dir>`, then reads `<dir>/<original-filename>`

**Key adaptation points:**

1. **Carrier format: PNG instead of WebP**
   - Write carrier as `.png` (sharp can read both PNG and WebP input)
   - After stegano produces PNG output, convert to WebP via sharp before returning:
     ```js
     const webpBuffer = await sharp(stegoPngBuffer).webp({ quality: 80 }).toBuffer();
     ```

2. **Payload is a file, not a string argument**
   - Write payload JSON to `payload-{i}.json` on disk (already done in current code)
   - Pass file path via `--data` flag (matches current behavior of writing to file)

3. **Decode output: file in output directory**
   - `stegano unveil --in carrier.png -p <key> -o <output-dir>` extracts the hidden file as `payload-i.json` into the output directory
   - Read `<output-dir>/payload-i.json` and `JSON.parse()` it

4. **Password: no length limit**
   - `stegano-rs` uses Argon2id key derivation, so `WATERMARK_KEY` can be used as-is (no truncation or hashing needed)

5. **Replace `execFile` with `execFile` using `stegano` binary**
   - Update `IMGCONCEAL_PATH` constant to `STEGRANO_PATH = '/usr/local/bin/stegano'`
   - Update both function signatures and internal logic

**New `src/services/steganography.js` logic:**
```js
const STEGANO_PATH = '/usr/local/bin/stegano';

async function encodeWatermark(watermarkBuffer, payload, jobId, index = 0) {
  const carrierPath = path.resolve(config.tempDir, jobId, `carrier-${index}.png`);
  const payloadPath = path.resolve(config.tempDir, jobId, `payload-${index}.json`);
  const outputPath = path.resolve(config.tempDir, jobId, `stego-${index}.png`);

  await fs.writeFile(carrierPath, watermarkBuffer);
  await fs.writeFile(payloadPath, JSON.stringify(payload), 'utf8');

  await new Promise((resolve, reject) => {
    execFile(STEGANO_PATH, [
      'hide',
      '--in', carrierPath,
      '--data', payloadPath,
      '-p', config.watermarkKey,
      '-o', outputPath,
    ], { timeout: 60000 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const stegoPng = await fs.readFile(outputPath);
  // Convert PNG -> WebP
  const webpBuffer = await sharp(stegoPng).webp({ quality: 80 }).toBuffer();
  return webpBuffer;
}

async function decodeWatermark(imageBuffer, jobId, index = 0) {
  const carrierPath = path.resolve(config.tempDir, `carrier-${index}.png`);
  const outputDir = path.resolve(config.tempDir, jobId);

  await fs.writeFile(carrierPath, imageBuffer);

  await new Promise((resolve, reject) => {
    execFile(STEGANO_PATH, [
      'unveil',
      '--in', carrierPath,
      '-p', config.watermarkKey,
      '-o', outputDir,
    ], { timeout: 60000 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  // stegano preserves the original filename of hidden data
  const payloadPath = path.resolve(outputDir, `payload-${index}.json`);
  const content = await fs.readFile(payloadPath, 'utf8');
  return JSON.parse(content);
}
```

**Important:** Add `sharp` import to `encodeWatermark` for the PNG-to-WebP conversion.

### 2. Update `Dockerfile`

**Remove:**
- `imgconceal-src` stage (git clone)
- Builder stage with CFLAGS, libsodium, libjpeg, etc.
- Alpine musl/endian.h workaround

**Replace with:**
- `stegano-install` stage using `rust:alpine` base
- `cargo install stegano-cli --locked` (crate name is `stegano-cli`, binary is `stegano`)
- Copy binary from `/usr/local/cargo/bin/stegano`

**New Dockerfile:**
```dockerfile
# Stage 1: Install Node dependencies
FROM node:24-alpine AS node-deps
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm install --omit=dev

# Stage 2: Install stegano-rs binary (cross-platform: AMD64 + ARM64)
FROM rust:alpine AS stegano-install
RUN apk add --no-cache git
RUN cargo install stegano-cli --locked

# Final image
FROM node:24-alpine
WORKDIR /app

RUN apk add --no-cache dumb-init fontconfig ttf-dejavu

COPY --from=stegano-install /usr/local/cargo/bin/stegano /usr/local/bin/stegano
RUN chmod +x /usr/local/bin/stegano

COPY --from=node-deps /app/node_modules ./node_modules
COPY src ./src

RUN mkdir -p /app/data /app/logs /app/tmp

USER node
ENV NODE_ENV=production

CMD ["dumb-init", "node", "src/index.js"]
```

### 3. Update `README.md`

Replace all `imgconceal` references with `stegano-rs`:

| Section | Change |
|---|---|
| Overview | "uses the `stegano-rs` binary" instead of "uses the `imgconceal` binary" |
| Features | Same, just swap binary name |
| Important Limitations | Remove imgconceal-specific text about `imgconceal` payload extraction |
| Prerequisites | Change "imgconceal binary" to "stegano-rs binary (cross-platform, installed via Docker)" |
| Configuration table | WATERMARK_KEY description: remove "for imgconceal steganography", change to "for stegano-rs steganography" |
| Docker section | Simplify — no build stages mentioned, just `cargo install` |
| Architecture diagram | Update `encodeWatermark` comment from "imgconceal steganography" to "stegano-rs steganography" |
| Known Limitations | Remove "Linux-only for imgconceal"; remove "imgconceal availability" note |
| Security section | Replace "imgconceal key encryption" → "stegano-rs XChaCha20-Poly1305 + Argon2id encryption"; update PII risk text |
| Troubleshooting table | Replace `imgconceal: not found` entry with `stegano: not found` (run via Docker) |

### 4. No changes to `.github/workflows/docker-publish.yml`

The existing workflow already uses `docker/build-push-action@v6` with `platforms: linux/amd64,linux/arm64` and triggers on Dockerfile changes. No modifications needed.

## Risks and considerations

1. **WebP → PNG → WebP conversion** — `stegano-rs` only supports PNG carriers. The carrier is converted to PNG for steganography, then back to WebP via sharp. Since the watermarked image is already in memory as a buffer and sharp handles lossless PNG encoding, this should be transparent. The final WebP at quality 80 is the same as before.

2. **Decode file name resolution** — `stegano unveil` preserves the original filename of hidden data. Since we store `payload-{i}.json` during encoding, decode reads `payload-{i}.json` from the output directory. This matches the current decode path pattern.

3. **Password length** — `stegano-rs` uses Argon2id key derivation, so `WATERMARK_KEY` of any length works natively. No truncation or hashing needed (unlike `stegano` by wiseaidev which has a 16-char AES-128 limit).

4. **stegano-rs GPL-3.0 license** — The binary is GPL-3.0. Since it's bundled as a standalone binary in a Docker image (not linked/combined), this should be acceptable under the GPL's distribution rules. The Node.js application itself remains MIT-compatible.

5. **PNG carrier quality** — Converting WebP watermarked images to PNG before steganography is lossless. The stego PNG output is then converted to WebP quality 80, same as the original flow.

## Validation plan

After implementation:
1. **Docker build:** `docker build --platform linux/amd64 -t watermarker:test .` — verify stegano binary is present and executable
2. **Docker build:** `docker build --platform linux/arm64 -t watermarker:test .` — verify ARM64 compatibility (no C build issues)
3. **End-to-end encode:** Run bot against a test image — verify steganographic payload is embedded
4. **End-to-end decode:** Run decode against a watermarked image — verify payload JSON is extracted correctly
5. **Run tests:** `npm test` — all existing tests should pass unchanged
