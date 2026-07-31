import { Router } from 'express';
import { ethers } from 'ethers';
import { requireScope } from './auth.js';

const router = Router();

const HUB_API_URL = process.env.BEZHAS_HUB_API_URL || process.env.CORE_API_URL || 'http://localhost:3001';
const CORE_CHAIN_ID = Number(process.env.CORE_CHAIN_ID || process.env.CHAIN_ID || 2708);
const CORE_NETWORK = process.env.CORE_NETWORK || 'BeZhas L2';
const BEZ_TOKEN_ADDRESS = process.env.BEZ_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_BEZCOIN_ADDRESS || '';
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const BEZ_CREDIT_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter',
    eurAmount: 25,
    bezCredits: 500,
    bonusPct: 0,
    recommendedFor: ['copywriting', 'short-analysis'],
  },
  {
    id: 'growth',
    name: 'Growth',
    eurAmount: 75,
    bezCredits: 1575,
    bonusPct: 5,
    recommendedFor: ['ads-agent', 'campaigns'],
  },
  {
    id: 'pro',
    name: 'Pro',
    eurAmount: 199,
    bezCredits: 4577,
    bonusPct: 15,
    recommendedFor: ['video-agent', 'voice-agent', 'batch-jobs'],
  },
  {
    id: 'agency',
    name: 'Agency',
    eurAmount: 499,
    bezCredits: 12475,
    bonusPct: 25,
    recommendedFor: ['multi-client', 'high-volume-ai', 'all-subapps'],
  },
];

function buildHeaders(req) {
  const headers = { 'Content-Type': 'application/json' };
  if (req.headers.authorization) headers.Authorization = req.headers.authorization;
  if (req.headers['x-wallet-address']) headers['x-wallet-address'] = req.headers['x-wallet-address'];
  if (req.headers['x-api-key']) headers['x-api-key'] = req.headers['x-api-key'];
  return headers;
}

async function proxyToHub(req, res, path, options = {}) {
  const response = await fetch(`${HUB_API_URL}${path}`, {
    method: options.method || req.method,
    headers: buildHeaders(req),
    body: options.body === undefined ? (['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body)) : options.body,
  });

  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';
  res.status(response.status);

  if (contentType.includes('application/json')) {
    return res.json(text ? JSON.parse(text) : {});
  }
  return res.send(text);
}

/**
 * GET /api/billing/core
 * Contract and chain metadata used by every SubApp to anchor credits to Core.
 */
router.get('/core', (_req, res) => {
  res.json({
    core: {
      chainId: CORE_CHAIN_ID,
      network: CORE_NETWORK,
      rpcUrl: RPC_URL,
      contracts: {
        BEZCoinV2: BEZ_TOKEN_ADDRESS || null,
        Paymaster: process.env.PAYMASTER_ADDRESS || null,
        Treasury: process.env.TREASURY_ADDRESS || null,
      },
      endpoints: {
        contracts: '/api/contracts',
        wallet: '/api/wallet',
        billing: '/api/billing',
      },
    },
  });
});

/**
 * GET /api/billing/packages
 * Unified BEZ-Coin credit packages for Hub and every SubApp.
 */
router.get('/packages', (_req, res) => {
  res.json({
    currency: 'BEZ',
    fiatCurrency: 'EUR',
    packages: BEZ_CREDIT_PACKAGES,
    note: 'Bonuses are applied by the central billing ledger/webhook, not by SubApps.',
  });
});

/**
 * POST /api/billing/packages/:id/checkout
 * Starts checkout for a predefined BEZ-Coin package through BeZhas-Hub billing.
 */
router.post('/packages/:id/checkout', requireScope('billing:write'), (req, res) => {
  const pack = BEZ_CREDIT_PACKAGES.find((item) => item.id === req.params.id);
  if (!pack) return res.status(404).json({ error: 'BEZ credit package not found' });

  return proxyToHub(req, res, '/api/billing/add-fiat-funds', {
    method: 'POST',
    body: JSON.stringify({
      amount: pack.eurAmount,
      packageId: pack.id,
      expectedBezCredits: pack.bezCredits,
      bonusPct: pack.bonusPct,
    }),
  });
});

/**
 * GET /api/billing/core/balance/:address
 * Reads BEZ-Coin directly from BeZhas-Blockchain Core.
 */
router.get('/core/balance/:address', requireScope('billing:read'), async (req, res) => {
  const { address } = req.params;
  if (!ethers.isAddress(address)) return res.status(400).json({ error: 'Invalid address' });

  if (!BEZ_TOKEN_ADDRESS) {
    return res.status(503).json({ error: 'BEZ token contract not configured' });
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const bez = new ethers.Contract(
      BEZ_TOKEN_ADDRESS,
      ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)'],
      provider
    );
    const [raw, decimals, symbol] = await Promise.all([
      bez.balanceOf(address),
      bez.decimals().catch(() => 18),
      bez.symbol().catch(() => 'BEZ'),
    ]);

    res.json({
      address,
      chainId: CORE_CHAIN_ID,
      contract: BEZ_TOKEN_ADDRESS,
      symbol,
      raw: raw.toString(),
      formatted: ethers.formatUnits(raw, decimals),
    });
  } catch (error) {
    res.status(502).json({ error: `Core balance read failed: ${error.message}` });
  }
});

router.get('/balance', requireScope('billing:read'), (req, res) => proxyToHub(req, res, '/api/billing/balance'));
router.get('/history', requireScope('billing:read'), (req, res) => {
  const qs = new URLSearchParams(req.query).toString();
  return proxyToHub(req, res, `/api/billing/history${qs ? `?${qs}` : ''}`);
});
router.get('/ai/summary', requireScope('billing:read'), (req, res) => proxyToHub(req, res, '/api/billing/ai/summary'));
router.post('/ai/estimate', requireScope('billing:read'), (req, res) => proxyToHub(req, res, '/api/billing/ai/estimate'));
router.post('/ai/charge', requireScope('billing:write'), (req, res) => proxyToHub(req, res, '/api/billing/ai/charge'));
router.post('/add-fiat-funds', requireScope('billing:write'), (req, res) => proxyToHub(req, res, '/api/billing/add-fiat-funds'));
router.post('/add-bez-funds', requireScope('billing:write'), (req, res) => proxyToHub(req, res, '/api/billing/add-bez-funds'));

export { router as billingRouter };
