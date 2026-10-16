/**
 * Proveedor local (Ollama): sólo si se pide, sólo a una URL privada, sin fallback a la nube y sin coste por token.
 */
const gateway = require('../../services/ai-workspace/gateway');
const { calculateCallCost } = require('../../config/usage-pricing');

const recoger = async (gen) => { const out = []; for await (const e of gen) out.push(e); return out; };
const ARGS = { system: 'SYS', messages: [{ role: 'user', content: 'hola' }], maxTokens: 100, contextText: '<untrusted_document ref="1" relevance="0.90">dato</untrusted_document>' };
const ndjson = (lineas) => new ReadableStream({ start(c) { const t = lineas.map((l) => JSON.stringify(l)).join('\n') + '\n'; c.enqueue(new TextEncoder().encode(t.slice(0, 25))); c.enqueue(new TextEncoder().encode(t.slice(25))); c.close(); } });

const ENV = { ...process.env };
beforeEach(() => { delete process.env.ANTHROPIC_API_KEY; delete process.env.GEMINI_API_KEY; process.env.AI_PROVIDER = 'ollama'; });
afterEach(() => { process.env = { ...ENV }; delete global.fetch; });

describe('selección', () => {
    it('Ollama no se elige solo: sin AI_PROVIDER=ollama nunca se usa', () => {
        delete process.env.AI_PROVIDER;
        expect(gateway.pickProvider()).toBe('extractive');
        process.env.ANTHROPIC_API_KEY = 'x';
        expect(gateway.pickProvider()).toBe('anthropic');
    });
    it('AI_PROVIDER=ollama lo elige y no consume el techo de llamadas de pago', () => {
        process.env.AI_GLOBAL_DAILY_CALLS = '1';
        gateway._reiniciarPresupuesto();
        expect([gateway.pickProvider(), gateway.pickProvider(), gateway.pickProvider()]).toEqual(['ollama', 'ollama', 'ollama']);
    });
});

describe('llamada', () => {
    it('complete: URL local, system primero, think:false, ventana y salida acotadas, tokens reales', async () => {
        global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ message: { content: 'respuesta local' }, prompt_eval_count: 321, eval_count: 45 }) }));
        const r = await gateway.complete(ARGS);
        expect(r).toMatchObject({ provider: 'ollama', text: 'respuesta local', usage: { model: 'local:qwen3.5:4b', inputTokens: 321, outputTokens: 45 } });
        const [url, init] = global.fetch.mock.calls[0];
        expect(url).toBe('http://127.0.0.1:11434/api/chat');
        const b = JSON.parse(init.body);
        expect(b).toMatchObject({ model: 'qwen3.5:4b', stream: false, think: false, keep_alive: '5m', options: { num_ctx: 4096, num_predict: 100, temperature: 0.2 } });
        expect(b.messages[0]).toEqual({ role: 'system', content: 'SYS' });
        expect(init.headers).not.toHaveProperty('authorization');
    });
    it('stream NDJSON: trozos y uso al final', async () => {
        global.fetch = jest.fn(async () => ({ ok: true, body: ndjson([
            { message: { content: 'Hola ' }, done: false }, { message: { content: 'mundo' }, done: false },
            { message: { content: '' }, done: true, prompt_eval_count: 50, eval_count: 7 },
        ]) }));
        const ev = await recoger(gateway.stream(ARGS));
        expect(ev).toEqual([
            { type: 'start', provider: 'ollama' }, { type: 'delta', text: 'Hola ' }, { type: 'delta', text: 'mundo' },
            { type: 'usage', provider: 'ollama', model: 'local:qwen3.5:4b', inputTokens: 50, outputTokens: 7 }, { type: 'done' },
        ]);
    });
    it('configurable por entorno (URL, modelo y ventana)', async () => {
        process.env.OLLAMA_URL = 'http://ollama:11434/'; process.env.AI_MODEL_OLLAMA = 'qwen3.5:2b-q4_K_M'; process.env.OLLAMA_NUM_CTX = '2048';
        global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ message: { content: 'x' } }) }));
        await gateway.complete(ARGS);
        expect(global.fetch.mock.calls[0][0]).toBe('http://ollama:11434/api/chat');
        expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({ model: 'qwen3.5:2b-q4_K_M', options: { num_ctx: 2048 } });
    });
});

