const { mockQuery } = require('../helpers');
const onboarding = require('../../services/onboardingSession');

const enMinutos = (m) => new Date(Date.now() + m * 60000);

/** Fila devuelta por el INSERT. */
function conInsert(kind = 'signup', expira = enMinutos(15)) {
    mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', kind, status: 'pendiente', expires_at: expira, created_at: new Date() }],
    });
}

function conRecuento(n) {
    mockQuery.mockResolvedValueOnce({ rows: [{ n }] });
}

describe('onboardingSession', () => {
    beforeEach(() => {
        // mockReset y no clearAllMocks: clear vacía las llamadas registradas
        // pero NO la cola de mockResolvedValueOnce, así que un valor encolado y
        // no consumido lo heredaba el test siguiente y fallaba a distancia.
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    describe('el prefill no puede transportar nada sensible', () => {
        // Es LA defensa del flujo bancario. El modelo del cliente intentará
        // pasarnos el IBAN si su usuario se lo dicta —es lo que se le ha pedido
        // que haga—, así que no se puede confiar en que no lo mande.
        const casos = [
            ['iban', { iban: 'ES7714650100911766376210' }],
            ['numero_cuenta', { numero_cuenta: '123' }],
            ['apiKey', { apiKey: 'sk-123' }],
            ['api_key anidada', { credenciales: { api_key: 'x' } }],
            ['password', { password: 'hunter2' }],
            ['clave privada', { clave_privada: '0xdead' }],
            ['seed', { seed: 'palabra palabra' }],
            ['tarjeta en un array', { metodos: [{ tarjeta: '4111' }] }],
        ];

        it.each(casos)('rechaza %s', async (_nombre, prefill) => {
            await expect(onboarding.crear({ kind: 'signup', prefill }))
                .rejects.toMatchObject({ code: 'ONBOARDING_PREFILL_SENSIBLE' });
            // Nada se ha escrito: se rechaza ANTES de tocar la base.
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it('el mensaje de error nombra la clave pero nunca el valor', async () => {
            // Si el error citara el valor, el dato que estamos impidiendo que
            // llegue acabaría igualmente en el contexto del modelo.
            try {
                await onboarding.crear({ kind: 'signup', prefill: { iban: 'ES7714650100911766376210' } });
                throw new Error('debería haber lanzado');
            } catch (err) {
                expect(err.message).toContain('iban');
                expect(err.message).not.toContain('ES7714650100911766376210');
            }
        });

        it('deja pasar un prefill legítimo', async () => {
            conRecuento(0);
            conInsert();
            const s = await onboarding.crear({
                kind: 'signup',
                ip: '10.0.0.1',
                prefill: { sector: 'logistica', empleados: 40, pais: 'ES', razonSocial: 'Delta SL' },
            });
            expect(s.token).toHaveLength(64);
            expect(s.url).toContain(`/o/${s.token}`);
        });

        it('rechaza un prefill desmesurado', async () => {
            await expect(onboarding.crear({
                kind: 'signup',
                prefill: { notas: 'x'.repeat(20000) },
            })).rejects.toMatchObject({ code: 'ONBOARDING_PREFILL_GRANDE' });
        });
    });

    describe('token', () => {
        it('se guarda hasheado, nunca en claro', async () => {
            conRecuento(0);
            conInsert();
            const s = await onboarding.crear({ kind: 'signup', prefill: {}, ip: '10.0.0.1' });
            const guardado = mockQuery.mock.calls
                .find((c) => /INSERT INTO onboarding_sessions/i.test(String(c[0])))[1][0];
            expect(guardado).toHaveLength(64);
            expect(guardado).not.toBe(s.token);
            expect(require('crypto').createHash('sha256').update(s.token).digest('hex')).toBe(guardado);
        });

        it('un token con forma inválida no llega a consultarse', async () => {
            expect(await onboarding.porToken('../../etc/passwd')).toBeNull();
            expect(await onboarding.porToken('corto')).toBeNull();
            expect(await onboarding.porToken(null)).toBeNull();
            expect(mockQuery).not.toHaveBeenCalled();
        });
    });

    describe('caducidad', () => {
        it('se aplica AL LEER, no sólo por barrido', async () => {
            // Si dependiera del barrido y el barrido se parase, una sesión
            // vencida seguiría abriendo su pantalla.
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'x', kind: 'signup', prefill: {}, status: 'pendiente', step: null,
                    expires_at: enMinutos(-1), created_at: new Date(), completed_at: null }],
            });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });

            const s = await onboarding.porToken('a'.repeat(64));
            expect(s.status).toBe('caducado');
            expect(mockQuery.mock.calls.some((c) => /SET status = 'caducado'/.test(String(c[0])))).toBe(true);
        });

        it('completar una sesión caducada falla', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'x', kind: 'bank_setup', prefill: {}, status: 'caducado', step: null,
                    expires_at: enMinutos(-30), created_at: new Date(), completed_at: null }],
            });
            await expect(onboarding.completar('b'.repeat(64)))
                .rejects.toMatchObject({ code: 'ONBOARDING_CADUCADA' });
        });
    });

    describe('techo por IP', () => {
        it('corta al desconocido que abre sesiones en bucle', async () => {
            conRecuento(onboarding.MAX_POR_IP_HORA);
            await expect(onboarding.crear({ kind: 'signup', prefill: {}, ip: '1.2.3.4' }))
                .rejects.toMatchObject({ code: 'ONBOARDING_RATE' });
        });

        it('no se aplica a un cliente ya autenticado', async () => {
            // Quien tiene clave ya tiene su propio limitador y su factura.
            conInsert('sdk_install');
            const s = await onboarding.crear({ kind: 'sdk_install', prefill: {}, appId: 'app-1', ip: '1.2.3.4' });
            expect(s.token).toBeTruthy();
            expect(mockQuery.mock.calls.some((c) => /COUNT\(\*\)/.test(String(c[0])))).toBe(false);
        });
    });

    describe('estado público', () => {
        it('no revela nada de la organización ni de la app', () => {
            const publico = onboarding.estadoPublico({
                id: 'x', kind: 'signup', status: 'pendiente', step: null,
                expires_at: enMinutos(10), created_at: new Date(), completed_at: null,
                org_id: 'secreta', prefill: { razonSocial: 'Delta SL' },
            });
            const t = JSON.stringify(publico);
            expect(t).not.toContain('secreta');
            expect(t).not.toContain('Delta SL');
            expect(publico.siguienteAccion).toBeTruthy();
        });
    });

    describe('tipos', () => {
        it('rechaza un tipo desconocido antes de tocar la base', async () => {
            await expect(onboarding.crear({ kind: 'transferir_fondos', prefill: {} }))
                .rejects.toMatchObject({ code: 'ONBOARDING_TIPO' });
            expect(mockQuery).not.toHaveBeenCalled();
        });

        it('los tipos son exactamente los seis flujos previstos', () => {
            expect([...onboarding.TIPOS].sort()).toEqual(
                ['bank_setup', 'connect', 'erp_integration', 'node_provision', 'sdk_install', 'signup']
            );
        });

        it('connect no crea empresa: sólo identifica', async () => {
            // signup crea organización; connect comprueba quién eres y emite una
            // credencial acotada. Son flujos distintos aunque compartan pantalla.
            conRecuento(0);
            conInsert('connect');
            await onboarding.crear({ kind: 'connect', prefill: { entorno: 'sandbox' }, ip: '10.0.0.1' });
            const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
            expect(sqls.some((q) => /INSERT INTO (enterprises|organizations|users)/i.test(q))).toBe(false);
        });
    });

    describe('barrido', () => {
        it('caduca las vencidas y borra IP y user-agent de las viejas', async () => {
            // La IP se recoge para el limitador; pasada su ventana, conservarla
            // es guardar un dato personal sin razón.
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 3 });
            mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 7 });
            const r = await onboarding.barrer();
            expect(r).toEqual({ caducadas: 3, anonimizadas: 7 });
            expect(String(mockQuery.mock.calls[1][0])).toMatch(/source_ip = NULL/);
        });
    });
});
