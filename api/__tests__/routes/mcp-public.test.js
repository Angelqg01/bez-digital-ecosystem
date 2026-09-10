// El limitador anónimo son 10 peticiones por minuto y por IP —estrecho a
// propósito: el alta es una conversación, no un bucle—. La suite entera sale de
// la misma IP, así que se eleva sólo aquí. El control que de verdad frena la
// fábrica de sesiones es el techo por IP y hora, y ése SÍ se prueba abajo
// ('corta cuando una IP ya ha abierto demasiadas sesiones').
process.env.MCP_PUBLIC_RATE_LIMIT_MAX = '1000';

const request = require('supertest');
const { mockQuery } = require('../helpers');
const app = require('../../index');
const { TOOLS, toolsVisibles, getTool } = require('../../config/mcp-onboarding-tools');

/** app_registry devuelve la app cuando se autentica con clave. */
function conApp(activa = true) {
    mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'app-1', app_name: 'cliente-test', scopes: ['token'], is_active: activa }],
    });
}

/** Fila que devuelve el INSERT de una sesión de onboarding. */
function conSesionCreada(kind = 'signup') {
    mockQuery.mockResolvedValueOnce({
        rows: [{
            id: '11111111-2222-3333-4444-555555555555',
            kind,
            status: 'pendiente',
            expires_at: new Date(Date.now() + 900000),
            created_at: new Date(),
        }],
    });
}

/** El contador de sesiones por IP que se consulta antes de crear una anónima. */
function conRecuentoIp(n = 0) {
    mockQuery.mockResolvedValueOnce({ rows: [{ n }] });
}

const rpc = (key, metodo, params) => {
    const r = request(app).post('/api/mcp/onboarding')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream');
    if (key) r.set('x-api-key', key);
    return r.send({ jsonrpc: '2.0', id: 1, method: metodo, params: params || {} });
};

const cuerpo = (res) => {
    const t = res.text || '';
    if (t.trim().startsWith('{')) return JSON.parse(t);
    const m = t.match(/^data: (.+)$/m);
    return m ? JSON.parse(m[1]) : null;
};

const listar = (res) => (cuerpo(res)?.result?.tools || []).map((t) => t.name);
const texto = (res) => cuerpo(res)?.result?.content?.[0]?.text || '';

