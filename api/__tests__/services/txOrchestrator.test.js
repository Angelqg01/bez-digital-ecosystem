/**
 * Ciclo de vida completo de una operación con fondos, con dobles en los bordes
 * (base de datos, RPC, firmante) y el código real en medio: normalizador,
 * simulador, riesgo, política, aprobaciones EIP-712.
 */
require('../helpers');
const { ethers } = require('ethers');
const { crearOrquestador } = require('../../services/txOrchestrator');
const txApproval = require('../../services/txApproval');
const txSimulator = require('../../services/txSimulator');
const { getEntitlements } = require('../../config/plan-entitlements');

const ERC20 = txSimulator.ERC20;
const tesoreria = ethers.Wallet.createRandom();
const aprobadores = [ethers.Wallet.createRandom(), ethers.Wallet.createRandom(), ethers.Wallet.createRandom()];
const DESTINO = ethers.Wallet.createRandom().address;
const WALLET_CLIENTE = ethers.Wallet.createRandom().address;

function repoMemoria() {
    const filas = new Map();
    const firmas = [];
    return {
        filas,
        destinoEstado: 'active',
        async buscarPorIdempotencia(appId, k) { return [...filas.values()].find((f) => f.app_id === appId && f.idempotency_key === k) || null; },
        async insertar(f) {
            if ([...filas.values()].some((x) => x.app_id === f.app_id && x.idempotency_key === f.idempotency_key)) return null;
            const r = { ...f, created_at: new Date() };
            filas.set(f.id, r);
            return r;
        },
        async obtener(id) { return filas.get(id) || null; },
        async actualizar(id, cambios, { siEstado } = {}) {
            const f = filas.get(id);
            if (!f || (siEstado && f.status !== siEstado)) return null;
            Object.assign(f, cambios);
            return f;
        },
        async uso() { return { diaEur: 0, mesEur: 0, operacionesUltimaHora: 0, mediaEur30d: 0, agenteDiaEur: 0, cercaDeUmbral24h: 0 }; },
        async destino() {
            return this.destinoEstado === 'unknown'
                ? { estado: 'unknown', conocido: false, horasDesdeAlta: null }
                : { estado: this.destinoEstado, conocido: true, horasDesdeAlta: 200 };
        },
        registrarDestino: jest.fn().mockResolvedValue({}),
        async kycNivel() { return 2; },
        async kybNivel() { return 2; },
        async precioToken() { return { priceUsd: 0.1, updatedAt: new Date() }; },
        async insertarAprobacion({ intentId, address, decision, signature }) {
            if (firmas.some((a) => a.intentId === intentId && a.address === address)) return false;
            firmas.push({ intentId, address, decision, signature });
            return true;
        },
        async aprobaciones(id) {
            return firmas.filter((a) => a.intentId === id).map((a) => ({ approver_address: a.address, decision: a.decision, signature: a.signature }));
        },
    };
}

/** RPC que responde saldo holgado y `transfer` → true. */
function quorumFalso() {
    const selectorSaldo = ERC20.getFunction('balanceOf').selector;
    return {
        redundante: true,
        comprobarCadena: jest.fn().mockResolvedValue(137),
        llamar: jest.fn(async (tx) => (tx.data.startsWith(selectorSaldo)
            ? ERC20.encodeFunctionResult('balanceOf', [ethers.parseUnits('1000000', 18)])
            : ERC20.encodeFunctionResult('transfer', [true]))),
        estimarGas: jest.fn().mockResolvedValue(60000n),
        nonce: jest.fn().mockResolvedValue(5),
        comisiones: jest.fn().mockResolvedValue({ maxFeePerGas: 50n * 10n ** 9n, maxPriorityFeePerGas: 30n * 10n ** 9n }),
        difundir: jest.fn().mockResolvedValue({ aceptadaPor: 2 }),
    };
}

/** Firmante que firma con la tesorería lo que le piden (el de verdad verifica; aquí no se prueba eso). */
function firmanteHonesto() {
    return {
        solicitarFirma: jest.fn(async ({ tx }) => {
            const firmada = await tesoreria.signTransaction({ type: 2, ...tx, value: 0n, gasLimit: BigInt(tx.gasLimit), maxFeePerGas: BigInt(tx.maxFeePerGas), maxPriorityFeePerGas: BigInt(tx.maxPriorityFeePerGas) });
            return { signedTx: firmada, txHash: ethers.Transaction.from(firmada).hash };
        }),
    };
}

