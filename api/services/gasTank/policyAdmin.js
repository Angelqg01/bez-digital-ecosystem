'use strict';

/**
 * gasTank/policyAdmin — gestión de la política de patrocinio desde el panel (gas.bezhas.com).
 *
 * policy.js decide si se patrocina una UserOperation; este módulo es lo que la organización
 * puede ver y cambiar de esa decisión. Hasta ahora una política sólo podía crearse a mano en
 * la base, así que ninguna organización podía patrocinar nada desde el panel.
 *
 * Lo que la organización decide: qué contratos y funciones patrocina (allowed_targets, con
 * plantillas para los casos de BeZhas), el tope por operación, el tope diario y si la política
 * está activa. Lo que NO decide: `require_verified` (exigir KYB es cumplimiento, no
 * preferencia) ni patrocinar llamadas al token BEZ o a la bóveda, que policy.js sólo admite
 * como la pareja cuadrada de una comisión de protocolo.
 *
 * El simulador responde «¿se patrocinaría esto y cuánto costaría?» sin reservar saldo ni
 * firmar nada, con la misma política y la misma fórmula de coste que el patrocinio real.
 */

const { ethers } = require('ethers');
const db = require('../../db/pool');
const cfg = require('../../config/gas-tank');
const policy = require('./policy');
const { FABRICAS } = require('../rwaTokenization');

const BEZ_POLYGON = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

const MAX_TARGETS = 20;
const MAX_SELECTORS = 20;
/** Topes que el panel no deja superar: 1.000 € por operación y 10.000 € al día. */
const MAX_COST_PER_OP_CREDITS = cfg.creditsForEur(1000);
const MAX_DAILY_CAP_CREDITS = cfg.creditsForEur(10000);
/** Por defecto, como la migración 074: 5 € por operación y sin tope diario. */
const DEFAULT_POLICY = Object.freeze({
    active: false, allowedTargets: [], maxCostCreditsPerOp: 5000, dailyCapCredits: null, requireVerified: true,
});

const TOKENIZE_SIG = 'tokenizeAsset(string,uint8,string,string,uint256,uint256,uint256,uint256,string)';
const selectorOf = (sig) => ethers.id(sig).slice(0, 10);

/** Plantillas del panel: los usos de BeZhas que ya existen en Polygon. */
const TEMPLATES = Object.freeze([
    {
        id: 'rwa-activos',
        nombre: 'Tokenización RWA · fábrica de activos',
        descripcion: 'Patrocina tokenizeAsset en la fábrica que usa la web /rwa. La comisión de 100 BEZ sale de la bóveda.',
        targets: [{ address: FABRICAS.activos.direccion, selectors: [selectorOf(TOKENIZE_SIG)], label: 'RWAFactory · activos · tokenizeAsset', maxFeeBez: 100 }],
    },
    {
        id: 'rwa-industrial',
        nombre: 'Tokenización RWA · fábrica industrial',
        descripcion: 'Patrocina tokenizeAsset en la fábrica de Factory industrial (deployments/137.json).',
        targets: [{ address: FABRICAS.industrial.direccion, selectors: [selectorOf(TOKENIZE_SIG)], label: 'RWAFactory · industrial · tokenizeAsset', maxFeeBez: 100 }],
    },
]);

class PolicyInputError extends Error {
    constructor(message, field) { super(message); this.status = 400; this.code = 'INVALID_POLICY'; this.field = field; }
}
const invalid = (message, field) => { throw new PolicyInputError(message, field); };

/** Direcciones que nunca pueden ser un destino normal de la política. */
function reservedAddresses(env = process.env) {
    return [env.GAS_TANK_BEZ_TOKEN || BEZ_POLYGON, env.GAS_TANK_VAULT, env.GAS_TANK_ENTRYPOINT, env.GAS_TANK_PAYMASTER]
        .filter((a) => a && ethers.isAddress(a))
        .map((a) => a.toLowerCase());
}

