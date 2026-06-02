/**
 * GeminiClient.js — Direct integration with Google Gemini API.
 *
 * Replaces the internal gateway proxy entirely.
 * Priority chain:
 *   1. Gemini 2.0 Flash (GEMINI_API_KEY)
 *   2. BeZhas local AI-Engine (Aegis / port 3002) — for blockchain-specific tasks
 *
 * Used by UnifiedAgent._callLLM() for natural-language responses.
 */
'use strict';

const axios = require('axios');

const GEMINI_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_ALT,
].filter(Boolean);

// Model priority — gemini-2.5-flash is confirmed working with free-tier keys
const GEMINI_MODEL   = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_BASE    = 'https://generativelanguage.googleapis.com/v1beta/models';

const LOCAL_AI_URL   = process.env.AI_ENGINE_URL || 'http://localhost:3002';

let _keyIndex = 0; // round-robin key index

function nextKey() {
    if (GEMINI_KEYS.length === 0) return null;
    const key = GEMINI_KEYS[_keyIndex % GEMINI_KEYS.length];
    _keyIndex++;
    return key;
}

/**
 * Call Gemini with an OpenAI-style messages array.
 * Converts to Gemini's Content format automatically.
 * Tries all available API keys before giving up.
 *
 * @param {{ role: string, content: string }[]} messages
 * @param {object} [opts]
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.temperature]
 * @returns {Promise<string>} - Generated text
 */
async function callGemini(messages, opts = {}) {
    if (GEMINI_KEYS.length === 0) throw new Error('No GEMINI_API_KEY configured');

    // Separate system instructions from the conversation
    const systemMsgs = messages.filter(m => m.role === 'system');
    const chatMsgs   = messages.filter(m => m.role !== 'system');

    // Incorporar system instruction desde opts si existen
    const systemTextParts = systemMsgs.map(m => m.content);
    if (opts.system) systemTextParts.unshift(opts.system);
    if (opts.systemInstruction) systemTextParts.unshift(opts.systemInstruction);

    // Build Gemini contents array (alternating user/model)
    const contents = [];
    for (const m of chatMsgs) {
        contents.push({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content || '...' }],
        });
    }

    // Gemini requires the last turn to be from user
    if (contents.length === 0 || contents[contents.length - 1].role === 'model') {
        contents.push({ role: 'user', parts: [{ text: '...' }] });
    }

    const systemInstruction = systemTextParts.length > 0
        ? { parts: [{ text: systemTextParts.join('\n\n') }] }
        : undefined;

    const body = {
        contents,
        generationConfig: {
            maxOutputTokens: opts.maxTokens || 1024,
            temperature:     opts.temperature ?? 0.7,
        },
    };
    if (systemInstruction) body.systemInstruction = systemInstruction;

    // Try all keys + models before failing
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.0-flash-lite'];
    const errors = [];

    for (let attempt = 0; attempt < GEMINI_KEYS.length * 2; attempt++) {
        const key   = GEMINI_KEYS[attempt % GEMINI_KEYS.length];
        const model = models[Math.floor(attempt / GEMINI_KEYS.length)] || GEMINI_MODEL;

        try {
            const url = `${GEMINI_BASE}/${model}:generateContent?key=${key}`;
            const res = await axios.post(url, body, {
                timeout: 30000,
                headers: { 'Content-Type': 'application/json' },
            });

            const candidate = res.data?.candidates?.[0];
            const text = candidate?.content?.parts?.[0]?.text || '';

            if (!text) throw new Error('Gemini returned empty response');
            console.log(`[GeminiClient] Success with model=${model} key=[${attempt % GEMINI_KEYS.length}]`);
            return text;

        } catch (err) {
            const status = err.response?.status;
            errors.push(`key[${attempt % GEMINI_KEYS.length}] model=${model}: ${status || err.message}`);
            // On 429 or 402, try next key immediately
            if (status === 429 || status === 402) continue;
            // On other errors, also try next
            continue;
        }
    }

    throw new Error(`Gemini all attempts failed: ${errors.join(' | ')}`);
}

