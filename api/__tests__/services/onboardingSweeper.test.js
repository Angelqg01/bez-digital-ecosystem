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
        const r = await sweeper.pasada();
        expect(r).toEqual({ caducadas: 2, anonimizadas: 5, nodosCaducados: 1 });
        expect(String(mockQuery.mock.calls[1][0])).toMatch(/source_ip = NULL/);
        expect(String(mockQuery.mock.calls[1][0])).toMatch(/user_agent = NULL/);
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

        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
        await expect(sweeper.pasada()).resolves.toEqual({ caducadas: 0, anonimizadas: 0, nodosCaducados: 0 });
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

    it('stopSweeper lo detiene', () => {
        sweeper.startSweeper(60000);
        sweeper.stopSweeper();
        expect(sweeper.status().activo).toBe(false);
    });
});
