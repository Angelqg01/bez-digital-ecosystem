/**
 * BeZhas Messaging MCP — Definiciones de Tools
 * Todas las herramientas que los agentes IA pueden usar para mensajería.
 */

import { z } from 'zod';
import { MessageFormatter } from './telegram.js';

// ─── Schemas Zod reutilizables ────────────────────────────────────────────────
const ChatIdSchema = z.string().describe('ID del chat/canal de Telegram. Usa el alertChatId por defecto si no se especifica.');
const TextSchema = z.string().min(1).max(4096).describe('Texto del mensaje. Soporta Markdown básico.');

// ─── Registro de tools ────────────────────────────────────────────────────────
export function registerMessagingTools(server, clients) {
  const { telegram } = clients;

  // ── 1. send_telegram_message ────────────────────────────────────────────────
  server.registerTool(
    'send_telegram_message',
    {
      title: 'Send Telegram Message',
      description: 'Envía un mensaje de texto a un chat o canal de Telegram. Úsalo para notificaciones generales, respuestas a usuarios y comunicaciones del agente.',
      inputSchema: {
        chat_id: ChatIdSchema.optional(),
        text: TextSchema,
        parse_mode: z.enum(['MarkdownV2', 'HTML', 'plain']).optional().default('plain')
          .describe('Formato del mensaje. "plain" es más seguro para texto generado por IA.'),
        disable_notification: z.boolean().optional().default(false)
          .describe('Si true, el mensaje no genera notificación de sonido/vibración.')
      },
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ chat_id, text, parse_mode, disable_notification }) => {
      const targetChat = chat_id || process.env.TELEGRAM_ALERT_CHAT_ID;
      if (!targetChat) throw new Error('chat_id requerido o TELEGRAM_ALERT_CHAT_ID no configurado');

      const opts = { disable_notification };
      if (parse_mode !== 'plain') opts.parse_mode = parse_mode;

      const sent = await telegram.sendMessage(targetChat, text, opts);
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: true, message_id: sent.message_id, chat_id: targetChat }) }],
        structuredContent: { ok: true, message_id: sent.message_id, chat_id: targetChat }
      };
    }
  );

  // ── 2. send_trade_alert ──────────────────────────────────────────────────────
  server.registerTool(
    'send_trade_alert',
    {
      title: 'Send Trade Alert',
      description: 'Envía una alerta de trading formateada al canal de Telegram configurado. Incluye símbolo, acción, precio, cantidad, confianza y razón.',
      inputSchema: {
        symbol: z.string().describe('Símbolo del activo. Ej: AAPL, BTC/USDT, BEZ/USDT'),
        action: z.enum(['BUY', 'SELL', 'HOLD', 'CLOSE']).describe('Acción de trading'),
        price: z.number().describe('Precio de entrada/salida'),
        quantity: z.number().describe('Cantidad de unidades'),
        reason: z.string().describe('Razón del trade (análisis técnico/fundamental)'),
        confidence: z.number().min(0).max(1).describe('Confianza del modelo (0.0 a 1.0)'),
        chat_id: ChatIdSchema.optional()
      },
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async (params) => {
      const targetChat = params.chat_id || process.env.TELEGRAM_ALERT_CHAT_ID;
      const text = MessageFormatter.tradeAlert(params);
      const sent = await telegram.sendMessage(targetChat, text, { parse_mode: 'MarkdownV2' });
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: true, message_id: sent.message_id }) }],
        structuredContent: { ok: true, message_id: sent.message_id }
      };
    }
  );

  // ── 3. send_system_alert ─────────────────────────────────────────────────────
  server.registerTool(
    'send_system_alert',
    {
      title: 'Send System Alert (AEGIS)',
      description: 'Envía una alerta del sistema AEGIS. Úsala para anomalías de seguridad, errores críticos, cambios en contratos o eventos blockchain importantes.',
      inputSchema: {
        level: z.enum(['critical', 'warning', 'info', 'success']).describe('Nivel de severidad'),
        title: z.string().describe('Título corto de la alerta'),
        message: z.string().describe('Descripción detallada del evento'),
        chat_id: ChatIdSchema.optional()
      },
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ level, title, message, chat_id }) => {
      const targetChat = chat_id || process.env.TELEGRAM_ALERT_CHAT_ID;
      const text = MessageFormatter.bezAlert({ level, title, message });
      const sent = await telegram.sendMessage(targetChat, text, { parse_mode: 'MarkdownV2' });
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: true, level, message_id: sent.message_id }) }],
        structuredContent: { ok: true, level, message_id: sent.message_id }
      };
    }
  );

  // ── 4. send_lead_notification ────────────────────────────────────────────────
  server.registerTool(
    'send_lead_notification',
    {
      title: 'Send Lead Notification',
      description: 'Notifica un nuevo lead cualificado al canal de ventas de Telegram. Incluye empresa, contacto, sector, score de calificación y fuente.',
      inputSchema: {
        company: z.string().describe('Nombre de la empresa'),
        contact: z.string().describe('Nombre del contacto principal'),
        sector: z.string().describe('Sector de la empresa'),
        score: z.number().min(0).max(100).describe('Score de cualificación del lead (0-100)'),
        source: z.string().describe('Fuente del lead: linkedin, email, referral, etc.'),
        chat_id: ChatIdSchema.optional()
      },
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async (params) => {
      const targetChat = params.chat_id || process.env.TELEGRAM_LEADS_CHANNEL_ID || process.env.TELEGRAM_ALERT_CHAT_ID;
      const text = MessageFormatter.leadNotification(params);
      const sent = await telegram.sendMessage(targetChat, text, { parse_mode: 'MarkdownV2' });
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: true, message_id: sent.message_id }) }],
        structuredContent: { ok: true, message_id: sent.message_id }
      };
    }
  );

  // ── 5. request_human_confirmation ───────────────────────────────────────────
  server.registerTool(
    'request_human_confirmation',
    {
      title: 'Request Human Confirmation (Human-in-Loop)',
      description: 'Solicita confirmación humana para acciones críticas (órdenes de trading, deploy de contratos, transferencias). El agente espera la respuesta del usuario antes de continuar. SIEMPRE úsala antes de ejecutar trades o transacciones.',
      inputSchema: {
        request_id: z.string().describe('ID único de la solicitud (usa UUID o timestamp)'),
        action: z.string().describe('Descripción de la acción que requiere confirmación'),
        details: z.record(z.unknown()).describe('Detalles de la acción en formato objeto'),
        timeout_secs: z.number().min(30).max(300).optional().default(120)
          .describe('Segundos para esperar confirmación antes de timeout'),
        chat_id: ChatIdSchema.optional()
      },
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ request_id, action, details, timeout_secs, chat_id }) => {
      const targetChat = chat_id || process.env.TELEGRAM_ALERT_CHAT_ID;
      try {
        const result = await telegram.requestConfirmation({
          requestId: request_id,
          chatId: targetChat,
          action,
          details,
          timeoutSecs: timeout_secs
        });
        return {
          content: [{ type: 'text', text: JSON.stringify({ approved: result.approved, user: result.username, userId: result.userId }) }],
          structuredContent: { approved: result.approved, user: result.username, userId: result.userId }
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ approved: false, error: err.message, timeout: true }) }],
          structuredContent: { approved: false, error: err.message, timeout: true }
        };
      }
    }
  );

  // ── 6. get_chat_history ──────────────────────────────────────────────────────
  server.registerTool(
    'get_chat_history',
    {
      title: 'Get Telegram Chat History',
      description: 'Obtiene el historial reciente de mensajes de un chat de Telegram (desde Redis). Útil para que el agente tenga contexto de conversaciones previas.',
      inputSchema: {
        chat_id: ChatIdSchema,
        limit: z.number().min(1).max(50).optional().default(20).describe('Número de mensajes a recuperar')
      },
      annotations: { readOnlyHint: true, destructiveHint: false }
    },
    async ({ chat_id, limit }) => {
      const history = await telegram.getChatHistory(chat_id, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify({ chat_id, count: history.length, messages: history }) }],
        structuredContent: { chat_id, count: history.length, messages: history }
      };
    }
  );

  // ── 7. get_telegram_status ───────────────────────────────────────────────────
  server.registerTool(
    'get_telegram_status',
    {
      title: 'Get Telegram Bot Status',
      description: 'Obtiene el estado del bot de Telegram: info del bot, webhook configurado y estado de conexión.',
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false }
    },
    async () => {
      const [me, webhookInfo] = await Promise.all([
        telegram.getMe(),
        telegram.getWebhookInfo()
      ]);
      const status = {
        bot: { id: me.id, username: me.username, name: me.first_name },
        webhook: { url: webhookInfo.url, has_custom_certificate: webhookInfo.has_custom_certificate, pending_update_count: webhookInfo.pending_update_count },
        authorized_users_count: telegram.authorizedUsers.size,
        alert_chat_id: process.env.TELEGRAM_ALERT_CHAT_ID
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(status) }],
        structuredContent: status
      };
    }
  );

  // ── 8. send_document ─────────────────────────────────────────────────────────
  server.registerTool(
    'send_telegram_document',
    {
      title: 'Send Document to Telegram',
      description: 'Envía un documento (PDF, CSV, JSON, etc.) a un chat de Telegram. Úsalo para reportes de trading, análisis de portfolio, informes de compliance.',
      inputSchema: {
        chat_id: ChatIdSchema.optional(),
        document_url: z.string().url().describe('URL pública del documento a enviar'),
        caption: z.string().max(1024).optional().describe('Pie de foto/descripción del documento'),
        filename: z.string().optional().describe('Nombre del archivo (opcional)')
      },
      annotations: { readOnlyHint: false, destructiveHint: false }
    },
    async ({ chat_id, document_url, caption, filename }) => {
      const targetChat = chat_id || process.env.TELEGRAM_ALERT_CHAT_ID;
      const sent = await telegram.sendDocument(targetChat, document_url, caption || '');
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: true, message_id: sent.message_id }) }],
        structuredContent: { ok: true, message_id: sent.message_id }
      };
    }
  );
}
