'use strict';

/**
 * gasTank/policy — qué UserOperations patrocina el Gas Tank de una organización.
 *
 * Denegación por defecto: sin fila en gas_tank_policies (o inactiva) no se patrocina nada. Se inspecciona la
 * callData ENTERA (execute / executeBatch de la smart account); cada llamada debe estar permitida:
 *   - (contrato, función) dentro de allowed_targets de la política, o
 *   - las dos piezas especiales de una comisión de protocolo, que solo valen juntas y cuadradas:
 *       GasTankVault.pullProtocolFee(...)   con un voucher firmado por NOSOTROS para esta cuenta y este destino
 *       BEZ.approve(destinoDeLaComision, importe)
 *     más la llamada al propio destino (contrato, función) con la comisión. Cualquier otra llamada al token BEZ se rechaza.
 */

const { ethers } = require('ethers');
const db = require('../../db/pool');
const userOp = require('./userOp');

const VAULT_IFACE = new ethers.Interface([
    'function pullProtocolFee(bytes32 orgId, address target, bytes4 selector, uint256 amount, uint48 validUntil, bytes32 nonce, bytes signature)',
]);
const ERC20_IFACE = new ethers.Interface(['function approve(address spender, uint256 amount)']);
const PULL_SEL = VAULT_IFACE.getFunction('pullProtocolFee').selector;
const APPROVE_SEL = ERC20_IFACE.getFunction('approve').selector;

class PolicyDenied extends Error {
    constructor(code, message) { super(message); this.code = code; this.status = 403; }
}
const deny = (code, message) => { throw new PolicyDenied(code, message); };

async function loadPolicy(orgId) {
    const { rows } = await db.query(
        `SELECT p.*, o.verification_status
           FROM gas_tank_policies p JOIN organizations o ON o.id = p.organization_id
          WHERE p.organization_id = $1`, [orgId]);
    return rows[0] || null;
}

function ruleFor(policy, target, selector) {
    const t = (policy.allowed_targets || []).find((r) => r.address && r.address.toLowerCase() === target.toLowerCase());
    if (!t) return null;
    const sels = (t.selectors || []).map((s) => s.toLowerCase());
    return sels.includes(selector.toLowerCase()) ? t : null;
}

async function spentTodayCredits(orgId) {
    const { rows } = await db.query(
        `SELECT
            COALESCE((SELECT -SUM(credits) FROM gas_tank_ledger
                       WHERE organization_id = $1 AND kind = 'charge' AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'), 0)::bigint
          + COALESCE((SELECT SUM(max_cost_credits) FROM gas_tank_reservations WHERE organization_id = $1 AND status = 'reserved'), 0)::bigint AS n`,
        [orgId]);
    return Number(rows[0].n);
}

/**
 * @param {object} p
 * @param {string} p.orgId
 * @param {object} p.op           UserOp normalizada (userOp.normalize)
 * @param {object} p.chain        { chainId, vault, bez, signerAddress }
 * @param {number} p.maxCostCredits  coste máximo que se reservaría
 * @returns {Promise<{ calls: object[], feeBez: bigint, policy: object }>}
 */
