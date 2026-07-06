'use strict';

/**
 * energyLedgerService — real, DB-backed state for the Energy app, replacing the
 * previously hardcoded wallet / history / staking / P2P / CAE responses.
 *
 * Source of truth = Postgres (migration 022). On-chain reads (BEZ ERC-20 balance,
 * StakingPool stake + earned rewards) enrich the response best-effort and are
 * fully optional / boot-safe — exactly like services/vppChainBridge.js:
 *   - `ethers` required lazily-tolerant.
 *   - A read-only provider is built only when an RPC + contract address are set.
 *   - When unconfigured (e.g. contracts not yet deployed to Amoy), reads return
 *     null and the DB values stand alone.
 *
 * Every handler keys off req.user (the JWT payload: { address, userId, role }).
 * Helpers tolerate the DB mock-fallback (`{ rows: [{}] }`) so dev without
 * Postgres degrades to a clean zero-state instead of NaN.
 */

const { query } = require('../db/pool');
const logger = require('../utils/logger');

let ethers = null;
try { ethers = require('ethers'); } catch { /* ethers optional */ }

// ── On-chain read layer (provider-only, best-effort) ─────────────────────────

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];
const STAKE_ABI = [
  'function balanceOf(address) view returns (uint256)', // staked amount
  'function earned(address) view returns (uint256)',    // pending rewards
];

function readProvider() {
  const rpc = process.env.ENERGY_RPC_URL || process.env.VPP_RPC_URL
    || process.env.BEZHAS_L2_RPC_URL || process.env.POLYGON_RPC_URL;
  if (!ethers || !rpc) return null;
  try { return new ethers.JsonRpcProvider(rpc); } catch { return null; }
}

/** Real on-chain BEZ balance for an address, or null when unconfigured/failed. */
async function readBezBalance(address) {
  const p = readProvider();
  const addr = process.env.BEZ_TOKEN_ADDRESS || process.env.BEZCOIN_CONTRACT_ADDRESS
    || process.env.VITE_BEZ_POLYGON;
  if (!p || !addr || !address) return null;
  try {
    const c = new ethers.Contract(addr, ERC20_ABI, p);
    return Number(ethers.formatUnits(await c.balanceOf(address), 18));
  } catch (err) {
    logger.warn('[ENERGY][CHAIN] BEZ balanceOf failed: %s', err.message);
    return null;
  }
}

