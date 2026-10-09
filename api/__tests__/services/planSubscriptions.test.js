/**
 * Planes: una compra nunca se pierde, se asigna sólo a quien la justifica y el
 * acceso sigue al estado de la suscripción en Stripe.
 */
const { mockQuery } = require('../helpers');
const planes = require('../../services/planSubscriptions');

const APP = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const sesion = (extra = {}) => ({
    id: 'cs_live_abc123', customer: 'cus_1', subscription: 'sub_1',
    customer_details: { email: 'cliente@ejemplo.com' },
    metadata: { plan_id: 'creator_pro', billing: 'monthly' }, ...extra,
});
const llamadas = (re) => mockQuery.mock.calls.filter(([sql]) => re.test(sql));

// Simula la base: responde según la sentencia.
function base({ appActiva = true, insertada = true, reclamable = true, appDeOrg = true, compraPorSub = true } = {}) {
    mockQuery.mockImplementation(async (sql, params) => {
        if (/FROM app_registry a\s+JOIN organizations/.test(sql)) return { rows: appDeOrg ? [{}] : [] };
        if (/FROM app_registry WHERE id/.test(sql)) return { rows: appActiva ? [{}] : [] };
        if (/INSERT INTO plan_purchases/.test(sql)) {
            if (!insertada) return { rows: [] };
            return { rows: [{ id: 1, plan_id: params[5], billing: params[6], app_id: params[7], assigned_via: params[8],
                stripe_customer_id: params[2], stripe_subscription_id: params[3], status: params[9] }] };
        }
        if (/UPDATE plan_purchases SET app_id/.test(sql)) {
            return { rows: reclamable ? [{ id: 1, plan_id: 'business', billing: 'annual', app_id: params[1], stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'active' }] : [] };
        }
        if (/UPDATE plan_purchases SET status = 'refunded'/.test(sql)) return { rows: compraPorSub ? [{ id: 1 }] : [], rowCount: compraPorSub ? 1 : 0 };
        if (/UPDATE plan_purchases/.test(sql)) return { rows: [{ id: 1 }], rowCount: 1 };
        if (/UPDATE gateway_subscriptions/.test(sql)) return { rows: [{ app_id: APP }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
    });
}

beforeEach(() => mockQuery.mockReset());

describe('registrarCompra', () => {
    it('con client_reference_id de una app activa: registra y activa el plan con los ids de Stripe', async () => {
        base();
        const r = await planes.registrarCompra(sesion({ client_reference_id: APP }), { eventId: 'evt_1' });
        expect(r.estado).toBe('activado');
        const [[, p]] = llamadas(/INSERT INTO gateway_subscriptions/);
        expect(p).toEqual([APP, 'creator_pro', 'cus_1', 'sub_1']);
    });

    it('sin app: queda pendiente y NO toca gateway_subscriptions', async () => {
        base();
        const r = await planes.registrarCompra(sesion(), { eventId: 'evt_2' });
        expect(r.estado).toBe('pendiente');
        expect(llamadas(/INSERT INTO plan_purchases/)[0][1]).toEqual(expect.arrayContaining(['pending_assignment', 'cliente@ejemplo.com']));
        expect(llamadas(/gateway_subscriptions/)).toHaveLength(0);
    });

    it('un client_reference_id que no es una app activa no se usa (pendiente)', async () => {
        base({ appActiva: false });
        expect((await planes.registrarCompra(sesion({ client_reference_id: APP }))).estado).toBe('pendiente');
        expect(llamadas(/gateway_subscriptions/)).toHaveLength(0);
    });

    it('evento repetido: no se activa dos veces', async () => {
        base({ insertada: false });
        expect((await planes.registrarCompra(sesion({ client_reference_id: APP }))).estado).toBe('repetido');
        expect(llamadas(/gateway_subscriptions/)).toHaveLength(0);
    });

    it('plan desconocido: no registra nada', async () => {
        base();
        expect((await planes.registrarCompra(sesion({ metadata: { plan_id: 'inventado' } }))).estado).toBe('plan_desconocido');
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

describe('reclamar', () => {
    it('asigna la compra pendiente a una app de la organización y activa el plan', async () => {
        base();
        const c = await planes.reclamar({ sessionId: 'cs_live_abc123', appId: APP, orgId: ORG, userId: 'u1' });
        expect(c.app_id).toBe(APP);
        expect(llamadas(/INSERT INTO gateway_subscriptions/)[0][1]).toEqual([APP, 'business', 'cus_1', 'sub_1']);
    });

    it('una app de otra organización: 403 y nada cambia', async () => {
        base({ appDeOrg: false });
        await expect(planes.reclamar({ sessionId: 'cs_live_abc123', appId: APP, orgId: ORG }))
            .rejects.toMatchObject({ code: 'APP_AJENA', status: 403 });
        expect(llamadas(/UPDATE plan_purchases/)).toHaveLength(0);
    });

    it('ya asignada o inexistente: 409, sin activar nada', async () => {
        base({ reclamable: false });
        await expect(planes.reclamar({ sessionId: 'cs_live_abc123', appId: APP, orgId: ORG }))
            .rejects.toMatchObject({ code: 'NO_RECLAMABLE', status: 409 });
        expect(llamadas(/gateway_subscriptions/)).toHaveLength(0);
    });

    it('un id de sesión mal formado se rechaza antes de consultar', async () => {
        base();
        await expect(planes.reclamar({ sessionId: "cs_live_x' OR 1=1", appId: APP, orgId: ORG }))
            .rejects.toMatchObject({ code: 'SESION_INVALIDA' });
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

describe('ciclo de vida', () => {
    it.each([
        ['active', false, 'active'], ['trialing', false, 'active'], ['past_due', false, 'past_due'],
        ['unpaid', false, 'past_due'], ['canceled', false, 'canceled'], ['active', true, 'canceled'],
    ])('Stripe %s (borrada=%s) → %s', (status, borrada, esperado) => {
        expect(planes.estadoDe({ status }, borrada)).toBe(esperado);
    });

    it('suscripción cancelada: el plan de la app pasa a canceled', async () => {
        base();
        const r = await planes.alCambiarSuscripcion({ id: 'sub_1', status: 'canceled' }, { borrada: true });
        expect(r).toEqual({ estado: 'canceled', apps: [APP] });
        expect(llamadas(/UPDATE gateway_subscriptions/)[0][1].slice(0, 2)).toEqual(['sub_1', 'canceled']);
    });

    it('renovación: actualiza renews_at con el fin de periodo del item (API nueva)', async () => {
        base();
        await planes.alCambiarSuscripcion({ id: 'sub_1', status: 'active', items: { data: [{ current_period_end: 1893456000 }] } });
        expect(llamadas(/UPDATE gateway_subscriptions/)[0][1][2]).toEqual(new Date(1893456000 * 1000));
    });

    const stripeCon = (invoice) => ({
        charges: { retrieve: jest.fn(async () => ({ id: 'ch_1', invoice })) },
        subscriptions: { cancel: jest.fn(async () => ({})) },
    });

    it('reembolso completo de la factura de un plan: corta el acceso y cancela la suscripción', async () => {
        base();
        const s = stripeCon({ id: 'in_1', subscription: 'sub_1' });
        const r = await planes.alReembolsar({ id: 'ch_1', refunded: true, customer: 'cus_1' }, s);
        expect(r).toMatchObject({ accion: 'plan_cancelado', subId: 'sub_1', stripeCancelada: true });
        expect(s.subscriptions.cancel).toHaveBeenCalledWith('sub_1');
        expect(llamadas(/UPDATE gateway_subscriptions SET status = 'canceled'/)).toHaveLength(1);
    });

    it('factura con la forma de la API nueva (parent.subscription_details)', async () => {
        base();
        const s = stripeCon({ id: 'in_1', parent: { subscription_details: { subscription: 'sub_1' } } });
        expect((await planes.alReembolsar({ id: 'ch_1', refunded: true, customer: 'cus_1' }, s)).subId).toBe('sub_1');
    });

    it('reembolso parcial: el plan no se toca', async () => {
        base();
        const s = stripeCon({ id: 'in_1', subscription: 'sub_1' });
        expect((await planes.alReembolsar({ id: 'ch_1', refunded: false, customer: 'cus_1' }, s)).accion).toBe('ninguna');
        expect(s.charges.retrieve).not.toHaveBeenCalled();
    });

    it('reembolso de un cargo sin factura (compra de BEZ): el plan no se toca', async () => {
        base();
        const s = stripeCon(null);
        expect((await planes.alReembolsar({ id: 'ch_1', refunded: true, customer: 'cus_1' }, s)).accion).toBe('ninguna');
        expect(s.subscriptions.cancel).not.toHaveBeenCalled();
    });

    it('suscripción que no es de un plan de la plataforma: no se cancela nada', async () => {
        base({ compraPorSub: false });
        const s = stripeCon({ id: 'in_1', subscription: 'sub_otro' });
        expect((await planes.alReembolsar({ id: 'ch_1', refunded: true, customer: 'cus_1' }, s)).accion).toBe('ninguna');
        expect(s.subscriptions.cancel).not.toHaveBeenCalled();
    });
});
