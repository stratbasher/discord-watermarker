const { parseMessageOptions, validateHexColor } = require('../../src/bot/events/parsers/switchParser');
const { stripDiscordMentions, formatErrorReply, stripCommandSwitches } = require('../../src/bot/events/parsers/stripper');
const { CSS_BASIC_COLORS } = require('../../src/bot/events/parsers/colorMap');

describe('CSS_BASIC_COLORS', () => {
  test('includes all expected basic colors', () => {
    expect(CSS_BASIC_COLORS.red).toBe('#ff0000');
    expect(CSS_BASIC_COLORS.blue).toBe('#0000ff');
    expect(CSS_BASIC_COLORS.gold).toBe('#ffd700');
    expect(CSS_BASIC_COLORS.black).toBe('#000000');
    expect(CSS_BASIC_COLORS.white).toBe('#ffffff');
  });

  test('case-insensitive lookup', () => {
    expect(CSS_BASIC_COLORS['RED']).toBeUndefined();
    expect(CSS_BASIC_COLORS['red']).toBe('#ff0000');
  });
});

describe('parseMessageOptions', () => {
  test('parses valid color names', () => {
    const { options } = parseMessageOptions('textcolor:red');
    expect(options.textColor).toBe('#ff0000');
  });

  test('parses valid 6-char hex colors', () => {
    const { options } = parseMessageOptions('color:#ff0000');
    expect(options.textColor).toBe('#ff0000');
  });

  test('expands 3-char hex colors', () => {
    const { options } = parseMessageOptions('textcolor:#f00');
    expect(options.textColor).toBe('#ff0000');
  });

  test('rejects invalid color names', () => {
    const { errors } = parseMessageOptions('textcolor:puple');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Invalid color');
  });

  test('parses opacity with percent', () => {
    const { options } = parseMessageOptions('opacity:50%');
    expect(options.textOpacity).toBe(0.5);
  });

  test('parses opacity without percent', () => {
    const { options } = parseMessageOptions('opacity:0.75');
    expect(options.textOpacity).toBe(0.75);
  });

  test('rejects opacity out of range (percent)', () => {
    const { errors } = parseMessageOptions('opacity:150%');
    expect(errors.length).toBeGreaterThan(0);
  });

  test('rejects opacity out of range (decimal)', () => {
    const { errors } = parseMessageOptions('opacity:1.5');
    expect(errors.length).toBeGreaterThan(0);
  });

  test('parses transparency with percent', () => {
    const { options } = parseMessageOptions('transparency:40%');
    expect(options.textOpacity).toBe(0.6);
  });

  test('parses transparency without percent', () => {
    const { options } = parseMessageOptions('transparency:0.3');
    expect(options.textOpacity).toBe(0.7);
  });

  test('parses quality in range', () => {
    const { options } = parseMessageOptions('quality:80');
    expect(options.quality).toBe(80);
  });

  test('rejects quality out of range', () => {
    const { errors } = parseMessageOptions('quality:150');
    expect(errors.length).toBeGreaterThan(0);
  });

  test('accepts valid custom text', () => {
    const { options } = parseMessageOptions('text:"hello world"');
    expect(options.customText).toBe('hello world');
  });

  test('rejects custom text over max length', () => {
    const { errors } = parseMessageOptions('text:"'.concat('a'.repeat(31), '"'));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('too long');
  });

  test('accepts custom text at max length', () => {
    const { options } = parseMessageOptions('text:"'.concat('a'.repeat(30), '"'));
    expect(options.customText).toBe('a'.repeat(30));
  });

  test('last-value-wins for multiple opacity switches', () => {
    const { options } = parseMessageOptions('opacity:20% opacity:80%');
    expect(options.textOpacity).toBe(0.8);
  });

  test('case-insensitive switch matching', () => {
    const { options } = parseMessageOptions('TEXTCOLOR:red');
    expect(options.textColor).toBe('#ff0000');
  });

  test('returns errors for invalid color', () => {
    const { errors } = parseMessageOptions('color:invalidcolorname123');
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('stripDiscordMentions', () => {
  test('removes user mentions', () => {
    expect(stripDiscordMentions('hello <@123456789> world')).toBe('hello world');
  });

  test('removes role mentions', () => {
    expect(stripDiscordMentions('hello <@&987654321> world')).toBe('hello world');
  });

  test('removes channel mentions', () => {
    expect(stripDiscordMentions('hello <#111222333> world')).toBe('hello  world');
  });

  test('removes Discord user and role mentions', () => {
    expect(stripDiscordMentions('<@123><@&456> hello')).toBe('hello');
  });

  test('handles mixed Discord mentions', () => {
    expect(stripDiscordMentions('<@123><@&456><#789>')).toBe('');
  });

  test('removes trailing space after bot mention', () => {
    expect(stripDiscordMentions('hello <@123456>world')).toBe('hello world');
  });
});

describe('formatErrorReply', () => {
  test('formats errors with code block and original message label', () => {
    const result = formatErrorReply(['Error one'], 'original message');
    expect(result).toContain('Error one');
    expect(result).toContain('```');
    expect(result).toContain('Original message:');
    expect(result).toContain('original message');
  });

  test('escapes markdown in message content', () => {
    const result = formatErrorReply(['error'], 'hello *world_underscore_bold_tilde~backtick`');
    expect(result).toContain('\\*world');
    expect(result).toContain('\\u200B`');
  });
});

describe('stripCommandSwitches', () => {
  test('strips textcolor switch', () => {
    expect(stripCommandSwitches('hello textcolor:red world')).toBe('hello world');
  });

  test('strips opacity switch', () => {
    expect(stripCommandSwitches('hello opacity:50% world')).toBe('hello world');
  });

  test('strips transparency switch', () => {
    expect(stripCommandSwitches('hello transparency:30% world')).toBe('hello world');
  });

  test('strips quality switch', () => {
    expect(stripCommandSwitches('hello quality:80 world')).toBe('hello world');
  });

  test('strips quoted text switch', () => {
    expect(stripCommandSwitches('hello text:"my text" world')).toBe('hello world');
  });

  test('preserves non-switch content', () => {
    const result = stripCommandSwitches('textcolor:red opacity:50% hello world');
    expect(result).toBe('hello world');
  });

  test('handles multiple switches', () => {
    const result = stripCommandSwitches('textcolor:#fff opacity:0.5 quality:90 text:"test" hello world');
    expect(result).toBe('hello world');
  });
});

describe('validateHexColor', () => {
  test('validates 6-char hex', () => {
    expect(validateHexColor('#ff0000')).toBe(true);
  });

  test('validates 3-char hex', () => {
    expect(validateHexColor('#f00')).toBe(true);
  });

  test('rejects invalid hex', () => {
    expect(validateHexColor('#ggg')).toBe(false);
  });
});
