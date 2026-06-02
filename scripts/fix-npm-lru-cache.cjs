// Fix npm lru-cache missing module
const fs = require('fs');
const path = require('path');

const npmDir = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'node_modules');
const lruDir = path.join(npmDir, 'lru-cache');

console.log('npm node_modules dir:', npmDir);
console.log('lru-cache dir:', lruDir);

// Check if lru-cache exists somewhere nested
const possibleLocations = [
  path.join(npmDir, 'cacache', 'node_modules', 'lru-cache'),
  path.join(npmDir, 'make-fetch-happen', 'node_modules', 'lru-cache'),
  path.join(npmDir, 'minipass-fetch', 'node_modules', 'lru-cache'),
];

let found = null;
for (const loc of possibleLocations) {
  if (fs.existsSync(loc)) {
    console.log('Found lru-cache at:', loc);
    found = loc;
    break;
  }
}

if (!found) {
  // Need to manually create a minimal lru-cache module
  console.log('lru-cache not found anywhere in npm. Creating minimal shim...');
  fs.mkdirSync(lruDir, { recursive: true });
  
  // Write a minimal LRUCache implementation
  const shimCode = `
class LRUCache {
  constructor(options = {}) {
    this.max = options.max || 1000;
    this.cache = new Map();
  }
  get(key) { 
    const v = this.cache.get(key);
    if (v !== undefined) { this.cache.delete(key); this.cache.set(key, v); }
    return v;
  }
  set(key, value) {
    this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.max) {
      const first = this.cache.keys().next().value;
      this.cache.delete(first);
    }
    return this;
  }
  has(key) { return this.cache.has(key); }
  delete(key) { return this.cache.delete(key); }
  clear() { this.cache.clear(); }
  get size() { return this.cache.size; }
  keys() { return this.cache.keys(); }
  values() { return this.cache.values(); }
  entries() { return this.cache.entries(); }
  forEach(fn, thisArg) { this.cache.forEach(fn, thisArg); }
  [Symbol.iterator]() { return this.cache[Symbol.iterator](); }
}
module.exports = LRUCache;
`;
  
  fs.writeFileSync(path.join(lruDir, 'index.js'), shimCode);
  fs.writeFileSync(path.join(lruDir, 'package.json'), JSON.stringify({
    name: 'lru-cache',
    version: '10.0.0',
    main: 'index.js'
  }, null, 2));
  
  console.log('Created lru-cache shim at:', lruDir);
} else {
  // Symlink or copy
  console.log('Copying from found location...');
  fs.mkdirSync(lruDir, { recursive: true });
  const files = fs.readdirSync(found);
  for (const f of files) {
    fs.copyFileSync(path.join(found, f), path.join(lruDir, f));
  }
  console.log('Copied lru-cache to npm node_modules');
}

// Verify
try {
  delete require.cache[require.resolve(path.join(lruDir, 'index.js'))];
  require(path.join(lruDir, 'index.js'));
  console.log('✅ lru-cache is now loadable');
} catch(e) {
  console.log('❌ Still failing:', e.message);
}
