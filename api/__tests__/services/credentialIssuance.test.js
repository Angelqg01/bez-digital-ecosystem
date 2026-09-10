const { mockQuery } = require('../helpers');
const issuance = require('../../services/credentialIssuance');

const sha256 = (v) => require('crypto').createHash('sha256').update(v).digest('hex');
const TOKEN = 'a'.repeat(64);

/** El UPDATE condicional gana la carrera y devuelve la sesión. */
function sesionConsumida(kind, over = {}) {
    mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'sess-1', kind, prefill: { tipo: 'edge', entorno: 'sandbox' }, app_id: 'app-1', org_id: null, ...over }],
        rowCount: 1,
    });
}
/** El UPDATE no encuentra sesión abierta: otro se la llevó. */
function sesionNoConsumida() {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
}

function appPadre() {
    mockQuery.mockResolvedValueOnce({
        rows: [{ app_name: 'cliente', scopes: ['token', 'wallet'], tier: 'standard',
            enterprise_id: 'ent-1', authorized_addresses: [], address_access_mode: 'strict' }],
    });
}

describe('credentialIssuance', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    describe('se emite una vez y sólo una', () => {
        it('la sesión se consume con un ÚNICO update condicional', async () => {
            // Comprobar «¿ya se emitió?» y luego insertar deja una ventana en la
            // que dos pestañas emiten dos claves y el cliente sólo sabe de una.
            // La que no conoce no la va a revocar nunca.
            sesionConsumida('sdk_install');
            appPadre();
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-2', app_name: 'cliente-x-ab12' }] });

            await issuance.emitir(TOKEN, {});
            const update = String(mockQuery.mock.calls[0][0]);
            expect(update).toMatch(/UPDATE onboarding_sessions/);
            expect(update).toMatch(/status IN \('pendiente', 'en_curso'\)/);
            expect(update).toMatch(/RETURNING/);
        });

        it('la segunda llamada recibe «ya emitido», no otra credencial', async () => {
            sesionNoConsumida();
            mockQuery.mockResolvedValueOnce({ rows: [{ status: 'completado', expires_at: new Date() }] });
            await expect(issuance.emitir(TOKEN, {}))
                .rejects.toMatchObject({ code: 'ISSUE_YA_EMITIDO' });
        });

        it('distingue caducada de inexistente', async () => {
            sesionNoConsumida();
            mockQuery.mockResolvedValueOnce({ rows: [{ status: 'pendiente', expires_at: new Date(Date.now() - 1000) }] });
            await expect(issuance.emitir(TOKEN, {})).rejects.toMatchObject({ code: 'ISSUE_CADUCADO' });

            sesionNoConsumida();
            mockQuery.mockResolvedValueOnce({ rows: [] });
            await expect(issuance.emitir(TOKEN, {})).rejects.toMatchObject({ code: 'ISSUE_NO_EXISTE' });
        });
    });

    describe('api-key del SDK', () => {
        it('crea una entrada DERIVADA en vez de rotar la del cliente', async () => {
            // Rotar dejaría sin autenticar la integración que ya tiene en marcha,
            // sin avisar y en el peor momento.
            sesionConsumida('sdk_install');
            appPadre();
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-2', app_name: 'cliente-x-ab12' }] });

            const r = await issuance.emitir(TOKEN, { nombre: 'servidor-facturacion' });
            const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
            expect(sqls.some((s) => /INSERT INTO app_registry/i.test(s))).toBe(true);
            expect(sqls.some((s) => /UPDATE app_registry SET api_key_hash/i.test(s))).toBe(false);
            expect(r.appId).toBe('app-2');
        });

        it('hereda permisos y titular, para no ampliarlos por la puerta de atrás', async () => {
            sesionConsumida('sdk_install');
            appPadre();
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-2', app_name: 'x' }] });

            await issuance.emitir(TOKEN, {});
            const insert = mockQuery.mock.calls.find((c) => /INSERT INTO app_registry/i.test(String(c[0])));
            expect(insert[1][2]).toEqual(['token', 'wallet']);   // mismos scopes
            expect(insert[1][4]).toBe('ent-1');                  // mismo titular
            expect(insert[1][7]).toBe('app-1');                  // derived_from
        });

        it('guarda el hash, nunca la clave', async () => {
            sesionConsumida('sdk_install');
            appPadre();
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'app-2', app_name: 'x' }] });

            const r = await issuance.emitir(TOKEN, {});
            const insert = mockQuery.mock.calls.find((c) => /INSERT INTO app_registry/i.test(String(c[0])));
            expect(insert[1][1]).toBe(sha256(r.valor));
            expect(insert[1][1]).not.toBe(r.valor);
            expect(r.valor).toHaveLength(64);
        });

        it('sin cuenta asociada no emite nada', async () => {
            sesionConsumida('sdk_install', { app_id: null });
            await expect(issuance.emitir(TOKEN, {})).rejects.toMatchObject({ code: 'ISSUE_SIN_CUENTA' });
        });
    });

    describe('token de registro de nodo', () => {
        it('guarda el hash del vale y nunca una clave privada', async () => {
            sesionConsumida('node_provision');
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'node-1', tipo: 'edge', entorno: 'sandbox', nombre: 'edge-1',
                    token_expira_at: new Date(Date.now() + 86400000) }],
            });
            const r = await issuance.emitir(TOKEN, { nombre: 'almacen' });
            const insert = mockQuery.mock.calls.find((c) => /INSERT INTO client_nodes/i.test(String(c[0])));
            expect(insert[1][4]).toBe(sha256(r.valor));
            // La tabla no tiene columna para una privada, y el insert tampoco.
            expect(String(insert[0])).not.toMatch(/private/i);
        });

        it('rechaza un perfil de nodo que no existe', async () => {
            sesionConsumida('node_provision', { prefill: { tipo: 'cuantico' } });
            await expect(issuance.emitir(TOKEN, {})).rejects.toMatchObject({ code: 'ISSUE_PERFIL_NODO' });
        });
    });

    describe('tipos que no emiten', () => {
        it.each(['signup', 'bank_setup', 'erp_integration', 'connect'])(
            '«%s» no entrega credenciales', async (kind) => {
                sesionConsumida(kind);
                await expect(issuance.emitir(TOKEN, {}))
                    .rejects.toMatchObject({ code: 'ISSUE_TIPO_SIN_EMISION' });
            }
        );
    });

    describe('registro del nodo', () => {
        it('consume el vale y borra su hash de la fila', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'node-1', tipo: 'edge', entorno: 'sandbox', nombre: 'edge-1', app_id: 'app-1' }],
                rowCount: 1,
            });
            await issuance.registrarNodo({ registrationToken: TOKEN, publicKey: 'x'.repeat(64) });
            const sql = String(mockQuery.mock.calls[0][0]);
            expect(sql).toMatch(/registration_token_hash = NULL/);
            expect(sql).toMatch(/estado = 'pendiente'/);          // sólo si sigue pendiente
            expect(sql).toMatch(/token_expira_at > NOW\(\)/);
        });

        it('RECHAZA una clave privada en vez de guardarla', async () => {
            // Un error de configuración del cliente no puede acabar con nosotros
            // custodiando la llave de su nodo.
            await expect(issuance.registrarNodo({
                registrationToken: TOKEN,
                publicKey: '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----',
            })).rejects.toMatchObject({ code: 'NODO_CLAVE_PRIVADA' });
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it('rechaza un token con otra forma sin consultar nada', async () => {
            await expect(issuance.registrarNodo({ registrationToken: '../../etc/passwd', publicKey: 'x'.repeat(64) }))
                .rejects.toMatchObject({ code: 'NODO_TOKEN_INVALIDO' });
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it('un vale ya consumido no vale otra vez', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
            await expect(issuance.registrarNodo({ registrationToken: TOKEN, publicKey: 'x'.repeat(64) }))
                .rejects.toMatchObject({ code: 'NODO_TOKEN_CONSUMIDO' });
        });
    });

    describe('listado de nodos', () => {
        it('no devuelve el token de registro ni la clave, sólo si la hay', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'n1', tipo: 'edge', estado: 'registrado', con_clave: true }] });
            await issuance.listarNodos('app-1');
            const select = String(mockQuery.mock.calls[0][0]);
            expect(select).not.toMatch(/registration_token_hash(?!\s+IS)/);
            expect(select).toMatch(/public_key IS NOT NULL AS con_clave/);
        });
    });
});