function montar({ repo = repoMemoria(), quorum = quorumFalso(), firmante = firmanteHonesto(), estadoKs = 'NORMAL', env = {} } = {}) {
    const validos = new Set(aprobadores.map((w) => w.address.toLowerCase()));
    const killSwitch = { estado: estadoKs, estadoEfectivo: jest.fn(async function () { return { estado: killSwitch.estado }; }), elevar: jest.fn().mockResolvedValue({}) };
    const auditoria = { registrar: jest.fn().mockResolvedValue({}) };
    const orq = crearOrquestador({
        repo,
        killSwitch,
        auditoria,
        aprobacion: { ...txApproval, aprobadorValido: async (dir) => validos.has(dir) },
        simulador: txSimulator,
        quorumPara: () => quorum,
        firmante,
        fiat: () => null,
        fx: async () => ({ rate: 1.1 }),
        entitlementsPara: getEntitlements,
        env: { NODE_ENV: 'production', TX_TREASURY_ADDRESS: tesoreria.address, ...env },
        ahora: () => new Date(),
    });
    return { orq, repo, quorum, firmante, killSwitch, auditoria };
}

const APP = { id: 'app-1', scopes: ['wallet', 'treasury', 'payments'], enterpriseId: 'ent-1' };
let n = 0;
const clave = () => `clave-${Date.now()}-${n++}`;

function pagoTesoreria(extra = {}) {
    return {
        rail: 'crypto_transfer', asset: 'BEZ', amount: '1000', network: 'polygon',
        source: { type: 'bezhas_treasury' },
        destination: { type: 'evm_address', value: DESTINO, name: 'Proveedor SL' },
        counterparty: { legalName: 'Proveedor SL', country: 'ES' },
        purpose: 'supplier_payment', idempotencyKey: clave(), ...extra,
    };
}

async function firmar(orq, repo, v, w, decision = 'APPROVE') {
    const fila = repo.filas.get(v.id);
    const td = txApproval.datosTipados({ id: fila.id, app_id: fila.app_id, intent: fila.intent, intent_hash: fila.intent_hash, policy_hash: fila.policy_hash }, decision);
    return orq.aprobar({ id: v.id, app: APP, firma: await w.signTypedData(td.domain, td.types, td.message), decision });
}