async function evaluate({ orgId, op, chain, maxCostCredits }) {
    const policy = await loadPolicy(orgId);
    if (!policy || !policy.active) deny('NO_POLICY', 'La organización no tiene una política de patrocinio activa');
    if (policy.require_verified && policy.verification_status !== 'verified') {
        deny('ORG_NOT_VERIFIED', 'La organización necesita KYB verificado para patrocinar estas operaciones');
    }
    if (maxCostCredits > Number(policy.max_cost_credits_per_op)) {
        deny('COST_ABOVE_POLICY', `El coste máximo (${maxCostCredits} créditos) supera el tope por operación (${policy.max_cost_credits_per_op})`);
    }
    if (policy.daily_cap_credits != null) {
        const used = await spentTodayCredits(orgId);
        if (used + maxCostCredits > Number(policy.daily_cap_credits)) deny('DAILY_CAP', 'Se superaría el tope diario de la organización');
    }

    const calls = userOp.decodeCalls(op.callData);
    const orgB32 = userOp.orgIdBytes32(orgId);
    const bez = chain.bez.toLowerCase();
    const vault = chain.vault ? chain.vault.toLowerCase() : null;

    const pulls = [];
    const approves = [];
    const plain = [];
    for (const c of calls) {
        if (c.value !== 0n) deny('VALUE_NOT_ALLOWED', 'No se patrocinan llamadas con valor nativo');
        const t = c.target.toLowerCase();
        if (vault && t === vault) {
            if (c.selector !== PULL_SEL) deny('VAULT_CALL_NOT_ALLOWED', 'Solo se permite pullProtocolFee en la bóveda');
            pulls.push(VAULT_IFACE.decodeFunctionData('pullProtocolFee', c.data));
        } else if (t === bez) {
            if (c.selector !== APPROVE_SEL) deny('BEZ_CALL_NOT_ALLOWED', 'Solo se permite approve sobre el token BEZ');
            approves.push(ERC20_IFACE.decodeFunctionData('approve', c.data));
        } else {
            if (!ruleFor(policy, c.target, c.selector)) deny('TARGET_NOT_ALLOWED', `Llamada no permitida por la política: ${c.target} ${c.selector}`);
            plain.push(c);
        }
    }

    if (pulls.length > 1) deny('TOO_MANY_PULLS', 'Una operación solo puede retirar una comisión de la bóveda');
    if (pulls.length !== approves.length) deny('FEE_BATCH_MISMATCH', 'La comisión exige exactamente un pullProtocolFee y un approve');

    let feeBez = 0n;
    if (pulls.length === 1) {
        const [pOrg, pTarget, pSelector, pAmount, pUntil, pNonce, pSig] = pulls[0];
        const [spender, approved] = approves[0];
        const rule = ruleFor(policy, pTarget, pSelector);
        if (!rule) deny('FEE_TARGET_NOT_ALLOWED', 'El destino de la comisión no está permitido por la política');
        if (pOrg.toLowerCase() !== orgB32) deny('FEE_ORG_MISMATCH', 'El voucher es de otra organización');
        if (ethers.getAddress(spender) !== ethers.getAddress(pTarget)) deny('APPROVE_SPENDER_MISMATCH', 'El approve debe ser al destino de la comisión');
        if (approved !== pAmount) deny('APPROVE_AMOUNT_MISMATCH', 'El importe aprobado no coincide con la comisión');
        if (rule.maxFeeBez && pAmount > ethers.parseUnits(String(rule.maxFeeBez), 18)) deny('FEE_ABOVE_RULE', 'La comisión supera el máximo de la regla');
        if (!plain.some((c) => c.target.toLowerCase() === pTarget.toLowerCase() && c.selector === pSelector.toLowerCase())) {
            deny('FEE_TARGET_MISSING', 'El lote debe incluir la llamada que consume la comisión');
        }
        // El voucher lo firmamos nosotros para esta cuenta: lo comprobamos, no nos fiamos del cliente.
        const hash = userOp.vaultHash({
            chainId: chain.chainId, vault: chain.vault, orgId: pOrg, to: op.sender, target: pTarget,
            selector: pSelector, amount: pAmount, validUntil: pUntil, nonce: pNonce,
        });
        let rec;
        try { rec = ethers.verifyMessage(ethers.getBytes(hash), pSig); } catch { rec = null; }
        if (!rec || rec.toLowerCase() !== chain.signerAddress.toLowerCase()) deny('VOUCHER_INVALID', 'El voucher de comisión no es nuestro o no es para esta cuenta');
        feeBez = pAmount;
    }
    return { calls, feeBez, policy };
}

module.exports = { evaluate, loadPolicy, ruleFor, PolicyDenied, PULL_SEL, APPROVE_SEL, VAULT_IFACE, ERC20_IFACE };
