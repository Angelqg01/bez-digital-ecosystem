/**
 * BeZhas — Messaging MCP Server
 * ─────────────────────────────────────────────────────────────────────────────
 * Servidor MCP para mensajería multi-canal: Telegram (activo), WhatsApp y
 * Discord (planificados). Los agentes IA de OpenClaw usan estas tools para
 * comunicarse con humanos, enviar alertas y solicitar confirmaciones.
 *
 * Puerto: 4002 (mcp.bez.digital:4002)
 * Transport: stdio (local) | HTTP (producción con Express)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from 'http';
import { Redis } from 'ioredis';
import { TelegramClient } from './telegram.js';
import { registerMessagingTools } from './tools.js';

// ─── Validar variables de entorno requeridas ──────────────────────────────────
function validateEnv() {
  const required = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALERT_CHAT_ID'];
  if (process.env.NODE_ENV === 'production') {
    required.push('TELEGRAM_WEBHOOK_SECRET');
  }
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
    console.log('[Redis] Conectado:', url);
    return redis;
  } catch (err) {
    console.warn('[Redis] No disponible, continuando sin Redis:', err.message);
    return null;
  }
}

// ─── HTTP server para webhook de Telegram en producción ──────────────────────
function createWebhookServer(telegram) {
  const port = parseInt(process.env.MCP_PORT || '4002');
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  const server = createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/telegram/webhook') {
      if (webhookSecret && req.headers['x-telegram-bot-api-secret-token'] !== webhookSecret) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid Telegram webhook secret' }));
        return;
      }

      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > Number(process.env.TELEGRAM_WEBHOOK_MAX_BYTES || 1048576)) {
          req.destroy();
        }
      });
      req.on('end', () => {
        try {
          const update = JSON.parse(body);
          telegram.processUpdate(update);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'bezhas-messaging-mcp',
        version: '1.0.0',
        uptime: process.uptime()
      }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, process.env.MCP_HOST || '0.0.0.0', () => {
    console.log(`[MessagingMCP] HTTP server escuchando en puerto ${port}`);
    console.log(`[MessagingMCP] Webhook URL: https://mcp.bez.digital:${port}/telegram/webhook`);
    console.log(`[MessagingMCP] Health: http://localhost:${port}/health`);
  });

  return server;
}

// ─── Bootstrap principal ──────────────────────────────────────────────────────
async function main() {
  console.log('🚀 [BeZhas] Iniciando Messaging MCP Server...');

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
  await telegram.initialize(redis);

  // Servidor MCP
  const mcp = new McpServer({
    name: 'bezhas-messaging',
    version: '1.0.0',
    description: 'BeZhas Messaging MCP: Telegram alerts, trade notifications, lead updates y human-in-loop confirmations'
  });

  // Registrar todas las tools
  registerMessagingTools(mcp, { telegram });

  console.log('[MessagingMCP] Tools registradas: send_telegram_message, send_trade_alert, send_system_alert, send_lead_notification, request_human_confirmation, get_chat_history, get_telegram_status, send_telegram_document');

  // ── Modo producción: webhook HTTP + stdio ──────────────────────────────────
  if (process.env.NODE_ENV === 'production') {
    const httpServer = createWebhookServer(telegram);

    // Configurar webhook en Telegram si se proporciona URL
    const webhookUrl = process.env.BEZHAS_PUBLIC_URL || `https://mcp.bez.digital`;
    try {
      await telegram.setWebhook(webhookUrl);
      console.log(`[Telegram] Webhook configurado en ${webhookUrl}/telegram/webhook`);
    } catch (err) {
      console.warn('[Telegram] No se pudo configurar webhook automáticamente:', err.message);
      console.warn('[Telegram] Configúralo manualmente con: setWebhook()');
    }

    // MCP vía stdio (para OpenClaw local)
    const transport = new StdioServerTransport();
    await mcp.connect(transport);

    // Alerta de inicio
    try {
      await telegram.sendMessage(
        process.env.TELEGRAM_ALERT_CHAT_ID,
        '✅ *BeZhas Messaging MCP iniciado* — Sistema online y listo para recibir comandos\\.', {
          parse_mode: 'MarkdownV2'
        }
      );
    } catch (e) {
      console.warn('[Telegram] No se pudo enviar alerta de inicio:', e.message);
    }

  } else {
    // ── Modo desarrollo: polling + stdio ────────────────────────────────────
    console.log('[MessagingMCP] Modo desarrollo: usando polling de Telegram');
    const transport = new StdioServerTransport();
    await mcp.connect(transport);
  }

  console.log('✅ [BeZhas] Messaging MCP Server listo\n');

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[MessagingMCP] Recibido ${signal}, cerrando...`);
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
