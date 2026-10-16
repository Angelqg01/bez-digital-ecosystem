'use strict';

/**
 * Pasarela de modelos del chat. El control (RAG, ACL, sesión, saneado) es de
 * BeZhas; el proveedor solo infiere. Llamadas REST directas (sin SDK, sin
 * dependencias nuevas).
 *
 * Orden: AI_PROVIDER explícito > Anthropic (ANTHROPIC_API_KEY) > Gemini
 * (GEMINI_API_KEY) > extractivo local (devuelve los fragmentos recuperados).
 * Si el proveedor falla antes de empezar, se degrada al modo extractivo.
 *
 * `ollama` (modelo local) SOLO se usa si AI_PROVIDER=ollama: nunca se elige solo. Va a una URL privada (loopback, red
 * privada o nombre interno) y, si falla, se degrada al modo extractivo: jamás a un proveedor en la nube, porque eso
 * sacaría los datos del cliente del servidor sin que nadie lo haya decidido.
 */
const logger = require('../../utils/logger');
const { checkRateLimit } = require('../../cache/redis');
const telemetria = require('./telemetry');

const MODELO_ANTHROPIC = () => process.env.AI_MODEL_ANTHROPIC || 'claude-sonnet-5-5';
const MODELO_GEMINI = () => process.env.AI_MODEL_GEMINI || 'gemini-2.0-flash';
const TIMEOUT_MS = () => Number(process.env.AI_TIMEOUT_MS || 60_000);

// ── Modelo local (Ollama) ────────────────────────────────────────────────────
const OLLAMA_URL = () => (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const MODELO_OLLAMA = () => process.env.AI_MODEL_OLLAMA || 'qwen3.5:4b';
const OLLAMA_NUM_CTX = () => Number(process.env.OLLAMA_NUM_CTX || 4096);
const OLLAMA_KEEP_ALIVE = () => process.env.OLLAMA_KEEP_ALIVE || '5m';
const OLLAMA_TEMPERATURE = () => Number(process.env.OLLAMA_TEMPERATURE ?? 0.2);

/** Loopback, redes privadas (RFC 1918), `.internal`/`.local` o un nombre sin puntos (servicio de Docker). Nada público. */
function esHostPrivado(host) {
    const h = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (!h) return false;
    if (h === 'localhost' || h === '::1' || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
    if (/\.(internal|local|localhost)$/.test(h)) return true;
    return !h.includes('.') && !h.includes(':'); // `ollama`, `bqte-ollama`…
}

function urlOllama() {
    let u;
    try { u = new URL(OLLAMA_URL()); } catch (_) { throw new Error('ollama: OLLAMA_URL no es una URL válida'); }
    if (!/^https?:$/.test(u.protocol) || !esHostPrivado(u.hostname)) throw new Error('ollama: OLLAMA_URL debe apuntar a una dirección privada (nunca a Internet)');
    return u.origin;
}

const aprox = (t) => Math.ceil(String(t || '').length / 3); // estimación conservadora de tokens

/**
 * Cabe en el contexto: si no, Ollama recorta por el principio SIN avisar y se perdería el system prompt. Se descartan los
 * turnos más antiguos del historial; si ni así cabe, se falla (y se degrada al modo extractivo).
 */
function ajustarContexto({ system, messages, maxTokens }) {
    const presupuesto = OLLAMA_NUM_CTX() - maxTokens - 64;
    const coste = (ms) => aprox(system) + ms.reduce((n, m) => n + aprox(m.content) + 4, 0);
    const msgs = [...messages];
    while (msgs.length > 1 && coste(msgs) > presupuesto) msgs.shift();
    if (coste(msgs) > presupuesto) throw new Error('ollama: el mensaje y el contexto no caben en la ventana del modelo local');
    return msgs;
}

/**
 * Qwen3 (sin «.5») razona por defecto y las versiones de Ollama anteriores a la que entiende `think:false` lo ignoran:
 * el usuario veía el razonamiento en inglés («Okay, let's see. The user is…») y la respuesta se cortaba sin llegar a ella.
 * El interruptor propio de Qwen3 es `/no_think` al final del último mensaje del usuario, y funciona en cualquier versión.
 */
const esQwen3 = (modelo) => /^qwen3(:|$)/i.test(String(modelo || ''));
function sinRazonamiento(msgs, modelo) {
    if (!esQwen3(modelo)) return msgs;
    const i = msgs.map((m) => m.role).lastIndexOf('user');
    if (i < 0) return msgs;
    return msgs.map((m, j) => (j === i && !/\/no_think\s*$/.test(m.content) ? { ...m, content: `${m.content} /no_think` } : m));
}

function ollamaBody(args, stream) {
    return JSON.stringify({
        model: MODELO_OLLAMA(),
        stream,
        think: false, // los modelos con razonamiento (qwen3.x) no deben gastar el presupuesto de salida pensando
        keep_alive: OLLAMA_KEEP_ALIVE(),
        messages: [{ role: 'system', content: args.system }, ...sinRazonamiento(ajustarContexto(args), MODELO_OLLAMA())],
        options: { num_ctx: OLLAMA_NUM_CTX(), num_predict: args.maxTokens, temperature: OLLAMA_TEMPERATURE() },
    });
}

/** Recorre un cuerpo NDJSON (una línea JSON por evento). */
async function* eventosNDJSON(body) {
    const decoder = new TextDecoder();
    let buf = '';
    for await (const trozo of body) {
        buf += decoder.decode(trozo, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) !== -1) {
            const linea = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!linea) continue;
            try { yield JSON.parse(linea); } catch (_) { /* línea no JSON: se ignora */ }
        }
    }
    if (buf.trim()) { try { yield JSON.parse(buf.trim()); } catch (_) { /* resto no JSON */ } }
}

