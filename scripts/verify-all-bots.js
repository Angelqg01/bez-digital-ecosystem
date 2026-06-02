import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
dotenv.config();

const chatId = '812711473';

const bots = [
  { id: 'CEO',       token: process.env.TELEGRAM_TOKEN_DIRECTOR, msg: '🏢 *Reporte CEO Online*\n\n• *Cerebro:* Kimi-K2 (Local)\n• *Estado:* Orquestación central activa.\n• *Objetivo:* Coordinación de OKRs y visión estratégica.' },
  { id: 'CFO',       token: process.env.TELEGRAM_TOKEN_FINANCE,  msg: '💰 *Reporte CFO Online*\n\n• *Cerebro:* Qwen 3.6:35b (Local)\n• *Estado:* Tesorería y staking Rewards verificados.\n• *Objetivo:* Gestión de P&L y optimización de capital.' },
  { id: 'CMO',       token: process.env.TELEGRAM_TOKEN_MARKETING,msg: '📈 *Reporte CMO Online*\n\n• *Cerebro:* Gemma 4:27b (Local)\n• *Estado:* Campañas de prospección en espera.\n• *Objetivo:* Crecimiento del ecosistema BeZhas.' },
  { id: 'DevOps',    token: process.env.TELEGRAM_TOKEN_DEVOPS,   msg: '🛡️ *Reporte DevOps/Blockchain Online*\n\n• *Cerebro:* Qwen 3.6 (Coder)\n• *Estado:* Seguridad AEGIS Activa | Nodos Saludables.\n• *Objetivo:* Integridad de la red y despliegues seguros.' },
  { id: 'Legal',     token: process.env.TELEGRAM_TOKEN_LEGAL,    msg: '⚖️ *Reporte Legal Online*\n\n• *Cerebro:* Gemma 4:27b (Local)\n• *Estado:* Marco MiCA y RGPD actualizado.\n• *Objetivo:* Protección legal y cumplimiento fiscal.' }
];

async function main() {
    console.log('Iniciando verificación de red multi-bot...');
    for (const b of bots) {
        if (!b.token) {
            console.warn(`[${b.id}] Token no configurado. Saltando...`);
            continue;
        }
        try {
            const bot = new TelegramBot(b.token, { polling: false });
            await bot.sendMessage(chatId, b.msg, { parse_mode: 'Markdown' });
            console.log(`[${b.id}] Mensaje enviado correctamente.`);
        } catch (err) {
            console.error(`[${b.id}] Error: ${err.message}`);
        }
    }
}

main();
