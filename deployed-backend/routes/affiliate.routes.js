const express = require('express');
const router = express.Router();
const { customAlphabet } = require('nanoid');
const User = require('../models/user.model');
const AffiliateEvent = require('../models/affiliateEvent.model');
const { protect } = require('../middleware/auth.middleware');
const { query, validationResult } = require('express-validator');

/**
 * @route   GET /api/affiliate/me
 * @desc    Get affiliate data for the logged-in user. Generates a referral code on first access.
 * @access  Private
 */
router.get('/me', protect, async (req, res) => {
  try {
    let user = req.user;

    // Generate a referral code if it doesn't exist
    if (!user.affiliate || !user.affiliate.referralCode) {
      const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);
      const referralCode = nanoid();
      
      user.affiliate = { ...user.affiliate, referralCode };
      await user.save();
    }

    // Fetch basic stats
    const signups = await AffiliateEvent.countDocuments({ referrerId: user._id, eventType: 'signup' });
    // In a real app, you'd track clicks separately. This is a placeholder.
    const clicks = await AffiliateEvent.countDocuments({ referrerId: user._id, eventType: 'click' });

    res.json({
      referralCode: user.affiliate.referralCode,
      referralLink: `https://bezhas.com/join/${user.affiliate.referralCode}`,
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

      const history = await AffiliateEvent.find({ referrerId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
        
      const totalEvents = await AffiliateEvent.countDocuments({ referrerId: req.user._id });

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
