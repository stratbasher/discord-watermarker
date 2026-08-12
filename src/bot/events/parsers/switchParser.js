const { CSS_BASIC_COLORS } = require('./colorMap');
const config = require('../../../config');

const VALID_OPTIONS = ['textcolor', 'color', 'opacity', 'transparency', 'quality', 'text'];

const SWITCH_PATTERNS = {
  textcolor: /(?:textcolor|color)\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|[a-zA-Z]+)/gi,
  opacity: /opacity\s*:\s*(\d+(?:\.\d+)?)(%)?/gi,
  transparency: /transparency\s*:\s*(\d+(?:\.\d+)?)(%)?/gi,
  quality: /quality\s*:\s*(\d+)/gi,
  text: /text\s*:\s*(?:"([^"]+)"|'([^']+)')/gi,
};

function validateHexColor(color) {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return true;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) return true;
  return false;
}

/**
 * Parse command switches (textcolor, opacity, etc.) from message content.
 *
 * @param {string} content - Raw message content (after bot mention removed).
 * @returns {{ errors: string[], options: object }} Parsed options and any validation errors.
 */
function parseMessageOptions(content) {
  const errors = [];
  const options = {};

  for (const [switchName, pattern] of Object.entries(SWITCH_PATTERNS)) {
    const matches = [...content.matchAll(pattern)];

    if (matches.length === 0) continue;

    for (const match of matches) {
      switch (switchName) {
        case 'textcolor': {
          let color = match[1];
          if (color.length === 4) {
            color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
          }
          if (CSS_BASIC_COLORS[color.toLowerCase()]) {
            options.textColor = CSS_BASIC_COLORS[color.toLowerCase()];
          } else if (validateHexColor(color)) {
            options.textColor = color;
          } else {
            errors.push(`Invalid color: "${match[1]}" — use hex (#fff, #ff0000) or a CSS color name`);
          }
          break;
        }
        case 'opacity': {
          let value = parseFloat(match[1]);
          const isPercent = !!match[2];
          if (isPercent) {
            if (value < 0 || value > 100) {
              errors.push(`Invalid opacity: ${value}% — must be 0 to 100`);
            } else {
              options.textOpacity = value / 100;
            }
          } else {
            if (value < 0 || value > 1) {
              errors.push(`Invalid opacity: ${value} — must be 0.0 to 1.0 (or use %, e.g. 50%)`);
            } else {
              options.textOpacity = value;
            }
          }
          break;
        }
        case 'transparency': {
          let value = parseFloat(match[1]);
          const isPercent = !!match[2];
          if (isPercent) {
            if (value < 0 || value > 100) {
              errors.push(`Invalid transparency: ${value}% — must be 0 to 100`);
            } else {
              options.textOpacity = 1 - value / 100;
            }
          } else {
            if (value < 0 || value > 1) {
              errors.push(`Invalid transparency: ${value} — must be 0.0 to 1.0`);
            } else {
              options.textOpacity = 1 - value;
            }
          }
          break;
        }
        case 'quality': {
          const val = parseInt(match[1], 10);
          if (val < 1 || val > 100) {
            errors.push(`Invalid quality: ${val} — must be 1 to 100`);
          } else {
            options.quality = val;
          }
          break;
        }
        case 'text': {
          const rawText = (match[1] ?? match[2] ?? '').trim();
          if (rawText.length === 0) {
            errors.push('`text:` switch requires a value, e.g. `text:"my custom text"`');
          } else if (rawText.length > config.maxCustomTextLength) {
            errors.push(`Custom text is too long (${rawText.length} chars) — max ${config.maxCustomTextLength} characters`);
          } else {
            options.customText = rawText;
          }
          break;
        }
      }
    }
  }

  return { errors, options };
}

module.exports = {
  VALID_OPTIONS,
  SWITCH_PATTERNS,
  validateHexColor,
  parseMessageOptions,
};
