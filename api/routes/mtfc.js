'use strict';

const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const mtfc = require('../services/mtfcEngineService');

const router = Router();

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return false;
  }
  return true;
}

router.get('/manifest', (_req, res) => {
  res.json({ success: true, data: mtfc.getManifest() });
});

router.post('/evaluate', [
  body('fidelidadMax').optional().isFloat({ min: 0 }),
  body('fidelityMax').optional().isFloat({ min: 0 }),
  body('tensionEstatica').optional().isFloat({ min: 0 }),
  body('staticTension').optional().isFloat({ min: 0 }),
  body('tensionDinamica').optional().isFloat({ min: 0 }),
  body('dynamicTension').optional().isFloat({ min: 0 }),
  body('tauBase').optional().isFloat({ min: 0 })
], (req, res) => {
  if (!validate(req, res)) return;
  res.json({ success: true, data: mtfc.evaluateUnifiedLona(req.body) });
});

router.post('/batch', [
  body('samples').isArray({ min: 1, max: 1000 }),
  body('samples.*').isObject()
], (req, res) => {
  if (!validate(req, res)) return;
  try {
    res.json({ success: true, data: mtfc.evaluateBatch(req.body.samples) });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/estimate', [
  body('operations').optional().isInt({ min: 1 }).toInt(),
  body('priority').optional().isIn(['bulk', 'standard', 'realtime'])
], (req, res) => {
  if (!validate(req, res)) return;
  res.json({ success: true, data: mtfc.estimateComputeCharge(req.body) });
});

module.exports = router;
