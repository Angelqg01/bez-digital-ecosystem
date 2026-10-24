'use strict';

/**
 * gasTank/paymasterService — firma el patrocinio de UserOperations ERC-4337 contra el Gas Tank de una organización.
 *
 *   issueFeeVoucher(...)   voucher de la bóveda para pagar una comisión de protocolo (paso 1, antes de armar el lote)
 *   sponsorUserOp(...)     inspecciona la UserOp, reserva saldo y devuelve paymasterAndData firmado (paso 2)
 *   releaseSponsorship(..) libera la reserva si el cliente no llega a enviar la UserOp
 *
 * La clave de firma es una clave de VERIFICACIÓN dedicada y sin fondos (GAS_PAYMASTER_SIGNER_KEY), distinta de
 * cualquier wallet de tesorería u operador. Con ella solo se autoriza gasto del depósito del paymaster en el
 * EntryPoint, acotado por maxCostPerOp del contrato. En producción debe pasar a KMS: aquí se inyecta como `signer`.
 */

const crypto = require('crypto');
const { ethers } = require('ethers');
const cfg = require('../../config/gas-tank');
const ledger = require('./ledger');
const prices = require('./prices');
const policy = require('./policy');
const userOp = require('./userOp');
const meter = require('./meter');

const SPONSOR_TTL_S = 600;
const BEZ_POLYGON = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';

class SponsorError extends Error {
    constructor(code, status, message) { super(message); this.code = code; this.status = status; }
}

function chainConfig(env = process.env) {
    const need = (k) => { if (!env[k]) throw new SponsorError('NOT_CONFIGURED', 503, `Falta ${k}: el patrocinio no está configurado`); return env[k]; };
    return {
        chainId: Number(need('GAS_TANK_CHAIN_ID')),
        entryPoint: ethers.getAddress(need('GAS_TANK_ENTRYPOINT')),
        paymaster: ethers.getAddress(need('GAS_TANK_PAYMASTER')),
        vault: env.GAS_TANK_VAULT ? ethers.getAddress(env.GAS_TANK_VAULT) : null,
        bez: ethers.getAddress(env.GAS_TANK_BEZ_TOKEN || BEZ_POLYGON),
    };
}

function defaultSigner(env = process.env) {
    if (!env.GAS_PAYMASTER_SIGNER_KEY) throw new SponsorError('NOT_CONFIGURED', 503, 'Falta GAS_PAYMASTER_SIGNER_KEY: el patrocinio no está configurado');
    const w = new ethers.Wallet(env.GAS_PAYMASTER_SIGNER_KEY);
    return { address: w.address, signMessage: (bytes) => w.signMessage(bytes) };
}

// chain y signer se resuelven al usarse (si no se inyectan): importar el módulo no exige tener el patrocinio configurado.
function resolveDeps(deps = {}) {
    const d = {
        ledger, prices, policy, meter,
        now: () => Math.floor(Date.now() / 1000),
        randomBytes32: () => '0x' + crypto.randomBytes(32).toString('hex'),
        ...deps,
    };
    if (!d.chain) d.chain = chainConfig();
    if (!d.signer) d.signer = defaultSigner();
    return d;
}

async function assertAppBelongsToOrg(d, orgId, appId) {
    if (!appId) throw new SponsorError('APP_REQUIRED', 400, 'appId obligatorio');
    const owner = await d.meter.orgIdForApp(appId);
    if (!owner || owner !== orgId) throw new SponsorError('APP_NOT_IN_ORG', 403, 'La app no pertenece a la organización');
}

/** Paso 1: voucher de la bóveda para esta cuenta, este destino y este importe de comisión (BEZ). */
async function issueFeeVoucher({ orgId, appId, sender, target, selector, amountBez }, deps = {}) {
    const d = resolveDeps(deps);
    if (!d.chain.vault) throw new SponsorError('NOT_CONFIGURED', 503, 'Falta GAS_TANK_VAULT');
    await assertAppBelongsToOrg(d, orgId, appId);
    if (!ethers.isAddress(sender) || !ethers.isAddress(target) || !/^0x[0-9a-fA-F]{8}$/.test(String(selector))) {
        throw new SponsorError('BAD_REQUEST', 400, 'sender, target o selector no válidos');
    }
    const amount = ethers.parseUnits(String(amountBez), 18);
    const pol = await d.policy.loadPolicy(orgId);
    if (!pol || !pol.active) throw new SponsorError('NO_POLICY', 403, 'La organización no tiene una política de patrocinio activa');
    if (pol.require_verified && pol.verification_status !== 'verified') throw new SponsorError('ORG_NOT_VERIFIED', 403, 'La organización necesita KYB verificado');
    const rule = d.policy.ruleFor(pol, target, selector);
    if (!rule) throw new SponsorError('FEE_TARGET_NOT_ALLOWED', 403, 'El destino de la comisión no está permitido por la política');
    if (rule.maxFeeBez && amount > ethers.parseUnits(String(rule.maxFeeBez), 18)) throw new SponsorError('FEE_ABOVE_RULE', 403, 'La comisión supera el máximo de la regla');

    const validUntil = d.now() + SPONSOR_TTL_S;
    const nonce = d.randomBytes32();
    const orgB32 = userOp.orgIdBytes32(orgId);
    const to = ethers.getAddress(sender);
    const hash = userOp.vaultHash({ chainId: d.chain.chainId, vault: d.chain.vault, orgId: orgB32, to, target: ethers.getAddress(target), selector, amount, validUntil, nonce });
    const signature = await d.signer.signMessage(ethers.getBytes(hash));
    return { vault: d.chain.vault, orgId: orgB32, target: ethers.getAddress(target), selector, amount: amount.toString(), validUntil, nonce, signature };
}

