/**
 * BeZhas — Cliente de Telegram para el Messaging MCP
 * ─────────────────────────────────────────────────────────────────────────────
 * Envoltura mínima sobre la Bot API de Telegram, con historial de conversación
 * y el circuito de confirmación humana que usan los agentes.
 *
 * Se habla con la API por `fetch` en vez de usar `node-telegram-bot-api` a
 * propósito: esa librería quiere ser dueña del ciclo de vida (polling, webhook,
 * despacho de eventos) y aquí ya lo es index.js, que monta su propio servidor
 * HTTP y le pasa las actualizaciones a `processUpdate`. Meter las dos cosas
 * acaba en dos consumidores compitiendo por el mismo `offset` y mensajes que
 * se pierden. Además la versión disponible en el repositorio es la 1.1.0, de
 * hace años.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { randomBytes } from 'crypto';

const API_BASE = 'https://api.telegram.org';

/** Cuántos mensajes se guardan por chat. */
const HISTORY_MAX = parseInt(process.env.TELEGRAM_HISTORY_MAX || '200', 10);

/** Caducidad del historial en Redis. Un chat inactivo no ocupa para siempre. */
const HISTORY_TTL_S = parseInt(process.env.TELEGRAM_HISTORY_TTL_S || '604800', 10); // 7 días

/** Espera por defecto de una confirmación humana antes de darla por caducada. */
const CONFIRM_TIMEOUT_MS = parseInt(process.env.TELEGRAM_CONFIRM_TIMEOUT_MS || '300000', 10); // 5 min

/** Reintentos ante 429 y 5xx. */
const MAX_ATTEMPTS = parseInt(process.env.TELEGRAM_MAX_ATTEMPTS || '3', 10);

/**
 * Escapa los caracteres reservados de MarkdownV2.
 *
 * Hace falta para CUALQUIER valor interpolado en una plantilla: un guion o un
 * punto en el nombre de una empresa hace que Telegram rechace el mensaje entero
 * con «can't parse entities», y el agente se queda sin saber por qué su alerta
 * nunca llegó.
 */