const toView = (row) => (row ? {
    active: row.active,
    allowedTargets: row.allowed_targets || [],
    maxCostCreditsPerOp: Number(row.max_cost_credits_per_op),
    dailyCapCredits: row.daily_cap_credits == null ? null : Number(row.daily_cap_credits),
    requireVerified: row.require_verified,
    verificationStatus: row.verification_status || null,
    updatedAt: row.updated_at || null,
} : null);

/** Valida y normaliza lo que llega del panel. Devuelve la política lista para guardar. */
function validate(input, { env = process.env } = {}) {
    const out = {};
    if (input.active !== undefined) {
        if (typeof input.active !== 'boolean') invalid('active debe ser true o false', 'active');
        out.active = input.active;
    }
    if (input.allowedTargets !== undefined) {
        if (!Array.isArray(input.allowedTargets)) invalid('allowedTargets debe ser una lista', 'allowedTargets');
        if (input.allowedTargets.length > MAX_TARGETS) invalid(`Como máximo ${MAX_TARGETS} contratos`, 'allowedTargets');
        const reservadas = reservedAddresses(env);
        const vistas = new Set();
        out.allowedTargets = input.allowedTargets.map((t, i) => {
            const campo = `allowedTargets[${i}]`;
            if (!t || typeof t !== 'object') invalid('Cada destino es un objeto { address, selectors }', campo);
            if (!ethers.isAddress(String(t.address || ''))) invalid('Dirección de contrato no válida', `${campo}.address`);
            const address = ethers.getAddress(t.address);
            if (reservadas.includes(address.toLowerCase())) {
                invalid('El token BEZ, la bóveda, el EntryPoint y el paymaster no se patrocinan como destino normal', `${campo}.address`);
            }
            if (vistas.has(address)) invalid('Contrato repetido: junta sus funciones en una sola regla', `${campo}.address`);
            vistas.add(address);
            if (!Array.isArray(t.selectors) || t.selectors.length === 0) invalid('Indica al menos una función', `${campo}.selectors`);
            if (t.selectors.length > MAX_SELECTORS) invalid(`Como máximo ${MAX_SELECTORS} funciones por contrato`, `${campo}.selectors`);
            const selectors = [...new Set(t.selectors.map((s) => {
                const v = String(s).trim();
                if (/^0x[0-9a-fA-F]{8}$/.test(v)) return v.toLowerCase();
                // También se acepta la firma de la función: "transfer(address,uint256)".
                if (/^[A-Za-z_][A-Za-z0-9_]*\([^()]*\)$/.test(v)) return selectorOf(v.replace(/\s+/g, ''));
                return invalid(`Función no válida: «${v}» (selector 0x12345678 o firma nombre(tipos))`, `${campo}.selectors`);
            }))];
            const regla = { address, selectors };
            if (t.label !== undefined && t.label !== null && t.label !== '') {
                if (typeof t.label !== 'string' || t.label.length > 80) invalid('La etiqueta tiene como máximo 80 caracteres', `${campo}.label`);
                regla.label = t.label.trim();
            }
            if (t.maxFeeBez !== undefined && t.maxFeeBez !== null && t.maxFeeBez !== '') {
                const f = Number(t.maxFeeBez);
                if (!Number.isFinite(f) || f < 0 || f > 10000) invalid('La comisión máxima va de 0 a 10.000 BEZ', `${campo}.maxFeeBez`);
                regla.maxFeeBez = f;
            }
            return regla;
        });
    }
    if (input.maxCostCreditsPerOp !== undefined) {
        const v = Number(input.maxCostCreditsPerOp);
        if (!Number.isInteger(v) || v < 1 || v > MAX_COST_PER_OP_CREDITS) {
            invalid(`El tope por operación va de 1 a ${MAX_COST_PER_OP_CREDITS} créditos`, 'maxCostCreditsPerOp');
        }
        out.maxCostCreditsPerOp = v;
    }
    if (input.dailyCapCredits !== undefined) {
        if (input.dailyCapCredits === null) out.dailyCapCredits = null;
        else {
            const v = Number(input.dailyCapCredits);
            if (!Number.isInteger(v) || v < 1 || v > MAX_DAILY_CAP_CREDITS) {
                invalid(`El tope diario va de 1 a ${MAX_DAILY_CAP_CREDITS} créditos, o sin tope`, 'dailyCapCredits');
            }
            out.dailyCapCredits = v;
        }
    }
    if (input.requireVerified !== undefined) invalid('Exigir KYB no se puede cambiar desde el panel', 'requireVerified');
    return out;
}

