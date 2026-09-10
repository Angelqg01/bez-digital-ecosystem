const e = require('../../config/plan-entitlements');
const { PLANS } = require('../../config/plans');

describe('plan-entitlements', () => {
    describe('los cuatro planes se distinguen de verdad', () => {
        it('cada plan de plans.js tiene sus derechos definidos', () => {
            // Si se añade un plan comercial y se olvida aquí, sus clientes
            // caerían al plan por defecto sin que nadie se entere.
            for (const p of PLANS) {
                expect(e.ENTITLEMENTS[p.id]).toBeDefined();
            }
        });

        it('los cinco ejes escalan y ninguno va hacia atrás', () => {
            let limiteAnterior = 0;
            let retrasoAnterior = Infinity;
            for (const plan of e.ORDEN) {
                const ent = e.getEntitlements(plan);
                expect(ent.limites.mcpPorMinuto).toBeGreaterThan(limiteAnterior);
                expect(ent.mercado.retrasoSegundos).toBeLessThanOrEqual(retrasoAnterior);
                limiteAnterior = ent.limites.mcpPorMinuto;
                retrasoAnterior = ent.mercado.retrasoSegundos;
            }
        });
    });

    describe('alcanza()', () => {
        it('un plan alcanza el suyo y los de abajo', () => {
            expect(e.alcanza('business', 'business')).toBe(true);
            expect(e.alcanza('business', 'starter')).toBe(true);
            expect(e.alcanza('starter', 'business')).toBe(false);
        });

        it('un plan desconocido no alcanza NADA', () => {
            // Si mañana alguien escribe 'business_v2' en la base sin añadirlo
            // aquí, lo seguro es negar, no conceder.
            expect(e.alcanza('business_v2', 'starter')).toBe(false);
            expect(e.alcanza(undefined, 'starter')).toBe(false);
            expect(e.alcanza(null, 'starter')).toBe(false);
        });

        it('un mínimo desconocido tampoco se concede', () => {
            expect(e.alcanza('enterprise_vip', 'plan_inventado')).toBe(false);
        });
    });

    describe('privacidad', () => {
        it('zero-retention significa que la capa de episodios NI SE ESCRIBE', () => {
            // Se vende como feature, así que tiene que ser cierto.
            for (const plan of ['business', 'enterprise_vip']) {
                const ent = e.getEntitlements(plan);
                expect(ent.privacidad.regimen).toBe('zero_retention');
                expect(ent.privacidad.episodios).toBe(false);
            }
        });

        it('los planes con telemetría lo declaran y dicen qué NO se usa', () => {
            for (const plan of ['starter', 'creator_pro']) {
                const ent = e.getEntitlements(plan);
                expect(ent.privacidad.episodios).toBe(true);
                expect(ent.privacidad.nota).toBeTruthy();
            }
            // El gratuito es el único sin opt-out, y es el trato: más barato
            // porque su telemetría alimenta la mejora del servicio.
            expect(e.getEntitlements('starter').privacidad.optOut).toBe(false);
            expect(e.getEntitlements('creator_pro').privacidad.optOut).toBe(true);
        });
    });

    describe('describirPlan()', () => {
        it('NO publica el nombre del modelo, sólo el nivel', () => {
            // Vender «Opus 5» ata el margen a que un proveedor no suba tarifas
            // ni retire el modelo. Se vende el nivel; el modelo se decide aquí.
            for (const plan of e.ORDEN) {
                const ficha = JSON.stringify(e.describirPlan(plan));
                expect(ficha).not.toMatch(/claude|opus|sonnet|haiku|gpt|gemini/i);
                expect(e.describirPlan(plan).razonamiento.nivel).toBeTruthy();
            }
        });

        it('dice el retraso del dato de mercado en claro', () => {
            expect(e.describirPlan('starter').mercado.tiempoReal).toBe(false);
            expect(e.describirPlan('starter').mercado.retrasoSegundos).toBe(900);
            expect(e.describirPlan('business').mercado.tiempoReal).toBe(true);
        });

        it('un plan desconocido cae al más restrictivo, no al más generoso', () => {
            const ficha = e.describirPlan('plan_inventado');
            expect(ficha.mercado.tiempoReal).toBe(false);
            expect(ficha.erpGestionado).toBe(false);
            expect(ficha.nodosDisponibles).toEqual([]);
        });
    });

    describe('coherencia con lo que el resto del sistema ya exige', () => {
        it('el ERP gestionado sólo desde Business, como dice la estrategia', () => {
            expect(e.getEntitlements('starter').erpGestionado).toBe(false);
            expect(e.getEntitlements('creator_pro').erpGestionado).toBe(false);
            expect(e.getEntitlements('business').erpGestionado).toBe(true);
        });

        it('los perfiles de nodo casan con node-profiles.js', () => {
            const { planPermite } = require('../../config/node-profiles');
            for (const plan of e.ORDEN) {
                for (const perfil of ['edge', 'enterprise']) {
                    expect(e.getEntitlements(plan).nodos.includes(perfil))
                        .toBe(planPermite(perfil, plan));
                }
            }
        });
    });
});
