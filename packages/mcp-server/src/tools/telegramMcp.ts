/**
 * ============================================================================
 * MCP SERVER - TELEGRAM
 * ============================================================================
 *
 * Canal por el que el servidor avisa al administrador. Es la vía de escape
 * cuando algo va mal, así que el criterio aquí es que el aviso llegue: más
 * vale un mensaje feo que un mensaje perdido.
 *
 * Eso obliga a dos cosas que no son evidentes:
 *
 *   - `parse_mode: 'Markdown'` hace que Telegram RECHACE el mensaje entero
 *     (HTTP 400, «Can't parse entities») si el texto trae un `*` o un `_`
 *     suelto. Un aviso de seguridad suele llevar dentro un fragmento de
 *     código o un nombre de variable, que es justo lo que lo dispara: el
 *     aviso se perdía en silencio y nadie se enteraba de nada. Ahora, si
 *     Telegram se queja del formato, se reintenta como texto plano.
 *
 *   - Las credenciales se leen en cada llamada, no al cargar el módulo. Si se
 *     leen al importar, quedan congeladas antes de que nadie haya podido
 *     configurarlas y no hay forma de comprobarlo en una prueba.
 */

import axios from 'axios';
import { z } from 'zod';
import 'dotenv/config';

const TIMEOUT_MS = 5000;

/** Credenciales, leídas en el momento de usarlas. */
function credenciales(): { token?: string; chatId?: string } {
    return {
        token: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_SECURITY_CHAT_ID,
    };
}

type Severidad = 'low' | 'medium' | 'high' | 'critical';

/** Prefijo por urgencia. Sin prefijo para lo que no lo necesita. */
const PREFIJOS: Partial<Record<Severidad, string>> = {
    critical: '🚨 *CRÍTICO* 🚨\n\n',
    high: '⚠️ *ALTA PRIORIDAD* ⚠️\n\n',
};

function respuesta(text: string, isError = false) {
    return { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) };
}

/**
 * ¿Telegram ha rechazado el mensaje por el formato y no por otra cosa?
 *
 * Solo en ese caso tiene sentido reintentar sin formato. Un 401 por token
 * inválido o un 403 por chat bloqueado no se arreglan quitando el Markdown, y
 * reintentarlos solo duplicaría la llamada.
 */
function esErrorDeFormato(error: any): boolean {
    if (error?.response?.status !== 400) return false;
    const descripcion = String(error?.response?.data?.description ?? '').toLowerCase();
    return descripcion.includes('parse') || descripcion.includes('entit');
}

/**
 * El token del bot va dentro de la URL, así que cualquier texto de error que
 * se devuelva al modelo tiene que pasar por aquí antes.
 */
function sinToken(texto: string, token?: string): string {
    if (!token) return texto;
    return texto.split(token).join('[token redactado]');
}

async function enviar(token: string, chatId: string, text: string, conFormato: boolean) {
    return axios.post(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
            chat_id: chatId,
            text,
            ...(conFormato ? { parse_mode: 'Markdown' } : {}),
            disable_web_page_preview: true,
        },
        { timeout: TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } },
    );
}

export async function sendTelegramMessage(args: { message?: string; severity?: Severidad }) {
    const { token, chatId } = credenciales();

    if (!token || !chatId) {
        return respuesta(
            'Error: faltan TELEGRAM_BOT_TOKEN o TELEGRAM_SECURITY_CHAT_ID en el entorno. ' +
                'Pide al administrador que los configure.',
            true,
        );
    }

    const { message, severity = 'medium' } = args ?? {};
    if (!message || !message.trim()) {
        return respuesta('Error: el mensaje está vacío, no hay nada que enviar.', true);
    }

    const finalMessage = (PREFIJOS[severity] ?? '') + message;

    try {
        let response;
        let formatoAplicado = true;

        try {
            response = await enviar(token, chatId, finalMessage, true);
        } catch (error: any) {
            if (!esErrorDeFormato(error)) throw error;

            // El texto lleva Markdown que Telegram no sabe leer. El contenido
            // importa más que el formato: se manda plano, sin los prefijos de
            // énfasis, que también son Markdown.
            const plano = (severity === 'critical' ? 'CRÍTICO\n\n' : severity === 'high' ? 'ALTA PRIORIDAD\n\n' : '') + message;
            response = await enviar(token, chatId, plano, false);
            formatoAplicado = false;
        }

        if (response.data?.ok) {
            const aviso = formatoAplicado
                ? ''
                : ' (enviado como texto plano: Telegram rechazó el formato Markdown del mensaje)';
            return respuesta(
                `Mensaje entregado al administrador por Telegram (Msg ID: ${response.data.result?.message_id})${aviso}.`,
            );
        }

        return respuesta(
            sinToken(`Telegram no aceptó el mensaje. Respuesta: ${JSON.stringify(response.data)}`, token),
            true,
        );
    } catch (error: any) {
        const status = error?.response?.status;
        const descripcion = error?.response?.data?.description;

        if (status === 401) {
            return respuesta('Telegram rechazó el token del bot (HTTP 401). TELEGRAM_BOT_TOKEN no es válido.', true);
        }
        if (status === 403) {
            return respuesta(
                'Telegram denegó el envío (HTTP 403). El bot no tiene permiso para escribir en ese chat: ' +
                    'el administrador debe iniciar la conversación con el bot o revisar TELEGRAM_SECURITY_CHAT_ID.',
                true,
            );
        }
        if (error?.code === 'ECONNABORTED') {
            return respuesta(`Telegram no respondió en ${TIMEOUT_MS} ms. El aviso NO se ha entregado.`, true);
        }

        return respuesta(
            sinToken(
                `Error enviando el mensaje a Telegram: ${descripcion || error?.message || 'desconocido'}. El aviso NO se ha entregado.`,
                token,
            ),
            true,
        );
    }
}

const DESCRIPCION =
    'Send a message proactively to the system Administrator via Telegram. Use this to report ' +
    'critical security alerts, summaries of platform status, or request human intervention. ' +
    'Do not overuse to avoid rate-limiting.';

export function registerTelegramMcp(server: any): void {
    server.tool(
        'send_telegram_message',
        DESCRIPCION,
        {
            message: z
                .string()
                .min(1)
                .describe(
                    'The main content of the message. Markdown formatting is supported; if Telegram ' +
                        'rejects it, the message is delivered as plain text instead.',
                ),
            severity: z
                .enum(['low', 'medium', 'high', 'critical'])
                .optional()
                .describe('The urgency of the message. High and critical will use more urgent emojis.'),
        },
        async (args: any) => sendTelegramMessage(args),
    );
}
