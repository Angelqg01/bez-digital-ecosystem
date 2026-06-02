// Fix pacote cache-dir.js
const fs = require('fs');
const path = require('path');
const target = path.join('C:', 'Program Files', 'nodejs', 'node_modules', 'npm', 'node_modules', 'pacote', 'lib', 'util', 'cache-dir.js');
const src = [
  "const { resolve } = require('node:path');",
  "const { tmpdir, homedir } = require('node:os');",
  "module.exports = (fakePlatform = false) => {",
  "  const temp = tmpdir();",
  "  const uidOrPid = process.getuid ? process.getuid() : process.pid;",
  "  const home = homedir() || resolve(temp, 'npm-' + uidOrPid);",
  "  const platform = fakePlatform || process.platform;",
  "  const cacheExtra = platform === 'win32' ? 'npm-cache' : '.npm';",
  "  const cacheRoot = (platform === 'win32' && process.env.LOCALAPPDATA) || home;",
  "  return {",
  "    cacache: resolve(cacheRoot, cacheExtra, '_cacache'),",
  "    tufcache: resolve(cacheRoot, cacheExtra, '_tuf'),",
  "  };",
  "};",
].join('\n');
try {
  fs.writeFileSync(target, src);
  console.log('Created:', target);
  // Verify
  const fn = require(target);
  console.log('Verify:', JSON.stringify(fn()));
} catch (e) {
  console.error('Error:', e.message);
}