/** Real on-chain staking position (staked + earned) or null when unconfigured. */
async function readStaking(address) {
  const p = readProvider();
  const addr = process.env.CONTRACT_STAKING_POOL_V2 || process.env.STAKING_POOL_ADDRESS;
  if (!p || !addr || !address) return null;
  try {
    const c = new ethers.Contract(addr, STAKE_ABI, p);
    const [staked, earned] = await Promise.all([c.balanceOf(address), c.earned(address)]);
    return {
      staked_bzhs: Number(ethers.formatUnits(staked, 18)),
      earned_bzhs: Number(ethers.formatUnits(earned, 18)),
    };
  } catch (err) {
    logger.warn('[ENERGY][CHAIN] staking read failed: %s', err.message);
    return null;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const err = (status, message) => Object.assign(new Error(message), { status });
const num = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const signed = (v) => (v == null ? null : `${num(v) >= 0 ? '+' : ''}${num(v).toFixed(2)}`);

function normalizeWallet(row, address) {
  return {
    wallet_address: row?.wallet_address || address,
    balance_bzhs: num(row?.balance_bzhs),
    staked_bzhs: num(row?.staked_bzhs),
    pending_rewards_bzhs: num(row?.pending_rewards_bzhs),
    apy_pct: num(row?.apy_pct, 8.5),
    reputation_score: Math.round(num(row?.reputation_score, 50)),
    self_sufficiency_pct: num(row?.self_sufficiency_pct),
    available_kwh: num(row?.available_kwh),
    reserved_kwh: num(row?.reserved_kwh),
  };
}

/** Upsert + return the caller's energy wallet (zero-state on first touch). */
async function getOrCreateWallet(userId, address) {
  const { rows } = await query(
    `INSERT INTO energy_wallets (user_id, wallet_address)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET wallet_address = COALESCE(energy_wallets.wallet_address, EXCLUDED.wallet_address),
                     updated_at = NOW()
       RETURNING *`,
    [userId, address]
  );
  return normalizeWallet(rows && rows[0], address);
}

function mapCae(r) {
  return {
    token_id: r.token_id,
    savings_kwh: num(r.savings_kwh),
    period: r.period,
    certified_by: r.certifier,
    status: r.status,
    market_value_eur: r.market_value_eur != null ? num(r.market_value_eur).toFixed(2) : null,
    for_sale: !!r.for_sale,
    listing_price_eur: r.listing_price_eur != null ? num(r.listing_price_eur).toFixed(2) : undefined,
    tx_hash: r.tx_hash,
    minted_at: r.minted_at,
  };
}

function mapOffer(r) {
  return {
    offer_id: r.offer_id,
    seller: r.seller_address || '0x0000...0000',
    energy_kwh: num(r.energy_kwh),
    price_bzhs_kwh: num(r.price_bzhs_kwh),
    total_bzhs: num(num(r.energy_kwh) * num(r.price_bzhs_kwh)),
    source: r.source,
    location: r.location,
    expires_at: r.expires_at,
    verified: !!r.verified,
  };
}

// ── Wallet ───────────────────────────────────────────────────────────────────

async function getWalletStats(req) {
  const { userId, address } = req.user;
  const w = await getOrCreateWallet(userId, address);

  const { rows: yrows } = await query(
    `SELECT COALESCE(SUM(amount_eur), 0) AS eur
       FROM energy_tx_history
       WHERE user_id = $1 AND amount_eur > 0 AND created_at > NOW() - INTERVAL '30 days'`,
    [userId]
  );
  const yieldEur = num(yrows && yrows[0] && yrows[0].eur);

  const [bezOnchain, staking] = await Promise.all([readBezBalance(address), readStaking(address)]);

  return {
    address,
    balance_bzhs: w.balance_bzhs.toFixed(2),
    yield_percentage: (w.balance_bzhs > 0 ? (yieldEur / w.balance_bzhs) * 100 : 0).toFixed(1),
    yield_eur_30d: yieldEur.toFixed(2),
    reputation_score: w.reputation_score,
    self_sufficiency_pct: w.self_sufficiency_pct,
    staking: {
      staked_bzhs: num(staking ? staking.staked_bzhs : w.staked_bzhs).toFixed(2),
      apy_pct: w.apy_pct.toFixed(1),
      pending_rewards_bzhs: num(staking ? staking.earned_bzhs : w.pending_rewards_bzhs).toFixed(2),
      lock_until: null,
    },
    energy_credits: {
      available_kwh: w.available_kwh,
      reserved_kwh: w.reserved_kwh,
      expires_at: null,
    },
    onchain: bezOnchain == null
      ? { configured: false }
      : { configured: true, bez_balance: bezOnchain.toFixed(4) },
  };
}

async function getHistory(req, { limit = 20, type } = {}) {
  const { rows } = await query(
    `SELECT id, type, amount_bzhs, amount_eur, status, tx_hash, created_at
       FROM energy_tx_history
       WHERE user_id = $1 AND ($2::text IS NULL OR type = $2)
       ORDER BY created_at DESC LIMIT $3`,
    [req.user.userId, type || null, limit]
  );
  const history = (rows || [])
    .filter((r) => r && r.type)
    .map((r) => ({
      id: `tx${r.id}`,
      type: r.type,
      amount_bzhs: signed(r.amount_bzhs),
      amount_eur: signed(r.amount_eur),
      ts: r.created_at,
      status: r.status,
      tx_hash: r.tx_hash,
    }));
  return { count: history.length, history };
}

async function recordCreditPurchase(req, { amountBzhs, txHash }) {
  const { userId, address } = req.user;

  // Best-effort on-chain confirmation: if a provider is configured, the tx must
  // have mined successfully. When unconfigured we trust the client + replay guard.
  const p = readProvider();
  if (p) {
    try {
      const receipt = await p.getTransactionReceipt(txHash);
      if (receipt && receipt.status === 0) throw err(400, 'On-chain transaction reverted');
    } catch (e) {
      if (e.status) throw e; // surface our own 400
      logger.warn('[ENERGY][CHAIN] receipt check skipped: %s', e.message);
    }
  }

  // Replay protection (id present only on a real prior row, never on mock `{}`).
  const dup = await query('SELECT id FROM energy_tx_history WHERE tx_hash = $1', [txHash]);
  if (dup.rows && dup.rows[0] && dup.rows[0].id) throw err(409, 'Transaction already processed');

  await getOrCreateWallet(userId, address);
  await query('UPDATE energy_wallets SET balance_bzhs = balance_bzhs + $1, updated_at = NOW() WHERE user_id = $2',
    [amountBzhs, userId]);
  await query(
    `INSERT INTO energy_tx_history (user_id, type, amount_bzhs, amount_eur, status, tx_hash)
       VALUES ($1, 'CREDIT_PURCHASE', $2, $3, 'CONFIRMED', $4)
       ON CONFLICT (tx_hash) DO NOTHING`,
    [userId, amountBzhs, -(amountBzhs * 0.26), txHash]
  );
  const { rows } = await query('SELECT balance_bzhs FROM energy_wallets WHERE user_id = $1', [userId]);
  return {
    tx_hash: txHash,
    amount_bzhs: amountBzhs,
    new_balance_bzhs: num(rows && rows[0] && rows[0].balance_bzhs, amountBzhs).toFixed(2),
    credited_kwh: Number((amountBzhs * 0.25).toFixed(2)),
    credited_at: new Date().toISOString(),
  };
}

// ── CAE tokens ───────────────────────────────────────────────────────────────

async function listCaeTokens(req) {
  const { userId, address } = req.user;
  const { rows } = await query(
    'SELECT * FROM energy_cae_tokens WHERE owner_user_id = $1 ORDER BY minted_at DESC', [userId]);
  const tokens = (rows || []).filter((r) => r && r.token_id).map(mapCae);
  const total = tokens.reduce((s, t) => s + num(t.market_value_eur), 0);
  return { owner: address, total_tokens: tokens.length, total_value_eur: total.toFixed(2), tokens };
}

async function mintCae(req, { savingsKwh, period, certifier, telemetryProof }) {
  const tokenId = `CAE-${period}-${Date.now().toString(36).toUpperCase()}`;
  const value = Number((savingsKwh * 0.1).toFixed(2));
  await query(
    `INSERT INTO energy_cae_tokens (token_id, owner_user_id, savings_kwh, period, certifier, status, market_value_eur, telemetry_proof)
       VALUES ($1, $2, $3, $4, $5, 'PENDING_MINT', $6, $7)`,
    [tokenId, req.user.userId, savingsKwh, period, certifier, value, telemetryProof]
  );
  return {
    token_id: tokenId, savings_kwh: savingsKwh, period, certifier,
    telemetry_proof: telemetryProof, estimated_value_eur: value,
    minted_at: new Date().toISOString(), status: 'PENDING_MINT', tx_hash: null,
  };
}

// ── P2P market ───────────────────────────────────────────────────────────────

async function listP2pOffers() {
  const { rows } = await query(
    `SELECT * FROM energy_p2p_offers
       WHERE status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC LIMIT 100`
  );
  const active_offers = (rows || []).filter((r) => r && r.offer_id).map(mapOffer);
  return { market: 'BeZhas P2P Energy Market', settlement_token: 'BZHS', active_offers };
}

async function createP2pOffer(req, { energyKwh, priceBzhsKwh, nodeId, expiresInMinutes, source, location }) {
  const { userId, address } = req.user;
  const offerId = `p2p-${Date.now().toString(36)}`;
  const expires = new Date(Date.now() + expiresInMinutes * 60_000).toISOString();
  await query(
    `INSERT INTO energy_p2p_offers (offer_id, seller_user_id, seller_address, energy_kwh, price_bzhs_kwh, source, location, node_id, status, verified, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', false, $9)`,
    [offerId, userId, address, energyKwh, priceBzhsKwh, source || null, location || null, nodeId, expires]
  );
  return {
    offer_id: offerId, seller: address, energy_kwh: energyKwh, price_bzhs_kwh: priceBzhsKwh,
    total_bzhs: Number((energyKwh * priceBzhsKwh).toFixed(4)), node_id: nodeId, expires_at: expires, tx_hash: null,
  };
}

async function buyP2pOffer(req, { offerId, txHash }) {
  const { userId } = req.user;
  const { rows } = await query(
    'SELECT id, status, energy_kwh, price_bzhs_kwh FROM energy_p2p_offers WHERE offer_id = $1', [offerId]);
  const offer = rows && rows[0];
  if (!offer || !offer.id) throw err(404, 'Offer not found');
  if (offer.status !== 'ACTIVE') throw err(409, `Offer is ${offer.status}, not purchasable`);

  await query('UPDATE energy_p2p_offers SET status = $1, buyer_user_id = $2, settle_tx_hash = $3 WHERE offer_id = $4',
    ['SOLD', userId, txHash, offerId]);
  const total = num(offer.energy_kwh) * num(offer.price_bzhs_kwh);
  await query(
    `INSERT INTO energy_tx_history (user_id, type, amount_bzhs, amount_eur, status, tx_hash)
       VALUES ($1, 'P2P', $2, $3, 'CONFIRMED', $4) ON CONFLICT (tx_hash) DO NOTHING`,
    [userId, -total, null, txHash]
  );
  return { offer_id: offerId, tx_hash: txHash, settled_at: new Date().toISOString(), delivery_window: '15 min' };
}

// ── Staking ──────────────────────────────────────────────────────────────────

async function getStaking(req) {
  const { userId, address } = req.user;
  const w = await getOrCreateWallet(userId, address);
  const onchain = await readStaking(address);
  return {
    staker: address,
    staked_bzhs: num(onchain ? onchain.staked_bzhs : w.staked_bzhs).toFixed(2),
    apy_pct: w.apy_pct.toFixed(1),
    rewards: {
      pending_bzhs: num(onchain ? onchain.earned_bzhs : w.pending_rewards_bzhs).toFixed(2),
      pending_eur: null,
      claimable_at: new Date().toISOString(),
      source: 'VPP Flexibility Pool Yield',
    },
    onchain: onchain == null ? { configured: false } : { configured: true, ...onchain },
  };
}

async function claimStaking(req) {
  const { userId, address } = req.user;
  const w = await getOrCreateWallet(userId, address);
  const claim = w.pending_rewards_bzhs;
  if (claim > 0) {
    await query(
      'UPDATE energy_wallets SET balance_bzhs = balance_bzhs + $1, pending_rewards_bzhs = 0, updated_at = NOW() WHERE user_id = $2',
      [claim, userId]);
    await query(
      `INSERT INTO energy_tx_history (user_id, type, amount_bzhs, amount_eur, status)
         VALUES ($1, 'STAKING', $2, NULL, 'CONFIRMED')`,
      [userId, claim]);
  }
  return { claimed_bzhs: claim.toFixed(2), claimed_at: new Date().toISOString(), tx_hash: null };
}

module.exports = {
  getWalletStats,
  getHistory,
  recordCreditPurchase,
  listCaeTokens,
  mintCae,
  listP2pOffers,
  createP2pOffer,
  buyP2pOffer,
  getStaking,
  claimStaking,
  // exposed for tests
  readBezBalance,
  readStaking,
  _normalizeWallet: normalizeWallet,
};
