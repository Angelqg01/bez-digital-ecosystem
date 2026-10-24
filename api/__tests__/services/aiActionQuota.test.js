/**
 * aiActionQuota — cupo mensual de acciones de IA por plan (config/plans.js: aiActions).
 *
 * Se prueba sin el mock global de __tests__/helpers.js (que deja pasar todo): aquí
 * importa el recuento real, en memoria y contra una base simulada que reproduce la
 * transacción con candado.
 */
const { crearCupoAcciones, AiQuotaError, limiteDe, SQL_USADAS, clave } = require('../../services/aiActionQuota');

const APP = { id: 'app-1', scopes: ['token', 'wallet'] };

describe('aiActionQuota: límites por plan', () => {
    it('lee aiActions de config/plans.js; null es ilimitado', () => {
        expect(limiteDe('starter')).toBe(150);
        expect(limiteDe('creator_pro')).toBe(1500);
        expect(limiteDe('business')).toBe(15000);
        expect(limiteDe('enterprise_vip')).toBe(Infinity);
    });

    it('un plan desconocido no tiene cupo: niega, no regala', () => {
        expect(limiteDe('business_v2')).toBe(0);
    });
});

describe('aiActionQuota en memoria', () => {
    it('cuenta hasta el límite y a partir de ahí lanza 402 QUOTA_EXCEEDED', async () => {
        const cupo = crearCupoAcciones();
        for (let i = 1; i <= 150; i++) {
            const r = await cupo.reservar({ app: APP, plan: 'starter' });
            expect(r.used).toBe(i);
            expect(r.limit).toBe(150);
        }
        const err = await cupo.reservar({ app: APP, plan: 'starter' }).catch((e) => e);
        expect(err).toBeInstanceOf(AiQuotaError);
        expect(err.status).toBe(402);
        expect(err.code).toBe('QUOTA_EXCEEDED');
        expect(err.limit).toBe(150);
        expect(err.used).toBe(150);
        expect(new Date(err.resetsAt).getUTCDate()).toBe(1);
    });

    it('anular devuelve la acción una sola vez aunque se llame dos', async () => {
        const cupo = crearCupoAcciones();
        await cupo.reservar({ app: APP, plan: 'starter' });
        const r = await cupo.reservar({ app: APP, plan: 'starter' });
        await cupo.anular(r);
        await cupo.anular(r);
        expect(await cupo.usadas(APP.id)).toBe(1);
    });

    it('las apps no comparten contador', async () => {
        const cupo = crearCupoAcciones();
        await cupo.reservar({ app: APP, plan: 'starter' });
        await cupo.reservar({ app: { id: 'app-2', scopes: [] }, plan: 'starter' });
        expect(await cupo.usadas('app-1')).toBe(1);
        expect(await cupo.usadas('app-2')).toBe(1);
    });

    it('ilimitado: nunca bloquea y lo informa como limit null', async () => {
        const cupo = crearCupoAcciones();
        const r = await cupo.reservar({ app: APP, plan: 'enterprise_vip' });
        expect(r.limit).toBeNull();
        expect(await cupo.consumo({ app: APP, plan: 'enterprise_vip' })).toMatchObject({ used: 1, limit: null });
    });

    it('las claves internas (scope admin) no gastan cupo', async () => {
        const cupo = crearCupoAcciones();
        const r = await cupo.reservar({ app: { id: 'interna', scopes: ['admin'] }, plan: 'starter' });
        expect(r).toEqual({ interna: true });
        expect(await cupo.usadas('interna')).toBe(0);
    });
});

/** Base simulada: guarda el contador y registra cada consulta de la transacción. */
function baseSimulada({ usadasIniciales = 0 } = {}) {
    let usadas = usadasIniciales;
    const llamadas = [];
    const ejecutar = async (sql, params) => {
        llamadas.push({ sql: String(sql), params });
        if (sql === SQL_USADAS) return { rows: [{ n: usadas }] };
        if (/INSERT INTO ai_action_usage/.test(sql)) { usadas += 1; return { rows: [] }; }
        if (/UPDATE ai_action_usage SET used = GREATEST/.test(sql)) { usadas = Math.max(0, usadas - 1); return { rows: [] }; }
        if (/INSERT INTO gateway_usage_ledger/.test(sql)) { usadas += 1; return { rows: [{ id: usadas }] }; } // mensaje del chat
        return { rows: [] };
    };
    const client = { query: jest.fn(ejecutar), release: jest.fn() };
    return {
        db: { query: jest.fn(ejecutar), getClient: jest.fn().mockResolvedValue(client) },
        client, llamadas, usadas: () => usadas,
    };
}

