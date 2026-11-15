const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/pg/User');
const AffiliateEvent = require('../models/pg/AffiliateEvent');
const { protect } = require('../middleware/auth.middleware');
const { query, validationResult } = require('express-validator');

// Código de referido: 10 caracteres [a-z0-9] con crypto.randomInt (sin sesgo). Sustituye a nanoid, que es ESM puro y
// no se podía cargar con require en las pruebas.
const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';
const generarCodigo = () => Array.from({ length: 10 }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join('');

/**
 * @route   GET /api/affiliate/me
 * @desc    Get affiliate data for the logged-in user. Generates a referral code on first access.
 * @access  Private
 */
router.get('/me', protect, async (req, res) => {
  try {
    // El código vive en users.affiliate_referral_code; se genera la primera vez (atómico, sin pisar uno existente).
    const referralCode = await User.ensureReferralCode(req.user._id, generarCodigo);
    if (!referralCode) return res.status(404).json({ error: 'User not found' });

    const counts = await AffiliateEvent.countsByType(req.user._id);
    const signups = counts.signup;
    const clicks = counts.click;

    res.json({
      referralCode,
      referralLink: `https://bezhas.com/join/${referralCode}`,
      stats: {
        clicks,
        signups
      },
      // History is now fetched from the /api/affiliate/history endpoint 
    });

  } catch (error) {
    req.log.error({ err: error }, 'Error in /api/affiliate/me');
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @route   GET /api/affiliate/history
 * @desc    Get paginated affiliate event history for the logged-in user.
 * @access  Private
 */
router.get(
  '/history',
  protect,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const skip = (page - 1) * limit;

      const { events: history, total: totalEvents } = await AffiliateEvent.history(req.user._id, { limit, skip });

      res.json({
        history,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalEvents / limit),
          totalEvents,
        },
      });

    } catch (error) {
      req.log.error({ err: error }, 'Error in /api/affiliate/history');
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;
