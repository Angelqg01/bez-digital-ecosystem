/**
 * Nonces SIWE en Redis: emitidos en una instancia, consumibles en otra, un solo uso,
 * y sin caída silenciosa a memoria cuando Redis está configurado pero no responde.
 */
const { Wallet } = require('ethers');

// Redis simulado y compartido entre "instancias" (módulos cargados por separado).
const mockRedisData = new Map();
const mockRedis = {
    set: async (k, v) => { mockRedisData.set(k, v); return 'OK'; },
    multi: () => {
        const ops = [];
        const chain = {
            get: (k) => { ops.push(() => mockRedisData.get(k) || null); return chain; },
            del: (k) => { ops.push(() => mockRedisData.delete(k)); return chain; },
            exec: async () => ops.map((f) => [null, f()]),
        };
        return chain;
    },
};
const mockRedisService = { getConnection: jest.fn() };
jest.mock('../../services/redis.service', () => mockRedisService);

const ENV = { ...process.env };
const loadStore = () => { let s; jest.isolateModules(() => { s = require('../../services/walletNonceStore'); }); return s; };

beforeEach(() => {
    mockRedisData.clear();
    mockRedisService.getConnection.mockReset();
    mockRedisService.getConnection.mockResolvedValue(mockRedis);
    process.env = { ...ENV };
    delete process.env.REDIS_URL; delete process.env.REDIS_HOST; delete process.env.REDIS_PORT; delete process.env.WALLET_AUTH_REQUIRE_REDIS;
});
afterAll(() => { process.env = ENV; });

const ADDR = Wallet.createRandom().address.toLowerCase();

describe('sin Redis configurado: memoria del proceso', () => {
    test('un solo uso y no toca Redis', async () => {
        const s = loadStore();
        await s.put('abcdefgh12345678', ADDR, 60000);
        expect(await s.take('abcdefgh12345678')).toBe(ADDR);
        expect(await s.take('abcdefgh12345678')).toBeNull();
        expect(mockRedisService.getConnection).not.toHaveBeenCalled();
    });

    test('caducado → null', async () => {
        const s = loadStore();
        await s.put('abcdefgh12345678', ADDR, -1);
        expect(await s.take('abcdefgh12345678')).toBeNull();
    });

    test('WALLET_AUTH_REQUIRE_REDIS=true sin Redis → 503', async () => {
        process.env.WALLET_AUTH_REQUIRE_REDIS = 'true';
        await expect(loadStore().put('abcdefgh12345678', ADDR, 1000)).rejects.toMatchObject({ status: 503 });
    });
});

describe('con Redis configurado', () => {
    beforeEach(() => { process.env.REDIS_URL = 'redis://x'; });

    test('instancia A emite, instancia B consume, y solo una vez', async () => {
        const a = loadStore();
        const b = loadStore();
        await a.put('abcdefgh12345678', ADDR, 60000);
        expect(a._memory.size).toBe(0);
        expect(await b.take('abcdefgh12345678')).toBe(ADDR);
        expect(await a.take('abcdefgh12345678')).toBeNull();
    });

    test('Redis caído → 503, sin caer a memoria', async () => {
        mockRedisService.getConnection.mockResolvedValue(null);
        const s = loadStore();
        await expect(s.put('abcdefgh12345678', ADDR, 1000)).rejects.toMatchObject({ status: 503 });
        await expect(s.take('abcdefgh12345678')).rejects.toMatchObject({ status: 503 });
        expect(s._memory.size).toBe(0);
    });

    test('nonce con formato inválido se rechaza sin consultar Redis', async () => {
        const s = loadStore();
        expect(await s.take('../../x')).toBeNull();
        expect(await s.take(undefined)).toBeNull();
        expect(mockRedisService.getConnection).not.toHaveBeenCalled();
    });
});
