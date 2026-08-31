/**
 * BeZhas — Tools del Messaging MCP
 * ─────────────────────────────────────────────────────────────────────────────
 * Las ocho herramientas que index.js anuncia al arrancar. Son la superficie que
 * ve un agente: cada una recibe argumentos validados con zod y devuelve texto
 * más un JSON con el detalle.
 *
 * Dos reglas que se repiten en todas:
 *
 *  1. Ninguna lanza. Un error se devuelve como `isError: true` con un mensaje
 *     legible. Si una tool lanza, el agente recibe un fallo de protocolo sin
 *     contexto y lo normal es que reintente en bucle contra el mismo problema.
 *
 *  2. Todo valor que venga de fuera y se meta en una plantilla MarkdownV2 pasa
 *     por escapeMarkdownV2. Un guion en el nombre de una empresa basta para que
 *     Telegram rechace el mensaje entero.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from 'zod';
import { escapeMarkdownV2 } from './telegram.js';

/** Respuesta correcta: resumen legible + datos para el agente. */
function ok(resumen, datos) {
    return {
        content: [{
            type: 'text',
            text: datos ? `${resumen}\n\n${JSON.stringify(datos, null, 2)}` : resumen,
        }],
    };
}

/** Respuesta de error. Nunca se propaga la excepción al transporte. */
function fallo(accion, err) {
    return {
        content: [{ type: 'text', text: `${accion} falló: ${err?.message || String(err)}` }],
        isError: true,
    };
}

const SEVERIDADES = {
    info: { icono: 'ℹ️', etiqueta: 'INFO' },
    warning: { icono: '⚠️', etiqueta: 'AVISO' },
    error: { icono: '🔴', etiqueta: 'ERROR' },
    critical: { icono: '🚨', etiqueta: 'CRÍTICO' },
};

