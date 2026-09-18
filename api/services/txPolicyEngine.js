'use strict';

/**
 * txPolicyEngine — decide si una intención puede seguir, necesita aprobación
 * humana o se deniega.
 *
 * Función pura, como el motor de riesgo: el orquestador reúne el contexto y
 * esto responde. Las preguntas son las del documento de seguridad (§9):
 * ¿quién?, ¿qué?, ¿sobre qué?, ¿cuánto?, ¿a quién?, ¿con qué frecuencia?, ¿con
 * qué riesgo?, ¿necesita aprobación?
 *
 * Reglas de composición, sin excepciones:
 *
 *   · Cualquier DENY gana. Se devuelven TODOS los motivos, no el primero: quien
 *     tiene que corregir la operación necesita la lista entera.
 *   · El límite efectivo es el MÁS restrictivo de los que apliquen (plan,
 *     agente). Sumar permisos nunca amplía.
 *   · Lo que sale de fondos custodiados (tesorería de BeZhas, socio licenciado)
 *     nunca se ejecuta sin aprobación, sea cual sea el importe.
 *   · Sin estado del kill switch no se mueve dinero: desconocido cuenta como
 *     bloqueado.
 *
 * El policyHash ata la decisión a la intención exacta. El firmante lo recalcula
 * con los mismos cuatro campos; si alguien cambia la intención, la decisión o
 * el número de aprobaciones después de aprobar, deja de casar.
 */

const { RAILS, PROVEEDORES_FIAT } = require('../config/tx-rails');
const { hashCanonico } = require('./txCanonical');

const POLICY_VERSION = '2026-09-15.1';

const DECISION = Object.freeze({ ALLOW: 'ALLOW', REQUIRE_APPROVAL: 'REQUIRE_APPROVAL', DENY: 'DENY' });

/** Mismo cálculo en tx-signer/src/verify.js. No cambiar uno sin el otro. */
function calcularPolicyHash({ intentHash, policyVersion, decision, requiredApprovals }) {
    return hashCanonico({ intentHash, policyVersion, decision, requiredApprovals });
}

const min = (...valores) => Math.min(...valores.filter((v) => typeof v === 'number' && Number.isFinite(v)));

/**
 * @param {object} p
 *   intent, intentHash
 *   app            { id, scopes[] }
 *   agente         { agentId, rails[], porOperacionEur?, diarioEur? } | null
 *   operaciones    entitlements.operaciones del plan
 *   kycNivel       0|1|2
 *   uso            { diaEur, mesEur, agenteDiaEur }
 *   importeEur     number|null
 *   destino        { estado: 'active'|'pending'|'unknown'|'blocked' }
 *   proveedor      { id, ...PROVEEDORES_FIAT[id], habilitado:boolean } | null
 *   riesgo         salida de evaluarRiesgo
 *   killSwitch     { estado: 'NORMAL'|'SUSPICIOUS'|'LOCKDOWN'|'UNKNOWN' }
 */