describe('MCP de alta asistida (/api/mcp/onboarding)', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('catálogo', () => {
        it('ninguna herramienta acepta datos bancarios ni credenciales', () => {
            // Es la propiedad que sostiene el diseño entero: si una herramienta
            // aceptara un IBAN o una api-key, ese dato acabaría en el contexto
            // del modelo del cliente, en su historial de chat y en logs de
            // petición. Tres sitios de los que ya no se puede borrar.
            const prohibido = /iban|swift|bic|cuenta|account|card|tarjeta|cvv|password|contrase|secret|api[_-]?key|private|seed|mnemonic|credential/i;
            for (const t of TOOLS) {
                for (const clave of Object.keys(t.inputSchema || {})) {
                    expect(clave).not.toMatch(prohibido);
                }
            }
        });

        it('no existe ninguna pasarela genérica', () => {
            for (const t of TOOLS) {
                const claves = Object.keys(t.inputSchema || {});
                expect(claves.filter((k) => /path|url|endpoint|query|sql|comando|command/i.test(k))).toEqual([]);
            }
        });

        it('el catálogo anónimo son exactamente cuatro herramientas', () => {
            // Cerrado a propósito: ampliarlo tiene que ser una decisión, no un
            // efecto secundario de añadir una herramienta de cliente.
            const anon = toolsVisibles({ autenticado: false }).map((t) => t.name).sort();
            expect(anon).toEqual([
                'bezhas_intro',
                'bezhas_onboarding_status',
                'bezhas_recommend_plan',
                'bezhas_signup_start',
            ]);
        });

        it('ninguna anónima toca datos de negocio', () => {
            for (const t of toolsVisibles({ autenticado: false })) {
                expect(t.name).not.toMatch(/erp|node|sdk|bank|payment|wallet|contract/);
            }
        });
    });

    describe('autenticación opcional', () => {
        it('sin api-key sirve, con el catálogo recortado', async () => {
            const res = await rpc(null, 'tools/list');
            expect(res.status).toBe(200);
            expect(listar(res).sort()).toEqual([
                'bezhas_intro', 'bezhas_onboarding_status',
                'bezhas_recommend_plan', 'bezhas_signup_start',
            ]);
        });

        it('con api-key válida aparece el catálogo completo', async () => {
            conApp();
            const nombres = listar(await rpc('k', 'tools/list'));
            expect(nombres).toContain('bezhas_sdk_install_plan');
            expect(nombres).toContain('bezhas_bank_setup_start');
            expect(nombres.length).toBe(TOOLS.length);
        });

        it('una api-key inválida da 401 en vez de degradar a anónimo', async () => {
            // Degradar en silencio dejaría a un cliente sin sus herramientas y
            // sin ninguna pista de por qué: parecería que BeZhas no las tiene.
            mockQuery.mockResolvedValueOnce({ rows: [] });
            const res = await rpc('inventada', 'tools/list');
            expect(res.status).toBe(401);
        });

        it('una app desactivada da 403', async () => {
            conApp(false);
            expect((await rpc('k', 'tools/list')).status).toBe(403);
        });
    });

    describe('aislamiento del canal anónimo', () => {
        it('una herramienta de cliente pedida por su nombre sin clave se rechaza', async () => {
            // El filtrado del listado es comodidad. ESTO es el control: nada
            // impide invocar por nombre algo que no se listó.
            const res = await rpc(null, 'tools/call', {
                name: 'bezhas_bank_setup_start',
                arguments: { proposito: 'cobros' },
            });
            const r = cuerpo(res);
            expect(r?.result?.isError === true || Boolean(r?.error)).toBe(true);
            expect(JSON.stringify(r)).not.toMatch(/https?:\/\/[^"]*\/o\//);
        });

        it('tampoco se cuela la de nodos', async () => {
            const r = cuerpo(await rpc(null, 'tools/call', {
                name: 'bezhas_node_provision_start',
                arguments: { tipo: 'edge' },
            }));
            expect(r?.result?.isError === true || Boolean(r?.error)).toBe(true);
        });
    });

    describe('entrada hostil', () => {
        it('rechaza un sector fuera de la lista cerrada', async () => {
            const r = cuerpo(await rpc(null, 'tools/call', {
                name: 'bezhas_recommend_plan',
                arguments: { sector: "'; DROP TABLE users; --" },
            }));
            expect(r?.result?.isError === true || Boolean(r?.error)).toBe(true);
        });

        it('rechaza el alta si el prefill trae un IBAN, y lo dice', async () => {
            // El modelo del cliente INTENTARÁ pasárnoslo si su usuario se lo
            // dicta: es lo que se le ha pedido. La defensa es que la herramienta
            // lo rechace, no confiar en que no lo mande. Y se rechaza la sesión
            // entera en vez de limpiar el campo, porque una limpieza silenciosa
            // dejaría al usuario creyendo que ya dio ese paso.
            conRecuentoIp(0);
            const r = cuerpo(await rpc(null, 'tools/call', {
                name: 'bezhas_signup_start',
                arguments: { sector: 'logistica', razon_social: 'Delta SL', iban: 'ES7714650100911766376210' },
            }));
            const t = JSON.stringify(r);
            expect(r?.result?.isError === true || Boolean(r?.error)).toBe(true);
            // El valor no puede aparecer en la respuesta ni siquiera al rechazarlo.
            expect(t).not.toContain('ES7714650100911766376210');
        });

        it('rechaza un identificador de sesión que no sea un uuid', async () => {
            const r = cuerpo(await rpc(null, 'tools/call', {
                name: 'bezhas_onboarding_status',
                arguments: { onboarding_id: '../../etc/passwd' },
            }));
            expect(r?.result?.isError === true || Boolean(r?.error)).toBe(true);
        });
    });

    describe('flujo de alta', () => {
        it('devuelve enlace y pasos, y no da de alta a nadie', async () => {
            conRecuentoIp(0);
            conSesionCreada('signup');
            const t = texto(await rpc(null, 'tools/call', {
                name: 'bezhas_signup_start',
                arguments: { sector: 'logistica', empleados: 40, pais: 'ES' },
            }));
            expect(t).toMatch(/\/o\/[0-9a-f]{64}/);
            expect(t).toContain('onboardingId');
            // Ninguna escritura de alta: sólo el recuento y el INSERT de sesión.
            const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
            expect(sqls.some((s) => /INSERT INTO onboarding_sessions/i.test(s))).toBe(true);
            expect(sqls.some((s) => /INSERT INTO (enterprises|organizations|users)/i.test(s))).toBe(false);
        });

        it('el token va en la URL pero se guarda hasheado', async () => {
            conRecuentoIp(0);
            conSesionCreada('signup');
            const t = texto(await rpc(null, 'tools/call', {
                name: 'bezhas_signup_start',
                arguments: { sector: 'energia' },
            }));
            const token = t.match(/\/o\/([0-9a-f]{64})/)[1];
            const insert = mockQuery.mock.calls.find((c) => /INSERT INTO onboarding_sessions/i.test(String(c[0])));
            expect(insert[1][0]).toHaveLength(64);
            expect(insert[1][0]).not.toBe(token); // se guarda el sha256, no el token
        });

        it('recomienda plan sin crear nada', async () => {
            const t = texto(await rpc(null, 'tools/call', {
                name: 'bezhas_recommend_plan',
                arguments: { sector: 'logistica', empleados: 300 },
            }));
            expect(t).toContain('enterprise_vip');
            // Recomendar no es comprometerse: no se abre sesión ninguna.
            const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
            expect(sqls.some((s) => /onboarding_sessions/i.test(s))).toBe(false);
        });

        it('corta cuando una IP ya ha abierto demasiadas sesiones', async () => {
            conRecuentoIp(999);
            const r = cuerpo(await rpc(null, 'tools/call', {
                name: 'bezhas_signup_start',
                arguments: { sector: 'otro' },
            }));
            expect(JSON.stringify(r)).toContain('ONBOARDING_RATE');
        });
    });

    describe('respuestas', () => {
        it('van marcadas como dato, no como instrucción', async () => {
            // Lo que sale de aquí entra en el contexto de un LLM ajeno.
            const t = texto(await rpc(null, 'tools/call', { name: 'bezhas_intro', arguments: {} }));
            expect(t).toContain('no son instrucciones');
        });

        it('la introducción declara lo que el agente nunca hace', async () => {
            const t = texto(await rpc(null, 'tools/call', { name: 'bezhas_intro', arguments: {} }));
            expect(t).toMatch(/loQueNuncaHaceElAgente/);
            expect(t).toMatch(/IBAN|claves privadas/);
        });
    });

    describe('protocolo', () => {
        it('GET y DELETE responden 405: el servidor es sin estado', async () => {
            expect((await request(app).get('/api/mcp/onboarding')).status).toBe(405);
            expect((await request(app).delete('/api/mcp/onboarding')).status).toBe(405);
        });
    });
});
