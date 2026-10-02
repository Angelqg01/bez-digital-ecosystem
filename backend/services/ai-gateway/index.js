/**
 * BeZhas AI Gateway (V1) — abstracción de proveedor.
 * El control plane (RAG, ACL, auth) es de BeZhas; el proveedor solo infiere.
 * Orden: AI_PROVIDER explícito > Anthropic > OpenAI > extractivo local (sin claves).
 */
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
    async extractive({ sources, contextText }) {
        if (!contextText) {
            return 'No encuentro información sobre eso en la documentación a la que tienes acceso. ¿Puedes darme más detalles?';
        }
        const body = contextText
            .split(/<untrusted_document[^>]*>/).slice(1)
            .map((p, i) => `**[${i + 1}]** ${p.replace(/<\/untrusted_document>/, '').trim()}`)
            .join('\n\n');
        return `Esto es lo que encontré en la documentación:\n\n${body}\n\n_(Modo local sin proveedor de IA configurado.)_`;
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

module.exports = { complete, pickProvider };