function extractiveText({ contextText }) {
    if (!contextText) {
        return 'No encuentro información sobre eso en la documentación a la que tienes acceso. ¿Puedes darme más detalles?';
    }
    const body = contextText
        .split(/<untrusted_document[^>]*>/).slice(1)
        .map((p, i) => `**[${i + 1}]** ${p.replace(/<\/untrusted_document>/, '').trim()}`)
        .join('\n\n');
    // Coincidencia débil: se dice, en vez de presentar como respuesta algo que sólo comparte una palabra con la pregunta.
    const relevancia = Number((contextText.match(/<untrusted_document[^>]*relevance="([0-9.]+)"/) || [])[1]);
    const intro = Number.isFinite(relevancia) && relevancia < 0.5
        ? 'No estoy seguro de que esto responda a tu pregunta; es lo más cercano que he encontrado en la documentación:'
        : 'Esto es lo que encontré en la documentación:';
    return `${intro}\n\n${body}\n\n_(Modo sin proveedor de IA configurado.)_`;
}

/** Une la señal del cliente con un tiempo máximo. */
function senal(signal) {
    const t = AbortSignal.timeout(TIMEOUT_MS());
    return signal ? AbortSignal.any([signal, t]) : t;
}

/** Recorre un cuerpo SSE y entrega cada `data:` ya parseado. */
async function* eventosSSE(body) {
    const decoder = new TextDecoder();
    let buf = '';
    for await (const trozo of body) {
        buf += decoder.decode(trozo, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) !== -1) {
            const bloque = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const data = bloque.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
            if (!data || data === '[DONE]') continue;
            try { yield JSON.parse(data); } catch (_) { /* fragmento no JSON: se ignora */ }
        }
    }
}

async function fallo(res, quien) {
    const texto = await res.text().catch(() => '');
    return new Error(`${quien} ${res.status}: ${texto.slice(0, 200)}`);
}

const geminiBody = ({ system, messages, maxTokens }) => JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: maxTokens },
});

const providers = {
    async anthropic({ system, messages, maxTokens, signal }) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: MODELO_ANTHROPIC(), max_tokens: maxTokens, system, messages }),
            signal: senal(signal),
        });
        if (!res.ok) throw await fallo(res, 'anthropic');
        const json = await res.json();
        return {
            text: (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'),
            usage: { model: json.model || MODELO_ANTHROPIC(), inputTokens: json.usage?.input_tokens || 0, outputTokens: json.usage?.output_tokens || 0 },
        };
    },
    async gemini(args) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO_GEMINI()}:generateContent`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
            body: geminiBody(args),
            signal: senal(args.signal),
        });
        if (!res.ok) throw await fallo(res, 'gemini');
        const json = await res.json();
        return {
            text: (json.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join(''),
            usage: { model: MODELO_GEMINI(), inputTokens: json.usageMetadata?.promptTokenCount || 0, outputTokens: json.usageMetadata?.candidatesTokenCount || 0 },
        };
    },
    async ollama(args) {
        const res = await fetch(`${urlOllama()}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: ollamaBody(args, false), signal: senal(args.signal) });
        if (!res.ok) throw await fallo(res, 'ollama');
        const json = await res.json();
        return {
            text: json.message?.content || '',
            usage: { model: `local:${MODELO_OLLAMA()}`, inputTokens: json.prompt_eval_count || 0, outputTokens: json.eval_count || 0 },
        };
    },
    async extractive(args) { return { text: extractiveText(args), usage: { model: 'extractive', inputTokens: 0, outputTokens: 0 } }; },
};