async function getPolicy(orgId) {
    const row = await policy.loadPolicy(orgId);
    if (row) return toView(row);
    const { rows } = await db.query('SELECT verification_status FROM organizations WHERE id = $1', [orgId]);
    return { ...DEFAULT_POLICY, verificationStatus: rows[0]?.verification_status || null, updatedAt: null, exists: false };
}

/** Guarda los campos indicados (el resto se conserva). No se puede activar una política sin destinos. */
async function savePolicy(orgId, input, opts = {}) {
    const cambios = validate(input || {}, opts);
    const actual = await getPolicy(orgId);
    const final = { ...actual, ...cambios };
    if (final.active && final.allowedTargets.length === 0) {
        invalid('Añade al menos un contrato antes de activar la política', 'allowedTargets');
    }
    if (final.dailyCapCredits != null && final.dailyCapCredits < final.maxCostCreditsPerOp) {
        invalid('El tope diario no puede ser menor que el tope por operación', 'dailyCapCredits');
    }
    await db.query(
        `INSERT INTO gas_tank_policies (organization_id, allowed_targets, max_cost_credits_per_op, daily_cap_credits, active)
         VALUES ($1, $2::jsonb, $3, $4, $5)
         ON CONFLICT (organization_id) DO UPDATE SET
            allowed_targets = EXCLUDED.allowed_targets,
            max_cost_credits_per_op = EXCLUDED.max_cost_credits_per_op,
            daily_cap_credits = EXCLUDED.daily_cap_credits,
            active = EXCLUDED.active,
            updated_at = NOW()`,
        [orgId, JSON.stringify(final.allowedTargets), final.maxCostCreditsPerOp, final.dailyCapCredits, final.active]
    );
    return getPolicy(orgId);
}

/**
 * ¿Se patrocinaría y cuánto costaría? No reserva, no firma, no toca la cadena.
 * @param {{calls: {target:string, selector:string}[], gasUsed?:number, gasPriceGwei?:number, protocolFeeBez?:number}} p
 */
