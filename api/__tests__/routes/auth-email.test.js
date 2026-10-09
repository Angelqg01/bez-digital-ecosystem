const request = require('supertest');
const bcrypt = require('bcryptjs');
const { mockQuery, mockWalletService } = require('../helpers');

const mockSendMail = jest.fn().mockResolvedValue({ sent: true });
jest.mock('../../services/mailer', () => ({ sendMail: (...a) => mockSendMail(...a) }));
const mockSafeWallet = mockWalletService.ensureFiatSafeWalletForUser;
const app = require('../../index');

const post = (path, body) => request(app).post(`/api/auth${path}`).send(body);
const HASH = bcrypt.hashSync('Correcta123', 4);
const usuario = { id: 5, wallet_address: '0x' + 'a'.repeat(40), username: 'ana', role: 'user', email: 'ana@bezhas.com', auth_type: 'fiat', password_hash: HASH, bezhas_id: 'BZ-1' };

beforeEach(() => { mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [], rowCount: 0 }); mockSendMail.mockClear(); });

describe('login con email y contraseña (/auth/login-email)', () => {
    it('entra con credenciales correctas y devuelve token sin el hash', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [usuario] });
        const res = await post('/login-email', { email: 'Ana@Bezhas.com', password: 'Correcta123' });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeTruthy();
        expect(JSON.stringify(res.body)).not.toMatch(/password_hash|\$2[aby]\$/);
    });
    it('el login no depende de la cadena: sin wallet gestionada entra igual', async () => {
        mockSafeWallet.mockRejectedValueOnce(new Error('RPC caído'));
        mockQuery.mockResolvedValueOnce({ rows: [usuario] });
        const res = await post('/login-email', { email: 'ana@bezhas.com', password: 'Correcta123' });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeTruthy();
    });
    it('contraseña incorrecta → 401 genérico', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [usuario] });
        const res = await post('/login-email', { email: 'ana@bezhas.com', password: 'Mala' });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
    });
    it('cuenta inexistente → el mismo 401 (no enumera usuarios)', async () => {
        const res = await post('/login-email', { email: 'nadie@bezhas.com', password: 'Correcta123' });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
    });
    it('cuenta sólo-wallet (sin hash) no admite contraseña', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ ...usuario, password_hash: null }] });
        expect((await post('/login-email', { email: 'ana@bezhas.com', password: 'x' })).status).toBe(401);
    });
    it('email inválido → 400', async () => {
        expect((await post('/login-email', { email: 'no-es-email', password: 'x' })).status).toBe(400);
    });
});

describe('registro (/auth/register-email)', () => {
    it('crea la cuenta y devuelve token', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [{ id: 9 }] })                                     // INSERT
            .mockResolvedValueOnce({ rows: [{ id: 9, wallet_address: '0x' + 'c'.repeat(40), role: 'user', auth_type: 'fiat', bezhas_id: 'BZ-9' }] }); // SELECT refrescado
        const res = await post('/register-email', { email: 'nuevo@bezhas.com', password: 'Correcta123', username: 'nuevo' });
        expect(res.status).toBe(201);
        expect(res.body.token).toBeTruthy();
        // La contraseña se guarda con bcrypt, nunca en claro.
        const insertArgs = mockQuery.mock.calls[0][1];
        expect(insertArgs.some((a) => typeof a === 'string' && a.startsWith('$2'))).toBe(true);
        expect(insertArgs).not.toContain('Correcta123');
    });
    it('si la wallet gestionada no se puede crear (cadena/bóveda caídas) la cuenta se crea igualmente', async () => {
        mockSafeWallet.mockRejectedValueOnce(new Error('WALLET_VAULT_SECRET es obligatorio'));
        mockQuery
            .mockResolvedValueOnce({ rows: [{ id: 9 }] })
            .mockResolvedValueOnce({ rows: [{ id: 9, wallet_address: '0x' + 'c'.repeat(40), role: 'user', auth_type: 'fiat', bezhas_id: 'BZ-9' }] });
        const res = await post('/register-email', { email: 'sinwallet@bezhas.com', password: 'Correcta123' });
        expect(res.status).toBe(201);
        expect(res.body.token).toBeTruthy();
        expect(res.body.safeWallet).toBeNull();
    });
    it('contraseña corta → 400', async () => {
        expect((await post('/register-email', { email: 'a@bezhas.com', password: '1234567' })).status).toBe(400);
    });
    it('email repetido → 409', async () => {
        mockQuery.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
        expect((await post('/register-email', { email: 'ana@bezhas.com', password: 'Correcta123' })).status).toBe(409);
    });
});