describe('txOrchestrator', () => {
    it('tesorería: exige dos aprobaciones firmadas, firma fuera y difunde', async () => {
        const { orq, repo, quorum, firmante } = montar();
        const v = await orq.crearIntencion({ entrada: pagoTesoreria(), app: APP, plan: 'business' });
        expect(v.estado).toBe('awaiting_approval');
        expect(v.aprobacionesRequeridas).toBe(2);
        expect(v.aprobacion.datosTipados.message.amount).toBe('1000'); // el aprobador ve lo que firma

        await expect(orq.ejecutar({ id: v.id, app: APP, plan: 'business' })).rejects.toMatchObject({ code: 'INTENT_NOT_APPROVED' });

        const tras1 = await firmar(orq, repo, v, aprobadores[0]);
        expect(tras1.estado).toBe('awaiting_approval');
        const tras2 = await firmar(orq, repo, v, aprobadores[1]);
        expect(tras2.estado).toBe('approved');

        const hecha = await orq.ejecutar({ id: v.id, app: APP, plan: 'business' });
        expect(hecha.estado).toBe('broadcast');
        expect(hecha.txHash).toMatch(/^0x[0-9a-f]{64}$/);
        expect(firmante.solicitarFirma).toHaveBeenCalledTimes(1);
        expect(firmante.solicitarFirma.mock.calls[0][0].approvals).toHaveLength(2);
        expect(quorum.difundir).toHaveBeenCalledTimes(1);

        // Segunda ejecución: nada.
        await expect(orq.ejecutar({ id: v.id, app: APP, plan: 'business' })).rejects.toMatchObject({ code: 'INTENT_NOT_APPROVED' });
    });

    it('una firma de alguien que no es aprobador no cuenta', async () => {
        const { orq, repo } = montar();
        const v = await orq.crearIntencion({ entrada: pagoTesoreria(), app: APP, plan: 'business' });
        await expect(firmar(orq, repo, v, ethers.Wallet.createRandom())).rejects.toMatchObject({ code: 'APPROVER_NOT_AUTHORIZED' });
    });

    it('un rechazo firmado cierra la intención', async () => {
        const { orq, repo } = montar();
        const v = await orq.crearIntencion({ entrada: pagoTesoreria(), app: APP, plan: 'business' });
        expect((await firmar(orq, repo, v, aprobadores[0], 'REJECT')).estado).toBe('rejected');
    });

    it('si el firmante devuelve otra transacción, no se difunde y se eleva el kill switch', async () => {
        const trampa = {
            solicitarFirma: jest.fn(async ({ tx }) => {
                const otra = { ...tx, data: ERC20.encodeFunctionData('transfer', [ethers.Wallet.createRandom().address, 1n]) };
                const firmada = await tesoreria.signTransaction({ type: 2, ...otra, value: 0n, gasLimit: BigInt(tx.gasLimit), maxFeePerGas: BigInt(tx.maxFeePerGas), maxPriorityFeePerGas: BigInt(tx.maxPriorityFeePerGas) });
                return { signedTx: firmada, txHash: ethers.Transaction.from(firmada).hash };
            }),
        };
        const { orq, repo, quorum, killSwitch } = montar({ firmante: trampa });
        const v = await orq.crearIntencion({ entrada: pagoTesoreria(), app: APP, plan: 'business' });
        await firmar(orq, repo, v, aprobadores[0]);
        await firmar(orq, repo, v, aprobadores[1]);
        await expect(orq.ejecutar({ id: v.id, app: APP, plan: 'business' })).rejects.toMatchObject({ code: 'SIGNER_OUTPUT_MISMATCH' });
        expect(quorum.difundir).not.toHaveBeenCalled();
        expect(repo.filas.get(v.id).status).toBe('failed_needs_review');
        expect(killSwitch.elevar).toHaveBeenCalledWith(expect.objectContaining({ scope: 'global', estado: 'SUSPICIOUS' }));
    });

    it('en producción no firma con un único RPC', async () => {
        const quorum = { ...quorumFalso(), redundante: false };
        const { orq, repo } = montar({ quorum });
        const v = await orq.crearIntencion({ entrada: pagoTesoreria(), app: APP, plan: 'business' });
        await firmar(orq, repo, v, aprobadores[0]);
        await firmar(orq, repo, v, aprobadores[1]);
        await expect(orq.ejecutar({ id: v.id, app: APP, plan: 'business' })).rejects.toMatchObject({ code: 'RPC_NOT_REDUNDANT' });
        expect(repo.filas.get(v.id).status).toBe('approved'); // no se pierde: vuelve a aprobada
    });

    it('LOCKDOWN después de aprobar impide ejecutar', async () => {
        const { orq, repo, killSwitch } = montar();
        const v = await orq.crearIntencion({ entrada: pagoTesoreria(), app: APP, plan: 'business' });
        await firmar(orq, repo, v, aprobadores[0]);
        await firmar(orq, repo, v, aprobadores[1]);
        killSwitch.estado = 'LOCKDOWN';
        await expect(orq.ejecutar({ id: v.id, app: APP, plan: 'business' })).rejects.toMatchObject({ code: 'LOCKDOWN' });
    });

    it('sin estado del kill switch no se crea nada movible', async () => {
        const { orq } = montar({ estadoKs: 'UNKNOWN' });
        const v = await orq.crearIntencion({ entrada: pagoTesoreria(), app: APP, plan: 'business' });
        expect(v.estado).toBe('denied');
        expect(v.motivos.map((m) => m.code)).toContain('KILL_SWITCH_UNAVAILABLE');
    });

    it('custodia propia por debajo del umbral: lista para que firme la wallet del cliente', async () => {
        const { orq } = montar();
        const v = await orq.crearIntencion({
            entrada: {
                rail: 'crypto_transfer', asset: 'USDC', amount: '100', network: 'polygon',
                source: { type: 'evm_address', value: WALLET_CLIENTE },
                destination: { type: 'evm_address', value: DESTINO },
                purpose: 'invoice_payment', idempotencyKey: clave(),
            },
            app: APP, plan: 'business',
        });
        expect(v.decision).toBe('ALLOW');
        expect(v.estado).toBe('ready');
        expect(v.txSinFirmar.data).toBe(ERC20.encodeFunctionData('transfer', [DESTINO, 100n * 10n ** 6n]));
        await expect(orq.ejecutar({ id: v.id, app: APP, plan: 'business' })).rejects.toMatchObject({ code: 'SELF_CUSTODY' });
    });

    it('destino nuevo: pide aprobación y lo da de alta en enfriamiento', async () => {
        const repo = repoMemoria();
        repo.destinoEstado = 'unknown';
        const { orq } = montar({ repo });
        const v = await orq.crearIntencion({
            entrada: {
                rail: 'crypto_transfer', asset: 'USDC', amount: '100', network: 'polygon',
                source: { type: 'evm_address', value: WALLET_CLIENTE },
                destination: { type: 'evm_address', value: DESTINO },
                purpose: 'invoice_payment', idempotencyKey: clave(),
            },
            app: APP, plan: 'business',
        });
        expect(v.estado).toBe('awaiting_approval');
        expect(v.motivos.map((m) => m.code)).toContain('NEW_DESTINATION');
        expect(repo.registrarDestino).toHaveBeenCalled();
    });

    it('FIAT→FIAT con fondos del cliente por la cuenta propia: denegado por licencia', async () => {
        const { orq } = montar();
        const v = await orq.crearIntencion({
            entrada: {
                rail: 'fiat_to_fiat', asset: 'EUR', amount: '500', provider: 'sepa_ing_propia',
                source: { type: 'client_balance' },
                destination: { type: 'iban', value: 'DE89 3704 0044 0532 0130 00', name: 'Muster GmbH', country: 'DE' },
                purpose: 'supplier_payment', idempotencyKey: clave(),
            },
            app: APP, plan: 'enterprise_vip',
        });
        expect(v.estado).toBe('denied');
        expect(v.motivos.map((m) => m.code)).toContain('UNLICENSED_THIRD_PARTY_FUNDS');
    });

    it('FIAT→FIAT fuera del plan y pago a IBAN sin titular', async () => {
        const { orq } = montar();
        const v = await orq.crearIntencion({
            entrada: {
                rail: 'fiat_to_fiat', asset: 'EUR', amount: '500',
                source: { type: 'bezhas_treasury' },
                destination: { type: 'iban', value: 'ES9121000418450200051332' },
                purpose: 'supplier_payment', idempotencyKey: clave(),
            },
            app: APP, plan: 'business',
        });
        const codigos = v.motivos.map((m) => m.code);
        expect(codigos).toEqual(expect.arrayContaining(['RAIL_NOT_IN_PLAN', 'PAYEE_NAME_REQUIRED']));
    });

    it('idempotencia: misma clave y cuerpo devuelve la misma; otro cuerpo, 409', async () => {
        const { orq } = montar();
        const entrada = pagoTesoreria();
        const a = await orq.crearIntencion({ entrada, app: APP, plan: 'business' });
        const b = await orq.crearIntencion({ entrada, app: APP, plan: 'business' });
        expect(b.id).toBe(a.id);
        expect(b.idempotente).toBe(true);
        await expect(orq.crearIntencion({ entrada: { ...entrada, amount: '2000' }, app: APP, plan: 'business' }))
            .rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED', status: 409 });
    });

    it('agentes: su carril y su límite mandan, y sin canExecute no ejecutan', async () => {
        const { orq } = montar();
        const agente = { agentId: 'pagos', rails: ['fiat_to_crypto'], porOperacionEur: 10, canExecute: false };
        const v = await orq.crearIntencion({ entrada: pagoTesoreria(), app: APP, agente, plan: 'business' });
        expect(v.motivos.map((m) => m.code)).toContain('AGENT_RAIL_NOT_ALLOWED');
        await expect(orq.ejecutar({ id: v.id, app: APP, agente, plan: 'business' })).rejects.toMatchObject({ code: 'AGENT_CANNOT_EXECUTE' });
    });

    it('otro cliente no ve la intención', async () => {
        const { orq } = montar();
        const v = await orq.crearIntencion({ entrada: pagoTesoreria(), app: APP, plan: 'business' });
        await expect(orq.obtener({ id: v.id, app: { id: 'app-2', scopes: ['wallet'] } })).rejects.toMatchObject({ code: 'INTENT_NOT_FOUND', status: 404 });
    });
});