export function registerMessagingTools(mcp, { telegram }) {
    if (!mcp) throw new Error('registerMessagingTools: falta el servidor MCP');
    if (!telegram) throw new Error('registerMessagingTools: falta el cliente de Telegram');

    // ── 1. Mensaje libre ─────────────────────────────────────────────────────
    mcp.registerTool('send_telegram_message', {
        title: 'Enviar mensaje de Telegram',
        description:
            'Envía un mensaje de texto a un chat de Telegram. Si no se indica chat_id se usa ' +
            'el chat de alertas configurado. Para texto generado por el agente conviene dejar ' +
            'parse_mode sin poner: cualquier carácter suelto rompe el formateo.',
        inputSchema: {
            text: z.string().min(1).max(4096).describe('Contenido del mensaje'),
            chat_id: z.string().optional().describe('Chat de destino. Por defecto, el de alertas'),
            parse_mode: z.enum(['MarkdownV2', 'HTML']).optional()
                .describe('Formato. Omitir para texto plano, que es lo seguro'),
            silent: z.boolean().optional().describe('Entrega sin notificación sonora'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async ({ text, chat_id, parse_mode, silent }) => {
        try {
            const r = await telegram.sendMessage(chat_id, text, {
                parse_mode,
                disable_notification: silent === true,
            });
            return ok('Mensaje enviado.', { message_id: r.message_id, chat_id: r.chat?.id });
        } catch (err) {
            return fallo('send_telegram_message', err);
        }
    });

    // ── 2. Alerta de operación ───────────────────────────────────────────────
    mcp.registerTool('send_trade_alert', {
        title: 'Alerta de operación',
        description:
            'Publica una alerta de trading con formato: par, sentido, cantidad y precio. ' +
            'Pensada para los agentes de mercado.',
        inputSchema: {
            pair: z.string().min(1).describe('Par operado, p. ej. BEZ/USDT'),
            side: z.enum(['BUY', 'SELL']).describe('Sentido de la operación'),
            amount: z.union([z.number(), z.string()]).describe('Cantidad'),
            price: z.union([z.number(), z.string()]).optional().describe('Precio de ejecución'),
            pnl: z.union([z.number(), z.string()]).optional().describe('Resultado, si la operación se cierra'),
            reason: z.string().optional().describe('Motivo o señal que la dispara'),
            tx_hash: z.string().optional().describe('Hash on-chain, si existe'),
            chat_id: z.string().optional(),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async ({ pair, side, amount, price, pnl, reason, tx_hash, chat_id }) => {
        try {
            const compra = side === 'BUY';
            const lineas = [
                `${compra ? '🟢' : '🔴'} *${compra ? 'COMPRA' : 'VENTA'}* \\· ${escapeMarkdownV2(pair)}`,
                '',
                `Cantidad: \`${escapeMarkdownV2(amount)}\``,
            ];
            if (price !== undefined) lineas.push(`Precio: \`${escapeMarkdownV2(price)}\``);
            if (pnl !== undefined) {
                const positivo = Number(pnl) >= 0;
                lineas.push(`PnL: ${positivo ? '📈' : '📉'} \`${escapeMarkdownV2(pnl)}\``);
            }
            if (reason) lineas.push('', `_${escapeMarkdownV2(reason)}_`);
            if (tx_hash) lineas.push('', `Tx: \`${escapeMarkdownV2(tx_hash)}\``);

            const r = await telegram.sendMessage(chat_id, lineas.join('\n'), { parse_mode: 'MarkdownV2' });
            return ok(`Alerta de ${side} en ${pair} enviada.`, { message_id: r.message_id });
        } catch (err) {
            return fallo('send_trade_alert', err);
        }
    });

    // ── 3. Alerta de sistema ─────────────────────────────────────────────────
    mcp.registerTool('send_system_alert', {
        title: 'Alerta de sistema',
        description:
            'Avisa de un evento de infraestructura o del propio sistema, clasificado por ' +
            'severidad. Las críticas se envían siempre con notificación, aunque se pida silencio.',
        inputSchema: {
            severity: z.enum(['info', 'warning', 'error', 'critical']).describe('Gravedad'),
            component: z.string().min(1).describe('Componente afectado, p. ej. api, indexer, aegis'),
            message: z.string().min(1).describe('Qué ha pasado'),
            details: z.record(z.string(), z.any()).optional().describe('Datos adicionales, clave/valor'),
            chat_id: z.string().optional(),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async ({ severity, component, message, details, chat_id }) => {
        try {
            const { icono, etiqueta } = SEVERIDADES[severity];
            const lineas = [
                `${icono} *${etiqueta}* \\· \`${escapeMarkdownV2(component)}\``,
                '',
                escapeMarkdownV2(message),
            ];

            if (details && Object.keys(details).length) {
                lineas.push('');
                for (const [k, v] of Object.entries(details).slice(0, 15)) {
                    lineas.push(`\\· ${escapeMarkdownV2(k)}: \`${escapeMarkdownV2(
                        typeof v === 'object' ? JSON.stringify(v) : v
                    )}\``);
                }
            }

            const r = await telegram.sendMessage(chat_id, lineas.join('\n'), {
                parse_mode: 'MarkdownV2',
                // Una alerta crítica silenciada no es una alerta.
                disable_notification: severity === 'info',
            });
            return ok(`Alerta ${etiqueta} de ${component} enviada.`, { message_id: r.message_id });
        } catch (err) {
            return fallo('send_system_alert', err);
        }
    });

    // ── 4. Aviso de lead ─────────────────────────────────────────────────────
    mcp.registerTool('send_lead_notification', {
        title: 'Aviso de lead comercial',
        description:
            'Publica un lead nuevo en el canal comercial (TELEGRAM_LEADS_CHANNEL_ID, o el de ' +
            'alertas si no está configurado).',
        inputSchema: {
            company: z.string().min(1).describe('Empresa'),
            contact: z.string().optional().describe('Persona de contacto'),
            email: z.string().optional().describe('Correo de contacto'),
            sector: z.string().optional().describe('Sector: logística, aduanas, RWA, fintech...'),
            estimated_value: z.union([z.number(), z.string()]).optional().describe('Valor estimado'),
            source: z.string().optional().describe('Origen del lead'),
            notes: z.string().optional().describe('Notas'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async ({ company, contact, email, sector, estimated_value, source, notes }) => {
        try {
            const lineas = [`🎯 *Lead nuevo* \\· ${escapeMarkdownV2(company)}`, ''];
            const campos = [
                ['Contacto', contact], ['Email', email], ['Sector', sector],
                ['Valor estimado', estimated_value], ['Origen', source],
            ];
            for (const [etiqueta, valor] of campos) {
                if (valor !== undefined && valor !== null && valor !== '') {
                    lineas.push(`${escapeMarkdownV2(etiqueta)}: \`${escapeMarkdownV2(valor)}\``);
                }
            }
            if (notes) lineas.push('', `_${escapeMarkdownV2(notes)}_`);

            const r = await telegram.sendMessage(telegram.leadsChannelId, lineas.join('\n'), {
                parse_mode: 'MarkdownV2',
            });
            return ok(`Lead de ${company} publicado.`, { message_id: r.message_id, chat_id: r.chat?.id });
        } catch (err) {
            return fallo('send_lead_notification', err);
        }
    });

    // ── 5. Confirmación humana ───────────────────────────────────────────────
    mcp.registerTool('request_human_confirmation', {
        title: 'Pedir confirmación a un humano',
        description:
            'Publica una pregunta con botones y ESPERA la respuesta de un humano autorizado. ' +
            'Es la puerta que debe atravesar cualquier acción irreversible: pagos, ' +
            'liquidaciones, despliegues, cambios de configuración en producción. ' +
            'Devuelve APPROVED, REJECTED, CHOSEN o TIMEOUT — comprueba el estado antes de ' +
            'seguir; que no haya error NO significa que te hayan dicho que sí. ' +
            'Solo responden los usuarios de TELEGRAM_AUTHORIZED_USERS.',
        inputSchema: {
            question: z.string().min(1).max(1000).describe('Qué se pregunta'),
            details: z.string().max(2000).optional().describe('Contexto para decidir'),
            options: z.array(z.string()).min(2).max(4).optional()
                .describe('Opciones a medida. Por defecto, Aprobar / Rechazar'),
            timeout_seconds: z.number().int().min(10).max(3600).optional()
                .describe('Espera máxima. Por defecto 300 s'),
            requested_by: z.string().optional().describe('Agente que lo solicita, para la traza'),
            chat_id: z.string().optional(),
        },
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
        },
    }, async ({ question, details, options, timeout_seconds, requested_by, chat_id }) => {
        try {
            const resultado = await telegram.requestConfirmation({
                question,
                details,
                options,
                timeoutMs: (timeout_seconds ?? 300) * 1000,
                requestedBy: requested_by,
                chatId: chat_id,
            });

            const resumen = {
                APPROVED: `✅ Aprobado por ${resultado.answeredBy}.`,
                REJECTED: `❌ Rechazado por ${resultado.answeredBy}.`,
                CHOSEN: `Se eligió «${resultado.label}» (${resultado.answeredBy}).`,
                TIMEOUT: '⏱️ Nadie respondió a tiempo. Trátalo como NO aprobado.',
                CANCELLED: 'Confirmación cancelada: el servidor se detuvo.',
            }[resultado.status] || `Estado: ${resultado.status}`;

            // No se marca isError en TIMEOUT: no ha fallado nada, simplemente
            // nadie contestó. Es un desenlace legítimo que el agente debe leer.
            return ok(resumen, resultado);
        } catch (err) {
            return fallo('request_human_confirmation', err);
        }
    });

    // ── 6. Historial ─────────────────────────────────────────────────────────
    mcp.registerTool('get_chat_history', {
        title: 'Leer historial del chat',
        description:
            'Devuelve los mensajes recientes de un chat, más nuevos primero. Sale del ' +
            'historial que guarda este servidor (Redis, o memoria si no está disponible), ' +
            'no de la API de Telegram: solo contiene lo ocurrido desde que el servidor está en marcha.',
        inputSchema: {
            chat_id: z.string().optional().describe('Chat a consultar. Por defecto, el de alertas'),
            limit: z.number().int().min(1).max(200).optional().describe('Cuántos mensajes. Por defecto 20'),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ chat_id, limit }) => {
        try {
            const h = await telegram.getChatHistory(chat_id, limit ?? 20);
            return ok(`${h.count} mensaje(s) del chat ${h.chat_id} (origen: ${h.source}).`, h);
        } catch (err) {
            return fallo('get_chat_history', err);
        }
    });

    // ── 7. Estado ────────────────────────────────────────────────────────────
    mcp.registerTool('get_telegram_status', {
        title: 'Estado del servicio de Telegram',
        description:
            'Diagnóstico del bot: identidad, modo (webhook o polling), estado del webhook, ' +
            'disponibilidad de Redis, confirmaciones pendientes y contadores. Útil antes de ' +
            'dar por hecho que una alerta llegó.',
        inputSchema: {},
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async () => {
        try {
            const estado = await telegram.getStatus();
            const bot = estado.bot ? `@${estado.bot.username}` : 'sin identificar';
            return ok(`Bot ${bot} en modo ${estado.mode}. Redis: ${estado.redis}.`, estado);
        } catch (err) {
            return fallo('get_telegram_status', err);
        }
    });

    // ── 8. Documento ─────────────────────────────────────────────────────────
    mcp.registerTool('send_telegram_document', {
        title: 'Enviar documento',
        description:
            'Envía un fichero: o una URL pública que Telegram descarga, o contenido de texto ' +
            'que se sube como adjunto (informes, CSV, logs). Indica `url` o `content`, no ambos.',
        inputSchema: {
            filename: z.string().min(1).max(255).describe('Nombre del fichero'),
            url: z.string().url().optional().describe('URL pública del documento'),
            content: z.string().max(1_000_000).optional().describe('Contenido en texto, si no hay URL'),
            caption: z.string().max(1024).optional().describe('Pie del documento'),
            chat_id: z.string().optional(),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async ({ filename, url, content, caption, chat_id }) => {
        try {
            if (url && content) {
                return fallo('send_telegram_document', new Error('Indica `url` o `content`, no las dos'));
            }
            const r = await telegram.sendDocument(chat_id, { url, content, filename, caption });
            return ok(`Documento «${filename}» enviado.`, {
                message_id: r.message_id,
                file_id: r.document?.file_id,
                size: r.document?.file_size,
            });
        } catch (err) {
            return fallo('send_telegram_document', err);
        }
    });

    return mcp;
}

export default registerMessagingTools;