const streamers = {
    async *anthropic({ system, messages, maxTokens, signal }) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: MODELO_ANTHROPIC(), max_tokens: maxTokens, system, messages, stream: true }),
            signal: senal(signal),
        });
        if (!res.ok) throw await fallo(res, 'anthropic');
        const usage = { model: MODELO_ANTHROPIC(), inputTokens: 0, outputTokens: 0 };
        for await (const ev of eventosSSE(res.body)) {
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') yield ev.delta.text;
            else if (ev.type === 'message_start') {
                usage.model = ev.message?.model || usage.model;
                usage.inputTokens = ev.message?.usage?.input_tokens || 0;
                usage.outputTokens = ev.message?.usage?.output_tokens || 0;
            } else if (ev.type === 'message_delta' && ev.usage) usage.outputTokens = ev.usage.output_tokens ?? usage.outputTokens;
            else if (ev.type === 'error') throw new Error(`anthropic: ${ev.error?.message || 'error'}`);
        }
        yield { usage };
    },
    async *gemini(args) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO_GEMINI()}:streamGenerateContent?alt=sse`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
            body: geminiBody(args),
            signal: senal(args.signal),
        });
        if (!res.ok) throw await fallo(res, 'gemini');
        const usage = { model: MODELO_GEMINI(), inputTokens: 0, outputTokens: 0 };
        for await (const ev of eventosSSE(res.body)) {
            const texto = (ev.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
            if (texto) yield texto;
            if (ev.usageMetadata) {
                usage.inputTokens = ev.usageMetadata.promptTokenCount || usage.inputTokens;
                usage.outputTokens = ev.usageMetadata.candidatesTokenCount || usage.outputTokens;
            }
        }
        yield { usage };
    },
    async *ollama(args) {
        const res = await fetch(`${urlOllama()}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: ollamaBody(args, true), signal: senal(args.signal) });
        if (!res.ok) throw await fallo(res, 'ollama');
        const usage = { model: `local:${MODELO_OLLAMA()}`, inputTokens: 0, outputTokens: 0 };
        for await (const ev of eventosNDJSON(res.body)) {
            if (ev.error) throw new Error(`ollama: ${String(ev.error).slice(0, 200)}`);
            const texto = ev.message?.content || '';
            if (texto) yield texto;
            if (ev.done) { usage.inputTokens = ev.prompt_eval_count || 0; usage.outputTokens = ev.eval_count || 0; }
        }
        yield { usage };
    },
    async *extractive(args) {
        for (const pieza of extractiveText(args).match(/\S+\s*/g) || []) {
            if (args.signal?.aborted) return;
            yield pieza;
            if (args.paceMs) await new Promise((r) => setTimeout(r, args.paceMs));
        }
    },
};

// Techo global de llamadas de pago al modelo por día UTC (AI_GLOBAL_DAILY_CALLS, 0 = sin techo). Pasado el techo el
// chat sigue funcionando en modo extractivo (coste 0), así que ningún volumen de cuentas puede disparar el gasto.
const presupuesto = { dia: '', n: 0 };
const TECHO_DIARIO = () => Number(process.env.AI_GLOBAL_DAILY_CALLS ?? 20000);
function hayPresupuesto() {
    const techo = TECHO_DIARIO();
    if (!techo) return true;
    const dia = new Date().toISOString().slice(0, 10);
    if (presupuesto.dia !== dia) { presupuesto.dia = dia; presupuesto.n = 0; }
    return presupuesto.n < techo;
}

/**
 * Techo diario COMPARTIDO entre instancias (Redis, un contador por día UTC). El contador en memoria de pickProvider sigue
 * como red de seguridad por instancia. Si Redis no está o no responde se deja pasar y manda el local. Devuelve false si el
 * techo global ya se alcanzó.
 */
