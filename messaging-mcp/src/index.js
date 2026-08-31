/**
 * BeZhas — Messaging MCP Server
 * ─────────────────────────────────────────────────────────────────────────────
 * Servidor MCP para mensajería multi-canal: Telegram (activo), WhatsApp y
 * Discord (planificados). Los agentes IA de OpenClaw usan estas tools para
 * comunicarse con humanos, enviar alertas y solicitar confirmaciones.
 *
 * Transporte: stdio. El cliente MCP (Claude Code, Claude Desktop, o cualquier
 * agente compatible) lanza este fichero como subproceso y habla por
 * stdin/stdout. Ver .mcp.json en la raíz del repositorio.
 *
 * NO es un servicio de red y por eso no está en docker-compose.yml: un
 * subproceso lanzado bajo demanda no tiene puerto estable ni URL pública, así
 * que Telegram no puede entregarle un webhook. Las actualizaciones se traen
 * con polling, siempre.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Redis } from 'ioredis';
import { TelegramClient, log } from './telegram.js';
import { registerMessagingTools } from './tools.js';

// ─── Validar variables de entorno requeridas ──────────────────────────────────
function validateEnv() {
  const required = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALERT_CHAT_ID'];
  // TELEGRAM_WEBHOOK_SECRET ya no se exige: sin webhook no hay nada que firmar.
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error('[MessagingMCP] Faltan variables de entorno:', missing.join(', '));
    console.error('[MessagingMCP] Copia .env.example a .env y configura los valores.');
    process.exit(1);
  }
}

// ─── Conexión Redis ───────────────────────────────────────────────────────────
async function createRedisClient() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(url, {
    retryStrategy: (times) => Math.min(times * 200, 3000),
    lazyConnect: true,
    enableOfflineQueue: false
  });

  try {
    await redis.connect();
    await redis.ping();
    log('[Redis] Conectado:', url);
    return redis;
  } catch (err) {
    console.warn('[Redis] No disponible, continuando sin Redis:', err.message);
    return null;
  }
}

// ─── Bootstrap principal ──────────────────────────────────────────────────────
async function main() {
  log('🚀 [BeZhas] Iniciando Messaging MCP Server...');

  validateEnv();

  // Redis
  const redis = await createRedisClient();

  // Cliente Telegram
  const telegram = new TelegramClient({
    token: process.env.TELEGRAM_BOT_TOKEN,
    alertChatId: process.env.TELEGRAM_ALERT_CHAT_ID,
    leadsChannelId: process.env.TELEGRAM_LEADS_CHANNEL_ID,
    authorizedUsers: process.env.TELEGRAM_AUTHORIZED_USERS || ''
  });
  await telegram.initialize(redis, { polling: true });

  // Servidor MCP
  const mcp = new McpServer({
    name: 'bezhas-messaging',
    version: '1.0.0',
    description: 'BeZhas Messaging MCP: Telegram alerts, trade notifications, lead updates y human-in-loop confirmations'
  });

  // Registrar todas las tools
  registerMessagingTools(mcp, { telegram });

  log('[MessagingMCP] Tools registradas: send_telegram_message, send_trade_alert, send_system_alert, send_lead_notification, request_human_confirmation, get_chat_history, get_telegram_status, send_telegram_document');

  // ── Transporte stdio ──────────────────────────────────────────────────────
  // Polling incondicional: es la única forma de recibir los callback_query de
  // los botones, y sin ellos request_human_confirmation caduca SIEMPRE. Antes
  // esto dependía de NODE_ENV, que con `production` —el valor por defecto—
  // dejaba la confirmación humana rota sin que nada lo dijera.
  const transport = new StdioServerTransport();
  await mcp.connect(transport);

  log('✅ [BeZhas] Messaging MCP Server listo\n');

  // Graceful shutdown
  const shutdown = async (signal) => {
    log(`\n[MessagingMCP] Recibido ${signal}, cerrando...`);
    telegram.stop();
    if (redis) await redis.quit();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(err => {
  console.error('[MessagingMCP] Error fatal:', err);
  process.exit(1);
});
