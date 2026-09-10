const bcrypt = require('bcryptjs');
const { mockQuery } = require('../helpers');
const login = require('../../services/onboardingLogin');

const TOKEN = 'a'.repeat(64);
const PASS = 'contraseña-buena';
let HASH;

beforeAll(async () => { HASH = await bcrypt.hash(PASS, 4); });

function sesionConnect(over = {}) {
    mockQuery.mockResolvedValueOnce({
        rows: [{ id: 's1', kind: 'connect', status: 'pendiente', prefill: {},
            user_id: null, intentos_login: 0,
            expires_at: new Date(Date.now() + 600000), ...over }],
    });
}
function usuario(conHash = true) {
    mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'u1', email: 'yoel@bezhas.com', username: 'Yoel', role: 'user',
            password_hash: conHash ? HASH : null }],
    });
}
function sinUsuario() { mockQuery.mockResolvedValueOnce({ rows: [] }); }

describe('onboardingLogin', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    describe('no cuenta qué correos son clientes', () => {
        it('el mensaje es el mismo exista o no el usuario', async () => {
            // Distinguirlos convertiría el formulario en un comprobador de qué
            // correos tienen cuenta en BeZhas.
            sesionConnect(); sinUsuario();
            mockQuery.mockResolvedValueOnce({ rows: [{ intentos_login: 1 }] });
            const a = await login.identificar(TOKEN, { email: 'nadie@x.com', password: 'x' }).catch((e) => e);

            sesionConnect(); usuario();
            mockQuery.mockResolvedValueOnce({ rows: [{ intentos_login: 1 }] });
            const b = await login.identificar(TOKEN, { email: 'yoel@bezhas.com', password: 'mala' }).catch((e) => e);

            expect(a.code).toBe(b.code);
            expect(a.message).toBe(b.message);
        });

        it('compara contra un hash aunque el usuario no exista', async () => {
            // Sin ese bcrypt de mentira, el tiempo de respuesta contesta lo que
            // el mensaje se niega a contestar.
            const espia = jest.spyOn(bcrypt, 'compare');
            sesionConnect(); sinUsuario();
            mockQuery.mockResolvedValueOnce({ rows: [{ intentos_login: 1 }] });
            await login.identificar(TOKEN, { email: 'nadie@x.com', password: 'x' }).catch(() => {});
            expect(espia).toHaveBeenCalled();
            espia.mockRestore();
        });

        it('no registra el correo probado', async () => {
            // Este log se llenaría de las direcciones que alguien está tanteando.
            const logger = require('../../utils/logger');
            const espia = jest.spyOn(logger, 'warn').mockImplementation(() => {});
            sesionConnect(); sinUsuario();
            mockQuery.mockResolvedValueOnce({ rows: [{ intentos_login: 1 }] });
            await login.identificar(TOKEN, { email: 'secreto@empresa.com', password: 'x' }).catch(() => {});
            expect(JSON.stringify(espia.mock.calls)).not.toContain('secreto@empresa.com');
            espia.mockRestore();
        });
    });

    describe('fuerza bruta', () => {
        it('al agotar los intentos CANCELA la sesión, no sólo bloquea el login', async () => {
            // Si sólo se bloqueara, el enlace seguiría vivo para reintentar
            // desde otra IP.
            sesionConnect({ intentos_login: login.MAX_INTENTOS - 1 });
            usuario();
            mockQuery.mockResolvedValueOnce({ rows: [{ intentos_login: login.MAX_INTENTOS }] });

            await expect(login.identificar(TOKEN, { email: 'yoel@bezhas.com', password: 'mala' }))
                .rejects.toMatchObject({ code: 'LOGIN_CREDENCIALES' });
            const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
            expect(sqls.some((s) => /status = 'cancelado'/.test(s))).toBe(true);
        });

        it('con los intentos ya agotados no llega ni a comparar', async () => {
            const espia = jest.spyOn(bcrypt, 'compare');
            sesionConnect({ intentos_login: login.MAX_INTENTOS });
            await expect(login.identificar(TOKEN, { email: 'a@b.com', password: 'x' }))
                .rejects.toMatchObject({ code: 'LOGIN_INTENTOS_AGOTADOS' });
            expect(espia).not.toHaveBeenCalled();
            espia.mockRestore();
        });
    });

    describe('identificación correcta', () => {
        it('escribe user_id en la sesión y NO devuelve ningún token', async () => {
            // Un JWT aquí dejaría en ese navegador una segunda credencial, de
            // vida más larga que la sesión, que nadie ha pedido.
            sesionConnect(); usuario();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });      // update sesión
            mockQuery.mockResolvedValueOnce({ rows: [] });                    // organizaciones

            const r = await login.identificar(TOKEN, { email: 'yoel@bezhas.com', password: PASS });
            const texto = JSON.stringify(r);
            expect(texto).not.toMatch(/token|jwt|Bearer/i);
            expect(r.usuario.id).toBe('u1');
            const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
            expect(sqls.some((s) => /SET user_id = \$2/.test(s))).toBe(true);
        });

        it('reinicia el contador de intentos al acertar', async () => {
            sesionConnect({ intentos_login: 3 }); usuario();
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
            mockQuery.mockResolvedValueOnce({ rows: [] });
            await login.identificar(TOKEN, { email: 'yoel@bezhas.com', password: PASS });
            const update = mockQuery.mock.calls.find((c) => /SET user_id = \$2/.test(String(c[0])));
            expect(String(update[0])).toMatch(/intentos_login = 0/);
        });
    });

    describe('sesión', () => {
        it('sólo el flujo connect pide identificación', async () => {
            sesionConnect({ kind: 'sdk_install' });
            await expect(login.identificar(TOKEN, { email: 'a@b.com', password: 'x' }))
                .rejects.toMatchObject({ code: 'LOGIN_TIPO_NO_APLICA' });
        });

        it('una sesión caducada no acepta login', async () => {
            sesionConnect({ expires_at: new Date(Date.now() - 1000) });
            await expect(login.identificar(TOKEN, { email: 'a@b.com', password: 'x' }))
                .rejects.toMatchObject({ code: 'LOGIN_SESION_CERRADA' });
        });

        it('un token con otra forma no llega a consultarse', async () => {
            await expect(login.identificar('corto', { email: 'a@b.com', password: 'x' }))
                .rejects.toMatchObject({ code: 'LOGIN_TOKEN_INVALIDO' });
            expect(mockQuery).not.toHaveBeenCalled();
        });
    });

    describe('organizaciones y papeles', () => {
        it('lista todas, marcando las que el papel no permite', async () => {
            // Ocultarlas haría que un auditor viera una lista vacía y pensara
            // que su alta está mal, cuando lo que pasa es que su papel no llega.
            mockQuery.mockResolvedValueOnce({
                rows: [
                    { id: 'o1', name: 'Delta', role: 'owner', verification_status: 'verified', legacy_enterprise_id: 'e1' },
                    { id: 'o2', name: 'Gamma', role: 'auditor', verification_status: 'verified', legacy_enterprise_id: 'e2' },
                ],
            });
            const orgs = await login.organizacionesDe('u1');
            expect(orgs[0].puedeConectar).toBe(true);
            expect(orgs[1].puedeConectar).toBe(false);
            expect(orgs[1].motivo).toMatch(/auditor/);
        });

        it('un auditor no puede conectar aunque lo pida directamente', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'o2', name: 'Gamma', legacy_enterprise_id: 'e2', role: 'auditor' }],
            });
            await expect(login.verificarMembresia('u1', 'o2'))
                .rejects.toMatchObject({ code: 'LOGIN_ROL_INSUFICIENTE' });
        });

        it('no ser miembro se responde igual que no existir', async () => {
            // Quien no es miembro tampoco tiene por qué saber que existe.
            mockQuery.mockResolvedValueOnce({ rows: [] });
            await expect(login.verificarMembresia('u1', 'o-ajena'))
                .rejects.toMatchObject({ code: 'LOGIN_NO_MIEMBRO' });
        });
    });
});
