const request = require('supertest');
const jwt = require('jsonwebtoken');
const { makeAdminToken } = require('../helpers');
const app = require('../../index');
const sponsor = require('../../services/adminSponsor');

const superAdmin = () => jwt.sign(
    { role: 'SUPER_ADMIN', wallet: '0x' + '1'.repeat(40) },
    process.env.JWT_SECRET,
    { expiresIn: '1h', issuer: 'bezhas-admin-auth' },
);
const auth = () => ({ Authorization: `Bearer ${superAdmin()}` });

// La suite corre con NODE_ENV=production: sin esto la cadena por defecto (2708)
// no tiene despliegue local y 31337 no estaría permitida.
beforeAll(() => {
    process.env.BEZHAS_CHAIN_ID = '31337';
    process.env.ALLOWED_CHAIN_IDS = '31337';
});

describe('Routes: /api/admin/console', () => {
    describe('sin sesión SuperAdmin', () => {
        it.each([
            ['get', '/catalog'], ['get', '/health'], ['get', '/sponsor/status'],
            ['post', '/session'], ['post', '/sponsor/execute'], ['post', '/contracts/read'],
            ['get', '/knowledge?q=token'], ['get', '/rwa'],
        ])('%s %s → 401', async (m, p) => {
            const res = await request(app)[m](`/api/admin/console${p}`).send({});
            expect(res.status).toBe(401);
        });

        it('un JWT de usuario con role admin no abre la consola', async () => {
            const res = await request(app).get('/api/admin/console/catalog')
                .set('Authorization', `Bearer ${makeAdminToken()}`);
            expect(res.status).toBe(401);
        });
    });

    describe('con sesión SuperAdmin', () => {
        it('RAG local: devuelve fragmentos de docs/ sin llamar a ningún LLM', async () => {
            const res = await request(app).get('/api/admin/console/knowledge?q=OPERANT%20plan%20Business').set(auth());
            expect(res.status).toBe(200);
            expect(res.body.indexados).toBeGreaterThan(0);
            expect(res.body.fragmentos[0]).toHaveProperty('archivo');
        });

        it('RAG: q vacía o enorme → 400', async () => {
            const a = await request(app).get('/api/admin/console/knowledge?q=a').set(auth());
            const b = await request(app).get(`/api/admin/console/knowledge?q=${'x'.repeat(301)}`).set(auth());
            expect([a.status, b.status]).toEqual([400, 400]);
        });

        it('lista servicios y sectores', async () => {
            const res = await request(app).get('/api/admin/console/catalog').set(auth());
            expect(res.status).toBe(200);
            expect(res.body.servicios.length).toBeGreaterThan(10);
            expect(res.body.contratos).toHaveProperty('sectores');
        });

        it('emite un token de sector de 30 min con role admin', async () => {
            const res = await request(app).post('/api/admin/console/session').set(auth());
            expect(res.status).toBe(200);
            const dec = jwt.verify(res.body.token, process.env.JWT_SECRET);
            expect(dec.role).toBe('admin');
            expect(dec.exp - dec.iat).toBe(1800);
        });

        it('rechaza un contrato fuera del despliegue', async () => {
            const res = await request(app).post('/api/admin/console/sponsor/execute').set(auth())
                .send({ contract: 'NoExiste', method: 'pause', args: [] });
            expect(res.status).toBe(404);
            expect(res.body.code).toBe('CONTRACT_UNKNOWN');
        });

        it('rechaza una dirección libre en lugar de nombre', async () => {
            const res = await request(app).post('/api/admin/console/sponsor/execute').set(auth())
                .send({ contract: '0x' + 'a'.repeat(40), method: 'pause', args: [] });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('CONTRACT_INVALID');
        });

        it('veta transferOwnership aunque el contrato exista', async () => {
            const res = await request(app).post('/api/admin/console/sponsor/execute').set(auth())
                .send({ contract: 'BEZCoinV2', method: 'transferOwnership', args: ['0x' + 'b'.repeat(40)] });
            expect(res.status).toBe(403);
            expect(res.body.code).toBe('METHOD_FORBIDDEN');
        });
    });
});

describe('adminSponsor.validarPeticion', () => {
    const abi = [
        { type: 'function', name: 'ping', inputs: [], outputs: [], stateMutability: 'nonpayable' },
        { type: 'function', name: 'fund', inputs: [], outputs: [], stateMutability: 'payable' },
    ];
    const loader = () => abi;
    const dev = { NODE_ENV: 'development', BEZHAS_CHAIN_ID: '31337' };

    it('acepta un método nonpayable del despliegue en la cadena configurada', () => {
        const v = sponsor.validarPeticion({ contrato: 'BEZCoinV2', metodo: 'ping', args: [] }, dev, loader);
        expect(v.chainId).toBe(31337);
        expect(v.direccion).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('rechaza métodos payable', () => {
        expect(() => sponsor.validarPeticion({ contrato: 'BEZCoinV2', metodo: 'fund', args: [] }, dev, loader))
            .toThrow(/payable/);
    });

    it('rechaza otra cadena distinta de la configurada', () => {
        expect(() => sponsor.validarPeticion({ contrato: 'BEZCoinV2', metodo: 'ping', args: [], chainId: 97 }, dev, loader))
            .toThrow(/configurada/);
    });

    it('mantiene mainnet cerrada salvo opt-in explícito', () => {
        const prod = { NODE_ENV: 'production', BEZHAS_CHAIN_ID: '137', ALLOWED_CHAIN_IDS: '137' };
        expect(() => sponsor.validarPeticion({ contrato: 'BEZCoinV2', metodo: 'ping', args: [] }, prod, loader))
            .toThrow();
    });
});
