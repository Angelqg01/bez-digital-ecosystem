'use strict';

/**
 * Standalone end-to-end verifier for vppChainBridge against a local chain.
 * Requires env: VPP_RPC_URL, VPP_OPERATOR_PK, BEZHAS_VPP_ADDRESS, OWNER_ADDR.
 *
 *   node scripts/verify-chain-bridge.js   (exit 0 = flexibility accrued on-chain)
 */

const bridge = require('../services/vppChainBridge');

(async () => {
  console.log('bridge enabled:', bridge.isEnabled());
  if (!bridge.isEnabled()) { console.error('bridge not configured'); process.exit(1); }

  const node = process.env.NODE_ID || 'n4';
  const owner = process.env.OWNER_ADDR;

  const enroll = await bridge.enrollAssetOnChain(node, owner, 0 /* BATTERY */, 500);
  console.log('enrollAsset:', enroll);

  const log = await bridge.logCommandOnChain('arb_test_1', node, 'CHARGE_BATTERY', { powerKw: 50 }, 50);
  console.log('logCommand:', log);

  const flex = await bridge.flexibilityOf(node);
  console.log('flexibilityOf', node, '=', flex);

  if (flex === 50) { console.log('\n✅ on-chain audit verified (flexibility accrued = 50 kWh)'); process.exit(0); }
  console.error('\n❌ unexpected flexibility:', flex);
  process.exit(1);
})().catch((e) => { console.error('verify failed:', e.message); process.exit(1); });
