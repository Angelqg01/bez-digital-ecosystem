const request = require('supertest');
const { mockQuery } = require('../helpers');
const app = require('../../index');
const { TOOLS, toolsParaScopes, getTool } = require('../../config/mcp-tools');

/**
 * El registro devuelve la app cuando authenticateApp consulta por el hash, y
 * después `resolverPlan` consulta la suscripción.
 *
 * El plan por defecto de esta ayuda es business y NO starter a propósito: con
 * starter, media suite pasaría porque el plan deniega la herramienta y no
 * porque el control que se está probando funcione. Los tests que quieran probar
 * el límite del plan lo piden explícitamente.
 */
function conApp(scopes, plan = 'business') {
    mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'app-1', app_name: 'cliente-test', scopes, tier: 'standard', is_active: true }],
    });
    mockQuery.mockResolvedValueOnce({ rows: plan ? [{ plan_id: plan }] : [] });
}

const rpc = (key, metodo, params) => {
    const r = request(app).post('/api/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream');
    if (key) r.set('x-api-key', key);
    return r.send({ jsonrpc: '2.0', id: 1, method: metodo, params: params || {} });
};

/** El transporte responde con SSE; el JSON viene en la línea `data:`. */
const listar = (res) => (cuerpo(res)?.result?.tools || []).map((t) => t.name);

const cuerpo = (res) => {
    const t = res.text || '';
    if (t.trim().startsWith('{')) return JSON.parse(t);
    const m = t.match(/^data: (.+)$/m);
    return m ? JSON.parse(m[1]) : null;
};

