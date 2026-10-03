const { mockQuery } = require('../helpers');
const sweeper = require('../../services/onboardingSweeper');
const onboarding = require('../../services/onboardingSession');

describe('onboardingSweeper', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
        sweeper.stopSweeper();
    });
    afterEach(() => {
        sweeper.stopSweeper();
        jest.restoreAllMocks();
    });

    it('caduca lo vencido, borra la IP de lo viejo y cierra los vales de nodo', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 2 });   // sesiones caducadas
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 5 });   // anonimizadas
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });   // vales de nodo sin usar
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 7 });   // telemetría vencida
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 4 });   // episodios vencidos
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 3 });   // códigos OAuth caducados
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 6 });   // denylist vencida
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 2 });   // refresh caducados/revocados
        const r = await sweeper.pasada();
        expect(r).toEqual({
            caducadas: 2, anonimizadas: 5, nodosCaducados: 1,
            // Purga por plazo (art. 5.1.e RGPD): va en el mismo barrido para que
            // no dependa de un segundo demonio que nadie vigila.
            telemetriaBorrada: 7, episodiosBorrados: 4,
            oauthCodigos: 3, oauthDenylist: 6, oauthRefresh: 2,
        });
        expect(String(mockQuery.mock.calls[1][0])).toMatch(/source_ip = NULL/);
        expect(String(mockQuery.mock.calls[1][0])).toMatch(/user_agent = NULL/);
    });

    it('purga OAuth: conserva los refresh rotados hasta caducar (detección de replay)', async () => {
        await sweeper.pasada();
        const sql = mockQuery.mock.calls.map((c) => String(c[0]));
        const refresh = sql.find((q) => /DELETE FROM oauth_refresh_tokens/.test(q));
        expect(refresh).toMatch(/expires_at < NOW\(\)/);
        expect(refresh).toMatch(/revoked_at IS NOT NULL/);
        // Un token ya rotado es el que delata una copia robada si reaparece:
        // no se puede borrar sólo por estar usado.
        expect(refresh).not.toMatch(/used_at/);
        expect(sql.some((q) => /DELETE FROM oauth_authorization_codes/.test(q))).toBe(true);
        expect(sql.some((q) => /DELETE FROM oauth_token_denylist/.test(q))).toBe(true);
    });

    it('no se solapa consigo mismo', async () => {
        // setInterval no espera a que termine la función: con una base lenta, una
        // pasada cada diez minutos se convierte en diez UPDATE simultáneos sobre
        // las mismas filas.
        let resolver;
        jest.spyOn(onboarding, 'barrer').mockImplementation(
            () => new Promise((r) => { resolver = r; })
        );

        const primera = sweeper.pasada();
        const segunda = await sweeper.pasada();      // mientras la primera sigue viva
        expect(segunda).toBeNull();
        expect(onboarding.barrer).toHaveBeenCalledTimes(1);

        resolver({ caducadas: 0, anonimizadas: 0 });
        await primera;
    });

    it('un fallo no rompe el bucle', async () => {
        // La base puede estar reiniciándose; la pasada siguiente funcionará.
        jest.spyOn(onboarding, 'barrer').mockRejectedValueOnce(new Error('la base no responde'));
        await expect(sweeper.pasada()).resolves.toBeNull();

        for (let i = 0; i < 8; i++) mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        await expect(sweeper.pasada()).resolves.toEqual({
            caducadas: 0, anonimizadas: 0, nodosCaducados: 0,
            telemetriaBorrada: 0, episodiosBorrados: 0,
            oauthCodigos: 0, oauthDenylist: 0, oauthRefresh: 0,
        });
    });

    it('arrancar dos veces no crea dos bucles', () => {
        const t1 = sweeper.startSweeper(60000);
        const t2 = sweeper.startSweeper(60000);
        expect(t2).toBe(t1);
        expect(sweeper.status().activo).toBe(true);
    });

    it('el temporizador no mantiene vivo el proceso', () => {
        // Sin unref(), una API que termina de servir se quedaría esperando al
        // siguiente tick y Jest avisaría de un manejador abierto.
        const t = sweeper.startSweeper(60000);
        expect(t.hasRef()).toBe(false);
    });

    it('barre una vez al arrancar', async () => {
        // Si el proceso ha estado caído, hay sesiones vencidas esperando desde
        // antes del reinicio.
        const espia = jest.spyOn(onboarding, 'barrer').mockResolvedValue({ caducadas: 0, anonimizadas: 0 });
        sweeper.startSweeper(60000);
        await new Promise((r) => setImmediate(r));
        expect(espia).toHaveBeenCalledTimes(1);
    });

    it('un vale de nodo sin usar se cierra aunque no haya sesiones que caducar', async () => {
        // Un vale «pendiente» de hace un mes en la pantalla del cliente parece
        // que todavía sirve, y no sirve.
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 3 });
        const r = await sweeper.pasada();
        expect(r.nodosCaducados).toBe(3);
        expect(String(mockQuery.mock.calls[2][0])).toMatch(/registration_token_hash = NULL/);
    });

    it('purga la telemetría y los episodios por la fecha de la fila', async () => {
        // Por `purgar_despues_de` y no por la constante de hoy: purgar con la
        // constante actual alargaría retroactivamente la conservación de datos
        // ya recogidos si alguien sube el plazo.
        for (let i = 0; i < 3; i++) mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 9 });
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 2 });
        const r = await sweeper.pasada();
        expect(r.telemetriaBorrada).toBe(9);
        expect(r.episodiosBorrados).toBe(2);
        const sqls = mockQuery.mock.calls.map((c) => String(c[0]));
        expect(sqls.filter((q) => /purgar_despues_de <= NOW\(\)/.test(q))).toHaveLength(2);
    });

    it('stopSweeper lo detiene', () => {
        sweeper.startSweeper(60000);
        sweeper.stopSweeper();
        expect(sweeper.status().activo).toBe(false);
    });
});
