/**
 * gasTank/policyAdmin — la política de patrocinio vista y editada desde el panel.
 */
const mockQuery = jest.fn();
jest.mock('../../db/pool', () => ({ query: (...a) => mockQuery(...a) }));

const { ethers } = require('ethers');
const admin = require('../../services/gasTank/policyAdmin');
const policy = require('../../services/gasTank/policy');

const ORG = '11111111-1111-1111-1111-111111111111';
const DESTINO = '0x' + '2'.repeat(40);
const BEZ = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
const SEL = '0xa9059cbb';

const fila = (extra = {}) => ({
    organization_id: ORG, active: true, max_cost_credits_per_op: '5000', daily_cap_credits: null, require_verified: true,
    allowed_targets: [{ address: ethers.getAddress(DESTINO), selectors: [SEL], label: 'Mi contrato' }],
    verification_status: 'verified', updated_at: '2026-10-24T10:00:00Z', ...extra,
});

/** loadPolicy hace un JOIN con organizations; el resto de consultas se anotan. */
function base({ politica = null, verificacion = 'verified' } = {}) {
    mockQuery.mockReset();
    mockQuery.mockImplementation(async (sql) => {
        if (/FROM gas_tank_policies p JOIN organizations/.test(sql)) return { rows: politica ? [politica] : [] };
        if (/SELECT verification_status FROM organizations/.test(sql)) return { rows: [{ verification_status: verificacion }] };
        return { rows: [] };
    });
}

describe('validate', () => {
    it('normaliza direcciones y acepta selector o firma de función', () => {
        const v = admin.validate({ allowedTargets: [{ address: DESTINO, selectors: ['transfer(address, uint256)', '0xA9059CBB'] }] });
        expect(v.allowedTargets).toEqual([{ address: ethers.getAddress(DESTINO), selectors: [SEL] }]);
    });

    it('rechaza patrocinar el token BEZ como destino normal', () => {
        expect(() => admin.validate({ allowedTargets: [{ address: BEZ, selectors: [SEL] }] }))
            .toThrow(/token BEZ, la bóveda/);
    });

    it('rechaza también la bóveda, el EntryPoint y el paymaster configurados', () => {
        const env = { GAS_TANK_VAULT: '0x' + '3'.repeat(40), GAS_TANK_ENTRYPOINT: '0x' + '4'.repeat(40), GAS_TANK_PAYMASTER: '0x' + '5'.repeat(40) };
        for (const a of Object.values(env)) {
            expect(() => admin.validate({ allowedTargets: [{ address: a, selectors: [SEL] }] }, { env })).toThrow(admin.PolicyInputError);
        }
    });

    it('rechaza contratos repetidos, sin funciones o con funciones mal escritas', () => {
        expect(() => admin.validate({ allowedTargets: [{ address: DESTINO, selectors: [SEL] }, { address: DESTINO, selectors: [SEL] }] })).toThrow(/repetido/);
        expect(() => admin.validate({ allowedTargets: [{ address: DESTINO, selectors: [] }] })).toThrow(/al menos una función/);
        expect(() => admin.validate({ allowedTargets: [{ address: DESTINO, selectors: ['transferir'] }] })).toThrow(/Función no válida/);
    });

    it('los topes tienen límites: hasta 1.000 € por operación y 10.000 € al día', () => {
        expect(() => admin.validate({ maxCostCreditsPerOp: 0 })).toThrow(/tope por operación/);
        expect(() => admin.validate({ maxCostCreditsPerOp: admin.MAX_COST_PER_OP_CREDITS + 1 })).toThrow(/tope por operación/);
        expect(() => admin.validate({ dailyCapCredits: admin.MAX_DAILY_CAP_CREDITS + 1 })).toThrow(/tope diario/);
        expect(admin.validate({ dailyCapCredits: null })).toEqual({ dailyCapCredits: null });
    });

    it('exigir KYB no se puede cambiar desde el panel', () => {
        expect(() => admin.validate({ requireVerified: false })).toThrow(/KYB/);
    });
});

describe('plantillas', () => {
    it('la de RWA usa el selector real de tokenizeAsset y la fábrica de activos', () => {
        const t = admin.TEMPLATES.find((x) => x.id === 'rwa-activos');
        const iface = new ethers.Interface(['function tokenizeAsset(string name, uint8 category, string legalCID, string imagesCID, uint256 supply, uint256 valuationUSD, uint256 pricePerFraction, uint256 estimatedYield, string location) returns (uint256)']);
        expect(t.targets[0].selectors).toEqual([iface.getFunction('tokenizeAsset').selector]);
        expect(t.targets[0].address).toBe('0xa7e6656eFA45EB59ca247aa15F883330692C0d9A');
        expect(t.targets[0].maxFeeBez).toBe(100);
    });

    it('cada plantilla pasa la validación del panel', () => {
        for (const t of admin.TEMPLATES) expect(() => admin.validate({ allowedTargets: t.targets })).not.toThrow();
    });
});