async function techoCompartidoLibre(check = checkRateLimit) {
    const techo = TECHO_DIARIO();
    if (!techo) return true;
    try {
        const r = await check(`ai:daily:${new Date().toISOString().slice(0, 10)}`, techo, 90_000);
        return r.degraded ? true : r.allowed;
    } catch (_) { return true; }
}

function pickProvider(forzado) {
    const forced = forzado || process.env.AI_PROVIDER;
    const elegido = forced && providers[forced] ? forced
        : process.env.ANTHROPIC_API_KEY ? 'anthropic'
        : process.env.GEMINI_API_KEY ? 'gemini'
        : 'extractive';
    if (elegido === 'extractive' || elegido === 'ollama') return elegido; // el modelo local no cuesta: no cuenta para el techo
    if (!hayPresupuesto()) {
        logger.warn({ techo: TECHO_DIARIO() }, 'techo diario global de IA alcanzado; modo extractivo');
        return 'extractive';
    }
    presupuesto.n += 1;
    return elegido;
}
// Cuántas veces el proveedor de pago falló y se sirvió el modo extractivo: sin esto la degradación pasa inadvertida.
const degradaciones = { total: 0, ultimoError: null };
function registrarDegradacion(provider, err) {
    degradaciones.total += 1;
    degradaciones.ultimoError = String(err.message || err).slice(0, 200);
    telemetria.degradacion(provider);
    logger.warn({ provider, error: degradaciones.ultimoError, degradaciones: degradaciones.total }, 'degradación del chat a modo extractivo');
}
function _reiniciarPresupuesto() { presupuesto.dia = ''; presupuesto.n = 0; }

async function complete(args) {
    let name = pickProvider(args.provider);
    if (name !== 'extractive' && !(await techoCompartidoLibre())) { logger.warn('techo diario global (compartido) de IA alcanzado; modo extractivo'); name = 'extractive'; }
    try {
        const r = await providers[name](args);
        return { provider: name, text: r.text, usage: r.usage };
    } catch (err) {
        registrarDegradacion(name, err);
        const r = await providers.extractive(args);
        return { provider: 'extractive', text: r.text, usage: r.usage };
    }
}

/**
 * Respuesta en streaming: { type: 'start', provider }, { type: 'delta', text }*,
 * { type: 'usage', provider, model, inputTokens, outputTokens }, { type: 'done' }.
 * Si el proveedor falla antes del primer trozo, se degrada al modo extractivo; si falla a mitad,
 * termina con { type: 'error' } (no se mezclan respuestas de dos proveedores).
 */
async function* stream(args) {
    let name = pickProvider(args.provider);
    if (name !== 'extractive' && !(await techoCompartidoLibre())) { logger.warn('techo diario global (compartido) de IA alcanzado; modo extractivo'); name = 'extractive'; }
    let started = false;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            yield { type: 'start', provider: name };
            let usage = { model: name === 'extractive' ? 'extractive' : null, inputTokens: 0, outputTokens: 0 };
            for await (const chunk of streamers[name](args)) {
                if (typeof chunk === 'object') { usage = chunk.usage; continue; }
                started = true;
                yield { type: 'delta', text: chunk };
            }
            // Tokens reales de la respuesta: es lo que se cobra al plan del cliente.
            yield { type: 'usage', provider: name, ...usage };
            yield { type: 'done' };
            return;
        } catch (err) {
            if (args.signal?.aborted) { yield { type: 'done', aborted: true }; return; }
            if (started || name === 'extractive') {
                yield { type: 'error', message: 'El proveedor de IA falló durante la respuesta.' };
                return;
            }
            registrarDegradacion(name, err);
            name = 'extractive';
        }
    }
}

/** Modelo que usa un proveedor (para estimar el coste si una respuesta se cortó). */
function modeloDe(provider) {
    if (provider === 'anthropic') return MODELO_ANTHROPIC();
    if (provider === 'gemini') return MODELO_GEMINI();
    if (provider === 'ollama') return `local:${MODELO_OLLAMA()}`;
    return 'extractive';
}

module.exports = { esQwen3, sinRazonamiento, esHostPrivado, eventosNDJSON, ajustarContexto, techoCompartidoLibre, degradaciones, _reiniciarPresupuesto, complete, stream, pickProvider, modeloDe, extractiveText, eventosSSE };
