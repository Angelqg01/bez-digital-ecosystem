#!/usr/bin/env node
'use strict';

/**
 * verify-telemetry-anchor.js — Phase 4 proof on a REAL local chain (Anvil):
 *
 *   signed telemetry → merkle root → EnergyOracle.submitProof (on-chain)
 *                                  → read back proofs(proofId).dataURI == root
 *
 * Spawns Anvil, deploys EnergyOracle.sol with ethers (using the forge artifact),
 * registers a node, anchors a batch of signed telemetry via vppChainBridge, then
 * reads the proof back from chain and asserts the merkle root + kWh match. Also
 * proves tamper-evidence: changing a reading changes the root.
 *
 * Exit 0 on success, 1 on failure. Requires Foundry (anvil) + a prior `forge build`.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ethers = require('ethers');

const anchor = require('../services/telemetryAnchor');
const bridge = require('../services/vppChainBridge');

const PORT = 8547;
const RPC = `http://127.0.0.1:${PORT}`;
const ANVIL = process.env.ANVIL_BIN || path.join(os.homedir(), '.foundry', 'bin', 'anvil.exe');
const KEY0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ADDR0 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ARTIFACT = path.resolve(__dirname, '../../smart-contracts/out/EnergyOracle.sol/EnergyOracle.json');

const log = (...a) => console.log('[anchor-e2e]', ...a);

function startAnvil() {
  return new Promise((resolve, reject) => {
    const p = spawn(ANVIL, ['--port', String(PORT), '--silent', '--chain-id', '31337']);
    p.on('error', reject);
    const t = setTimeout(() => reject(new Error('anvil start timeout')), 15000);
    (async () => {
      const provider = new ethers.JsonRpcProvider(RPC);
      for (let i = 0; i < 50; i++) {
        try { await provider.getBlockNumber(); clearTimeout(t); return resolve(p); } catch { await new Promise((r) => setTimeout(r, 300)); }
      }
      reject(new Error('anvil never became ready'));
    })();
  });
}

const signed = (seq, energy, sig) => ({
  type: 'SOLAR', name: 'Array Alpha', status: 'ONLINE', protocol: 'SunSpec/Modbus-TCP',
  metrics: { output_kw: 18.42, voltage_v: 231.4, grid_frequency: 50.01, energy_kwh: energy },
  ts: '2026-06-27T10:15:00.000Z', seq, keyId: 'edge-key-1', sig,
});

async function main() {
  if (!fs.existsSync(ARTIFACT)) { console.error('❌ missing artifact — run forge build first:', ARTIFACT); process.exit(1); }
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8'));

  const anvil = await startAnvil();
  log('anvil up on', RPC);
  const errs = [];
  try {
    // 1) Deploy EnergyOracle(admin = deployer).
    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(KEY0, provider);
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode.object || artifact.bytecode, wallet);
    const oracle = await factory.deploy(ADDR0);
    await oracle.waitForDeployment();
    const oracleAddr = await oracle.getAddress();
    log('EnergyOracle deployed at', oracleAddr);

    // 2) Point the bridge at the live chain.
    process.env.VPP_RPC_URL = RPC;
    process.env.VPP_OPERATOR_PK = KEY0;
    process.env.ENERGY_ORACLE_ADDRESS = oracleAddr;
    bridge._reset();
    if (!bridge.isOracleEnabled()) errs.push('bridge oracle not enabled after config');

    // 3) Accumulate signed telemetry and anchor it on-chain.
    anchor._reset();
    anchor.observe({ nodeId: 'n1', accepted: true, payload: signed(1, 1000, 'sigA') });
    anchor.observe({ nodeId: 'n1', accepted: true, payload: signed(2, 1012, 'sigB') });
    anchor.observe({ nodeId: 'n1', accepted: true, payload: signed(3, 1025, 'sigC') });

    const results = await anchor.anchorPending(bridge, ADDR0);
    if (results.length !== 1) errs.push(`expected 1 anchor result, got ${results.length}`);
    const anchored = results[0];
    log('anchored: kWh', anchored && anchored.kWh, 'root', anchored && anchored.root.slice(0, 18), 'tx', anchored && anchored.tx);
    if (!anchored || !anchored.ok) errs.push('anchor tx not ok');
    if (anchored && anchored.kWh !== 25) errs.push(`expected kWh 25, got ${anchored.kWh}`); // 1025-1000

    // 4) Read the proof back from chain and assert the merkle root + kWh persisted.
    const onchain = await bridge.getProofOnChain(anchored.proofId);
    log('on-chain proof:', JSON.stringify(onchain));
    if (!onchain || !onchain.exists) errs.push('proof not found on-chain');
    if (onchain && onchain.dataURI !== anchored.root) errs.push('on-chain dataURI != anchored merkle root');
    if (onchain && onchain.kWh !== 25) errs.push(`on-chain kWh ${onchain.kWh} != 25`);
    if (onchain && onchain.account.toLowerCase() !== ADDR0.toLowerCase()) errs.push('on-chain account mismatch');

    // 5) Tamper-evidence: a changed reading yields a different root (so it could
    //    never silently match the already-anchored proof).
    anchor._reset();
    anchor.observe({ nodeId: 'n2', accepted: true, payload: signed(1, 1000, 'sigA') });
    anchor.observe({ nodeId: 'n2', accepted: true, payload: signed(2, 1012, 'TAMPERED') });
    anchor.observe({ nodeId: 'n2', accepted: true, payload: signed(3, 1025, 'sigC') });
    const tamperBatch = anchor.buildBatch('n2');
    if (tamperBatch.root === anchored.root) errs.push('tampered batch produced the same root (not tamper-evident)');
  } catch (err) {
    errs.push(`exception: ${err.message}`);
  } finally {
    anvil.kill();
  }

  if (errs.length) { console.error('\n❌ FAIL:', errs.join('; ')); process.exit(1); }
  console.log('\n✅ PASS — signed telemetry → merkle root → anchored in EnergyOracle on-chain → read back; tamper changes root');
  process.exit(0);
}

main().catch((err) => { console.error('\n❌ ERROR:', err); process.exit(1); });
