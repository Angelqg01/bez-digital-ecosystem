'use strict';

const express = require('express');

/**
 * Rutas de BZ PureScan
 * Actúa como Gateway para el agente de visión y blockchain de Food Oracle.
 */
module.exports = function (manager = null) {
  const router = express.Router();

  // Mocks iniciales integrados en el backend para facilitar el desarrollo local sin dependencias pesadas
  const mockData = {
    geminiAnalysis: (scanData) => ({
      success: true,
      analysis: {
        product_type: 'Organic Hass Avocados',
        batch_id: '8829-XP',
        quality_assessment: 'EXCELLENT',
        risk_level: 'LOW',
        detected_issues: [],
        nutritional_profile: {
          fat: '15g',
          protein: '3g',
          fiber: '7g',
          potassium: '485mg'
        },
        freshness_index: 9.2,
        recommendation: 'Ready for immediate distribution'
      },
      processing_time_ms: 1200
    }),
    blockchainSync: (dppData) => ({
      success: true,
      transaction: {
        hash: '0x' + Math.random().toString(16).slice(2, 66),
        from: '0x8a1e3930fde1f151471c368fdbb39f3f63a65b55',
        to: '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',
        block: Math.floor(Math.random() * 1000000),
        timestamp: Date.now(),
        gas_used: '125000',
        status: 'CONFIRMED',
        token_id: `DPP-${Date.now()}`
      }
    }),
    inventory: () => Array.from({ length: 8 }, (_, i) => ({
      id: `INV-${String(i + 1).padStart(4, '0')}`,
      sku: `SKU-${8800 + i}`,
      product: ['Avocados', 'Tomatoes', 'Lettuce', 'Bell Peppers', 'Cucumber', 'Spinach', 'Kale', 'Cabbage'][i],
      quantity: Math.floor(Math.random() * 500) + 50,
      last_scan: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: ['verified', 'pending', 'warning'][Math.floor(Math.random() * 3)],
      batch: `BATCH-${2024}${String(i + 1).padStart(2, '0')}`
    }))
  };

  /**
   * POST /api/purescan/analyze
   * Envía los datos de la inferencia Edge a Gemini / Agentes para análisis profundo
   */
  router.post('/analyze', async (req, res) => {
    try {
      const scanData = req.body;
      // Aquí se conectaría con el Agente de Food Oracle real si se provee el manager
      // Por ahora retornamos el mock estructurado para satisfacer al frontend
      
      setTimeout(() => {
        res.json(mockData.geminiAnalysis(scanData));
      }, 800);

    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/purescan/blockchain/sync
   * Sincroniza el Digital Product Passport (DPP) a la blockchain
   */
  router.post('/blockchain/sync', async (req, res) => {
    try {
      const dppData = req.body;
      
      // Simulación de delay de transacción
      setTimeout(() => {
        res.json(mockData.blockchainSync(dppData));
      }, 1500);

    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/purescan/inventory
   * Devuelve el inventario analizado y almacenado
   */
  router.get('/inventory', async (req, res) => {
    try {
      res.json(mockData.inventory());
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/purescan/profile/did
   * Devuelve el perfil descentralizado (DID)
   */
  router.get('/profile/did', async (req, res) => {
    res.json({
      did: 'did:bezhas:0x8a1e3930fde1f151471c368fdbb39f3f63a65b55',
      name: 'BeZhas Food Oracle Node',
      verified: true,
      created_at: '2024-01-15T10:30:00Z',
      verification_methods: 2,
      credentials: [
        { type: 'FOOD_SAFETY', issued_by: 'BeZhas', expires: '2026-01-15' },
        { type: 'BLOCKCHAIN_PROVIDER', issued_by: 'BeZhas', expires: '2026-01-15' }
      ]
    });
  });

  /**
   * GET /api/purescan/scans
   * Historial de escaneos
   */
  router.get('/scans', async (req, res) => {
    const limit = parseInt(req.query.limit || '10', 10);
    const scans = Array.from({ length: limit }, (_, i) => ({
      id: `SCAN-${i}`,
      timestamp: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
      product: ['Avocados', 'Tomatoes', 'Lettuce'][i % 3],
      status: 'completed',
      dpp_id: `DPP-${i}`
    }));
    res.json(scans);
  });

  /**
   * POST /api/purescan/scans/:id/feedback
   * Recibe feedback humano de un análisis (HITL)
   */
  router.post('/scans/:id/feedback', async (req, res) => {
    res.json({ success: true, message: 'Feedback recorded' });
  });

  /**
   * GET /api/purescan/analytics
   * Devuelve analíticas para el dashboard
   */
  router.get('/analytics', async (req, res) => {
    res.json({
      total_scans: 128,
      accuracy_rate: 99.2,
      avg_processing_time: 4.2,
      verified_batches: 124,
      pending_review: 4,
      risk_detected: 2,
      daily_scans: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        count: Math.floor(Math.random() * 30) + 10
      }))
    });
  });

  return router;
};
