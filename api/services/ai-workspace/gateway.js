'use strict';

/**
 * Pasarela de modelos del chat. El control (RAG, ACL, sesión, saneado) es de
 * BeZhas; el proveedor solo infiere. Llamadas REST directas (sin SDK, sin
 * dependencias nuevas).
 *
 * Orden: AI_PROVIDER explícito > Anthropic (ANTHROPIC_API_KEY) > Gemini
 * (GEMINI_API_KEY) > extractivo local (devuelve los fragmentos recuperados).
 * Si el proveedor falla antes de empezar, se degrada al modo extractivo.
 */
const logger = require('../../utils/logger');

const MODELO_ANTHROPIC = () => process.env.AI_MODEL_ANTHROPIC || 'claude-sonnet-5';
const MODELO_GEMINI = () => process.env.AI_MODEL_GEMINI || 'gemini-2.0-flash';
const TIMEOUT_MS = () => Number(process.env.AI_TIMEOUT_MS || 60_000);

function extractiveText({ contextText }) {
    if (!contextText) {
        return 'No encuentro información sobre eso en la documentación a la que tienes acceso. ¿Puedes darme más detalles?';
    }
    const body = contextText
        .split(/<untrusted_document[^>]*>/).slice(1)
        .map((p, i) => `**[${i + 1}]** ${p.replace(/<\/untrusted_document>/, '').trim()}`)
        .join('\n\n');
    return `Esto es lo que encontré en la documentación:\n\n${body}\n\n_(Modo sin proveedor de IA configurado.)_`;
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
    async *extractive(args) {
        for (const pieza of extractiveText(args).match(/\S+\s*/g) || []) {
            if (args.signal?.aborted) return;
            yield pieza;
            if (args.paceMs) await new Promise((r) => setTimeout(r, args.paceMs));
        }
    },
};

function pickProvider(forzado) {
    const forced = forzado || process.env.AI_PROVIDER;
    if (forced && providers[forced]) return forced;
    if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
    if (process.env.GEMINI_API_KEY) return 'gemini';
    return 'extractive';
}

async function complete(args) {
    const name = pickProvider(args.provider);
    try {
        const r = await providers[name](args);
        return { provider: name, text: r.text, usage: r.usage };
    } catch (err) {
        logger.warn({ provider: name, error: err.message }, 'proveedor de IA falló; modo extractivo');
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
            logger.warn({ provider: name, error: err.message }, 'proveedor de IA falló; modo extractivo');
            name = 'extractive';
        }
    }
}

/** Modelo que usa un proveedor (para estimar el coste si una respuesta se cortó). */
function modeloDe(provider) {
    if (provider === 'anthropic') return MODELO_ANTHROPIC();
    if (provider === 'gemini') return MODELO_GEMINI();
    return 'extractive';
}

module.exports = { complete, stream, pickProvider, modeloDe, extractiveText, eventosSSE };
