/**
 * /api/plans — planes de suscripción definitivos + calculadora de coste.
 * Fuente única: config/plans.js (espejo del frontend). Endpoint público de
 * lectura para que cualquier superficie (web, SDK, plugin) consuma los MISMOS
 * planes y cálculos (−20% en $BEZ, IVA 21%).
 */
const express = require('express');
const {
  PLANS, calculateSubscription,
  BEZ_DISCOUNT_RATE, IVA_RATE, STAKING_APY_MAX, HOLDING_COMMISSION, ADMIN_SAVINGS_PCT,
} = require('../config/plans');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    plans: PLANS,
    meta: {
      currency: 'EUR',
      bezDiscountRate: BEZ_DISCOUNT_RATE,
      ivaRate: IVA_RATE,
      stakingApyMax: STAKING_APY_MAX,
      holdingCommission: HOLDING_COMMISSION,
      adminSavingsPct: ADMIN_SAVINGS_PCT,
    },
  });
});

router.post('/quote', (req, res) => {
  try {
    const { planId, payWithBez, annual } = req.body || {};
    if (!planId) return res.status(400).json({ error: 'Bad Request', message: 'planId requerido.', code: 'NO_PLAN' });
    const quote = calculateSubscription({
      planId,
      payWithBez: !!payWithBez,
      annual: !!annual,
    });
    res.json({ quote });
  } catch (err) {
    if (err.code === 'UNKNOWN_PLAN') {
      return res.status(404).json({ error: 'Not Found', message: err.message, code: 'UNKNOWN_PLAN' });
    }
    res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

module.exports = router;
