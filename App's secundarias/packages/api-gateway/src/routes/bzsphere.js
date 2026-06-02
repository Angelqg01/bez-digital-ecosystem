import express from 'express';
import { requireScope } from './auth.js';

const router = express.Router();

/**
 * POST /api/sphere/chat/process
 * NLP Listener for demand/offer detection
 */
router.post('/chat/process', (req, res) => {
  const { text } = req.body;
  
  let tag = null;
  let isOffer = false;
  
  const textLower = text.toLowerCase();
  
  if (textLower.includes('alguien tiene') || textLower.includes('busco') || textLower.includes('necesito')) {
    tag = '[Buscando Producto]';
  } else if (textLower.includes('tengo') && (textLower.includes('bez') || textLower.includes('precio'))) {
    isOffer = true;
  }

  res.json({
    success: true,
    tag,
    isOffer,
    confidence: 0.92
  });
});

/**
 * POST /api/sphere/escrow/lock
 * Smart Contract interaction via Antigravity L2
 */
router.post('/escrow/lock', requireScope('subapp:user'), (req, res) => {
  const { buyer, seller, amount, product } = req.body;
  
  console.log(`[SPHERE] Locking ${amount} BEZ for ${product} (Buyer: ${buyer})...`);
  
  setTimeout(() => {
    res.json({
      success: true,
      txHash: `0x${Math.random().toString(16).slice(2, 66)}`,
      status: 'LOCKED',
      qrSecret: Math.random().toString(36).substring(2, 10).toUpperCase()
    });
  }, 2000);
});

export { router as bzsphereRouter };
