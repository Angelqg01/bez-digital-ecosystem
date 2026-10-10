'use strict';

/**
 * services/costEstimate.js — cuánto cuesta algo ANTES de hacerlo.
 *
 * Lo usa la herramienta MCP `bezhas_cost_estimate`. La promesa comercial es que
 * una empresa con control de gasto pueda preguntar el coste antes de gastar
 * (docs/BEZHAS_MCP_ESTRATEGIA_CLIENTE.md, «la política de créditos opaca se
 * descarta»). Para que esa promesa sea verdad, este fichero NO tiene precios
 * propios: llama a las mismas funciones con las que se factura
 * (usage-pricing.calculateCallCost, operant-services.estimateTaskCost,
 * tokenomics.calculateFeeBreakdown). Si cambia una tarifa, la estimación cambia
 * con ella; no puede quedarse desfasada respecto a la factura.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  PRECIO DE LISTA ≠ LO QUE PAGAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cada línea devuelve el precio de lista (lo que vale la unidad) y además QUÉ
 * pagarías realmente con tu plan, que es lo que el agente necesita contarle a
 * su usuario:
 *
 *   · Starter factura por uso (middleware/gateway-metering.js sólo mide apps
 *     Starter): el precio de lista es lo que paga, tras 15 días de prueba.
 *   · Los demás planes pagan cuota fija; las llamadas no se miden una a una.
 *   · OPERANT tiene cuota propia de tareas por plan y cobra por uso al
 *     agotarla, y hay departamentos que un plan no incluye.
 *
 * Nunca se inventa el consumo del mes: no se sabe cuánta cuota le queda al
 * cliente, así que lo que depende de ella se devuelve aparte, como «si superas
 * la cuota», en vez de sumarlo a un total que parecería exacto y no lo es.
 */

const { calculateCallCost, EUR_PER_CREDIT, STARTER_TRIAL_DAYS } = require('../config/usage-pricing');
const { estimateTaskCost, PLAN_MATRIX, DEPARTMENT_BY_ID } = require('../config/operant-services');
const { calculateFeeBreakdown } = require('../config/tokenomics');
const { PLANS } = require('../config/plans');
const { getEntitlements, PLAN_POR_DEFECTO } = require('../config/plan-entitlements');

/** Unidades que se pueden estimar, con la acción de coste que usa la factura. */
const TIPOS = Object.freeze({
    llamada_api: { accion: 'api_call', etiqueta: 'Llamada a la API/SDK' },
    accion_ia: { accion: 'ai_action', etiqueta: 'Acción de IA orquestada' },
    consulta_oraculo: { accion: 'oracle_query', etiqueta: 'Consulta al oráculo' },
    relay_onchain: { accion: 'onchain_relay', etiqueta: 'Envío de transacción on-chain (relay)' },
    entrega_webhook: { accion: 'webhook_delivery', etiqueta: 'Entrega de webhook' },
    tarea_operant: { accion: null, etiqueta: 'Tarea de OPERANT' },
    compra_bez: { accion: null, etiqueta: 'Compra de BEZ-Coin' },
});

const MAX_LINEAS = 20;
const MAX_CANTIDAD = 1_000_000;

class CostEstimateError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CostEstimateError';
        this.status = 400;
        this.code = 'COST_ESTIMATE_INVALID';
    }
}

const r4 = (n) => Math.round(n * 1e4) / 1e4;
const eurDe = (creditos) => r4(creditos * EUR_PER_CREDIT);

function _cobertura(plan, tipo) {
    if (plan === 'starter') {
        return { cobertura: 'pago_por_uso', nota: `Starter factura por uso (tras ${STARTER_TRIAL_DAYS} días de prueba).` };
    }
    if (tipo === 'accion_ia') {
        const acciones = PLANS.find((p) => p.id === plan)?.aiActions;
        return {
            cobertura: acciones === null ? 'incluido_en_cuota' : 'incluido_hasta_cuota',
            nota: acciones === null
                ? 'Tu plan incluye acciones de IA sin límite.'
                : `Incluido en tu cuota: ${acciones} acciones de IA al mes.`,
        };
    }
    return { cobertura: 'incluido_en_cuota', nota: 'Incluido en la cuota fija de tu plan; no se cobra por unidad.' };
}

function _lineaUnidad({ tipo, cantidad, tokens_entrada: tin, tokens_salida: tout }, plan) {
    const { accion, etiqueta } = TIPOS[tipo];
    const modelo = getEntitlements(plan).razonamiento?.modelo;
    const conTokens = tipo === 'accion_ia' && (tin || tout);
    const c = calculateCallCost({
        action: accion,
        model: conTokens ? modelo : undefined,
        inputTokens: conTokens ? tin || 0 : 0,
        outputTokens: conTokens ? tout || 0 : 0,
    });
    const linea = {
        tipo, concepto: etiqueta, cantidad,
        creditosPorUnidad: c.credits,
        creditos: c.credits * cantidad,
        eur: eurDe(c.credits * cantidad),
        ..._cobertura(plan, tipo),
    };
    if (tipo === 'accion_ia' && !conTokens) {
        linea.aviso = 'Sólo el cómputo de BeZhas: los tokens del modelo se suman según el uso real. '
            + 'Indica tokens_entrada y tokens_salida para incluirlos.';
    }
    if (tipo === 'relay_onchain') {
        linea.aviso = 'No incluye el gas de la red, que depende del momento y lo cobra la cadena, no BeZhas.';
    }
    return linea;
}

