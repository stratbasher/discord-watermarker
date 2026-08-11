const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.resolve(__dirname, '..');

const PRESERVED_PATHS = [
  path.join(SRC_ROOT, 'database'),
  path.join(SRC_ROOT, 'config'),
  path.join(SRC_ROOT, 'bot', 'client'),
];

function clearSrcCache() {
  const cleared = [];
  for (const cacheKey of Object.keys(require.cache)) {
    const resolved = path.resolve(cacheKey);
    if (!resolved.startsWith(SRC_ROOT)) continue;
    const isPreserved = PRESERVED_PATHS.some(p => resolved.startsWith(p));
    if (isPreserved) continue;
    delete require.cache[cacheKey];
    cleared.push(path.relative(SRC_ROOT, cacheKey));
  }
  return cleared;
}

module.exports = { clearSrcCache };
