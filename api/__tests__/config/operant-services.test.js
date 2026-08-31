/**
 * operant-services.test.js — el modelo económico de OPERANT como SubApp.
 *
 * Estos tests no comprueban "que la función devuelva algo": fijan las
 * invariantes de negocio que, si se rompen, hacen perder dinero en silencio.
 * Un cambio de precio de Anthropic, una cuota subida a ojo o un departamento
 * movido de tier deben hacer saltar algo aquí ANTES de llegar a una factura.
 */

const {
    DEPARTMENTS, PLAN_MATRIX, estimateTaskCost, worstCaseMonthlyCost,
    resolveEntitlements, planAllowsDepartment, describeCatalog, priceCard,
} = require('../../config/operant-services');
const { PLANS, ACTIVATABLE_SUBAPPS } = require('../../config/plans');
const { EUR_PER_CREDIT, MARGIN_RATE } = require('../../config/usage-pricing');

/** Margen bruto mínimo aceptable de un plan si el cliente agota su cuota. */
const MIN_GROSS_MARGIN = 0.50;

describe('OPERANT — catálogo y planes', () => {
    test('la SubApp está activable en la suscripción', () => {
        expect(ACTIVATABLE_SUBAPPS).toContain('operant');
    });

    test('todo plan de la matriz existe en plans.js y viceversa', () => {
        const planIds = PLANS.map((p) => p.id).sort();
        expect(Object.keys(PLAN_MATRIX).sort()).toEqual(planIds);
    });

    test('los departamentos de cada plan existen en el registro', () => {
        const known = new Set(DEPARTMENTS.map((d) => d.id));
        for (const plan of Object.values(PLAN_MATRIX)) {
            for (const dep of plan.departments) {
                expect(known.has(dep)).toBe(true);
            }
        }
    });

    test('los planes son acumulativos: nadie pierde departamentos al subir', () => {
        const order = ['starter', 'creator_pro', 'business', 'enterprise_vip'];
        for (let i = 1; i < order.length; i++) {
            const lower = PLAN_MATRIX[order[i - 1]].departments;
            const higher = new Set(PLAN_MATRIX[order[i]].departments);
            for (const dep of lower) {
                expect(higher.has(dep)).toBe(true);
            }
        }
    });

    test('Enterprise VIP incluye los 10 departamentos', () => {
        expect(PLAN_MATRIX.enterprise_vip.departments).toHaveLength(DEPARTMENTS.length);
    });
});

describe('OPERANT — coste y precio por tarea', () => {
    test('el precio nunca queda por debajo del coste real', () => {
        for (const dept of DEPARTMENTS) {
            const c = estimateTaskCost(dept.id);
            expect(c.billableEUR).toBeGreaterThan(c.rawCostEUR);
            expect(c.margin).toBe(MARGIN_RATE);
        }
    });

    test('los créditos cubren el importe facturable (nunca se redondea a la baja)', () => {
        for (const dept of DEPARTMENTS) {
            const c = estimateTaskCost(dept.id);
            expect(c.credits * EUR_PER_CREDIT).toBeGreaterThanOrEqual(c.billableEUR);
            expect(c.credits).toBeGreaterThanOrEqual(1);
        }
    });

    test('una tarea frontier cuesta más que una mid: la cuota no puede ignorar el mix', () => {
        const frontier = estimateTaskCost('sales');       // Opus
        const mid = estimateTaskCost('support');          // Sonnet
        expect(frontier.rawCostEUR).toBeGreaterThan(mid.rawCostEUR);
        expect(frontier.aiActions).toBeGreaterThan(mid.aiActions);
    });

    test('con tokens reales el coste es medido, no estimado', () => {
        const estimado = estimateTaskCost('support');
        const medido = estimateTaskCost('support', { inputTokens: 60_000, outputTokens: 12_000 });
        expect(medido.rawCostEUR).toBeGreaterThan(estimado.rawCostEUR);
        expect(medido.inputTokens).toBe(60_000);
    });

    test('cada especialista extra suma coste de cómputo, no solo tokens', () => {
        const base = estimateTaskCost('operations');
        const conExtras = estimateTaskCost('operations', { specialists: 4 });
        expect(conExtras.rawCostEUR).toBeGreaterThan(base.rawCostEUR);
        expect(conExtras.aiActions).toBe(base.aiActions + 2);
    });

    test('un departamento inexistente falla en voz alta', () => {
        expect(() => estimateTaskCost('marketing-galactico')).toThrow(/Unknown OPERANT department/);
    });
});

