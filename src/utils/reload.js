const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.resolve(__dirname, '..');

function clearSrcCache() {
  const cleared = [];
  for (const cacheKey of Object.keys(require.cache)) {
    const resolved = path.resolve(cacheKey);
    if (resolved.startsWith(SRC_ROOT)) {
      delete require.cache[cacheKey];
      cleared.push(path.relative(SRC_ROOT, cacheKey));
    }
  }
  return cleared;
}

module.exports = { clearSrcCache };
