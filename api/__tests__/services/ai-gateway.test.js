/**
 * Pasarela de modelos del chat: llamadas REST directas a Anthropic y Gemini,
 * modelo por defecto válido y degradación al modo extractivo.
 */
const gateway = require('../../services/ai-workspace/gateway');

const sse = (eventos) => {
    const texto = eventos.map((e) => `event: x\ndata: ${JSON.stringify(e)}\n\n`).join('');
    return new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(texto.slice(0, 40))); c.enqueue(new TextEncoder().encode(texto.slice(40))); c.close(); } });
};
const recoger = async (gen) => { const out = []; for await (const e of gen) out.push(e); return out; };
const ARGS = { system: 's', messages: [{ role: 'user', content: 'hola' }], maxTokens: 50, contextText: '<untrusted_document ref="1">dato</untrusted_document>' };

const ENV = { ...process.env };
afterEach(() => { process.env = { ...ENV }; delete global.fetch; });

it('Anthropic: modelo claude-sonnet-5 por defecto, cabeceras correctas y texto en streaming', async () => {
    delete process.env.AI_PROVIDER; delete process.env.AI_MODEL_ANTHROPIC;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    global.fetch = jest.fn(async (url, init) => ({ ok: true, body: sse([
        { type: 'message_start', message: { model: 'claude-sonnet-5', usage: { input_tokens: 1234, output_tokens: 1 } } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hola ' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'mundo' } },
        { type: 'message_delta', usage: { output_tokens: 87 } },
        { type: 'message_stop' },
    ]) }));
    const ev = await recoger(gateway.stream(ARGS));
    // Los tokens reales de la respuesta (son los que se cobran al plan del cliente).
    expect(ev).toEqual([
        { type: 'start', provider: 'anthropic' }, { type: 'delta', text: 'Hola ' }, { type: 'delta', text: 'mundo' },
        { type: 'usage', provider: 'anthropic', model: 'claude-sonnet-5', inputTokens: 1234, outputTokens: 87 },
        { type: 'done' },
    ]);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers).toMatchObject({ 'x-api-key': 'sk-ant-test', 'anthropic-version': '2023-06-01' });
    expect(JSON.parse(init.body)).toMatchObject({ model: 'claude-sonnet-5', stream: true, max_tokens: 50 });
});

it('Gemini cuando solo hay su clave (la clave va en cabecera, no en la URL)', async () => {
    delete process.env.AI_PROVIDER; delete process.env.ANTHROPIC_API_KEY;
    process.env.GEMINI_API_KEY = 'gem-test';
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({
        candidates: [{ content: { parts: [{ text: 'respuesta' }] } }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 40 },
    }) }));
    const r = await gateway.complete(ARGS);
    expect(r).toMatchObject({ provider: 'gemini', text: 'respuesta', usage: { inputTokens: 900, outputTokens: 40 } });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).not.toMatch(/key=/);
    expect(init.headers['x-goog-api-key']).toBe('gem-test');
});

it('si el proveedor falla antes de empezar, degrada al modo extractivo con los fragmentos', async () => {
    delete process.env.AI_PROVIDER;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    global.fetch = jest.fn(async () => ({ ok: false, status: 529, text: async () => 'overloaded' }));
    const ev = await recoger(gateway.stream(ARGS));
    expect(ev[0]).toEqual({ type: 'start', provider: 'anthropic' });
    expect(ev[1]).toEqual({ type: 'start', provider: 'extractive' });
    expect(ev.filter((e) => e.type === 'delta').map((e) => e.text).join('')).toMatch(/dato/);
});

it('sin claves: modo extractivo', () => {
    delete process.env.AI_PROVIDER; delete process.env.ANTHROPIC_API_KEY; delete process.env.GEMINI_API_KEY;
    expect(gateway.pickProvider()).toBe('extractive');
});

it('el proveedor forzado por la ruta manda sobre AI_PROVIDER (la pregunta gratis va siempre en extractivo)', () => {
    process.env.AI_PROVIDER = 'anthropic';
    expect(gateway.pickProvider('extractive')).toBe('extractive');
    expect(gateway.pickProvider()).toBe('anthropic');
});
