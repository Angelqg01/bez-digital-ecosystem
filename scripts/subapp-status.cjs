const fs = require('fs');
const p = require('path');
const dir = p.resolve(__dirname, '..', "App-nativas");
const subs = fs.readdirSync(dir).filter(f => fs.statSync(p.join(dir, f)).isDirectory());

console.log('SubApp Status Report');
console.log('====================\n');

for (const s of subs) {
    const hasApi = fs.existsSync(p.join(dir, s, 'src', 'api.js'));
    const hasServices = fs.existsSync(p.join(dir, s, 'src', 'services'));
    const hasSrc = fs.existsSync(p.join(dir, s, 'src'));
    const hasBlockchain = hasApi
        ? fs.readFileSync(p.join(dir, s, 'src', 'api.js'), 'utf-8').includes('bezhas-blockchain-client')
        : false;
    const icon = (hasApi || hasServices) ? '[OK]' : '[--]';
    console.log(`${icon} ${s.padEnd(25)} src:${hasSrc ? 'Y' : 'N'}  api:${hasApi ? 'Y' : 'N'}  services:${hasServices ? 'Y' : 'N'}  blockchain:${hasBlockchain ? 'Y' : 'N'}`);
}
