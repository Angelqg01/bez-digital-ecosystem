#!/usr/bin/env node
/**
 * Telegram Bot Test & Configuration Helper.
 * Usage:
 *   node scripts/telegram-test.js getUpdates     — Find chat IDs
 *   node scripts/telegram-test.js send <chatId>   — Send test message to a chat
 *   node scripts/telegram-test.js broadcast       — Send to all known chats
 */
// Try dotenv from multiple locations
try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); } catch {
    try { require('dotenv').config(); } catch { /* no dotenv—use env directly */ }
}
const https = require('https');
const fs = require('fs');
const path = require('path');

// Load token from env or fallback to reading .env file directly
let TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
    try {
        const envPath = path.join(__dirname, '..', '.env');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/TELEGRAM_BOT_TOKEN=(.+)/);
        if (match) TOKEN = match[1].trim();
    } catch { /* ignore */ }
}
if (!TOKEN) { console.error('TELEGRAM_BOT_TOKEN not found'); process.exit(1); }

function telegramAPI(method, body) {
    return new Promise((resolve, reject) => {
        const url = `https://api.telegram.org/bot${TOKEN}/${method}`;
        if (!body) {
            https.get(url, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch { resolve(data); }
                });
            }).on('error', reject);
        } else {
            const payload = JSON.stringify(body);
            const { hostname, pathname } = new URL(url);
            const req = https.request({
                hostname, path: pathname, method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch { resolve(data); }
                });
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        }
    });
}

async function main() {
    const cmd = process.argv[2] || 'getUpdates';

    if (cmd === 'getUpdates') {
        console.log('Fetching updates from @BeZhasBot...');
        const result = await telegramAPI('getUpdates', null);
        if (result.ok && result.result.length > 0) {
            const chats = new Map();
            for (const update of result.result) {
                const chat = update.message?.chat || update.my_chat_member?.chat;
                if (chat && !chats.has(chat.id)) {
                    chats.set(chat.id, {
                        id: chat.id,
                        type: chat.type,
                        name: chat.first_name || chat.title || chat.username || 'unknown'
                    });
                }
            }
            if (chats.size > 0) {
                console.log('\nFound chats:');
                for (const [id, info] of chats) {
                    console.log(`  Chat ID: ${id} | Type: ${info.type} | Name: ${info.name}`);
                }
                console.log(`\nTo send a test message: node scripts/telegram-test.js send ${[...chats.keys()][0]}`);
            } else {
                console.log('No chat messages found. Send /start to @BeZhasBot in Telegram first.');
            }
        } else if (result.ok && result.result.length === 0) {
            console.log('No updates. Please send /start to @BeZhasBot in Telegram, then run this again.');
        } else {
            console.log('Error:', JSON.stringify(result, null, 2));
        }
    }
    else if (cmd === 'send') {
        const chatId = process.argv[3];
        if (!chatId) { console.error('Usage: node scripts/telegram-test.js send <chatId>'); process.exit(1); }

        const now = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
        const msg = `🟢 *BeZhas Platform — Sistema Confirmado*\n\n` +
            `✅ Plataforma BeZhas Blockchain operativa\n` +
            `✅ Token BEZ-Coin activo en Polygon\n` +
            `✅ Bot @BeZhasBot conectado\n` +
            `✅ Agent Runtime: 24 tools, 8 commands\n` +
            `✅ AI Engine: 12 MCP tools\n\n` +
            `📊 *Enlaces Confirmados:*\n` +
            `• [BEZCoin Contract](https://polygon.blockscout.com/address/0xE65F6B8ADbcd604dBCbb826b5792D17e2FD95744?tab=contract)\n` +
            `• [BEZCoin Multisig](https://polygon.blockscout.com/address/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8?tab=contract)\n` +
            `• [LP Pool BEZ/USDC](https://dapp.quickswap.exchange/pool/positions/v2/0x4edc77de01f2a2c87611c2f8e9249be43df745a9?chainId=137)\n` +
            `• [Sourcify Verified](https://repo.sourcify.dev/137/0xE65F6B8ADbcd604dBCbb826b5792D17e2FD95744/)\n\n` +
            `📱 Usa comandos para gestionar la plataforma:\n` +
            `/gas — Análisis de gas\n` +
            `/validator — Estado de validadores\n` +
            `/bridge — Salud del bridge L1↔L2\n` +
            `/incident — Reportar incidentes\n\n` +
            `⏰ ${now}`;

        console.log(`Sending to chat ${chatId}...`);
        const result = await telegramAPI('sendMessage', {
            chat_id: chatId,
            text: msg,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
        });

        if (result.ok) {
            console.log('✅ Message sent successfully!');
            console.log(`   Message ID: ${result.result.message_id}`);
        } else {
            console.log('❌ Failed:', JSON.stringify(result, null, 2));
        }
    }
    else if (cmd === 'broadcast') {
        // First get all known chats from updates
        const updates = await telegramAPI('getUpdates', null);
        if (!updates.ok || updates.result.length === 0) {
            console.log('No chats found. Send /start to @BeZhasBot first.');
            return;
        }
        const chatIds = new Set();
        for (const u of updates.result) {
            const chat = u.message?.chat || u.my_chat_member?.chat;
            if (chat) chatIds.add(chat.id);
        }
        console.log(`Broadcasting to ${chatIds.size} chat(s)...`);
        for (const id of chatIds) {
            process.argv[3] = String(id);
            // Reuse send logic
            const result = await telegramAPI('sendMessage', {
                chat_id: id,
                text: `🟢 *BeZhas Platform Online*\nSistema confirmado y operativo. Usa /start para ver comandos disponibles.`,
                parse_mode: 'Markdown',
            });
            console.log(`  Chat ${id}: ${result.ok ? '✅ Sent' : '❌ Failed'}`);
        }
    }
    else {
        console.log('Unknown command. Use: getUpdates, send <chatId>, or broadcast');
    }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