/**
 * Call local BeZhas AI-Engine (Aegis NLP endpoint).
 * Used for blockchain-specific analysis: fraud, gas, sentiment.
 *
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function callLocalAI(prompt) {
    const res = await axios.post(
        `${LOCAL_AI_URL}/api/nlp/generate`,
        { prompt, max_tokens: 512 },
        { timeout: 15000 }
    );
    return res.data?.text || res.data?.response || res.data?.result || '';
}

/**
 * Main LLM call with priority chain.
 * 
 * @param {{ role: string, content: string }[]} messages
 * @param {{ useLocal?: boolean, temperature?: number }} [opts]
 * @returns {Promise<{ text: string, provider: string }>}
 */
async function generate(messages, opts = {}) {
    // If caller explicitly wants the local AI, try it first
    if (opts.useLocal) {
        try {
            const lastUser = [...messages].reverse().find(m => m.role === 'user');
            const text = await callLocalAI(lastUser?.content || '');
            if (text) return { text, provider: 'bezhas-local' };
        } catch (err) {
            console.warn('[GeminiClient] Local AI error:', err.message);
        }
    }

    // Primary: Gemini
    try {
        const text = await callGemini(messages, opts);
        return { text, provider: 'gemini' };
    } catch (geminiErr) {
        console.warn('[GeminiClient] Gemini error:', geminiErr.message);
    }

    // Fallback: Local BeZhas AI
    try {
        const lastUser = [...messages].reverse().find(m => m.role === 'user');
        const text = await callLocalAI(lastUser?.content || '');
        if (text) return { text, provider: 'bezhas-local' };
    } catch (localErr) {
        console.warn('[GeminiClient] Local AI fallback error:', localErr.message);
    }

    throw new Error('All LLM providers failed');
}

/**
 * Streamed LLM call with priority chain.
 * 
 * @param {{ role: string, content: string }[]} messages
 * @param {Function} onChunk - Callback for each token
 * @param {{ useLocal?: boolean, temperature?: number }} [opts]
 * @returns {Promise<{ text: string, provider: string }>}
 */
async function stream(messages, onChunk, opts = {}) {
    if (opts.useLocal) {
        // Local AI doesn't support streaming yet, fallback to sync
        const res = await generate(messages, opts);
        onChunk(res.text);
        return res;
    }

    const key = nextKey();
    if (!key) return generate(messages, opts);

    const systemMsgs = messages.filter(m => m.role === 'system');
    const chatMsgs   = messages.filter(m => m.role !== 'system');
    const contents   = chatMsgs.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content || '...' }],
    }));

    // Incorporar system instruction desde opts si existen
    const systemTextParts = systemMsgs.map(m => m.content);
    if (opts.system) systemTextParts.unshift(opts.system);
    if (opts.systemInstruction) systemTextParts.unshift(opts.systemInstruction);

    const body = {
        contents,
        generationConfig: {
            maxOutputTokens: opts.maxTokens || 1024,
            temperature: opts.temperature ?? 0.7,
        },
        systemInstruction: systemTextParts.length > 0
            ? { parts: [{ text: systemTextParts.join('\n\n') }] }
            : undefined,
    };

    try {
        const url = `${GEMINI_BASE}/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${key}`;
        const response = await axios({
            method: 'post',
            url,
            data: body,
            responseType: 'stream',
            timeout: 30000,
        });

        let fullText = '';
        return new Promise((resolve, reject) => {
            response.data.on('data', chunk => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            if (text) {
                                fullText += text;
                                onChunk(text);
                            }
                        } catch (e) { /* partial JSON line */ }
                    }
                }
            });

            response.data.on('end', () => resolve({ text: fullText, provider: 'gemini-stream' }));
            response.data.on('error', err => reject(err));
        });

    } catch (err) {
        console.warn('[GeminiClient] Stream failed, falling back to sync:', err.message);
        const res = await generate(messages, opts);
        onChunk(res.text);
        return res;
    }
}

module.exports = { generate, stream, callGemini, callLocalAI };
