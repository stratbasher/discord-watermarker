# Watermarker Bot

A Discord bot that applies visible tiled watermarks to images shared in Discord servers.

## Overview

When @mentioned with one or more image attachments, the Watermarker bot downloads each image, applies a tiled SVG watermark with the user's name and server name, and sends the processed images back through a channel webhook. Each job uses isolated temporary directories and all jobs are tracked in a SQLite database.

## Features

- **Tiled SVG watermark** — diagonal repeating tile with user and guild name, auto-scaling font size, configurable color, opacity, and quality
- **WebP output** — all processed images are output as lossy WebP with configurable quality
- **Per-job temp isolation** — each watermarking job gets a unique temp directory, cleaned up after completion
- **SQLite job tracking** — Sequelize-backed `WatermarkJob` model stores userId, username, guildId, guildName, channel, image hashes, and job status

## Important Limitations

**Watermarks do not truly protect images.** This bot adds a visible tiled overlay, but:

- **Images are still uploaded to Discord without a watermark.** The original, unmodified image exists on Discord's CDN until the bot deletes the source message. Anyone with the right tools (Discord cache extractors, browser dev tools, CDN URL manipulation) can retrieve the original before deletion.
- **Discord clients and plugins can capture images immediately.** Many tools (e.g. BetterDiscord, Powercord, image saver extensions, Discord's own cache) download every received image to the user's local machine. The watermarked version posted via webhook may arrive after these captures have already completed.
- **The visible watermark can be removed.** Basic image editing (cloning, content-aware fill, inpainting) can strip tiled text. Automated tools and AI-based removal make this even easier.

**This bot is a deterrent, not a protection mechanism.** It raises the bar slightly for casual misuse and provides an audit trail via the SQLite database, but it should not be relied upon to prevent unauthorized distribution.

## Bot Permissions

The Discord bot requires the following **Privileged Gateway Intents** (configured at [discord.dev](https://discord.dev) under Bot → Privileged Gateway Intents):

| Intent | Why |
|---|---|
| **Message Content** | Read message text to include in webhook output and strip the bot mention |
| **Guild Messages** | Receive messages and delete the original source messages |
| **Guilds** | Basic guild information |

The bot also needs these **channel permissions**:

| Permission | Why |
|---|---|
| **Send Messages** | Post "Processing..." ephemeral replies and error messages |
| **Embed Links** | Webhook messages display as embeds |
| **Attach Files** | Send watermarked WebP images via webhook |
| **Manage Webhooks** | Create and fetch the "Watermarker" webhook in each channel |
| **Delete Messages** | Delete original user messages after processing |

- Node.js 20
- Discord bot token
- Docker (for simplified Node-only deployment, no native binary dependencies)

## Installation

1. Clone the repository:

```bash
git clone <repo-url>
cd watermarker-kilo
```

2. Install dependencies:

```bash
npm install
```

3. Copy the environment template and configure:

```bash
cp .env.example .env
```

4. Edit `.env` and set `DISCORD_TOKEN` to your value.

## Usage

1. Start the bot:

```bash
npm start
```

2. In any Discord text channel where the bot has permissions:
   - Mention the bot (e.g. `@Watermarker`)
   - Attach one or more images (PNG, JPG, etc.)
     - The bot will delete the original messages, process each image, and reply with the watermarked WebP images via a webhook

The bot requires `Manage Webhooks` and `Attach Files` permissions to send watermarked output and delete original messages.

## Configuration

All configuration comes from environment variables (`.env`).

| Variable | Description | Default | Required |
|---|---|---|---|
| `DISCORD_TOKEN` | Discord bot token | — | Yes |
| `NODE_ENV` | Environment (`development` / `production`) | `development` | No |
| `LOG_LEVEL` | Logging verbosity (`debug`, `info`, `warn`, `error`) | `debug` in dev, `info` in prod | No |
| `DB_PATH` | Path to SQLite database file | `./data/watermarker.sqlite` | No |
| `TEMP_DIR` | Base directory for per-job temp files | `./tmp` | No |
| `WATERMARK_KEY` | Not used for encryption (kept for backwards compatibility) | — | No |
| `WATERMARK_TEXT_COLOR` | Color of the tiled watermark text | `#ffffff` | No |
| `WATERMARK_TEXT_OPACITY` | Opacity of the watermark text (0.0–1.0) | `0.6` | No |

## Docker

A simplified Dockerfile builds a minimal Node.js 24 Alpine image with no native dependencies. Data, logs, and temp files are persisted via volume mounts.

```bash
docker compose up -d
```

Volumes:

| Volume | Purpose |
|---|---|
| `./data` | SQLite database persistence |
| `./logs` | Winston log files |
| `./tmp` | Per-job temporary files |

## Docker (GHCR)

This project includes a GitHub Actions workflow (`.github/workflows/docker-publish.yml`) that automatically builds multi-arch Docker images (`linux/amd64`, `linux/arm64`) and publishes them to the GitHub Container Registry (GHCR).

### Setup

1. Push this repository to GitHub.

2. Update `docker-compose.yml` with your GHCR image path:

```yaml
image: ghcr.io/<your-username>/<repo-name>:latest
```

3. On your deployment server, authenticate with GHCR:

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u <your-username> --password-stdin
```

Generate a fine-grained personal access token at **Settings → Developer settings → Personal access tokens → Fine-grained tokens** with read access to `packages`.

### Deployment

```bash
cd /opt/watermarker-bot
cp .env.example .env   # then edit .env with your DISCORD_TOKEN
docker compose up -d
```

The workflow triggers automatically on pushes to `main`/`master` (when `Dockerfile`, `package.json`, `package-lock.json`, or files under `src/` change). You can also trigger it manually via **Actions → Build and Push Docker Image → Run workflow**.

### Image Tags

| Tag | Description |
|---|---|
| `latest` | Latest build from default branch |
| `<sha>` | Build from git commit SHA |
| `<semver>` | Build tagged with git semver tag |

## Architecture

```
Discord message (@mention + images)
  │
  ├─► messageCreate handler
  │     ├─ Validate mentions, attachment count (max 10), file size (max 25 MB)
  │     ├─ Create per-job temp directory
  │     ├─ Create WatermarkJob record (status: processing)
  │     │
  │     ├─► downloadImage (parallel)
  │     │     ├─ Whitelist check: cdn.discordapp.com, media.discordapp.net
  │     │     ├─ Content-type validation (image/*)
  │     │     └─ Save to job temp dir as input-*.png
  │     │
  │     ├─ Delete original messages
  │     │
   │     ├─► Per-image processing (parallel)
   │     │     └─ applyWatermark — tiled SVG composite, output as WebP
   │     │
   │     ├─► postViaWebhook
   │     │     ├─ Get or create "Watermarker" webhook per channel
   │     │     └─ Send watermarked WebP files with original author info
   │     │
   │     ├─ Update WatermarkJob record (status: completed, image hashes)
  │     └─► cleanupJobDir — remove per-job temp directory
  │
  ├─► WatermarkJob DB record (SQLite, Sequelize)
  │     └─ Fields: id, userId, username, guildId, guildName, channelId,
   │                originalMessageContent, imageCount, imageHashes,
   │                status, errorMessage
  │
  └─► Cleanup (finally block)
        └─ Remove temp directory, delete processing status message
```

## Testing

```bash
npm test
```

Runs Jest with `--forceExit`. Tests cover `config`, `imageDownloader`, `watermark`, `webhookPoster`, and `tempFiles` utilities.

## Known Limitations

- **Max 10 images per mention** — attempting to process more returns an error
- **25 MB per image** — files exceeding this limit are rejected
- **WebP-only output** — all watermarked images are output as `.webp` files

## Security

- **Path traversal protection** — `safePath()` in `tempFiles.js` validates that resolved paths stay within the job directory
- **CDN hostname whitelist** — `imageDownloader` only accepts URLs from `cdn.discordapp.com` and `media.discordapp.net`
- **`.env` not committed** — `.env` is listed in `.gitignore` to prevent accidental token exposure

## Troubleshooting

| Issue | Likely Cause | Fix |
|---|---|---|
| `DISCORD_TOKEN is required` | `.env` not configured | Copy `.env.example` to `.env` and set `DISCORD_TOKEN` |
| Bot does not respond to @mentions | Missing intents or permissions | Ensure `GuildMessages`, `MessageContent` intents are enabled; verify bot has `Manage Webhooks`, `Attach Files`, `Send Messages` permissions |
| Webhook send fails | Channel lacks webhook permissions | Grant bot `Manage Webhooks` permission in the channel |
| SQLite permission errors | `data/` directory not writable | Ensure the process can write to the configured `DB_PATH` directory |
