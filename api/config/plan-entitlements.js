'use strict';

/**
 * config/plan-entitlements.js — qué cambia de verdad al subir de plan.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL PROBLEMA QUE RESUELVE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `config/plans.js` define cuatro planes y, hasta ahora, lo único que escalaba
 * entre ellos era `aiActions`: cuántas veces puedes hacer lo mismo. Eso no es
 * una suscripción, es un contador. Un cliente que paga 2.499 € y otro que paga
 * 99 € veían EXACTAMENTE el mismo catálogo de herramientas, el mismo dato de
 * mercado y el mismo límite de llamadas.
 *
 * Aquí se define lo que sí distingue a un plan de otro, en cinco ejes:
 *
 *   1. CATÁLOGO      — qué herramientas existen para ti.
 *   2. RAZONAMIENTO  — con qué calidad de modelo se resuelve tu petición.
 *   3. MERCADO       — cómo de fresco es el dato que recibes.
 *   4. LÍMITES       — cuántas llamadas por minuto.
 *   5. PRIVACIDAD    — qué se guarda de tu uso.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ EL RAZONAMIENTO SE VENDE POR NIVEL Y NO POR NOMBRE DE MODELO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La tentación comercial es poner «Opus 5» en la tabla de precios. Sería atarse
 * a que un proveedor no suba tarifas ni retire un modelo: el día que lo haga,
 * o se incumple lo vendido o se come el margen. Se vende «razonamiento
 * avanzado» y aquí dentro se decide qué modelo lo sirve hoy.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  POR QUÉ LA FRESCURA DEL MERCADO ES UN EJE Y NO UNA TRAMPA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Servir dato diferido en el plan gratuito es práctica normal en datos de
 * mercado, y lo que la hace honesta es DECIRLO: cada respuesta lleva su edad y
 * su retraso declarado. Un precio de hace quince minutos presentado como actual
 * sería otra cosa, y quien opere con él va a perder dinero por nuestra culpa.
 */

const { PLANS } = require('./plans');

/** Orden de menor a mayor. Sirve para comparar «alcanza el mínimo». */
const ORDEN = ['starter', 'creator_pro', 'business', 'enterprise_vip'];

/*
 * ═══════════════════════════════════════════════════════════════════════════
 *  EL SEXTO EJE: OPERACIONES CON FONDOS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Qué carriles de dinero abre cada plan y con qué techo, en euros. Lo aplica
 * services/txPolicyEngine.js y el límite efectivo es SIEMPRE el más restrictivo
 * entre este y el del agente que opere.
 *
 *   porOperacionEur / diarioEur / mensualEur   techos duros: por encima, DENY.
 *   aprobacionDesdeEur    desde aquí hace falta aprobación humana firmada,
 *                         también cuando el cliente firma desde su wallet.
 *   dobleAprobacionDesdeEur  desde aquí, dos aprobadores distintos.
 *
 * FIAT→FIAT sólo en Enterprise: es el carril que exige socio con licencia de
 * pago y KYB completo, y el que más coste de cumplimiento arrastra.
 */
const RAIL = (porOperacionEur, diarioEur, mensualEur, aprobacionDesdeEur) =>
    Object.freeze({ porOperacionEur, diarioEur, mensualEur, aprobacionDesdeEur });

