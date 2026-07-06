/**
 * /api/identity — BeZhas_ID único. NO duplica el sistema de auth existente:
 * es la capa que, tras un login/registro (email, wallet u OAuth), resuelve el
 * identificador canónico y portable del usuario y lo vincula a su organización.
 */
const express = require('express');
const { resolveOrCreate, getByBezhasId } = require('../services/identity.service');

const router = express.Router();

function publicView(identity) {
  if (!identity) return null;
  return {
    bezhasId: identity.bezhas_id,
    displayName: identity.display_name,
    hasWallet: !!identity.wallet_address,
    hasEmail: !!identity.email_hash,
    status: identity.status,
    createdAt: identity.created_at,
  };
}

// Resolver/crear la identidad canónica a partir de email/wallet/userId.
router.post('/resolve', async (req, res, next) => {
  try {
    const { email, wallet, userId, displayName } = req.body || {};
    const result = await resolveOrCreate({ email, wallet, userId, displayName });
    res.json({
      bezhasId: result.bezhasId,
      created: result.created,
      merged: result.merged,
      identity: publicView(result.identity),
    });
  } catch (err) {
    if (err.code === 'NO_IDENTIFIER') {
      return res.status(400).json({ error: 'Bad Request', message: err.message, code: err.code });
    }
    next(err);
  }
});

// Identidad del actor actual (sesión/wallet). Reutiliza lo que la auth ya fija.
router.get('/me', async (req, res, next) => {
  try {
    const email = req.user?.email || null;
    const wallet = req.walletAddress || req.user?.walletAddress || req.header('X-Wallet-Address') || null;
    const userId = req.user?.id || null;
    if (!email && !wallet && !userId) {
      return res.status(401).json({ error: 'Unauthenticated', message: 'Sin sesión ni wallet.', code: 'NO_ACTOR' });
    }
    const result = await resolveOrCreate({ email, wallet, userId });
    res.json({ bezhasId: result.bezhasId, identity: publicView(result.identity) });
  } catch (err) { next(err); }
});

// Lookup público por BeZhas_ID (verificación entre socios B2B).
router.get('/:bezhasId', async (req, res, next) => {
  try {
    const identity = await getByBezhasId(req.params.bezhasId);
    if (!identity) return res.status(404).json({ error: 'Not Found', code: 'NO_IDENTITY' });
    res.json({ identity: publicView(identity) });
  } catch (err) { next(err); }
});

module.exports = router;
