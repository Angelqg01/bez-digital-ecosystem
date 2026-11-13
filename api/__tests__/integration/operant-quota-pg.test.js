/**
 * Reserva atómica de la cuota de OPERANT contra un Postgres REAL. Se salta si no hay base:
 *
 *   OPERANT_TEST_PG_URL=postgres://usuario:clave@localhost:5433/bezhas pnpm exec jest __tests__/integration/operant-quota-pg.test.js
 *
 * Necesita las migraciones aplicadas (app_registry, operant_tasks). No borra ni recrea tablas:
 * crea una app desechable por prueba y la elimina al terminar (las filas de operant_tasks caen
 * en cascada).
 */
const URL = process.env.OPERANT_TEST_PG_URL;
const d = URL ? describe : describe.skip;

d('operantUsage.reserveTask contra Postgres', () => {
    let db; let usage; let PLAN_MATRIX; let appId;

    const crearApp = async () => {
        const n = `qa-cuota-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { rows } = await db.query('INSERT INTO app_registry (app_name, api_key_hash) VALUES ($1, $2) RETURNING id', [n, `h-${n}`]);
        return rows[0].id;
    };
    const rellenar = (id, n) => db.query(
        `INSERT INTO operant_tasks (app_id, tenant_id, task_id, department, tier, billed_as)
         SELECT $1, 't', 'previa-' || g, 'support', 'mid', 'quota' FROM generate_series(1, $2) g`, [id, n]);
    const filas = async (id, status) => Number((await db.query(
        'SELECT COUNT(*)::int AS n FROM operant_tasks WHERE app_id = $1 AND status = $2', [id, status])).rows[0].n);

    beforeAll(() => {
        process.env.DATABASE_URL = URL;
        db = require('../../db/pool');
        usage = require('../../services/operantUsage');
        ({ PLAN_MATRIX } = require('../../config/operant-services'));
    });
    beforeEach(async () => { appId = await crearApp(); });
    afterEach(async () => { await db.query('DELETE FROM app_registry WHERE id = $1', [appId]); });
    afterAll(async () => { await db.pool.end(); });

    const reservar = (extra = {}) => usage.reserveTask({ appId, tenantId: 't', planId: 'creator_pro', department: 'support', ...extra });

    test('con una plaza libre y 10 peticiones simultáneas sólo UNA entra en la cuota', async () => {
        await rellenar(appId, PLAN_MATRIX.creator_pro.includedTasks - 1);

        const r = await Promise.all(Array.from({ length: 10 }, () => reservar()));

        // Antes de la reserva atómica las 10 pasaban como incluidas en la cuota.
        expect(r.filter((x) => x.allowed && x.billedAs === 'quota')).toHaveLength(1);
        // Las otras 9 no tienen customer de Stripe al que cobrar el exceso: 402 antes de ejecutar.
        const bloqueadas = r.filter((x) => !x.allowed);
        expect(bloqueadas).toHaveLength(9);
        expect(bloqueadas.every((x) => x.code === 'QUOTA_EXHAUSTED')).toBe(true);
        expect(await filas(appId, 'reserved')).toBe(1);
    });

    test('la reserva cuenta como tarea: una segunda petición ve la plaza ocupada', async () => {
        await rellenar(appId, PLAN_MATRIX.creator_pro.includedTasks - 1);
        const primera = await reservar();
        expect(primera.allowed).toBe(true);
        expect(primera.reservationId).toMatch(/^reserved:/);
        expect((await reservar()).allowed).toBe(false);
    });

    test('devolver la reserva libera la plaza', async () => {
        await rellenar(appId, PLAN_MATRIX.creator_pro.includedTasks - 1);
        const primera = await reservar();
        await usage.releaseReservation(appId, primera.reservationId);
        expect(await filas(appId, 'reserved')).toBe(0);
        expect((await reservar()).allowed).toBe(true);
        // Idempotente
        await usage.releaseReservation(appId, primera.reservationId);
    });

    test('una reserva abandonada (proceso caído) deja de contar a los 15 minutos', async () => {
        await rellenar(appId, PLAN_MATRIX.creator_pro.includedTasks - 1);
        const primera = await reservar();
        await db.query(`UPDATE operant_tasks SET created_at = NOW() - INTERVAL '20 minutes' WHERE app_id = $1 AND task_id = $2`, [appId, primera.reservationId]);
        const otra = await reservar();
        expect(otra.allowed).toBe(true);
        expect(await filas(appId, 'reserved')).toBe(1); // la abandonada se limpió, queda sólo la nueva
    });

    test('recordTask completa la MISMA fila: no se cuenta dos veces', async () => {
        const antes = await usage.currentPeriodUsage(appId);
        const res = await reservar();
        await usage.recordTask({
            appId, tenantId: 't', taskId: 'tarea-real-1', department: 'support', planId: 'creator_pro',
            billedAs: res.billedAs, reservationId: res.reservationId,
        });
        const despues = await usage.currentPeriodUsage(appId);
        expect(despues.tasks - antes.tasks).toBe(1);
        expect(await filas(appId, 'reserved')).toBe(0);
        const { rows } = await db.query('SELECT task_id, status FROM operant_tasks WHERE app_id = $1', [appId]);
        expect(rows).toHaveLength(1);
        expect(rows[0].task_id).toBe('tarea-real-1');
    });

    test('el tope de tareas frontier también es atómico', async () => {
        const tope = PLAN_MATRIX.creator_pro.frontierCap;
        await db.query(
            `INSERT INTO operant_tasks (app_id, tenant_id, task_id, department, tier, billed_as)
             SELECT $1, 't', 'f-' || g, 'sales', 'frontier', 'quota' FROM generate_series(1, $2) g`, [appId, tope - 1]);
        const r = await Promise.all(Array.from({ length: 6 }, () => reservar({ department: 'sales' })));
        expect(r.filter((x) => x.allowed && x.billedAs === 'quota')).toHaveLength(1);
        expect(r.filter((x) => !x.allowed)).toHaveLength(5);
    });

    test('peticiones de apps distintas no se esperan ni se mezclan', async () => {
        const otra = await crearApp();
        try {
            await rellenar(appId, PLAN_MATRIX.creator_pro.includedTasks - 1);
            await rellenar(otra, PLAN_MATRIX.creator_pro.includedTasks - 1);
            const r = await Promise.all([
                usage.reserveTask({ appId, tenantId: 't', planId: 'creator_pro', department: 'support' }),
                usage.reserveTask({ appId: otra, tenantId: 't', planId: 'creator_pro', department: 'support' }),
            ]);
            expect(r.every((x) => x.allowed && x.billedAs === 'quota')).toBe(true);
        } finally {
            await db.query('DELETE FROM app_registry WHERE id = $1', [otra]);
        }
    });
});
