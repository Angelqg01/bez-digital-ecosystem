/**
 * BeZhas AI Gateway (V1) — abstracción de proveedor.
 * El control plane (RAG, ACL, auth) es de BeZhas; el proveedor solo infiere.
 * Orden: AI_PROVIDER explícito > Anthropic > OpenAI > extractivo local (sin claves).
 */

/** Texto del modo local sin proveedor: devuelve los fragmentos recuperados. */
function extractiveText({ contextText }) {
    if (!contextText) {
        return 'No encuentro información sobre eso en la documentación a la que tienes acceso. ¿Puedes darme más detalles?';
    }
    const body = contextText
        .split(/<untrusted_document[^>]*>/).slice(1)
        .map((p, i) => `**[${i + 1}]** ${p.replace(/<\/untrusted_document>/, '').trim()}`)
        .join('\n\n');
    return `Esto es lo que encontré en la documentación:\n\n${body}\n\n_(Modo local sin proveedor de IA configurado.)_`;
}

const providers = {
    async anthropic({ system, messages, maxTokens }) {
        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const res = await client.messages.create({
            model: process.env.AI_MODEL_ANTHROPIC || 'claude-sonnet-5-5',
            max_tokens: maxTokens,
            system,
            messages,
        });
        return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    },
    async openai({ system, messages, maxTokens }) {
        const OpenAI = require('openai');
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const res = await client.chat.completions.create({
            model: process.env.AI_MODEL_OPENAI || 'gpt-4o-mini',
            max_tokens: maxTokens,
            messages: [{ role: 'system', content: system }, ...messages],
        });
        return res.choices[0].message.content;
    },
    /** Sin claves: responde con los fragmentos recuperados (útil en local y como degradación). */
    async extractive(args) {
        return extractiveText(args);
    },
};

/** Streaming por proveedor: generadores asíncronos de trozos de texto. */
const streamers = {
    async *anthropic({ system, messages, maxTokens, signal }) {
        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const stream = client.messages.stream({
            model: process.env.AI_MODEL_ANTHROPIC || 'claude-sonnet-5-5',
            max_tokens: maxTokens,
            system,
            messages,
        }, { signal });
        for await (const ev of stream) {
            if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') yield ev.delta.text;
        }
    },
    async *openai({ system, messages, maxTokens, signal }) {
        const OpenAI = require('openai');
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const stream = await client.chat.completions.create({
            model: process.env.AI_MODEL_OPENAI || 'gpt-4o-mini',
            max_tokens: maxTokens,
            stream: true,
            messages: [{ role: 'system', content: system }, ...messages],
        }, { signal });
        for await (const chunk of stream) {
            const text = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
            if (text) yield text;
        }
    },
    async *extractive(args) {
        const text = extractiveText(args);
        // Simula el ritmo de un modelo: palabra a palabra.
        for (const piece of text.match(/\S+\s*/g) || []) {
            if (args.signal && args.signal.aborted) return;
            yield piece;
            if (args.paceMs) await new Promise((r) => setTimeout(r, args.paceMs));
        }
    },
};

function pickProvider() {
    const forced = process.env.AI_PROVIDER;
    if (forced && providers[forced]) return forced;
    if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
    if (process.env.OPENAI_API_KEY) return 'openai';
    return 'extractive';
}

async function complete(args) {
    const name = pickProvider();
    try {
        return { provider: name, text: await providers[name](args) };
    } catch (err) {
        console.warn(`⚠️ AI provider ${name} falló (${err.message}); degradando a modo extractivo`);
        return { provider: 'extractive', text: await providers.extractive(args) };
    }
}

/**
 * Respuesta en streaming. Emite { type: 'start', provider }, { type: 'delta', text } y
 * { type: 'done' }. Si el proveedor falla antes del primer trozo, degrada al modo extractivo;
 * si falla a mitad, termina con { type: 'error' } (no se mezclan respuestas de dos proveedores).
 */
async function* stream(args) {
    let name = pickProvider();
    let started = false;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            yield { type: 'start', provider: name };
            for await (const text of streamers[name](args)) {
                started = true;
                yield { type: 'delta', text };
            }
            yield { type: 'done' };
            return;
        } catch (err) {
            if (args.signal && args.signal.aborted) { yield { type: 'done', aborted: true }; return; }
            if (started || name === 'extractive') {
                yield { type: 'error', message: 'El proveedor de IA falló durante la respuesta.' };
                return;
            }
            console.warn(`⚠️ AI provider ${name} falló (${err.message}); degradando a modo extractivo`);
            name = 'extractive';
        }
    }
}

module.exports = { complete, stream, pickProvider };
