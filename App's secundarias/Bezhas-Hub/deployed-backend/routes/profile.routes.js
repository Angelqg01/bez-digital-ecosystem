const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');

/**
 * @route   GET /api/profile/:address
 * @desc    Get user profile by wallet address
 * @access  Public
 */
router.get('/:address', profileController.getProfile);

/**
 * @route   PUT /api/profile/:address
 * @desc    Update user profile
 * @access  Private (should add auth middleware)
 */
router.put('/:address', profileController.updateProfile);

/**
 * @route   GET /api/profile/:address/activity
 * @desc    Get user activity log
 * @access  Public
 */
router.get('/:address/activity', profileController.getActivities);

/**
 * @route   GET /api/profile/:address/nfts
 * @desc    Get user NFTs (backend cache/mock)
 * @access  Public
 */
router.get('/:address/nfts', profileController.getUserNFTs);

module.exports = router;