/** Paso 2: patrocina la UserOp. `rawOp` llega del cliente en formato empaquetado, con un paymasterAndData provisional. */
async function sponsorUserOp({ orgId, appId, userOp: rawOp }, deps = {}) {
    const d = resolveDeps(deps);
    await assertAppBelongsToOrg(d, orgId, appId);
    const op = userOp.normalize(rawOp);

    // El cliente declara los gas del paymaster en paymasterAndData[20:52]; el resto lo ponemos nosotros.
    let pmGas;
    try { pmGas = userOp.paymasterGas(op); } catch (e) { throw new SponsorError('BAD_USEROP', 400, e.message); }
    const { requiredGas, maxFeePerGas, maxCostWei } = userOp.maxCost(op);
    if (maxCostWei <= 0n) throw new SponsorError('BAD_USEROP', 400, 'La UserOp no declara coste máximo');

    const polEur = await d.prices.getPolEur();
    // Primera pasada sin comisión para fijar el tope; con comisión se recalcula tras inspeccionar el lote.
    const gasOnlyCredits = cfg.operationCostCredits({ gasUsed: Number(requiredGas), gasPriceGwei: Number(maxFeePerGas) / 1e9, polEur });
    const { feeBez } = await d.policy.evaluate({
        orgId, op, maxCostCredits: gasOnlyCredits,
        chain: { chainId: d.chain.chainId, vault: d.chain.vault, bez: d.chain.bez, signerAddress: d.signer.address },
    });

    let feeCredits = 0;
    if (feeBez > 0n) {
        const bezEur = await d.prices.getBezEur();
        feeCredits = Math.ceil((Number(ethers.formatUnits(feeBez, 18)) * bezEur * (1 + cfg.MARKUP_RATE)) / cfg.EUR_PER_CREDIT);
    }
    const maxCredits = gasOnlyCredits + feeCredits;

    // Tope por operación, ahora con la comisión incluida.
    const pol = await d.policy.loadPolicy(orgId);
    if (maxCredits > Number(pol.max_cost_credits_per_op)) {
        throw new SponsorError('COST_ABOVE_POLICY', 403, `El coste máximo (${maxCredits} créditos) supera el tope por operación`);
    }

    const key = userOp.reservationKey({ entryPoint: d.chain.entryPoint, chainId: d.chain.chainId, sender: op.sender, nonce: op.nonce });
    const validUntil = d.now() + SPONSOR_TTL_S;
    const reservation = await d.ledger.reserve(orgId, maxCredits, {
        opHash: key, appId, sender: op.sender, ttlSeconds: SPONSOR_TTL_S + 120,
        meta: { polEur, feeBez: feeBez.toString(), feeCredits, gasOnlyCredits, maxCostWei: maxCostWei.toString() },
    });
    if (!reservation) throw new SponsorError('INSUFFICIENT_GAS_TANK', 402, 'El Gas Tank no tiene saldo suficiente para esta operación');
    if (reservation.reused) throw new SponsorError('ALREADY_SPONSORED', 409, 'Esta UserOp (misma cuenta y nonce) ya tiene un patrocinio');

    try {
        const orgB32 = userOp.orgIdBytes32(orgId);
        const hash = userOp.paymasterHash({ op, orgId: orgB32, validUntil, validAfter: 0, signedMax: maxCostWei, chainId: d.chain.chainId, paymaster: d.chain.paymaster });
        const signature = await d.signer.signMessage(ethers.getBytes(hash));
        const paymasterAndData = userOp.buildPaymasterAndData({
            paymaster: d.chain.paymaster, verificationGas: pmGas.verification, postOpGas: pmGas.postOp,
            orgId: orgB32, validUntil, validAfter: 0, signedMax: maxCostWei, signature,
        });
        return { paymasterAndData, validUntil, maxCostWei: maxCostWei.toString(), maxCostCredits: maxCredits, reservationKey: key };
    } catch (err) {
        await d.ledger.release(key).catch(() => {});
        throw err;
    }
}

async function releaseSponsorship({ orgId, userOp: rawOp }, deps = {}) {
    const d = resolveDeps(deps);
    const op = userOp.normalize(rawOp);
    const key = userOp.reservationKey({ entryPoint: d.chain.entryPoint, chainId: d.chain.chainId, sender: op.sender, nonce: op.nonce });
    const r = await d.ledger.getReservation(key);
    if (!r || r.organization_id !== orgId) return { released: false };
    return d.ledger.release(key);
}

module.exports = { issueFeeVoucher, sponsorUserOp, releaseSponsorship, chainConfig, SponsorError };
