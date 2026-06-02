const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
console.log('Working dir:', dir);
console.log('Node version:', process.version);

// Check current state
const nmPath = path.join(dir, 'node_modules');
const nextPath = path.join(nmPath, 'next');
const pnpmPath = path.join(nmPath, '.pnpm');

console.log('\n--- Current state ---');
console.log('node_modules exists:', fs.existsSync(nmPath));
console.log('next exists:', fs.existsSync(nextPath));
console.log('.pnpm exists:', fs.existsSync(pnpmPath));

if (fs.existsSync(nmPath)) {
    const items = fs.readdirSync(nmPath);
    console.log('node_modules items:', items.length);
    console.log('First 10:', items.slice(0, 10));
}

// Try pnpm install with shamefully-hoist
console.log('\n--- Running pnpm install --shamefully-hoist ---');
try {
    const result = execSync('pnpm install --shamefully-hoist --force --reporter=default 2>&1', {
        cwd: dir,
        encoding: 'utf8',
        timeout: 600000,
        maxBuffer: 10 * 1024 * 1024
    });
    console.log('PNPM OUTPUT:', result);
} catch (e) {
    console.log('PNPM EXIT CODE:', e.status);
    console.log('PNPM STDOUT:', e.stdout ? e.stdout.slice(-2000) : 'none');
    console.log('PNPM STDERR:', e.stderr ? e.stderr.slice(-2000) : 'none');
}

// Check state after
console.log('\n--- After install ---');
console.log('next exists:', fs.existsSync(nextPath));
console.log('.pnpm exists:', fs.existsSync(pnpmPath));

if (fs.existsSync(nextPath)) {
    const pkg = JSON.parse(fs.readFileSync(path.join(nextPath, 'package.json'), 'utf8'));
    console.log('Next.js version:', pkg.version);
}
