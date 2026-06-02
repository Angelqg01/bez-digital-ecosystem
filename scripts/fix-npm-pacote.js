// Fix npm's missing pacote/lib/util/cache-dir.js file
const fs = require('fs');
const path = require('path');

const targetDir = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node_modules', 'npm', 'node_modules', 'pacote', 'lib', 'util');
const targetFile = path.join(targetDir, 'cache-dir.js');

const content = `const { resolve } = require('node:path')
const { tmpdir, homedir } = require('node:os')

module.exports = (fakePlatform = false) => {
  const temp = tmpdir()
  const uidOrPid = process.getuid ? process.getuid() : process.pid
  const home = homedir() || resolve(temp, 'npm-' + uidOrPid)
  const platform = fakePlatform || process.platform
  const cacheExtra = platform === 'win32' ? 'npm-cache' : '.npm'
  const cacheRoot = (platform === 'win32' && process.env.LOCALAPPDATA) || home
  return {
    cacache: resolve(cacheRoot, cacheExtra, '_cacache'),
    tufcache: resolve(cacheRoot, cacheExtra, '_tuf'),
  }
}
`;

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

fs.writeFileSync(targetFile, content);
console.log('Created:', targetFile);

// Verify
const cacheDirFn = require(targetFile);
const result = cacheDirFn();
console.log('Verification - cacache:', result.cacache);
console.log('npm pacote fix applied successfully!');
