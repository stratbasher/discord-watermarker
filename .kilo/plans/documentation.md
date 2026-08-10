# Plan: Documentation

## Scope

Write Markdown documentation for the Watermarker Discord bot.

## 1. README.md at Project Root

Create `README.md` with these sections:

1. **Overview** — What the Watermarker bot does (visible + steganographic watermarks on Discord images)
2. **Features** — Tiled SVG watermark, steganographic payload embedding, WebP output, per-job temp isolation, SQLite job tracking
3. **Prerequisites** — Node.js 20, Discord bot token, `imgconceal` binary (Linux) or Docker
4. **Installation** — Clone, `npm install`, copy `.env.example` to `.env`, set env vars
5. **Usage** — Mention bot + attach images in Discord; describe expected behavior
6. **Configuration** — Table of all `.env` variables with descriptions, defaults, required/optional
7. **Docker** — How to build and run with `docker-compose up -d`
8. **Architecture** — Text-based flow diagram: message → download → watermark → stego → metadata → webhook → DB → cleanup
9. **Testing** — `npm test`
10. **Known Limitations** — Linux-only for `imgconceal`, max 10 images, 25MB per image, WebP-only output
11. **Security** — Path traversal protection, CDN-hostname whitelist, `imgconceal` key encryption, steganographic PII risk (userId, username, guildId, guildName embedded in image binary — extractable by anyone with imgconceal)
12. **Troubleshooting** — Common issues (token missing, imgconceal not found, Discord permissions)

## 2. Not In Scope (Future)

- `docs/development.md` — contribution guidelines
- `docs/deployment.md` — production deployment checklist

## 3. Ordered Task List

1. Create `README.md` with all 12 sections above
2. Include steganographic PII risk in the Security section
3. Verify `.env` is listed in `.gitignore`

## 4. Risk Assessment

- Documentation is read-only, zero risk
- No code changes involved
