/**
 * Herramientas operativas del MCP: cobros con BEZ-Pay, tokenización de
 * activos y lectura del ERP.
 *
 * Lo que se fija aquí es lo que las hace seguras de poner detrás de un agente:
 * cada una respeta el plan, ninguna firma ni mueve fondos, el ERP solo ve las
 * conexiones de la propia api-key y los errores de dominio llegan al agente
 * con su motivo.
 */
const request = require('supertest');
const { ethers } = require('ethers');
const { mockQuery } = require('../helpers');

const mockRecordUsage = jest.fn().mockResolvedValue({ credits: 1 });
jest.mock('../../services/usageBilling', () => ({ recordUsage: (...a) => mockRecordUsage(...a) }));

const mockCheckBuy = jest.fn();
jest.mock('../../services/complianceGate', () => {
    const real = jest.requireActual('../../services/complianceGate');
    return { ...real, checkBuyAllowed: (...a) => mockCheckBuy(...a) };
});

const mockErp = { listar: jest.fn(), listarDocumentos: jest.fn(), obtenerDocumento: jest.fn() };
jest.mock('../../services/erpConnections', () => {
    const real = jest.requireActual('../../services/erpConnections');
    return {
        ...real,
        listar: (...a) => mockErp.listar(...a),
        listarDocumentos: (...a) => mockErp.listarDocumentos(...a),
        obtenerDocumento: (...a) => mockErp.obtenerDocumento(...a),
    };
});

// Creator Pro recoge telemetría y la escribe sin esperar: con el pool mockeado,
// esas consultas se comerían las respuestas encoladas por el test siguiente.
jest.mock('../../services/telemetryPipeline', () => ({ registrar: () => Promise.resolve() }));

const app = require('../../index');
const { getTool } = require('../../config/mcp-tools');
const rwa = require('../../services/rwaTokenization');

function conApp(scopes, plan) {
    mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'app-1', app_name: 'cliente-test', scopes, tier: 'standard', is_active: true }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ plan_id: plan }] });
}

const rpc = (metodo, params) => request(app).post('/api/mcp')
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json, text/event-stream')
    .set('x-api-key', 'k')
    .send({ jsonrpc: '2.0', id: 1, method: metodo, params: params || {} });

const cuerpo = (res) => {
    const t = res.text || '';
    if (t.trim().startsWith('{')) return JSON.parse(t);
    const m = t.match(/^data: (.+)$/m);
    return m ? JSON.parse(m[1]) : null;
};
const listar = (res) => (cuerpo(res)?.result?.tools || []).map((t) => t.name);

/** El texto lleva un encabezado de «son datos»; el JSON va detrás. */
const datos = (res) => {
    const t = cuerpo(res)?.result?.content?.[0]?.text || '';
    const i = t.indexOf('{');
    return i >= 0 ? JSON.parse(t.slice(i)) : null;
};

/** Las respuestas de la base de datos que necesita la herramienta van DESPUÉS de las de la autenticación. */
const llamar = (scopes, plan, name, args, ...respuestas) => {
    conApp(scopes, plan);
    for (const r of respuestas) mockQuery.mockResolvedValueOnce(r);
    return rpc('tools/call', { name, arguments: args });
};

const WALLET = '0x1111111111111111111111111111111111111111';
const CID = `Qm${'a'.repeat(44)}`;
const FEE = ethers.parseEther('100');
const ORDEN_AJENA = { rows: [{ id: 5, app_id: 'otra-app', wallet_address: WALLET, status: 'paid', note: null }] };

