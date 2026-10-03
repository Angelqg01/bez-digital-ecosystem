/**
 * Consentimiento OAuth: entrar con wallet, dar de alta al cliente nuevo y
 * crear su organización sin salir de la pantalla.
 *
 * Es lo que permite que alguien que llega desde ChatGPT o Codex sin cuenta
 * con contraseña termine autorizando el conector en vez de quedarse en el
 * login. Se fija que cada vía mantenga las reglas del login: sesión vigente,
 * intentos contados y firma o credenciales verificadas de verdad.
 */
const request = require('supertest');
const { ethers } = require('ethers');
const { mockQuery } = require('../helpers');
const app = require('../../index');

const TOKEN = 'b'.repeat(64);
const SESION = () => ({ rows: [{ id: 'code-1', status: 'pendiente', expires_at: new Date(Date.now() + 60_000), intentos_login: 0, user_id: null }] });
const SESION_CON_USUARIO = () => ({ rows: [{ id: 'code-1', status: 'pendiente', expires_at: new Date(Date.now() + 60_000), intentos_login: 0, user_id: 'user-n' }] });

const llamadas = (re) => mockQuery.mock.calls.filter(([sql]) => re.test(String(sql)));

describe('consentimiento OAuth: wallet, alta de cliente y organización', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    describe('la pantalla ofrece las tres vías', () => {
        it('trae «Entrar con wallet», el alta y la creación de organización', async () => {
            const res = await request(app).get(`/oauth/authorize/${TOKEN}`);
            expect(res.status).toBe(200);
            for (const id of ['b-wallet', 'f-reg', 'r-priv', 'f-org', 'a-registro']) expect(res.text).toContain(`id="${id}"`);
            expect(res.text).toContain('https://www.bezhas.com/privacy');
        });
    });

    describe('alta de cliente nuevo', () => {
        const ALTA = { email: '  Nuevo@Cliente.ES ', password: 'una-clave-larga', nombre: 'Marcos', aceptaPrivacidad: true };

        it('crea la cuenta, la deja identificada en la sesión y pide crear organización', async () => {
            mockQuery
                .mockResolvedValueOnce(SESION())
                .mockResolvedValueOnce({ rows: [] }) // el correo no existe
                .mockResolvedValueOnce({ rows: [{ id: 'user-n', email: 'nuevo@cliente.es', username: 'Marcos' }] });

            const res = await request(app).post(`/oauth/authorize/${TOKEN}/registro`).send(ALTA);
            expect(res.status).toBe(201);
            expect(res.body).toEqual({ organizaciones: [], nuevo: true });

            const [insert] = llamadas(/INSERT INTO users/);
            expect(insert[1][2]).toBe('nuevo@cliente.es');
            expect(insert[1][3]).toMatch(/^\$2[aby]\$12\$/); // bcrypt, nunca la contraseña
            expect(JSON.stringify(insert[1])).not.toContain('una-clave-larga');
            expect(llamadas(/SET user_id = \$2/)[0][1]).toEqual(['code-1', 'user-n']);
        });

        it('un correo con cuenta se manda a iniciar sesión, sin crear otra', async () => {
            mockQuery.mockResolvedValueOnce(SESION()).mockResolvedValueOnce({ rows: [{ 1: 1 }] });
            const res = await request(app).post(`/oauth/authorize/${TOKEN}/registro`).send(ALTA);
            expect(res.status).toBe(409);
            expect(res.body.error).toBe('email_taken');
            expect(llamadas(/INSERT INTO users/)).toHaveLength(0);
        });

        it('sin aceptar la privacidad no se crea nada', async () => {
            mockQuery.mockResolvedValueOnce(SESION());
            const res = await request(app).post(`/oauth/authorize/${TOKEN}/registro`).send({ ...ALTA, aceptaPrivacidad: false });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('privacy_required');
            expect(llamadas(/INSERT INTO users/)).toHaveLength(0);
        });

        it('rechaza una contraseña corta', async () => {
            mockQuery.mockResolvedValueOnce(SESION());
            const res = await request(app).post(`/oauth/authorize/${TOKEN}/registro`).send({ ...ALTA, password: 'corta' });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('weak_password');
        });

        it('una sesión caducada no admite altas', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'code-1', status: 'pendiente', expires_at: new Date(Date.now() - 1000), intentos_login: 0 }] });
            const res = await request(app).post(`/oauth/authorize/${TOKEN}/registro`).send(ALTA);
            expect(res.status).toBe(409);
            expect(llamadas(/INSERT INTO users/)).toHaveLength(0);
        });
    });

    describe('entrar con wallet', () => {
        const wallet = ethers.Wallet.createRandom();

        async function reto() {
            mockQuery.mockResolvedValueOnce(SESION());
            const r = await request(app).get(`/oauth/authorize/${TOKEN}/wallet/reto`).query({ address: wallet.address });
            expect(r.status).toBe(200);
            return r.body.message;
        }

        it('una wallet sin cuenta crea la cuenta al firmar el reto', async () => {
            const message = await reto();
            expect(message).toContain(wallet.address.toLowerCase());
            const signature = await wallet.signMessage(message);

            mockQuery
                .mockResolvedValueOnce(SESION())
                .mockResolvedValueOnce({ rows: [] }) // no hay usuario con esa wallet
                .mockResolvedValueOnce({ rows: [{ id: 'user-w', email: null, username: null }] });
            const res = await request(app).post(`/oauth/authorize/${TOKEN}/wallet`).send({ address: wallet.address, signature, message });
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ organizaciones: [], nuevo: true });
            expect(llamadas(/INSERT INTO users \(wallet_address/)[0][1][0]).toBe(wallet.address.toLowerCase());
        });

        it('una wallet con cuenta entra y recibe sus organizaciones', async () => {
            const message = await reto();
            const signature = await wallet.signMessage(message);
            mockQuery
                .mockResolvedValueOnce(SESION())
                .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'yo@bezhas.com', username: 'yo' }] })
                .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // fija user_id
                .mockResolvedValueOnce({ rows: [{ id: 'org-1', name: 'Acme', role: 'owner' }] });
            const res = await request(app).post(`/oauth/authorize/${TOKEN}/wallet`).send({ address: wallet.address, signature, message });
            expect(res.status).toBe(200);
            expect(res.body.nuevo).toBe(false);
            expect(res.body.organizaciones[0].puedeConectar).toBe(true);
            expect(llamadas(/INSERT INTO users/)).toHaveLength(0);
        });

        it('la firma de otra wallet no vale y cuenta el intento', async () => {
            const message = await reto();
            const signature = await ethers.Wallet.createRandom().signMessage(message);
            mockQuery.mockResolvedValueOnce(SESION()).mockResolvedValueOnce({ rows: [{ intentos_login: 1 }] });
            const res = await request(app).post(`/oauth/authorize/${TOKEN}/wallet`).send({ address: wallet.address, signature, message });
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('invalid_signature');
            expect(llamadas(/intentos_login = intentos_login \+ 1/)).toHaveLength(1);
        });

        it('el reto es de un solo uso: la misma firma no sirve dos veces', async () => {
            const message = await reto();
            const signature = await wallet.signMessage(message);
            mockQuery.mockResolvedValueOnce(SESION()).mockResolvedValueOnce({ rows: [{ id: 'user-1', email: null, username: null }] });
            await request(app).post(`/oauth/authorize/${TOKEN}/wallet`).send({ address: wallet.address, signature, message });

            mockQuery.mockResolvedValueOnce(SESION()).mockResolvedValueOnce({ rows: [{ intentos_login: 1 }] });
            const otra = await request(app).post(`/oauth/authorize/${TOKEN}/wallet`).send({ address: wallet.address, signature, message });
            expect(otra.status).toBe(401);
        });

        it('una firma de un mensaje distinto al del reto no vale, aunque lleve el nonce', async () => {
            const message = await reto();
            const otroMensaje = `${message}\nextra: transfiere todo`;
            const signature = await wallet.signMessage(otroMensaje);
            mockQuery.mockResolvedValueOnce(SESION()).mockResolvedValueOnce({ rows: [{ intentos_login: 1 }] });
            const res = await request(app).post(`/oauth/authorize/${TOKEN}/wallet`).send({ address: wallet.address, signature, message: otroMensaje });
            expect(res.status).toBe(401);
        });
    });

    describe('organización del cliente nuevo', () => {
        it('la crea con la persona como owner y la devuelve lista para autorizar', async () => {
            mockQuery
                .mockResolvedValueOnce(SESION_CON_USUARIO())
                .mockResolvedValueOnce({ rows: [{ id: 'org-n' }] })
                .mockResolvedValueOnce({ rows: [], rowCount: 1 })
                .mockResolvedValueOnce({ rows: [{ id: 'org-n', name: 'Gestora Algeciras', role: 'owner' }] });
            const res = await request(app).post(`/oauth/authorize/${TOKEN}/organizacion`).send({ nombre: 'Gestora Algeciras' });
            expect(res.status).toBe(201);
            expect(res.body.organizacionId).toBe('org-n');
            expect(res.body.organizaciones[0].puedeConectar).toBe(true);
            const [miembro] = llamadas(/INSERT INTO organization_members/);
            expect(miembro[0]).toMatch(/'owner'/);
            expect(miembro[1]).toEqual(['org-n', 'user-n']);
        });

        it('sin identificarse antes no se puede crear', async () => {
            mockQuery.mockResolvedValueOnce(SESION());
            const res = await request(app).post(`/oauth/authorize/${TOKEN}/organizacion`).send({ nombre: 'Acme' });
            expect(res.status).toBe(401);
            expect(llamadas(/INSERT INTO organizations/)).toHaveLength(0);
        });
    });
});