describe('sin fallback a la nube', () => {
    it('si Ollama falla se sirve el modo extractivo y NO se llama a Anthropic aunque haya clave', async () => {
        process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
        global.fetch = jest.fn(async () => { throw new Error('ECONNREFUSED'); });
        const r = await gateway.complete(ARGS);
        expect(r.provider).toBe('extractive');
        expect(global.fetch.mock.calls.every(([u]) => !/anthropic|googleapis/.test(String(u)))).toBe(true);
    });
    it('en stream, también extractivo y sin llamadas a la nube', async () => {
        process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
        global.fetch = jest.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' }));
        const ev = await recoger(gateway.stream(ARGS));
        expect(ev[0]).toEqual({ type: 'start', provider: 'ollama' });
        expect(ev.find((e) => e.type === 'start' && e.provider === 'extractive')).toBeTruthy();
        expect(global.fetch.mock.calls.every(([u]) => !/anthropic|googleapis/.test(String(u)))).toBe(true);
    });
    it.each(['https://api.openai.com', 'http://8.8.8.8:11434', 'http://ollama.example.com'])('rechaza una URL pública (%s) sin hacer ninguna petición', async (url) => {
        process.env.OLLAMA_URL = url;
        global.fetch = jest.fn();
        const r = await gateway.complete(ARGS);
        expect(r.provider).toBe('extractive');
        expect(global.fetch).not.toHaveBeenCalled();
    });
});

describe('red privada', () => {
    it('esHostPrivado', () => {
        for (const h of ['localhost', '127.0.0.1', '[::1]', '10.1.2.3', '192.168.0.5', '172.16.0.1', '172.31.9.9', 'ollama', 'gpu.internal']) expect(gateway.esHostPrivado(h)).toBe(true);
        for (const h of ['8.8.8.8', '172.32.0.1', '172.15.0.1', 'example.com', 'api.anthropic.com', '']) expect(gateway.esHostPrivado(h)).toBe(false);
    });
});

describe('ventana de contexto', () => {
    it('descarta el historial más antiguo antes de que Ollama recorte el system prompt', () => {
        const largo = 'x'.repeat(6000);
        const msgs = [{ role: 'user', content: largo }, { role: 'assistant', content: largo }, { role: 'user', content: 'pregunta final' }];
        const r = gateway.ajustarContexto({ system: 'SYS', messages: msgs, maxTokens: 800 });
        expect(r[r.length - 1].content).toBe('pregunta final');
        expect(r.length).toBeLessThan(msgs.length);
    });
    it('si el último mensaje ya no cabe, falla (y se degrada)', () => {
        expect(() => gateway.ajustarContexto({ system: 'SYS', messages: [{ role: 'user', content: 'y'.repeat(20000) }], maxTokens: 800 })).toThrow(/no caben/);
    });
});

describe('facturación', () => {
    it('un modelo local no cobra tokens (antes un modelo desconocido se facturaba al precio del modelo por defecto)', () => {
        const local = calculateCallCost({ model: 'local:qwen3.5:4b', inputTokens: 5000, outputTokens: 2000, action: 'ai_chat' });
        const desconocido = calculateCallCost({ model: 'otro', inputTokens: 5000, outputTokens: 2000, action: 'ai_chat' });
        expect(local.claudeCostEUR).toBe(0);
        expect(local.computeCostEUR).toBeGreaterThan(0);
        expect(desconocido.claudeCostEUR).toBeGreaterThan(0);
    });
});

describe('Qwen3: el razonamiento no debe salir al usuario', () => {
  const gw = require('../../services/ai-workspace/gateway');
  const msgs = [{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'qué tal' }, { role: 'user', content: '¿cómo conecto mi planta?' }];

  it('reconoce qwen3 y no qwen3.5', () => {
    expect(gw.esQwen3('qwen3:4b')).toBe(true);
    expect(gw.esQwen3('qwen3')).toBe(true);
    expect(gw.esQwen3('qwen3.5:4b')).toBe(false);
    expect(gw.esQwen3('llama3:8b')).toBe(false);
  });
  it('añade /no_think sólo al último mensaje del usuario y no lo duplica', () => {
    const out = gw.sinRazonamiento(msgs, 'qwen3:4b');
    expect(out[2].content).toBe('¿cómo conecto mi planta? /no_think');
    expect(out[0].content).toBe('hola');
    expect(gw.sinRazonamiento(out, 'qwen3:4b')[2].content).toBe('¿cómo conecto mi planta? /no_think');
  });
  it('con otros modelos no toca nada', () => {
    expect(gw.sinRazonamiento(msgs, 'qwen3.5:4b')).toEqual(msgs);
  });
});