function _lineaOperant({ cantidad, departamento }, plan) {
    const dept = DEPARTMENT_BY_ID[departamento];
    if (!dept) throw new CostEstimateError('tarea_operant necesita un departamento válido.');
    const t = estimateTaskCost(departamento);
    const matriz = PLAN_MATRIX[plan] || PLAN_MATRIX[PLAN_POR_DEFECTO];
    const linea = {
        tipo: 'tarea_operant', concepto: `Tarea de OPERANT · ${dept.label} (${t.tier})`, cantidad,
        creditosPorUnidad: t.credits,
        creditos: t.credits * cantidad,
        eur: eurDe(t.credits * cantidad),
    };
    if (!matriz.departments.includes(departamento)) {
        return { ...linea, cobertura: 'no_incluido_en_plan',
            nota: `Tu plan no incluye el departamento ${dept.label} de OPERANT.` };
    }
    if (!matriz.includedTasks) {
        return { ...linea, cobertura: 'pago_por_uso', nota: 'OPERANT se cobra por tarea en tu plan.' };
    }
    return { ...linea, cobertura: 'incluido_hasta_cuota',
        nota: `Incluido en tu cuota de ${matriz.includedTasks} tareas de OPERANT al mes`
            + `${matriz.frontierCap && t.tier === 'frontier' ? ` (hasta ${matriz.frontierCap} de tipo frontier)` : ''}; `
            + 'por encima, a este precio.' };
}

function _lineaCompraBez({ importe_usd: importe }) {
    const neto = Number(importe);
    if (!Number.isFinite(neto) || neto < 1) {
        throw new CostEstimateError('compra_bez necesita importe_usd de al menos 1.');
    }
    const f = calculateFeeBreakdown(neto);
    return {
        tipo: 'compra_bez', concepto: 'Compra de BEZ-Coin', cantidad: 1,
        importeNetoUsd: f.netAmountUSD,
        comisionPlataformaUsd: f.platformFeeUSD,
        comisionPlataformaPct: f.platformFeeBps / 100,
        totalUsd: f.grossAmountUSD,
        cobertura: 'comision_por_operacion',
        nota: 'Comisión de plataforma sobre la compra, en USD. No incluye la comisión del medio de pago '
            + '(tarjeta o banco) ni el tipo de cambio.',
    };
}

/**
 * @param {{operaciones: Array<{tipo:string, cantidad?:number, departamento?:string,
 *          importe_usd?:string, tokens_entrada?:number, tokens_salida?:number}>, plan?:string}} p
 */
function estimarCoste({ operaciones, plan: planPedido = PLAN_POR_DEFECTO }) {
    // Un plan desconocido se trata como el más restrictivo, igual que en el
    // catálogo: nunca se estima como «incluido» algo que quizá no lo está.
    const plan = PLAN_MATRIX[planPedido] ? planPedido : PLAN_POR_DEFECTO;
    if (!Array.isArray(operaciones) || operaciones.length === 0 || operaciones.length > MAX_LINEAS) {
        throw new CostEstimateError(`Indica entre 1 y ${MAX_LINEAS} operaciones.`);
    }

    const lineas = operaciones.map((op) => {
        if (!TIPOS[op?.tipo]) throw new CostEstimateError(`Tipo de operación desconocido: ${op?.tipo}.`);
        const cantidad = op.cantidad ?? 1;
        if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD) {
            throw new CostEstimateError(`La cantidad debe ser un entero entre 1 y ${MAX_CANTIDAD}.`);
        }
        const o = { ...op, cantidad };
        if (o.tipo === 'tarea_operant') return _lineaOperant(o, plan);
        if (o.tipo === 'compra_bez') return _lineaCompraBez(o);
        return _lineaUnidad(o, plan);
    });

    const enCreditos = lineas.filter((l) => typeof l.creditos === 'number');
    const suma = (ls) => ls.reduce((acc, l) => acc + l.creditos, 0);
    const pagoPorUso = suma(enCreditos.filter((l) => l.cobertura === 'pago_por_uso'));
    const siSuperasCuota = suma(enCreditos.filter((l) => l.cobertura === 'incluido_hasta_cuota'));
    const noIncluido = enCreditos.filter((l) => l.cobertura === 'no_incluido_en_plan');
    const comisiones = lineas.filter((l) => l.tipo === 'compra_bez');

    return {
        plan,
        lineas,
        resumen: {
            precioDeLista: { creditos: suma(enCreditos), eur: eurDe(suma(enCreditos)) },
            aPagarPorUso: { creditos: pagoPorUso, eur: eurDe(pagoPorUso) },
            siSuperasTuCuota: { creditos: siSuperasCuota, eur: eurDe(siSuperasCuota) },
            ...(noIncluido.length ? { noIncluidoEnTuPlan: noIncluido.map((l) => l.concepto) } : {}),
            ...(comisiones.length ? {
                comisionesUsd: r4(comisiones.reduce((acc, l) => acc + l.comisionPlataformaUsd, 0)),
            } : {}),
        },
        unidad: { credito: `1 crédito = ${EUR_PER_CREDIT} €`, iva: 'Precios sin IVA.' },
        noIncluye: ['gas de la red', 'comisiones del medio de pago (tarjeta, banco)', 'tipo de cambio'],
        estaConsulta: 'Estimar el coste no consume créditos.',
    };
}

module.exports = { estimarCoste, TIPOS, MAX_LINEAS, MAX_CANTIDAD, CostEstimateError };
