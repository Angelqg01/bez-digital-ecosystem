const express = require('express');
const router = express.Router();
const stakingController = require('../controllers/staking.controller');
// const { verifyToken } = require('../middleware/authMiddleware'); // Descomentar cuando el middleware esté listo

router.get('/pools', stakingController.getStakingPools);
// router.post('/stake', verifyToken, stakingController.stakeTokens);
router.post('/stake', stakingController.stakeTokens); // Temporalmente sin auth para pruebas

module.exports = router;
