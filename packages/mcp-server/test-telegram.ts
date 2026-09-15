/**
 * Comprobación MANUAL del canal de Telegram. No forma parte de la suite:
 * vitest solo recoge `src/**\/*.test.ts`, y este script envía un mensaje de
 * verdad, así que necesita credenciales reales y un administrador al otro
 * lado. Sirve para confirmar que TELEGRAM_BOT_TOKEN y
 * TELEGRAM_SECURITY_CHAT_ID están bien puestos.
 *
 *   pnpm exec tsx test-telegram.ts
 */
import 'dotenv/config';
import { sendTelegramMessage } from './src/tools/telegramMcp.js';

async function main() {
    console.log('Enviando mensaje de prueba por send_telegram_message...');

    const resultado = await sendTelegramMessage({
        message:
            '🤖 *Prueba desde el servidor MCP*\n\n' +
            'Mensaje automático para verificar que el administrador recibe los avisos.',
        severity: 'medium',
    });

    console.log(JSON.stringify(resultado, null, 2));
    process.exit(resultado.isError ? 1 : 0);
}

main();
