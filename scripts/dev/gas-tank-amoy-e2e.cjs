#!/usr/bin/env node
/**
 * Prueba de extremo a extremo del Gas Tank en Amoy (o en un fork local de Amoy):
 *   prepare   crea una organización de pruebas en una Postgres LOCAL, emite el voucher de comisión y firma el patrocinio
 *             con la clave KMS REAL del paymaster, arma la UserOp (cuenta nueva + lote voucher/approve/tokenizar) y deja
 *             listo el handleOps. NO envía nada a la cadena.
 *   settle <txHash>   lee el UserOperationEvent de esa transacción y liquida la reserva en el Gas Tank.
 *
 * El «bundler» es el admin: el handleOps se envía con `forge script ... SubmitHandleOps` (lo firmas tú con tu keystore).
 *
 * Entorno obligatorio: DATABASE_URL (Postgres local ya migrada), AMOY_RPC, GAS_PAYMASTER_KMS_KEY,
 *   E2E_PAYMASTER, E2E_VAULT, E2E_TOKEN, E2E_TOKENIZER, E2E_FACTORY, E2E_ADMIN. Opcional: E2E_STATE (fichero de estado).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const need = (k) => { if (!process.env[k]) { console.error(`Falta ${k}`); process.exit(2); } return process.env[k]; };
const DATABASE_URL = need('DATABASE_URL');
if (/amazonaws|googleapis|cloudsql|\.bezhas\.com/i.test(DATABASE_URL) || !/localhost|127\.0\.0\.1/.test(DATABASE_URL)) {
    console.error('Este script solo escribe en una Postgres LOCAL (localhost). Abortado.'); process.exit(2);
}
const RPC = need('AMOY_RPC');
const E = {
    paymaster: need('E2E_PAYMASTER'), vault: need('E2E_VAULT'), token: need('E2E_TOKEN'),
    tokenizer: need('E2E_TOKENIZER'), factory: need('E2E_FACTORY'), admin: need('E2E_ADMIN'),
};
need('GAS_PAYMASTER_KMS_KEY');
const ENTRYPOINT = '0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108';

// Configuración que lee el servicio de patrocinio (api/services/gasTank/paymasterService.js)
process.env.GAS_TANK_CHAIN_ID = '80002';
process.env.GAS_TANK_ENTRYPOINT = ENTRYPOINT;
process.env.GAS_TANK_PAYMASTER = E.paymaster;
process.env.GAS_TANK_VAULT = E.vault;
process.env.GAS_TANK_BEZ_TOKEN = E.token;
process.env.GAS_TANK_POL_EUR = process.env.GAS_TANK_POL_EUR || '0.4';

const API = path.resolve(__dirname, '../../api');
const { ethers } = require(path.join(API, 'node_modules/ethers'));
const db = require(path.join(API, 'db/pool'));
const svc = require(path.join(API, 'services/gasTank/paymasterService'));
const ledger = require(path.join(API, 'services/gasTank/ledger'));
const rec = require(path.join(API, 'services/gasTank/reconciler'));
const u = require(path.join(API, 'services/gasTank/userOp'));

const STATE = process.env.E2E_STATE || path.join(__dirname, '.gas-tank-e2e-state.json');
const provider = new ethers.JsonRpcProvider(RPC);
const TOKENIZE_SEL = ethers.id('tokenizeAsset(string)').slice(0, 10);

const ACCOUNT = new ethers.Interface(['function executeBatch((address target,uint256 value,bytes data)[])']);
const FACTORY = new ethers.Interface(['function createAccount(address owner,uint256 salt) returns (address)', 'function getAddress(address owner,uint256 salt) view returns (address)']);
const TOKENIZER = new ethers.Interface(['function tokenizeAsset(string name) returns (uint256)']);
const ERC20 = new ethers.Interface(['function approve(address,uint256) returns (bool)', 'function balanceOf(address) view returns (uint256)']);
const VAULT = new ethers.Interface(['function pullProtocolFee(bytes32,address,bytes4,uint256,uint48,bytes32,bytes)']);
const EP = new ethers.Contract(ENTRYPOINT, [
    'function getUserOpHash((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) op) view returns (bytes32)',
    'function handleOps((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature)[] ops,address beneficiary)',
    'error FailedOp(uint256 opIndex,string reason)', 'error FailedOpWithRevert(uint256 opIndex,string reason,bytes inner)',
], provider);

async function ensureOrg() {
    let ent = (await db.query(`SELECT id FROM enterprises WHERE name = 'Gas Tank E2E'`)).rows[0];
    if (!ent) ent = (await db.query(`INSERT INTO enterprises (name, sector, tier, is_active) VALUES ('Gas Tank E2E', 'logistics', 'enterprise', TRUE) RETURNING id`)).rows[0];
    let org = (await db.query(`SELECT id FROM organizations WHERE legacy_enterprise_id = $1`, [ent.id])).rows[0];
    if (!org) org = (await db.query(`INSERT INTO organizations (name, legacy_enterprise_id, verification_status) VALUES ('Gas Tank E2E', $1, 'verified') RETURNING id`, [ent.id])).rows[0];
    let app = (await db.query(`SELECT id FROM app_registry WHERE app_name = 'gas-tank-e2e'`)).rows[0];
    if (!app) app = (await db.query(`INSERT INTO app_registry (app_name, enterprise_id, api_key_hash, scopes) VALUES ('gas-tank-e2e', $1, $2, ARRAY['gas']) RETURNING id`, [ent.id, ethers.id(String(Date.now())).slice(2)])).rows[0];
    await db.query(
        `INSERT INTO gas_tank_policies (organization_id, allowed_targets, max_cost_credits_per_op, require_verified)
         VALUES ($1, $2::jsonb, 5000, TRUE)
         ON CONFLICT (organization_id) DO UPDATE SET allowed_targets = EXCLUDED.allowed_targets, active = TRUE, updated_at = NOW()`,
        [org.id, JSON.stringify([{ address: E.tokenizer, selectors: [TOKENIZE_SEL], maxFeeBez: '100' }])]);
    await db.query(`INSERT INTO token_price_cache (symbol, price_usd) VALUES ('BEZ', 0.0075) ON CONFLICT (symbol) DO UPDATE SET price_usd = 0.0075, updated_at = NOW()`);
    const b = await ledger.getBalance(org.id);
    if (b.balanceCredits < 50000) await ledger.credit(org.id, 100000, { kind: 'adjustment', externalRef: `e2e:${Date.now()}` });
    return { orgId: org.id, appId: String(app.id) };
}

const packedGas = (hi, lo) => ethers.concat([ethers.toBeHex(hi, 16), ethers.toBeHex(lo, 16)]);

async function prepare() {
    const { orgId, appId } = await ensureOrg();
    const owner = ethers.Wallet.createRandom();
    const salt = BigInt(Date.now());
    const factory = new ethers.Contract(E.factory, FACTORY, provider);
    const sender = await factory.getFunction('getAddress')(owner.address, salt);
    const initCode = ethers.concat([E.factory, FACTORY.encodeFunctionData('createAccount', [owner.address, salt])]);

    const voucher = await svc.issueFeeVoucher({ orgId, appId, sender, target: E.tokenizer, selector: TOKENIZE_SEL, amountBez: '100' });
    const amount = BigInt(voucher.amount);
    const calls = [
        [E.vault, 0, VAULT.encodeFunctionData('pullProtocolFee', [voucher.orgId, voucher.target, voucher.selector, amount, voucher.validUntil, voucher.nonce, voucher.signature])],
        [E.token, 0, ERC20.encodeFunctionData('approve', [E.tokenizer, amount])],
        [E.tokenizer, 0, TOKENIZER.encodeFunctionData('tokenizeAsset', ['galpon-algeciras-e2e'])],
    ];
    const fee = await provider.getFeeData();
    const maxFee = (fee.maxFeePerGas ?? fee.gasPrice) * 12n / 10n;
    const prio = fee.maxPriorityFeePerGas ?? 1_000_000_000n;
    const raw = {
        sender, nonce: '0x0', initCode,
        callData: ACCOUNT.encodeFunctionData('executeBatch', [calls]),
        accountGasLimits: packedGas(450_000n, 300_000n),            // verificación (incl. crear la cuenta) | llamada
        preVerificationGas: '0x' + (60_000).toString(16),
        gasFees: packedGas(prio, maxFee),
        paymasterAndData: ethers.concat([E.paymaster, ethers.toBeHex(100_000n, 16), ethers.toBeHex(50_000n, 16)]),
    };
    const sponsored = await svc.sponsorUserOp({ orgId, appId, userOp: raw });
    const op = { ...raw, paymasterAndData: sponsored.paymasterAndData, signature: '0x' };
    const opArr = [op.sender, BigInt(op.nonce), op.initCode, op.callData, op.accountGasLimits, BigInt(op.preVerificationGas), op.gasFees, op.paymasterAndData, op.signature];
    const userOpHash = await EP.getUserOpHash(opArr);
    op.signature = owner.signingKey.sign(userOpHash).serialized;   // SimpleAccount v0.8 recupera del hash tal cual (sin prefijo EIP-191)
    opArr[8] = op.signature;

    // Comprobación previa sin gastar gas: el admin simula el handleOps. Si el EntryPoint lo rechaza, aquí se ve por qué.
    try {
        await EP.getFunction('handleOps').staticCall([opArr], E.admin, { from: E.admin });
    } catch (e) {
        const msg = e.revert ? `${e.revert.name}(${e.revert.args.join(', ')})` : e.shortMessage || e.message;
        console.error('El EntryPoint rechaza la UserOp en la simulación:', msg);
        if (process.env.E2E_DEBUG) console.error('handleOps calldata (para `cast call --trace`):', EP.interface.encodeFunctionData('handleOps', [[opArr], E.admin]), '\n', e.code, e.data);
        await svc.releaseSponsorship({ orgId, userOp: raw });
        process.exit(1);
    }
    const data = EP.interface.encodeFunctionData('handleOps', [[opArr], E.admin]);
    fs.writeFileSync(STATE, JSON.stringify({ orgId, appId, sender, nonce: '0', userOpHash, maxCostCredits: sponsored.maxCostCredits, owner: owner.address }, null, 2));
    console.log(JSON.stringify({ sender, userOpHash, maxCostWei: sponsored.maxCostWei, maxCostCredits: sponsored.maxCostCredits, state: STATE }, null, 2));
    console.log('\nUSEROP_CALLDATA=' + data);
    console.error('\nPara enviarlo (el admin hace de bundler; el multiplicador de gas es OBLIGATORIO: el EntryPoint revierte con AA95 si la tx lleva poco gas):\n'
        + '  USEROP_CALLDATA=<la línea de arriba> FOUNDRY_PROFILE=aa forge script test-aa/AmoyE2E.s.sol --tc SubmitHandleOps \\\n'
        + '    --rpc-url $AMOY_RPC --account <keystore> --gas-estimate-multiplier 400 --broadcast\n'
        + 'Después: node scripts/dev/gas-tank-amoy-e2e.cjs settle <txHash>');
}

async function settle(txHash) {
    if (!txHash) { console.error('Uso: settle <txHash>'); process.exit(2); }
    const st = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    const rcpt = await provider.getTransactionReceipt(txHash);
    if (!rcpt || rcpt.status !== 1) { console.error('La transacción no existe o revirtió'); process.exit(1); }
    const log = rcpt.logs.find((l) => l.address.toLowerCase() === ENTRYPOINT.toLowerCase() && l.topics[0] === rec.EVENT_TOPIC);
    if (!log) { console.error('La transacción no contiene UserOperationEvent'); process.exit(1); }
    const ev = rec.EP_IFACE.parseLog(log);
    const out = await rec.settleFromEvent({
        entryPoint: ENTRYPOINT, chainId: 80002, sender: ev.args.sender, nonce: ev.args.nonce,
        success: ev.args.success, actualGasCost: ev.args.actualGasCost, txHash,
    });
    const token = new ethers.Contract(E.token, ERC20, provider);
    const tokenizer = new ethers.Contract(E.tokenizer, ['function assets() view returns (uint256)'], provider);
    console.log(JSON.stringify({
        userOpSuccess: ev.args.success,
        actualGasCostWei: ev.args.actualGasCost.toString(),
        liquidacion: out,
        saldoGasTank: await ledger.getBalance(st.orgId),
        activosTokenizados: (await tokenizer.assets()).toString(),
        cuentaSinBEZ: (await token.balanceOf(st.sender)).toString(),
        movimientos: (await ledger.activity(st.orgId, { limit: 3 })).map((a) => ({ kind: a.kind, credits: a.credits, op: a.op_type })),
    }, null, 2));
}

(async () => {
    const [cmd, arg] = process.argv.slice(2);
    if (cmd === 'prepare') await prepare();
    else if (cmd === 'settle') await settle(arg);
    else { console.error('Uso: gas-tank-amoy-e2e.cjs prepare | settle <txHash>'); process.exit(2); }
    await db.pool.end();
})().catch(async (e) => { console.error('ERROR', e.code || '', e.message); try { await db.pool.end(); } catch { /* */ } process.exit(1); });