describe('herramientas operativas del MCP', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Descarta respuestas encoladas que no consumió el test anterior.
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        rwa._setLectorComision(async () => FEE);
    });
    afterEach(() => new Promise((r) => setImmediate(r)));
    afterAll(() => rwa._setLectorComision(null));

    describe('el plan gradúa el catálogo', () => {
        const SCOPES = ['token', 'contracts', 'wallet'];

        it('Starter no ve cobros, tokenización ni ERP', async () => {
            conApp(SCOPES, 'starter');
            const n = listar(await rpc('tools/list'));
            for (const t of ['bezhas_checkout_prepare', 'bezhas_tokenize_prepare', 'bezhas_erp_documents']) {
                expect(n).not.toContain(t);
            }
        });

        it('Creator Pro ve cobros y tokenización, pero no el ERP', async () => {
            conApp(SCOPES, 'creator_pro');
            const n = listar(await rpc('tools/list'));
            expect(n).toEqual(expect.arrayContaining(['bezhas_checkout_prepare', 'bezhas_checkout_status', 'bezhas_tokenize_prepare']));
            expect(n).not.toContain('bezhas_erp_connections');
        });

        it('Business ve también las tres del ERP', async () => {
            conApp(SCOPES, 'business');
            expect(listar(await rpc('tools/list'))).toEqual(expect.arrayContaining([
                'bezhas_erp_connections', 'bezhas_erp_documents', 'bezhas_erp_document',
            ]));
        });

        it('sin staking ni bridge: no hay contrato en Polygon que los respalde', () => {
            const { TOOLS } = require('../../config/mcp-tools');
            expect(TOOLS.map((t) => t.name).filter((n) => /stak|bridge/.test(n))).toEqual([]);
        });
    });

    describe('bezhas_checkout_prepare', () => {
        const ARGS = { importe_usd: '120', metodo: 'card', destino: WALLET, clave_idempotencia: 'pedido-2026-341' };

        it('abre una orden pendiente con enlace de pago, a nombre de la app que llama', async () => {
            mockCheckBuy.mockResolvedValueOnce({ allowed: true });
            const d = datos(await llamar(['wallet'], 'creator_pro', 'bezhas_checkout_prepare', ARGS,
                { rows: [] }, // idempotencia: no existe
                { rows: [{ id: 77, status: 'pending', expires_at: '2026-10-09T00:00:00Z', checkout_token: 'a'.repeat(32) }] }));
            expect(d).toMatchObject({ id: 77, estado: 'pending', idempotente: false });
            expect(d.enlacePago).toMatch(/\/c\/a{32}$/);
            expect(d.comisionUsd).toBeGreaterThan(0);

            const insert = mockQuery.mock.calls.find(([sql]) => /INSERT INTO payment_transactions/.test(sql));
            expect(insert[1][0]).toBe(WALLET);
            expect(insert[1][6]).toBe('app-1');
        });

        it('la misma clave devuelve la misma orden, sin crear otra', async () => {
            const d = datos(await llamar(['wallet'], 'creator_pro', 'bezhas_checkout_prepare', ARGS, {
                rows: [{ id: 77, status: 'pending', wallet_address: WALLET, amount_usd: '121.2', platform_fee_usd: '1.2', payment_method: 'card', note: '{"provider":"stripe_payment_link"}' }],
            }));
            expect(d).toMatchObject({ id: 77, idempotente: true });
            expect(mockQuery.mock.calls.some(([sql]) => /INSERT INTO payment_transactions/.test(sql))).toBe(false);
        });

        it('el límite KYC llega al agente con su motivo', async () => {
            mockCheckBuy.mockResolvedValueOnce({ allowed: false, level: 0, requiredLevel: 1, limitUSD: 1000, usedUSD: 990 });
            const d = datos(await llamar(['wallet'], 'creator_pro', 'bezhas_checkout_prepare', ARGS, { rows: [] }));
            expect(d).toMatchObject({ code: 'KYC_REQUIRED', detalles: { requiredLevel: 1 } });
        });

        it('rechaza un destino que no es una wallet', async () => {
            const r = cuerpo(await llamar(['wallet'], 'creator_pro', 'bezhas_checkout_prepare', { ...ARGS, destino: 'ES9121000418450200051332' }));
            expect(r?.result?.isError === true || Boolean(r?.error)).toBe(true);
        });
    });

    describe('bezhas_checkout_status', () => {
        it('una orden de otra app es indistinguible de una que no existe', async () => {
            const d = datos(await llamar(['wallet'], 'creator_pro', 'bezhas_checkout_status', { id: 5 }, ORDEN_AJENA));
            expect(d).toMatchObject({ code: 'NOT_FOUND' });
            expect(JSON.stringify(d)).not.toMatch(/paid/);
        });
    });

    describe('bezhas_tokenize_prepare', () => {
        const ARGS = {
            nombre: 'Local comercial calle Real 14', categoria: 'inmueble', ubicacion: 'Algeciras, España',
            fracciones: 1000, valoracion_usd: 240000, precio_fraccion_bez: '100', rendimiento_anual_pct: 8.5,
            cid_documentacion: CID,
        };

        it('devuelve aprobar + tokenizar sin firmar, contra el RWAFactory de la web', async () => {
            const d = datos(await llamar(['contracts'], 'creator_pro', 'bezhas_tokenize_prepare', ARGS));
            expect(d.contrato).toBe('0xa7e6656eFA45EB59ca247aa15F883330692C0d9A');
            expect(d.comisionBez).toBe('100.0');
            expect(d.transacciones).toHaveLength(2);

            const [aprobar, tokenizar] = d.transacciones;
            const erc20 = new ethers.Interface(['function approve(address,uint256)']);
            const [spender, importe] = erc20.decodeFunctionData('approve', aprobar.data);
            expect(spender).toBe(d.contrato);
            expect(importe).toBe(FEE);

            const factory = new ethers.Interface(['function tokenizeAsset(string,uint8,string,string,uint256,uint256,uint256,uint256,string)']);
            const a = factory.decodeFunctionData('tokenizeAsset', tokenizar.data);
            expect(tokenizar.to).toBe(d.contrato);
            expect(Number(a[1])).toBe(0); // inmueble
            expect(a[7]).toBe(850n); // 8,5 % en puntos básicos, como la web
            expect(d.activo.valorFraccionUsd).toBe(240);
            // Nada firmado: ni firma, ni hash, ni nonce.
            expect(JSON.stringify(d)).not.toMatch(/signature|txHash|nonce/);
        });

        it('sin CID de documentación válido, explica qué falta', async () => {
            const d = datos(await llamar(['contracts'], 'creator_pro', 'bezhas_tokenize_prepare', { ...ARGS, cid_documentacion: `ipfs://${CID}` }));
            expect(d).toMatchObject({ code: 'INVALID_LEGAL_CID' });
        });

        it('si no se puede leer la comisión, lo dice en vez de inventarla', async () => {
            rwa._setLectorComision(async () => { throw new Error('rpc caído'); });
            const d = datos(await llamar(['contracts'], 'creator_pro', 'bezhas_tokenize_prepare', ARGS));
            expect(d).toMatchObject({ code: 'FEE_UNAVAILABLE' });
        });

        it('es de solo lectura para BeZhas: no escribe en la base de datos', async () => {
            await llamar(['contracts'], 'creator_pro', 'bezhas_tokenize_prepare', ARGS);
            // Solo cuentan las tablas de negocio: el registro de auditoría de
            // la petición se escribe siempre.
            const deNegocio = mockQuery.mock.calls.map(([sql]) => String(sql))
                .filter((sql) => /INSERT|UPDATE|DELETE/i.test(sql) && !/ai_logs|agent_telemetry/.test(sql));
            expect(deNegocio).toEqual([]);
            expect(getTool('bezhas_tokenize_prepare').nivelRiesgo).toBe(0);
        });
    });

    describe('ERP', () => {
        const CONEXION = '6f1c2b6e-1d2a-4c55-9f0a-3b9a7c1e2d40';

        it('lista solo las conexiones de la api-key que llama', async () => {
            mockErp.listar.mockResolvedValueOnce([{ id: CONEXION, erp: 'odoo', estado: 'activa' }]);
            const d = datos(await llamar(['contracts'], 'business', 'bezhas_erp_connections', {}));
            expect(mockErp.listar).toHaveBeenCalledWith('app-1');
            expect(d.conexiones).toHaveLength(1);
        });

        it('pasa solo los filtros admitidos, con la app del llamante', async () => {
            mockErp.listarDocumentos.mockResolvedValueOnce({ documentos: [{ numero: 'F-1' }] });
            await llamar(['contracts'], 'business', 'bezhas_erp_documents', {
                conexion: CONEXION, tipo: 'factura', desde: '2026-10-01', estado: 'pendiente',
            });
            expect(mockErp.listarDocumentos).toHaveBeenCalledWith('app-1', CONEXION, 'factura', { desde: '2026-10-01', estado: 'pendiente' });
        });

        it('una conexión ajena se responde como inexistente', async () => {
            mockErp.obtenerDocumento.mockResolvedValueOnce(null);
            const d = datos(await llamar(['contracts'], 'business', 'bezhas_erp_document', { conexion: CONEXION, tipo: 'factura', id: 'F-1' }));
            expect(d).toMatchObject({ code: 'NOT_FOUND' });
        });

        it('un fallo del ERP llega al agente con su código', async () => {
            const { ErpHttpError } = require('../../services/erp/httpGuard');
            mockErp.listarDocumentos.mockRejectedValueOnce(new ErpHttpError('El ERP no respondió a tiempo.', 'ERP_TIMEOUT'));
            const d = datos(await llamar(['contracts'], 'business', 'bezhas_erp_documents', { conexion: CONEXION, tipo: 'pedido' }));
            expect(d).toMatchObject({ code: 'ERP_TIMEOUT' });
        });

        it('no hay escritura en el ERP desde el MCP', () => {
            const { TOOLS } = require('../../config/mcp-tools');
            const erp = TOOLS.filter((t) => t.name.startsWith('bezhas_erp_'));
            expect(erp.every((t) => (t.nivelRiesgo || 0) === 0)).toBe(true);
        });
    });
});