function evaluarPolitica(p) {
    const { intent } = p;
    const rail = RAILS[intent.rail];
    const denegar = [];
    const aprobar = [];
    const d = (code, mensaje) => denegar.push({ code, mensaje });
    const a = (code, mensaje) => aprobar.push({ code, mensaje });

    // ── Kill switch ──────────────────────────────────────────────────────────
    const ks = p.killSwitch?.estado || 'UNKNOWN';
    if (ks === 'LOCKDOWN') d('LOCKDOWN', 'Operativa bloqueada por el kill switch.');
    else if (ks === 'UNKNOWN') d('KILL_SWITCH_UNAVAILABLE', 'No se pudo leer el estado de emergencia: no se mueven fondos a ciegas.');
    else if (ks === 'SUSPICIOUS') a('SUSPICIOUS_MODE', 'Modo sospechoso activo: se exige una aprobación adicional.');

    // ── Permisos de la clave ─────────────────────────────────────────────────
    const scopes = new Set(p.app?.scopes || []);
    const admin = scopes.has('admin');
    if (!admin && !scopes.has(rail.scope)) {
        d('SCOPE_REQUIRED', `La clave necesita el permiso «${rail.scope}» para ${intent.rail}.`);
    }
    if (intent.source.type === 'bezhas_treasury' && !admin && !scopes.has('treasury')) {
        d('TREASURY_SCOPE_REQUIRED', 'Sólo las claves de tesorería de BeZhas pueden ordenar pagos desde la tesorería.');
    }

    // ── Agente ───────────────────────────────────────────────────────────────
    if (p.agente && !(p.agente.rails || []).includes(intent.rail)) {
        d('AGENT_RAIL_NOT_ALLOWED', `El agente ${p.agente.agentId} no tiene habilitado ${intent.rail}.`);
    }

    // ── Plan ─────────────────────────────────────────────────────────────────
    const railPlan = p.operaciones?.rails?.[intent.rail];
    if (!railPlan) d('RAIL_NOT_IN_PLAN', `Tu plan no incluye ${intent.rail}.`);

    // ── KYC / KYB ────────────────────────────────────────────────────────────
    if ((p.kycNivel ?? 0) < rail.kycMinimo) {
        d('KYC_REQUIRED', `Hace falta verificación de nivel ${rail.kycMinimo} (actual: ${p.kycNivel ?? 0}).`);
    }

    // ── Proveedor FIAT y licencia ────────────────────────────────────────────
    const tocaFiat = intent.rail !== 'crypto_transfer';
    if (tocaFiat) {
        const prov = p.proveedor;
        if (!prov) {
            d('NO_PROVIDER', `No hay proveedor configurado para ${intent.rail}.`);
        } else {
            if (!prov.habilitado) d('PROVIDER_DISABLED', `El proveedor ${prov.id} no está configurado en este entorno.`);
            if (!prov.rails.includes(intent.rail)) d('PROVIDER_RAIL_MISMATCH', `${prov.id} no opera ${intent.rail}.`);
            const fondosDeTerceros = intent.source.type === 'client_balance'
                || (intent.rail === 'fiat_to_fiat' && intent.source.type !== 'bezhas_treasury');
            if (fondosDeTerceros && (prov.soloPrimeraParte || !prov.licenciado)) {
                // PSD2: transmitir dinero de terceros sin licencia es un servicio
                // de pago no autorizado. No hay importe pequeño que lo arregle.
                d('UNLICENSED_THIRD_PARTY_FUNDS',
                    `${prov.id} no puede mover fondos de clientes: hace falta un socio con licencia de pago.`);
            }
        }
    }

    // ── Límites (el más restrictivo manda) ───────────────────────────────────
    const importe = p.importeEur;
    const limites = railPlan ? {
        porOperacionEur: min(railPlan.porOperacionEur, p.agente?.porOperacionEur),
        diarioEur: min(railPlan.diarioEur, p.agente?.diarioEur),
        mensualEur: railPlan.mensualEur,
        aprobacionDesdeEur: railPlan.aprobacionDesdeEur,
    } : null;
    if (limites) {
        if (typeof importe === 'number') {
            if (importe > limites.porOperacionEur) {
                d('LIMIT_PER_TX', `Supera el máximo por operación (${limites.porOperacionEur} €).`);
            }
            if ((p.uso?.diaEur || 0) + importe > limites.diarioEur) {
                d('LIMIT_DAILY', `Supera el límite diario (${limites.diarioEur} €).`);
            }
            if (p.agente && typeof p.agente.diarioEur === 'number'
                && (p.uso?.agenteDiaEur || 0) + importe > p.agente.diarioEur) {
                d('LIMIT_AGENT_DAILY', `Supera el límite diario del agente (${p.agente.diarioEur} €).`);
            }
            if ((p.uso?.mesEur || 0) + importe > limites.mensualEur) {
                d('LIMIT_MONTHLY', `Supera el límite mensual (${limites.mensualEur} €).`);
            }
            if (importe >= limites.aprobacionDesdeEur) {
                a('ABOVE_APPROVAL_THRESHOLD', `Desde ${limites.aprobacionDesdeEur} € hace falta aprobación.`);
            }
        } else {
            a('PRICE_UNAVAILABLE', 'Sin precio fiable no se pueden comprobar los límites: aprobación reforzada.');
        }
    }

    // ── Destino ──────────────────────────────────────────────────────────────
    const estadoDestino = p.destino?.estado || 'unknown';
    if (estadoDestino === 'blocked') d('DESTINATION_BLOCKED', 'Destino bloqueado.');
    else if (estadoDestino !== 'active') a('NEW_DESTINATION', 'Destino nuevo o en periodo de enfriamiento.');

    // ── Travel rule (Reglamento UE 2023/1113) ────────────────────────────────
    // Aplica cuando BeZhas o un socio transfiere cripto por cuenta de alguien.
    // Si el cliente firma desde su propia wallet, BeZhas no es quien transfiere.
    const transfiereCripto = rail.travelRule && ['bezhas', 'partner'].includes(intent.custody)
        && (intent.rail === 'crypto_transfer' || intent.rail === 'fiat_to_crypto');
    if (transfiereCripto) {
        if (!intent.counterparty?.legalName || !intent.counterparty?.country) {
            d('TRAVEL_RULE_DATA_MISSING', 'Faltan los datos del beneficiario que exige el reglamento de transferencias.');
        }
        if (intent.destination.selfHosted && !intent.destination.ownershipProof
            && (importe === null || importe === undefined || importe >= 1000)) {
            a('SELF_HOSTED_UNVERIFIED', 'Wallet autoalojada sin prueba de titularidad: aprobación y verificación manual.');
        }
    }

    // ── Beneficiario FIAT ────────────────────────────────────────────────────
    if (rail.verificacionBeneficiario && !intent.destination.name) {
        d('PAYEE_NAME_REQUIRED', 'Un pago a IBAN necesita el nombre del titular para verificarlo.');
    }

    // ── Riesgo ───────────────────────────────────────────────────────────────
    const nivel = p.riesgo?.nivel || 'HIGH';
    if (nivel === 'CRITICAL') d('RISK_CRITICAL', 'Riesgo crítico.');
    else if (nivel === 'HIGH') d('RISK_HIGH', 'Riesgo alto.');
    else if (nivel === 'MEDIUM') a('RISK_MEDIUM', 'Riesgo medio: revisión humana.');

    // ── Custodia ─────────────────────────────────────────────────────────────
    if (['bezhas', 'partner'].includes(intent.custody)) {
        a('CUSTODIED_FUNDS', 'Sale de fondos custodiados: siempre con aprobación firmada.');
    }

    // ── Decisión ─────────────────────────────────────────────────────────────
    let decision;
    let aprobaciones = 0;
    if (denegar.length) {
        decision = DECISION.DENY;
    } else if (aprobar.length) {
        decision = DECISION.REQUIRE_APPROVAL;
        aprobaciones = 1;
        const dobleDesde = p.operaciones?.dobleAprobacionDesdeEur;
        if (importe === null || importe === undefined
            || (typeof dobleDesde === 'number' && importe >= dobleDesde)) aprobaciones = 2;
        if (intent.source.type === 'bezhas_treasury') aprobaciones = Math.max(aprobaciones, 2);
        if (ks === 'SUSPICIOUS') aprobaciones += 1;
    } else {
        decision = DECISION.ALLOW;
    }

    const policyHash = calcularPolicyHash({
        intentHash: p.intentHash,
        policyVersion: POLICY_VERSION,
        decision,
        requiredApprovals: aprobaciones,
    });

    return {
        decision,
        requiredApprovals: aprobaciones,
        motivos: [...denegar, ...aprobar],
        limites,
        nivelRiesgo: nivel,
        policyVersion: POLICY_VERSION,
        policyHash,
    };
}

/** Proveedor FIAT que corresponde a una intención, o null. */
function resolverProveedor(intent, env = process.env) {
    if (intent.rail === 'crypto_transfer') return null;
    let id = intent.provider;
    if (!id) {
        if (intent.rail === 'fiat_to_crypto') {
            id = intent.source.type === 'card' ? 'stripe'
                : intent.source.type === 'sepa_incoming' ? 'sepa_ing_propia' : 'onramp_partner';
        } else if (intent.source.type === 'bezhas_treasury') {
            id = 'sepa_ing_propia';
        } else {
            id = intent.rail === 'crypto_to_fiat' ? 'onramp_partner' : 'emi_partner';
        }
    }
    const def = PROVEEDORES_FIAT[id];
    if (!def) return null;
    return { id, rails: def.rails, licenciado: def.licenciado, soloPrimeraParte: def.soloPrimeraParte, habilitado: def.habilitado(env), nota: def.nota };
}

module.exports = { evaluarPolitica, resolverProveedor, calcularPolicyHash, POLICY_VERSION, DECISION };