describe('OPERANT — dimensionado de las cuotas', () => {
    test.each(['creator_pro', 'business', 'enterprise_vip'])(
        '%s conserva al menos el 50%% de margen bruto agotando la cuota en el peor mix',
        (planId) => {
            const plan = PLANS.find((p) => p.id === planId);
            const worst = worstCaseMonthlyCost(planId);
            const margin = 1 - worst.totalCostEUR / plan.priceEUR;
            expect(margin).toBeGreaterThanOrEqual(MIN_GROSS_MARGIN);
        }
    );

    test('el coste del anclaje continuo está contabilizado, no ignorado', () => {
        // 8.640 tx/mes no son gratis: si alguien pone `continuous` en un plan
        // barato, este número lo delata.
        const worst = worstCaseMonthlyCost('enterprise_vip');
        expect(worst.anchorCostEUR).toBeGreaterThan(0);
        expect(worst.totalCostEUR).toBeGreaterThan(worst.taskCostEUR);
    });

    test('Starter no incluye tareas: es pago por uso puro', () => {
        expect(PLAN_MATRIX.starter.includedTasks).toBe(0);
        expect(PLAN_MATRIX.starter.overage).toBe('payg');
    });

    test('el tope de tareas frontier nunca supera la cuota total', () => {
        for (const plan of Object.values(PLAN_MATRIX)) {
            if (plan.frontierCap === null || plan.includedTasks === null) continue;
            expect(plan.frontierCap).toBeLessThanOrEqual(plan.includedTasks || Infinity);
        }
    });
});

describe('OPERANT — entitlements', () => {
    test('sin la SubApp activada, enabled es false pero se informa del plan', () => {
        const ent = resolveEntitlements('business', ['pay']);
        expect(ent.enabled).toBe(false);
        expect(ent.departments).toEqual(PLAN_MATRIX.business.departments);
    });

    test('con la SubApp activada, enabled es true', () => {
        expect(resolveEntitlements('business', ['operant']).enabled).toBe(true);
    });

    test('un plan desconocido cae a Starter, nunca al más generoso', () => {
        const ent = resolveEntitlements('plan-inventado', ['operant']);
        expect(ent.departments).toEqual(PLAN_MATRIX.starter.departments);
    });

    test('planAllowsDepartment respeta la matriz', () => {
        expect(planAllowsDepartment('starter', 'sales')).toBe(true);
        expect(planAllowsDepartment('starter', 'fundraising')).toBe(false);
        expect(planAllowsDepartment('enterprise_vip', 'fundraising')).toBe(true);
    });

    test('el anclaje on-chain empieza en Creator Pro', () => {
        expect(PLAN_MATRIX.starter.onchain).not.toContain('auditAnchor');
        expect(PLAN_MATRIX.creator_pro.onchain).toContain('auditAnchor');
    });

    test('las capacidades on-chain son acumulativas al subir de plan', () => {
        const order = ['starter', 'creator_pro', 'business', 'enterprise_vip'];
        for (let i = 1; i < order.length; i++) {
            const higher = new Set(PLAN_MATRIX[order[i]].onchain);
            for (const f of PLAN_MATRIX[order[i - 1]].onchain) {
                expect(higher.has(f)).toBe(true);
            }
        }
    });
});

describe('OPERANT — catálogo público', () => {
    test('describeCatalog es serializable y no filtra nada interno', () => {
        const cat = describeCatalog();
        const json = JSON.stringify(cat);
        expect(json).not.toMatch(/sk_|secret|privateKey|password/i);
        expect(cat.departments).toHaveLength(DEPARTMENTS.length);
        expect(cat.plans).toHaveLength(Object.keys(PLAN_MATRIX).length);
    });

    test('la tarifa pública lista un precio por tier de modelo', () => {
        const card = priceCard();
        expect(card.frontier.pricePerTaskEUR).toBeGreaterThan(card.mid.pricePerTaskEUR);
    });
});