export function escapeMarkdownV2(value) {
    return String(value ?? '').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class TelegramClient {
    constructor({ token, alertChatId, leadsChannelId, authorizedUsers } = {}) {
        if (!token) throw new Error('TelegramClient: falta el token del bot');

        this.token = token;
        this.alertChatId = alertChatId || null;
        this.leadsChannelId = leadsChannelId || alertChatId || null;

        // Lista blanca de quién puede aprobar. Se acepta tanto id numérico como
        // @usuario porque en un callback_query Telegram manda los dos.
        this.authorizedUsers = new Set(
            String(authorizedUsers || '')
                .split(',')
                .map((u) => u.trim().replace(/^@/, '').toLowerCase())
                .filter(Boolean)
        );

        this.redis = null;
        this.botInfo = null;
        this.startedAt = Date.now();
        this.polling = false;
        this._pollOffset = 0;
        this._stopped = false;

        /**
         * Confirmaciones a la espera de respuesta: id → { resolve, timer, ... }.
         *
         * En memoria a propósito, igual que api/services/hitlQueue.js. Una
         * promesa no sobrevive a un reinicio ni cruza procesos, así que
         * fingir persistencia aquí sería mentir: si el servidor cae con una
         * confirmación abierta, el agente recibe el tiempo de espera agotado,
         * que es exactamente lo que ha pasado.
         */
        this.pendingConfirmations = new Map();

        /** Historial en memoria cuando no hay Redis. chatId → array. */
        this._memoryHistory = new Map();

        this.stats = { sent: 0, received: 0, failed: 0, confirmations: 0 };
    }

    // ── Ciclo de vida ────────────────────────────────────────────────────────

    async initialize(redis) {
        this.redis = redis || null;

        // getMe valida el token antes de que nadie intente enviar nada: mejor
        // fallar aquí que en la primera alerta crítica.
        this.botInfo = await this.call('getMe');
        console.log(`[Telegram] Bot conectado: @${this.botInfo.username} (id ${this.botInfo.id})`);

        if (this.authorizedUsers.size === 0) {
            console.warn(
                '[Telegram] TELEGRAM_AUTHORIZED_USERS está vacío: request_human_confirmation ' +
                'rechazará todas las respuestas. Es intencionado — una puerta de aprobación ' +
                'sin lista blanca la abre cualquiera que esté en el chat.'
            );
        }

        // En desarrollo no hay URL pública a la que Telegram pueda llamar, así
        // que se tira de polling. En producción manda el webhook que monta
        // index.js y arrancar polling aquí duplicaría las actualizaciones.
        if (process.env.NODE_ENV !== 'production') {
            await this.deleteWebhook().catch(() => { /* puede no haber ninguno */ });
            this._startPolling();
        }

        return this;
    }

    stop() {
        this._stopped = true;
        this.polling = false;
        for (const [id, pend] of this.pendingConfirmations) {
            clearTimeout(pend.timer);
            pend.resolve({ status: 'CANCELLED', reason: 'servidor detenido', id });
        }
        this.pendingConfirmations.clear();
    }

    // ── Transporte ───────────────────────────────────────────────────────────

    /**
     * Llama a un método de la Bot API. Devuelve `result` o lanza.
     *
     * Reintenta ante 429 respetando el `retry_after` que manda Telegram, y ante
     * 5xx con espera creciente. Importa más de lo normal aquí: quien llama es
     * un agente que puede reintentar en bucle, y un 429 mal gestionado se
     * convierte en un bloqueo del bot para toda la plataforma.
     */
    async call(method, payload = {}, { attempts = MAX_ATTEMPTS } = {}) {
        let ultimoError;

        for (let intento = 1; intento <= attempts; intento++) {
            let res;
            try {
                res = await fetch(`${API_BASE}/bot${this.token}/${method}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(30_000),
                });
            } catch (err) {
                // Fallo de red: reintentable.
                ultimoError = err;
                if (intento < attempts) { await sleep(500 * intento); continue; }
                break;
            }

            const cuerpo = await res.json().catch(() => ({}));

            if (res.ok && cuerpo.ok) return cuerpo.result;

            const descripcion = cuerpo.description || `HTTP ${res.status}`;

            if (res.status === 429) {
                const espera = (cuerpo.parameters?.retry_after ?? 1) * 1000;
                ultimoError = new Error(`Telegram limita la tasa: espera ${espera / 1000}s`);
                if (intento < attempts) { await sleep(espera); continue; }
                break;
            }

            if (res.status >= 500) {
                ultimoError = new Error(`Telegram ${res.status}: ${descripcion}`);
                if (intento < attempts) { await sleep(500 * intento); continue; }
                break;
            }

            // 4xx que no es 429: token inválido, chat inexistente, markdown mal
            // formado... Reintentar no arregla ninguno de esos.
            this.stats.failed++;
            throw new Error(`Telegram ${method} falló: ${descripcion}`);
        }

        this.stats.failed++;
        throw new Error(`Telegram ${method} falló tras ${attempts} intentos: ${ultimoError?.message}`);
    }

    // ── Envío ────────────────────────────────────────────────────────────────

    async sendMessage(chatId, text, options = {}) {
        const destino = chatId || this.alertChatId;
        if (!destino) throw new Error('No hay chat de destino: pasa chat_id o configura TELEGRAM_ALERT_CHAT_ID');
        if (!text || !String(text).trim()) throw new Error('El texto del mensaje está vacío');

        const resultado = await this.call('sendMessage', {
            chat_id: destino,
            text: String(text).slice(0, 4096), // límite duro de Telegram
            ...options,
        });

        this.stats.sent++;
        await this._recordHistory(destino, {
            direction: 'out',
            message_id: resultado.message_id,
            text: String(text),
            at: new Date().toISOString(),
        });

        return resultado;
    }

    /**
     * Envía un documento. Acepta una URL pública o contenido en texto plano,
     * que se sube como fichero adjunto.
     */
    async sendDocument(chatId, { url, content, filename, caption, parse_mode } = {}) {
        const destino = chatId || this.alertChatId;
        if (!destino) throw new Error('No hay chat de destino: pasa chat_id o configura TELEGRAM_ALERT_CHAT_ID');
        if (!url && !content) throw new Error('Indica `url` o `content` para el documento');

        let resultado;

        if (url) {
            resultado = await this.call('sendDocument', {
                chat_id: destino, document: url, caption, parse_mode,
            });
        } else {
            // multipart: la Bot API no acepta el contenido de un fichero en JSON.
            const form = new FormData();
            form.append('chat_id', String(destino));
            form.append('document', new Blob([content]), filename || 'bezhas.txt');
            if (caption) form.append('caption', caption);
            if (parse_mode) form.append('parse_mode', parse_mode);

            const res = await fetch(`${API_BASE}/bot${this.token}/sendDocument`, {
                method: 'POST', body: form, signal: AbortSignal.timeout(60_000),
            });
            const cuerpo = await res.json().catch(() => ({}));
            if (!res.ok || !cuerpo.ok) {
                this.stats.failed++;
                throw new Error(`Telegram sendDocument falló: ${cuerpo.description || res.status}`);
            }
            resultado = cuerpo.result;
        }

        this.stats.sent++;
        await this._recordHistory(destino, {
            direction: 'out',
            message_id: resultado.message_id,
            text: `[documento] ${filename || url}${caption ? ` — ${caption}` : ''}`,
            at: new Date().toISOString(),
        });

        return resultado;
    }

    // ── Confirmación humana ──────────────────────────────────────────────────

    /**
     * Publica una pregunta con botones y espera la respuesta de un humano
     * autorizado. Resuelve —nunca rechaza— con el desenlace, para que el agente
     * pueda distinguir «me han dicho que no» de «nadie contestó».
     *
     * Estados: APPROVED | REJECTED | CHOSEN | TIMEOUT | CANCELLED
     */
    async requestConfirmation({ question, details, options, timeoutMs = CONFIRM_TIMEOUT_MS, chatId, requestedBy } = {}) {
        if (!question || !String(question).trim()) throw new Error('La pregunta no puede estar vacía');

        const destino = chatId || this.alertChatId;
        if (!destino) throw new Error('No hay chat de destino para la confirmación');

        // 8 hex = 4 bytes. callback_data está limitado a 64 bytes y el prefijo
        // más la etiqueta de la opción ya consumen parte.
        const id = randomBytes(4).toString('hex');
        const opciones = (options && options.length)
            ? options.map((o, i) => ({ label: String(o), value: String(o), key: String(i) }))
            : [
                { label: '✅ Aprobar', value: 'APPROVED', key: 'a' },
                { label: '❌ Rechazar', value: 'REJECTED', key: 'r' },
            ];

        const lineas = [
            '🤔 *Confirmación requerida*',
            '',
            escapeMarkdownV2(question),
        ];
        if (details) lineas.push('', `_${escapeMarkdownV2(details)}_`);
        if (requestedBy) lineas.push('', `Solicitado por: \`${escapeMarkdownV2(requestedBy)}\``);
        lineas.push('', `Caduca en ${Math.round(timeoutMs / 1000)}s \\· ref \`${id}\``);

        const mensaje = await this.sendMessage(destino, lineas.join('\n'), {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [opciones.map((o) => ({
                    text: o.label,
                    callback_data: `cfm:${id}:${o.key}`,
                }))],
            },
        });

        this.stats.confirmations++;

        return new Promise((resolve) => {
            const timer = setTimeout(async () => {
                this.pendingConfirmations.delete(id);
                // Se quitan los botones: dejarlos activos invita a pulsar una
                // aprobación que ya no vale para nada.
                await this.call('editMessageReplyMarkup', {
                    chat_id: destino, message_id: mensaje.message_id, reply_markup: { inline_keyboard: [] },
                }).catch(() => {});
                await this.sendMessage(destino, `⏱️ Confirmación \`${id}\` caducada sin respuesta\\.`, {
                    parse_mode: 'MarkdownV2',
                }).catch(() => {});
                resolve({ status: 'TIMEOUT', id, question, waitedMs: timeoutMs });
            }, timeoutMs);

            // El temporizador NO se hace unref a propósito. Con unref, si nada
            // más mantiene vivo el bucle de eventos, Node sale sin dispararlo y
            // la promesa se queda sin resolver: el agente que está esperando la
            // confirmación se cuelga indefinidamente. Una confirmación
            // pendiente es una petición viva y debe sostener el proceso hasta
            // que se responda o caduque — como mucho una hora, que es el tope
            // que impone el esquema de la tool.
            this.pendingConfirmations.set(id, {
                id, question, chatId: destino, messageId: mensaje.message_id,
                options: opciones, createdAt: Date.now(), resolve, timer,
            });
        });
    }

    // ── Entrada ──────────────────────────────────────────────────────────────

    /**
     * Punto de entrada de las actualizaciones, venga de webhook o de polling.
     *
     * Es síncrona a propósito: index.js la llama desde el manejador HTTP y le
     * responde 200 a Telegram de inmediato. Si tardásemos, Telegram reintenta
     * la misma actualización y se duplica todo.
     */
    processUpdate(update) {
        this._handleUpdate(update).catch((err) => {
            console.error('[Telegram] Error procesando actualización:', err.message);
        });
    }

    async _handleUpdate(update) {
        if (!update || typeof update !== 'object') return;

        if (update.callback_query) return this._handleCallback(update.callback_query);

        const msg = update.message || update.edited_message || update.channel_post;
        if (!msg) return;

        this.stats.received++;
        await this._recordHistory(msg.chat?.id, {
            direction: 'in',
            message_id: msg.message_id,
            from: msg.from?.username || msg.from?.id || 'desconocido',
            text: msg.text || msg.caption || '[sin texto]',
            at: new Date((msg.date || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        });
    }

    async _handleCallback(cb) {
        const [prefijo, id, key] = String(cb.data || '').split(':');
        if (prefijo !== 'cfm' || !id) return;

        const pendiente = this.pendingConfirmations.get(id);

        // Responder SIEMPRE al callback: si no, el cliente de Telegram deja el
        // botón girando indefinidamente y el humano no sabe si se registró.
        const responder = (texto, alerta = false) =>
            this.call('answerCallbackQuery', {
                callback_query_id: cb.id, text: texto, show_alert: alerta,
            }).catch(() => {});

        if (!pendiente) {
            await responder('Esa confirmación ya no está activa (caducada o respondida).', true);
            return;
        }

        if (!this._isAuthorized(cb.from)) {
            await responder('No estás autorizado para responder a esta confirmación.', true);
            console.warn(
                `[Telegram] Respuesta rechazada de @${cb.from?.username || cb.from?.id}: ` +
                'no está en TELEGRAM_AUTHORIZED_USERS'
            );
            return;
        }

        clearTimeout(pendiente.timer);
        this.pendingConfirmations.delete(id);

        const elegida = pendiente.options.find((o) => o.key === key) || pendiente.options[0];
        const quien = cb.from?.username ? `@${cb.from.username}` : String(cb.from?.id ?? 'desconocido');

        await responder(`Registrado: ${elegida.label}`);
        await this.call('editMessageReplyMarkup', {
            chat_id: pendiente.chatId, message_id: pendiente.messageId, reply_markup: { inline_keyboard: [] },
        }).catch(() => {});
        await this.sendMessage(
            pendiente.chatId,
            `${elegida.label} por ${escapeMarkdownV2(quien)} \\· ref \`${id}\``,
            { parse_mode: 'MarkdownV2' }
        ).catch(() => {});

        // Con opciones a medida el valor es la etiqueta; con las de por defecto,
        // APPROVED/REJECTED, que es lo que el agente sabe interpretar.
        const status = ['APPROVED', 'REJECTED'].includes(elegida.value) ? elegida.value : 'CHOSEN';

        pendiente.resolve({
            status,
            id,
            question: pendiente.question,
            choice: elegida.value,
            label: elegida.label,
            answeredBy: quien,
            waitedMs: Date.now() - pendiente.createdAt,
        });
    }

    _isAuthorized(from) {
        // Sin lista blanca no se aprueba nada. Fallar abierto aquí convertiría
        // cualquier miembro del grupo en aprobador de operaciones críticas.
        if (this.authorizedUsers.size === 0) return false;
        const id = String(from?.id ?? '').toLowerCase();
        const usuario = String(from?.username ?? '').toLowerCase();
        return this.authorizedUsers.has(id) || (usuario && this.authorizedUsers.has(usuario));
    }

    // ── Polling (solo desarrollo) ────────────────────────────────────────────

    _startPolling() {
        if (this.polling) return;
        this.polling = true;
        console.log('[Telegram] Polling activo (getUpdates)');

        const bucle = async () => {
            while (this.polling && !this._stopped) {
                try {
                    const updates = await this.call('getUpdates', {
                        offset: this._pollOffset,
                        timeout: 25,          // long-poll: una petición cada 25s, no un bucle ocupado
                        allowed_updates: ['message', 'edited_message', 'channel_post', 'callback_query'],
                    }, { attempts: 1 });      // sin reintentos: el propio bucle ya reintenta

                    for (const u of updates) {
                        this._pollOffset = u.update_id + 1;
                        this.processUpdate(u);
                    }
                } catch (err) {
                    if (this.polling) {
                        console.warn('[Telegram] Fallo en getUpdates, reintentando en 5s:', err.message);
                        await sleep(5000);
                    }
                }
            }
        };

        bucle();
    }

    // ── Webhook ──────────────────────────────────────────────────────────────

    async setWebhook(baseUrl) {
        const url = `${String(baseUrl).replace(/\/+$/, '')}/telegram/webhook`;
        return this.call('setWebhook', {
            url,
            secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined,
            allowed_updates: ['message', 'edited_message', 'channel_post', 'callback_query'],
            drop_pending_updates: false,
        });
    }

    async deleteWebhook() {
        return this.call('deleteWebhook', { drop_pending_updates: false }, { attempts: 1 });
    }

    // ── Historial ────────────────────────────────────────────────────────────

    async _recordHistory(chatId, entry) {
        if (!chatId) return;
        const clave = `bezhas:mcp:tg:history:${chatId}`;

        if (this.redis) {
            try {
                await this.redis.lpush(clave, JSON.stringify(entry));
                await this.redis.ltrim(clave, 0, HISTORY_MAX - 1);
                await this.redis.expire(clave, HISTORY_TTL_S);
                return;
            } catch (err) {
                // El historial es una comodidad, no la operación. Que Redis
                // falle no puede tumbar el envío de una alerta crítica.
                console.warn('[Telegram] No se pudo guardar en Redis:', err.message);
            }
        }

        const lista = this._memoryHistory.get(String(chatId)) || [];
        lista.unshift(entry);
        this._memoryHistory.set(String(chatId), lista.slice(0, HISTORY_MAX));
    }

    async getChatHistory(chatId, limit = 20) {
        const destino = chatId || this.alertChatId;
        if (!destino) throw new Error('No hay chat del que leer historial');

        const n = Math.min(Math.max(parseInt(limit, 10) || 20, 1), HISTORY_MAX);

        if (this.redis) {
            try {
                const filas = await this.redis.lrange(`bezhas:mcp:tg:history:${destino}`, 0, n - 1);
                return {
                    chat_id: String(destino), source: 'redis', count: filas.length,
                    messages: filas.map((f) => { try { return JSON.parse(f); } catch { return null; } }).filter(Boolean),
                };
            } catch (err) {
                console.warn('[Telegram] Historial de Redis no disponible:', err.message);
            }
        }

        const lista = (this._memoryHistory.get(String(destino)) || []).slice(0, n);
        return { chat_id: String(destino), source: 'memoria', count: lista.length, messages: lista };
    }

    // ── Estado ───────────────────────────────────────────────────────────────

    async getStatus() {
        let webhook = null;
        try {
            const info = await this.call('getWebhookInfo', {}, { attempts: 1 });
            webhook = {
                url: info.url || null,
                pending_update_count: info.pending_update_count,
                last_error_message: info.last_error_message || null,
                last_error_date: info.last_error_date
                    ? new Date(info.last_error_date * 1000).toISOString()
                    : null,
            };
        } catch (err) {
            webhook = { error: err.message };
        }

        return {
            bot: this.botInfo
                ? { id: this.botInfo.id, username: this.botInfo.username, name: this.botInfo.first_name }
                : null,
            mode: process.env.NODE_ENV === 'production' ? 'webhook' : 'polling',
            polling: this.polling,
            webhook,
            redis: this.redis ? 'conectado' : 'no disponible (historial en memoria)',
            alert_chat_id: this.alertChatId,
            leads_channel_id: this.leadsChannelId,
            // Solo el recuento: los identificadores de quién puede aprobar no
            // tienen por qué viajar en la respuesta de una tool.
            authorized_users: this.authorizedUsers.size,
            pending_confirmations: this.pendingConfirmations.size,
            uptime_s: Math.floor((Date.now() - this.startedAt) / 1000),
            stats: { ...this.stats },
        };
    }
}

export default TelegramClient;