describe('MCP de cara al cliente (/api/mcp)', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('catálogo', () => {
        it('no expone ninguna herramienta que reciba una dirección', () => {
            // `app_registry` no vincula la api-key con un titular, así que no hay
            // contra qué contrastar una dirección recibida. Con MCP, «dame el
            // historial de pagos y el KYC de estas 200 direcciones» sería una
            // sola frase: la herramienta no puede existir hasta que haya titular.
            for (const t of TOOLS) {
                const claves = Object.keys(t.inputSchema || {});
                expect(claves.filter(k => /address|wallet|direccion/i.test(k))).toEqual([]);
            }
        });

        it('no expone nada de administración', () => {
            for (const t of TOOLS) {
                expect(t.scope).not.toBe('admin');
                expect(t.name).not.toMatch(/apps_list|registry|admin/);
            }
        });

        it('no expone ninguna herramienta de escritura', () => {
            // v1 es de solo lectura a propósito: votar o proponer exige la firma
            // del votante, y un agente que vota «en nombre de» decide gobernanza
            // por su cuenta.
            for (const t of TOOLS) {
                expect(t.name).not.toMatch(/vote|propose|execute|send|transfer|settle|pay|create|delete/);
            }
        });

        it('no existe ninguna pasarela genérica', () => {
            for (const t of TOOLS) {
                const claves = Object.keys(t.inputSchema || {});
                expect(claves.filter(k => /path|url|endpoint|query|sql/i.test(k))).toEqual([]);
            }
        });

        it('filtra por scope, sin colarse ninguna', () => {
            const soloToken = toolsParaScopes(['token']).map(t => t.name);
            expect(soloToken.length).toBeGreaterThan(0);
            expect(soloToken.every(n => getTool(n).scope === 'token')).toBe(true);
            expect(toolsParaScopes([])).toEqual([]);
        });
    });

    describe('autenticación', () => {
        it('sin api-key devuelve 401', async () => {
            expect((await rpc(null, 'tools/list')).status).toBe(401);
        });

        it('con api-key desconocida devuelve 401', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });
            expect((await rpc('inventada', 'tools/list')).status).toBe(401);
        });

        it('con una app desactivada devuelve 403', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'a', app_name: 'x', scopes: ['token'], tier: 'free', is_active: false }],
            });
            expect((await rpc('k', 'tools/list')).status).toBe(403);
        });

        it('sin ningún scope devuelve 403 en vez de un catálogo vacío', async () => {
            conApp([]);
            const res = await rpc('k', 'tools/list');
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('MCP_NO_SCOPES');
        });
    });

    describe('aislamiento por permisos', () => {
        it('solo lista lo que la clave puede usar', async () => {
            conApp(['token']);
            const nombres = (cuerpo(await rpc('k', 'tools/list'))?.result?.tools || []).map(t => t.name);
            expect(nombres.length).toBeGreaterThan(0);
            expect(nombres.every(n => getTool(n).scope === 'token')).toBe(true);
        });

        it('una herramienta sin permiso es indistinguible de una inexistente', async () => {
            // Si se diferenciaran, el catálogo entero sería enumerable probando
            // nombres: cada respuesta distinta confirmaría que algo existe.
            conApp(['token']);
            const sinPermiso = cuerpo(await rpc('k', 'tools/call', { name: 'bezhas_network_stats', arguments: {} }));
            conApp(['token']);
            const inexistente = cuerpo(await rpc('k', 'tools/call', { name: 'bezhas_no_existe', arguments: {} }));

            const norm = (o) => JSON.stringify(o?.result || o?.error || {}).replace(/bezhas_[a-z_]+/g, 'X');
            expect(norm(sinPermiso)).toBe(norm(inexistente));
        });
    });

    describe('el plan gradúa el catálogo', () => {
        // Antes de esto, un starter de 0 € y un enterprise de 2.499 € veían
        // EXACTAMENTE las mismas herramientas. La suscripción no significaba
        // nada más allá de un contador de llamadas.
        it('un starter ve menos herramientas que un business con los mismos scopes', async () => {
            conApp(['token', 'contracts', 'wallet'], 'starter');
            const pocas = listar(await rpc('k', 'tools/list'));
            conApp(['token', 'contracts', 'wallet'], 'business');
            const muchas = listar(await rpc('k', 'tools/list'));
            expect(pocas.length).toBeLessThan(muchas.length);
            expect(muchas).toEqual(expect.arrayContaining(pocas));
        });

        it('una herramienta fuera del plan es indistinguible de una inexistente', async () => {
            // Mismo criterio que con los scopes: si se diferenciaran, el
            // catálogo entero sería enumerable probando nombres con un plan
            // gratuito. Lo que el cliente SÍ puede saber es qué incluye su
            // plan, y eso se lo dice bezhas_subscription.
            conApp(['token'], 'starter');
            const fueraDePlan = cuerpo(await rpc('k', 'tools/call', {
                name: 'bezhas_dex_pool', arguments: {},
            }));
            conApp(['token'], 'starter');
            const inexistente = cuerpo(await rpc('k', 'tools/call', {
                name: 'bezhas_no_existe', arguments: {},
            }));

            const norm = (o) => JSON.stringify(o?.result || o?.error || {}).replace(/bezhas_[a-z_]+/g, 'X');
            expect(norm(fueraDePlan)).toBe(norm(inexistente));
        });

        it('planPermiteTool niega lo que el plan no alcanza', () => {
            // La comprobación en la ejecución del handler es defensa en
            // profundidad —el filtrado del catálogo ya impide llegar ahí— así
            // que se prueba directamente en vez de por HTTP.
            const { planPermiteTool } = require('../../config/mcp-tools');
            expect(planPermiteTool('bezhas_dex_pool', 'starter')).toBe(false);
            expect(planPermiteTool('bezhas_dex_pool', 'business')).toBe(true);
            expect(planPermiteTool('bezhas_token_price', 'starter')).toBe(true);
            expect(planPermiteTool('bezhas_no_existe', 'enterprise_vip')).toBe(false);
        });

        it('sin fila de suscripción se aplica el plan MÁS restrictivo', async () => {
            // Nunca el más generoso: una base que no contesta no es motivo para
            // regalar el catálogo de enterprise.
            conApp(['token', 'contracts', 'wallet'], null);
            const nombres = listar(await rpc('k', 'tools/list'));
            expect(nombres).not.toContain('bezhas_dex_quote');
            expect(nombres).toContain('bezhas_token_price');
        });

        it('un plan desconocido no alcanza nada por encima de starter', async () => {
            // Si mañana alguien escribe 'business_v2' en la base sin añadirlo al
            // catálogo de planes, lo seguro es negar.
            conApp(['token', 'contracts', 'wallet'], 'business_v2');
            expect(listar(await rpc('k', 'tools/list'))).not.toContain('bezhas_dex_quote');
        });

        it('scope admin salta el scope pero NO compra plan', async () => {
            // Son dos ejes distintos y ninguno cubre al otro.
            conApp(['admin'], 'starter');
            const nombres = listar(await rpc('k', 'tools/list'));
            expect(nombres).not.toContain('bezhas_oracle_prices');
        });
    });

    describe('la frescura del dato de mercado se declara', () => {
        it('un plan diferido lo dice en la propia respuesta', async () => {
            // Servir dato con retraso es normal; presentarlo como actual no. El
            // agente tiene que poder distinguirlo para advertir a su usuario.
            conApp(['token'], 'starter');
            const t = cuerpo(await rpc('k', 'tools/call', {
                name: 'bezhas_token_price', arguments: {},
            }))?.result?.content?.[0]?.text || '';
            expect(t).toMatch(/retrasoDeclaradoSegundos/);
            expect(t).toMatch(/No lo uses como precio de ejecución/);
        });

        it('un plan en tiempo real lo marca como tal', async () => {
            conApp(['token'], 'business');
            const t = cuerpo(await rpc('k', 'tools/call', {
                name: 'bezhas_token_price', arguments: {},
            }))?.result?.content?.[0]?.text || '';
            expect(t).toMatch(/"tiempoReal": true/);
        });
    });

    describe('entrada hostil', () => {
        it('rechaza una cantidad que no sea numérica', async () => {
            conApp(['token']);
            const r = cuerpo(await rpc('k', 'tools/call', {
                name: 'bezhas_dex_quote',
                arguments: { amount: "1; DROP TABLE users", from: 'BEZ', to: 'USDT' },
            }));
            expect(r?.result?.isError === true || Boolean(r?.error)).toBe(true);
        });

        it('rechaza un token fuera de la lista cerrada', async () => {
            conApp(['token']);
            const r = cuerpo(await rpc('k', 'tools/call', {
                name: 'bezhas_dex_quote',
                arguments: { amount: '1', from: 'INVENTADO', to: 'USDT' },
            }));
            expect(r?.result?.isError === true || Boolean(r?.error)).toBe(true);
        });
    });

    describe('protocolo', () => {
        it('GET y DELETE devuelven 405: el servidor es sin estado', async () => {
            expect((await request(app).get('/api/mcp')).status).toBe(405);
            expect((await request(app).delete('/api/mcp')).status).toBe(405);
        });
    });
});