async function simulate(orgId, { calls, gasUsed = 350000, gasPriceGwei = 50, protocolFeeBez = 0 }, deps = {}) {
    const { prices = require('./prices'), ledger = require('./ledger') } = deps;
    if (!Array.isArray(calls) || calls.length === 0 || calls.length > 10) invalid('Indica de 1 a 10 llamadas', 'calls');
    for (const [k, v, max] of [['gasUsed', gasUsed, 30_000_000], ['gasPriceGwei', gasPriceGwei, 100_000], ['protocolFeeBez', protocolFeeBez, 10_000]]) {
        if (!Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > max) invalid(`${k} fuera de rango`, k);
    }
    const row = await policy.loadPolicy(orgId);
    const motivos = [];
    if (!row || !row.active) motivos.push({ code: 'NO_POLICY', mensaje: 'No hay una política de patrocinio activa' });
    if (row?.require_verified && row.verification_status !== 'verified') {
        motivos.push({ code: 'ORG_NOT_VERIFIED', mensaje: 'La organización necesita KYB verificado' });
    }

    const reservadas = reservedAddresses();
    const llamadas = calls.map((c, i) => {
        const campo = `calls[${i}]`;
        if (!ethers.isAddress(String(c?.target || ''))) invalid('Dirección no válida', `${campo}.target`);
        const sel = /^0x[0-9a-fA-F]{8}$/.test(String(c.selector)) ? c.selector.toLowerCase()
            : /^[A-Za-z_][A-Za-z0-9_]*\([^()]*\)$/.test(String(c.selector)) ? selectorOf(String(c.selector).replace(/\s+/g, ''))
                : invalid('Función no válida', `${campo}.selector`);
        const target = ethers.getAddress(c.target);
        const regla = row ? policy.ruleFor(row, target, sel) : null;
        const reservada = reservadas.includes(target.toLowerCase());
        if (!regla) {
            motivos.push({
                code: reservada ? 'RESERVED_TARGET' : 'TARGET_NOT_ALLOWED',
                mensaje: reservada ? `${target}: solo como parte de una comisión de protocolo` : `${target} ${sel} no está en la política`,
            });
        }
        return { target, selector: sel, permitida: Boolean(regla), regla: regla ? (regla.label || null) : null };
    });

    let costCredits = null;
    let errorPrecio = null;
    try {
        const polEur = await prices.getPolEur();
        const bezEur = Number(protocolFeeBez) > 0 ? await prices.getBezEur() : 0;
        costCredits = cfg.operationCostCredits({
            gasUsed: Number(gasUsed), gasPriceGwei: Number(gasPriceGwei), polEur, protocolFeeBez: Number(protocolFeeBez), bezEur,
        });
    } catch (err) {
        errorPrecio = err.code || 'NO_PRICE';
        motivos.push({ code: errorPrecio, mensaje: err.message });
    }

    let saldo = null;
    if (costCredits != null) {
        if (row && costCredits > Number(row.max_cost_credits_per_op)) {
            motivos.push({ code: 'COST_ABOVE_POLICY', mensaje: `Cuesta ${costCredits} créditos y el tope por operación es ${row.max_cost_credits_per_op}` });
        }
        const b = await ledger.getBalance(orgId);
        saldo = b.balanceCredits;
        // balance_credits ya viene neto de las reservas abiertas (ledger.reserve las descuenta).
        if (saldo < costCredits) motivos.push({ code: 'INSUFFICIENT_BALANCE', mensaje: 'Saldo insuficiente en el tanque' });
    }

    return {
        patrocinable: motivos.length === 0,
        motivos,
        llamadas,
        coste: costCredits == null ? null : {
            credits: costCredits, eur: Math.round(costCredits * cfg.EUR_PER_CREDIT * 100) / 100,
            supuestos: { gasUsed: Number(gasUsed), gasPriceGwei: Number(gasPriceGwei), protocolFeeBez: Number(protocolFeeBez), markup: cfg.MARKUP_RATE },
        },
        saldoCredits: saldo,
        nota: 'Simulación: no reserva saldo ni firma. El cargo real se liquida con el gas que cobre el EntryPoint.',
    };
}

/** Apps de la organización y su URL ERC-7677. Nunca devuelve claves: solo dónde ponerlas. */
async function listApps(orgId, { apiUrl = process.env.API_PUBLIC_URL || 'https://api.bezhas.com' } = {}) {
    const { rows } = await db.query(
        `SELECT a.id, a.app_name, a.scopes, a.is_active
           FROM app_registry a JOIN organizations o ON o.legacy_enterprise_id = a.enterprise_id
          WHERE o.id = $1
          ORDER BY a.app_name`,
        [orgId]
    );
    const base = String(apiUrl).replace(/\/+$/, '');
    return rows.map((a) => ({
        id: String(a.id),
        nombre: a.app_name,
        activa: a.is_active,
        scopeGas: Array.isArray(a.scopes) && a.scopes.includes('gas'),
        paymasterUrl: `${base}/api/rpc/paymaster`,
        paymasterUrlConClave: `${base}/api/rpc/paymaster/<api-key>`,
    }));
}

module.exports = {
    TEMPLATES, DEFAULT_POLICY, MAX_COST_PER_OP_CREDITS, MAX_DAILY_CAP_CREDITS,
    validate, getPolicy, savePolicy, simulate, listApps, PolicyInputError, selectorOf,
};