describe('recuperación de contraseña', () => {
    it('forgot: cuenta existente → guarda sólo el hash del código y envía el email', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 5 }] });
        const res = await post('/forgot-password', { email: 'ana@bezhas.com' });
        expect(res.status).toBe(200);
        expect(mockSendMail).toHaveBeenCalledTimes(1);
        const codigo = /Tu código es: ([A-Z2-9]{10})/.exec(mockSendMail.mock.calls[0][0].text)[1];
        const insert = mockQuery.mock.calls.find((c) => /INSERT INTO password_reset_codes/.test(c[0]));
        expect(insert[1].join('|')).not.toContain(codigo);                 // en claro no se guarda
        expect(insert[1][1]).toMatch(/^[0-9a-f]{64}$/);
    });
    it('forgot: cuenta inexistente → misma respuesta, ni inserta ni envía', async () => {
        const existe = await (async () => { mockQuery.mockResolvedValueOnce({ rows: [{ id: 5 }] }); return post('/forgot-password', { email: 'ana@bezhas.com' }); })();
        mockSendMail.mockClear(); mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [] });
        const noExiste = await post('/forgot-password', { email: 'nadie@bezhas.com' });
        expect(noExiste.status).toBe(200);
        expect(noExiste.body).toEqual(existe.body);
        expect(mockSendMail).not.toHaveBeenCalled();
    });
    it('forgot: un fallo interno tampoco delata la cuenta', async () => {
        mockQuery.mockRejectedValueOnce(new Error('db caída'));
        const res = await post('/forgot-password', { email: 'ana@bezhas.com' });
        expect(res.status).toBe(200);
    });

    const codigoValido = 'ABCDEFGHJK';
    const filaCodigo = (extra = {}) => ({ id: 3, user_id: 5, attempts: 0, code_hash: require('crypto').createHash('sha256').update(codigoValido).digest('hex'), ...extra });

    it('reset: código correcto cambia la contraseña y lo invalida', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [filaCodigo()] });
        const res = await post('/reset-password', { email: 'ana@bezhas.com', code: 'abcdefghjk', password: 'NuevaClave99' });
        expect(res.status).toBe(200);
        const upd = mockQuery.mock.calls.find((c) => /UPDATE users SET password_hash/.test(c[0]));
        expect(bcrypt.compareSync('NuevaClave99', upd[1][0])).toBe(true);
        expect(mockQuery.mock.calls.some((c) => /UPDATE password_reset_codes SET used_at/.test(c[0]))).toBe(true);
    });
    it('reset: código incorrecto → 400 y cuenta el intento', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [filaCodigo()] });
        const res = await post('/reset-password', { email: 'ana@bezhas.com', code: 'ZZZZZZZZZZ', password: 'NuevaClave99' });
        expect(res.status).toBe(400);
        expect(mockQuery.mock.calls.some((c) => /attempts = attempts \+ 1/.test(c[0]))).toBe(true);
        expect(mockQuery.mock.calls.some((c) => /UPDATE users SET password_hash/.test(c[0]))).toBe(false);
    });
    it('reset: tras 5 fallos el código ya no vale ni siquiera el correcto', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [filaCodigo({ attempts: 5 })] });
        const res = await post('/reset-password', { email: 'ana@bezhas.com', code: codigoValido, password: 'NuevaClave99' });
        expect(res.status).toBe(400);
        expect(mockQuery.mock.calls.some((c) => /UPDATE users SET password_hash/.test(c[0]))).toBe(false);
    });
    it('reset: sin código vigente (caducado/usado/inexistente) → 400 con el mismo mensaje', async () => {
        const res = await post('/reset-password', { email: 'ana@bezhas.com', code: codigoValido, password: 'NuevaClave99' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('RESET_INVALID');
    });
    it('reset: contraseña nueva demasiado corta → 400', async () => {
        expect((await post('/reset-password', { email: 'ana@bezhas.com', code: codigoValido, password: 'corta' })).status).toBe(400);
    });
});