describe('getPolicy / savePolicy', () => {
    it('sin fila devuelve la política por defecto inactiva', async () => {
        base({ verificacion: 'pending' });
        const p = await admin.getPolicy(ORG);
        expect(p).toMatchObject({ active: false, allowedTargets: [], maxCostCreditsPerOp: 5000, exists: false, verificationStatus: 'pending' });
    });

    it('no deja activar una política sin contratos', async () => {
        base();
        await expect(admin.savePolicy(ORG, { active: true })).rejects.toThrow(/al menos un contrato/);
        expect(mockQuery.mock.calls.some((c) => /INSERT INTO gas_tank_policies/.test(c[0]))).toBe(false);
    });

    it('el tope diario no puede ser menor que el de una operación', async () => {
        base({ politica: fila() });
        await expect(admin.savePolicy(ORG, { dailyCapCredits: 100 })).rejects.toThrow(/menor que el tope por operación/);
    });

    it('guarda con UPSERT conservando lo que no cambia, y nunca toca require_verified', async () => {
        base({ politica: fila() });
        await admin.savePolicy(ORG, { maxCostCreditsPerOp: 8000 });
        const ins = mockQuery.mock.calls.find((c) => /INSERT INTO gas_tank_policies/.test(c[0]));
        expect(ins[0]).toMatch(/ON CONFLICT \(organization_id\) DO UPDATE/);
        expect(ins[0]).not.toMatch(/require_verified/);
        expect(ins[1]).toEqual([ORG, JSON.stringify(fila().allowed_targets), 8000, null, true]);
    });
});

describe('simulate', () => {
    const prices = { getPolEur: jest.fn().mockResolvedValue(0.2), getBezEur: jest.fn().mockResolvedValue(0.05) };
    const ledger = { getBalance: jest.fn().mockResolvedValue({ balanceCredits: 50_000, reservedCredits: 0 }) };

    it('una llamada permitida con saldo es patrocinable y calcula el coste como el patrocinio real', async () => {
        base({ politica: fila() });
        const r = await admin.simulate(ORG, { calls: [{ target: DESTINO, selector: SEL }], gasUsed: 300000, gasPriceGwei: 40 }, { prices, ledger });
        expect(r.patrocinable).toBe(true);
        expect(r.llamadas[0]).toMatchObject({ permitida: true, regla: 'Mi contrato' });
        const cfg = require('../../config/gas-tank');
        expect(r.coste.credits).toBe(cfg.operationCostCredits({ gasUsed: 300000, gasPriceGwei: 40, polEur: 0.2 }));
        expect(mockQuery.mock.calls.some((c) => /gas_tank_reservations[\s\S]*INSERT|INSERT INTO gas_tank_reservations/.test(c[0]))).toBe(false);
    });

    it('explica cada motivo de rechazo', async () => {
        base({ politica: fila({ verification_status: 'pending', max_cost_credits_per_op: '1' }) });
        const pobre = { getBalance: jest.fn().mockResolvedValue({ balanceCredits: 0, reservedCredits: 0 }) };
        const r = await admin.simulate(ORG, { calls: [{ target: '0x' + '9'.repeat(40), selector: SEL }] }, { prices, ledger: pobre });
        expect(r.patrocinable).toBe(false);
        expect(r.motivos.map((m) => m.code)).toEqual(expect.arrayContaining(['ORG_NOT_VERIFIED', 'TARGET_NOT_ALLOWED', 'COST_ABOVE_POLICY', 'INSUFFICIENT_BALANCE']));
    });

    it('sin precio de POL no inventa un coste', async () => {
        base({ politica: fila() });
        const sinPrecio = { getPolEur: jest.fn().mockRejectedValue(Object.assign(new Error('Sin precio'), { code: 'NO_POL_PRICE' })) };
        const r = await admin.simulate(ORG, { calls: [{ target: DESTINO, selector: SEL }] }, { prices: sinPrecio, ledger });
        expect(r.coste).toBeNull();
        expect(r.motivos.map((m) => m.code)).toContain('NO_POL_PRICE');
    });

    it('el token BEZ suelto sale como destino reservado', async () => {
        base({ politica: fila() });
        const r = await admin.simulate(ORG, { calls: [{ target: BEZ, selector: SEL }] }, { prices, ledger });
        expect(r.motivos.map((m) => m.code)).toContain('RESERVED_TARGET');
    });

    it('la misma regla que usa el patrocinio real decide si se permite', () => {
        expect(policy.ruleFor(fila(), DESTINO, SEL)).toBeTruthy();
        expect(policy.ruleFor(fila(), DESTINO, '0x12345678')).toBeNull();
    });
});

describe('listApps', () => {
    it('lista las apps de la organización con su URL ERC-7677, nunca la clave', async () => {
        mockQuery.mockReset().mockResolvedValue({ rows: [
            { id: 'a1', app_name: 'tienda', scopes: ['wallet', 'gas'], is_active: true },
            { id: 'a2', app_name: 'erp', scopes: ['wallet'], is_active: true },
        ] });
        const apps = await admin.listApps(ORG, { apiUrl: 'https://api.bezhas.com/' });
        expect(apps[0]).toEqual({
            id: 'a1', nombre: 'tienda', activa: true, scopeGas: true,
            paymasterUrl: 'https://api.bezhas.com/api/rpc/paymaster',
            paymasterUrlConClave: 'https://api.bezhas.com/api/rpc/paymaster/<api-key>',
        });
        expect(apps[1].scopeGas).toBe(false);
        expect(JSON.stringify(apps)).not.toMatch(/api_key_hash/);
    });
});