const ENTITLEMENTS = {
    starter: {
        // Sólo consulta de token y mercado: lo justo para probar la plataforma.
        planMinimoHerramientas: 'starter',
        razonamiento: {
            nivel: 'basico',
            modelo: 'claude-haiku-4-5',
            descripcion: 'Respuestas rápidas para consultas directas.',
        },
        mercado: {
            // Diferido, y dicho en cada respuesta.
            retrasoSegundos: 900,
            historico: false,
            oraclePorCadena: false,
        },
        limites: { mcpPorMinuto: 30, erpPorMinuto: 0 },
        privacidad: {
            regimen: 'telemetria_estandar',
            episodios: true,          // alimenta la mejora del servicio
            optOut: false,            // en el plan gratuito no se puede desactivar
            nota: 'Se recoge telemetría de uso seudonimizada. El contenido de tus operaciones no se usa para entrenar.',
        },
        erpGestionado: false,
        nodos: [],
        operaciones: {
            // El plan gratuito consulta; no mueve dinero de nadie.
            rails: {},
            dobleAprobacionDesdeEur: 0,
        },
    },

    creator_pro: {
        planMinimoHerramientas: 'creator_pro',
        razonamiento: {
            nivel: 'estandar',
            modelo: 'claude-sonnet-5',
            descripcion: 'Equilibrio entre profundidad y coste para el día a día.',
        },
        mercado: { retrasoSegundos: 0, historico: false, oraclePorCadena: false },
        limites: { mcpPorMinuto: 120, erpPorMinuto: 0 },
        privacidad: {
            regimen: 'telemetria_estandar',
            episodios: true,
            optOut: true,
            nota: 'Telemetría seudonimizada con desactivación disponible en el panel.',
        },
        erpGestionado: false,
        nodos: [],
        operaciones: {
            rails: {
                crypto_transfer: RAIL(1000, 3000, 15000, 250),
                fiat_to_crypto: RAIL(1000, 3000, 15000, 250),
            },
            dobleAprobacionDesdeEur: 1000,
        },
    },

    business: {
        planMinimoHerramientas: 'business',
        razonamiento: {
            nivel: 'avanzado',
            modelo: 'claude-opus-5',
            descripcion: 'Razonamiento profundo para flujos con varios pasos.',
        },
        mercado: { retrasoSegundos: 0, historico: true, oraclePorCadena: true },
        limites: { mcpPorMinuto: 600, erpPorMinuto: 60 },
        privacidad: {
            // Se vende como feature, así que tiene que ser cierto: para estos
            // inquilinos la capa de episodios NI SE ESCRIBE.
            regimen: 'zero_retention',
            episodios: false,
            optOut: true,
            nota: 'Zero-retention: no se conserva nada más allá de prestar el servicio.',
        },
        erpGestionado: true,
        nodos: ['edge'],
        operaciones: {
            rails: {
                crypto_transfer: RAIL(10000, 50000, 250000, 2500),
                fiat_to_crypto: RAIL(10000, 50000, 250000, 2500),
                crypto_to_fiat: RAIL(10000, 25000, 150000, 2500),
            },
            dobleAprobacionDesdeEur: 10000,
        },
    },

    enterprise_vip: {
        planMinimoHerramientas: 'enterprise_vip',
        razonamiento: {
            nivel: 'extendido',
            modelo: 'claude-opus-5',
            presupuestoAmpliado: true,
            descripcion: 'Razonamiento extendido y varios agentes en paralelo.',
        },
        mercado: { retrasoSegundos: 0, historico: true, oraclePorCadena: true, feedsDedicados: true },
        limites: { mcpPorMinuto: 1200, erpPorMinuto: 240 },
        privacidad: {
            regimen: 'zero_retention',
            episodios: false,
            optOut: true,
            nota: 'Zero-retention con residencia dedicada.',
        },
        erpGestionado: true,
        nodos: ['edge', 'enterprise'],
        operaciones: {
            rails: {
                crypto_transfer: RAIL(100000, 500000, 5000000, 10000),
                fiat_to_crypto: RAIL(100000, 500000, 5000000, 10000),
                crypto_to_fiat: RAIL(100000, 500000, 3000000, 10000),
                fiat_to_fiat: RAIL(100000, 500000, 3000000, 10000),
            },
            dobleAprobacionDesdeEur: 25000,
        },
    },
};

/** Plan de quien no tiene fila de suscripción. El más restrictivo, nunca el más generoso. */
const PLAN_POR_DEFECTO = 'starter';

function getEntitlements(planId) {
    return ENTITLEMENTS[planId] || ENTITLEMENTS[PLAN_POR_DEFECTO];
}

/**
 * ¿El plan contratado llega al mínimo exigido?
 *
 * Un plan desconocido NO alcanza nada: si mañana alguien escribe 'business_v2'
 * en la base sin añadirlo aquí, lo seguro es negar, no conceder.
 */
function alcanza(planContratado, planMinimo) {
    const tiene = ORDEN.indexOf(planContratado);
    const exige = ORDEN.indexOf(planMinimo);
    if (tiene < 0 || exige < 0) return false;
    return tiene >= exige;
}

/** Ficha para `bezhas_subscription`: qué te da tu plan, dicho en claro. */
function describirPlan(planId) {
    const e = getEntitlements(planId);
    const plan = PLANS.find((p) => p.id === planId);
    return {
        plan: planId,
        nombre: plan?.name || planId,
        razonamiento: {
            nivel: e.razonamiento.nivel,
            descripcion: e.razonamiento.descripcion,
            // El modelo concreto NO se publica: se vende el nivel, no la marca.
        },
        mercado: {
            tiempoReal: e.mercado.retrasoSegundos === 0,
            retrasoSegundos: e.mercado.retrasoSegundos,
            historico: e.mercado.historico,
            oraclePorCadena: e.mercado.oraclePorCadena,
        },
        limites: e.limites,
        privacidad: { regimen: e.privacidad.regimen, optOut: e.privacidad.optOut, nota: e.privacidad.nota },
        erpGestionado: e.erpGestionado,
        nodosDisponibles: e.nodos,
        operaciones: {
            carriles: Object.fromEntries(Object.entries(e.operaciones?.rails || {}).map(([rail, l]) => [rail, {
                porOperacionEur: l.porOperacionEur,
                diarioEur: l.diarioEur,
                mensualEur: l.mensualEur,
                aprobacionDesdeEur: l.aprobacionDesdeEur,
            }])),
            dobleAprobacionDesdeEur: e.operaciones?.dobleAprobacionDesdeEur ?? null,
            nota: 'Toda operación con fondos se prepara como intención, pasa política y riesgo, y se ejecuta con aprobación firmada.',
        },
    };
}

module.exports = {
    ENTITLEMENTS, ORDEN, PLAN_POR_DEFECTO,
    getEntitlements, alcanza, describirPlan,
};