describe('aiActionQuota con Postgres', () => {
    it('reserva dentro de una transacción con candado por app, y suma en la misma', async () => {
        const b = baseSimulada({ usadasIniciales: 10 });
        const cupo = crearCupoAcciones({ db: b.db });
        const r = await cupo.reservar({ app: APP, plan: 'creator_pro' });
        expect(r).toMatchObject({ used: 11, limit: 1500 });
        const sqls = b.llamadas.map((l) => l.sql);
        expect(sqls[0]).toBe('BEGIN');
        expect(sqls[1]).toMatch(/pg_advisory_xact_lock/);
        expect(b.llamadas[1].params).toEqual([clave('app-1')]);
        expect(sqls[2]).toBe(SQL_USADAS);
        expect(sqls[3]).toMatch(/ON CONFLICT \(app_id, period\) DO UPDATE/);
        expect(sqls[4]).toBe('COMMIT');
        expect(b.client.release).toHaveBeenCalled();
    });

    it('con el cupo agotado hace ROLLBACK, no escribe y suelta la conexión', async () => {
        const b = baseSimulada({ usadasIniciales: 150 });
        const cupo = crearCupoAcciones({ db: b.db });
        await expect(cupo.reservar({ app: APP, plan: 'starter' })).rejects.toBeInstanceOf(AiQuotaError);
        const sqls = b.llamadas.map((l) => l.sql);
        expect(sqls).toContain('ROLLBACK');
        expect(sqls.some((s) => /INSERT INTO ai_action_usage/.test(s))).toBe(false);
        expect(b.usadas()).toBe(150);
        expect(b.client.release).toHaveBeenCalled();
    });

    it('el recuento suma el chat (ai_chat en el ledger) y el REST/MCP: el cupo es uno', () => {
        expect(SQL_USADAS).toMatch(/gateway_usage_ledger[\s\S]*action = 'ai_chat'/);
        expect(SQL_USADAS).toMatch(/ai_action_usage/);
    });

    it('un error de la base hace ROLLBACK y se propaga (el llamante no deja pasar)', async () => {
        const b = baseSimulada();
        b.client.query.mockImplementation(async (sql) => {
            if (sql === SQL_USADAS) throw new Error('connection reset');
            return { rows: [] };
        });
        const cupo = crearCupoAcciones({ db: b.db });
        await expect(cupo.reservar({ app: APP, plan: 'starter' })).rejects.toThrow('connection reset');
        expect(b.client.query).toHaveBeenCalledWith('ROLLBACK');
        expect(b.client.release).toHaveBeenCalled();
    });

    it('ilimitado: suma sin candado ni recuento', async () => {
        const b = baseSimulada();
        const cupo = crearCupoAcciones({ db: b.db });
        await cupo.reservar({ app: APP, plan: 'enterprise_vip' });
        const sqls = b.llamadas.map((l) => l.sql);
        expect(sqls.some((s) => /pg_advisory_xact_lock/.test(s))).toBe(false);
        expect(sqls.some((s) => /INSERT INTO ai_action_usage/.test(s))).toBe(true);
    });

    it('anular resta sin bajar de cero', async () => {
        const b = baseSimulada({ usadasIniciales: 3 });
        const cupo = crearCupoAcciones({ db: b.db });
        const r = await cupo.reservar({ app: APP, plan: 'starter' });
        await cupo.anular(r);
        expect(b.usadas()).toBe(3);
    });
});

describe('el chat de la plataforma comparte el cupo', () => {
    const { crearFacturacionChat } = require('../../services/ai-workspace/billing');
    const principal = { appId: 'app-1', plan: 'starter', userId: 'u1', roles: [] };

    it('cuenta con el mismo recuento (chat + REST/MCP) y bajo el mismo candado', async () => {
        const b = baseSimulada({ usadasIniciales: 149 });
        const chat = crearFacturacionChat({ db: b.db, reportar: jest.fn() });
        const r = await chat.reservar(principal);
        expect(r.used).toBe(150);
        const lock = b.llamadas.find((l) => /pg_advisory_xact_lock/.test(l.sql));
        expect(lock.params).toEqual([clave('app-1')]);
        expect(b.llamadas.some((l) => l.sql === SQL_USADAS)).toBe(true);
    });

    it('si el REST/MCP agotó el cupo, el chat también responde QUOTA_EXCEEDED', async () => {
        const b = baseSimulada({ usadasIniciales: 150 });
        const chat = crearFacturacionChat({ db: b.db, reportar: jest.fn() });
        await expect(chat.reservar(principal)).rejects.toMatchObject({ status: 402, code: 'QUOTA_EXCEEDED' });
    });
});
