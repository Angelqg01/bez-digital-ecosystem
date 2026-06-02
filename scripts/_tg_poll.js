const https = require('https');
const fs = require('fs');
const path = require('path');

function loadToken() {
    if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;
    const envPath = path.resolve(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return null;
    const match = fs.readFileSync(envPath, 'utf8').match(/^TELEGRAM_BOT_TOKEN=(.+)$/m);
    return match ? match[1].trim() : null;
}

const TOKEN = loadToken();
if (!TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    process.exit(1);
}

https.get('https://api.telegram.org/bot' + TOKEN + '/getUpdates?offset=-1&limit=1&timeout=10', (r) => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => console.log(d));
});
