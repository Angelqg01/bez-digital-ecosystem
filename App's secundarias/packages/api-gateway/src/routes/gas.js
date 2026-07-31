import { Router } from 'express';
import { requireAuth, requireScope } from './auth.js';

const router = Router();

// In-memory gas tank store (replace with DB in production)
const gasTanks = new Map();

function getTank(address) {
  if (!gasTanks.has(address)) {
    gasTanks.set(address, {
      balanceUsd: 47.50,
      totalRecharged: 350.00,
      totalUsed: 302.50,
      autoRecharge: { enabled: true, threshold: 10, amount: 50 },
      transactions: [],
    });
  }
  return gasTanks.get(address);
}

/** GET /api/gas/balance — Current gas tank balance */
router.get('/balance', requireScope('gas:read'), (req, res) => {
  const tank = getTank(req.user.sub);
  const costPerTx = 0.005;
  res.json({
    balanceUsd: tank.balanceUsd,
    estimatedTxs: Math.floor(tank.balanceUsd / costPerTx),
    isLow: tank.balanceUsd < tank.autoRecharge.threshold,
    costPerTx,
    autoRecharge: tank.autoRecharge,
  });
});

/** POST /api/gas/recharge — Recharge via Stripe (stub) */
router.post('/recharge', requireScope('gas:write'), (req, res) => {
  const { amount, paymentMethodId } = req.body;
  if (!amount || amount < 10 || amount > 500) {
    return res.status(400).json({ error: 'Amount must be between $10 and $500' });
  }

  const tank = getTank(req.user.sub);
  tank.balanceUsd += amount;
  tank.totalRecharged += amount;
  tank.transactions.push({
    type: 'recharge',
    amount,
    method: paymentMethodId ? 'stripe' : 'manual',
    timestamp: new Date().toISOString(),
  });

  // In production: Create Stripe PaymentIntent here
  res.json({
    success: true,
    newBalance: tank.balanceUsd,
    estimatedTxs: Math.floor(tank.balanceUsd / 0.005),
    receiptId: `rcpt_${Date.now()}`,
  });
});

/** POST /api/gas/consume — Deduct gas for a transaction */
router.post('/consume', requireScope('gas:write'), (req, res) => {
  const { app, operation, gasUsed } = req.body;
  const tank = getTank(req.user.sub);
  const costUsd = (gasUsed || 1) * 0.005;

  if (tank.balanceUsd < costUsd) {
    return res.status(402).json({ error: 'Insufficient gas tank balance', balanceUsd: tank.balanceUsd });
  }

  tank.balanceUsd -= costUsd;
  tank.totalUsed += costUsd;
  tank.transactions.push({
    type: 'consume', app, operation, costUsd,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, costUsd, newBalance: tank.balanceUsd });
});

/** GET /api/gas/predict — Aegis ML gas prediction */
router.get('/predict', requireScope('gas:read'), async (req, res) => {
  // In production: call Aegis FastAPI endpoint
  const aegisUrl = process.env.AEGIS_BASE_URL;

  if (aegisUrl) {
    try {
      const response = await fetch(`${aegisUrl}/gas/predict`);
      const data = await response.json();
      return res.json(data);
    } catch (error) {
      console.error('[AEGIS] Prediction failed, using fallback:', error.message);
    }
  }

  // Fallback mock prediction
  res.json({
    currentGwei: 1.2,
    predictedLowGwei: 0.8,
    optimalHourUtc: 14,
    savingsPercent: 33,
    recommendation: 'now', // 'now' | 'wait'
    confidence: 0.87,
    source: aegisUrl ? 'aegis' : 'fallback',
  });
});

/** GET /api/gas/usage — Usage analytics */
router.get('/usage', requireScope('gas:read'), (req, res) => {
  const { period = '7d' } = req.query;
  // In production: query usage database
  res.json({
    period,
    totalTxs: 5680,
    totalCostUsd: 28.40,
    avgCostPerTx: 0.005,
    byApp: [
      { app: 'BEZ Scanner', txs: 2180, cost: 10.90 },
      { app: 'Bezhas Hub', txs: 1420, cost: 7.10 },
      { app: 'BZ Capital', txs: 1080, cost: 5.40 },
      { app: 'BEZ Wallet', txs: 680, cost: 3.40 },
      { app: 'Customs', txs: 320, cost: 1.60 },
    ],
    byOperation: [
      { op: 'mintLogisticsNFT', count: 1240, avgCost: 0.008 },
      { op: 'registerSensorData', count: 890, avgCost: 0.004 },
      { op: 'transfer', count: 680, avgCost: 0.003 },
    ],
  });
});

/** PATCH /api/gas/settings — Update auto-recharge settings */
router.patch('/settings', requireAuth, (req, res) => {
  const { enabled, threshold, amount } = req.body;
  const tank = getTank(req.user.sub);

  if (enabled !== undefined) tank.autoRecharge.enabled = enabled;
  if (threshold !== undefined) tank.autoRecharge.threshold = threshold;
  if (amount !== undefined) tank.autoRecharge.amount = amount;

  res.json({ success: true, autoRecharge: tank.autoRecharge });
});

export { router as gasRouter };
