const express = require('express');
const router = express.Router();
const { db } = require('../database/inMemoryDB');

/**
 * Get wallet balance - PROTEGIDO POR PRIVACIDAD
 * Solo el propietario de la wallet puede ver su balance
 */
router.get('/:address/balance', async (req, res) => {
    try {
        const { address } = req.params;
        const requestingWallet = req.headers['x-wallet-address']?.toLowerCase();

        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }

        // PRIVACIDAD: Solo el propietario puede ver su propio balance
        if (!requestingWallet || requestingWallet !== address.toLowerCase()) {
            return res.status(403).json({
                error: 'PRIVACY_PROTECTED',
                message: 'El balance de otros usuarios es información privada',
                balance: null,
                staked: null
            });
        }

        // Try to find user by wallet
        let user;
        try {
            user = db.findUserByWallet(address.toLowerCase());
        } catch (dbError) {
            console.log('DB error finding user, returning default balance:', dbError.message);
            // Return default balance if DB error
            return res.json({ balance: 0, staked: 0 });
        }

        if (!user) {
            return res.json({ balance: 0, staked: 0 });
        }

        res.json({
            balance: user.tokenBalance || 0,
            staked: user.stakedBalance || 0,
            private: true
        });
    } catch (error) {
        console.error('Error getting balance:', error);
        res.status(500).json({ error: 'Error al obtener balance', message: error.message });
    }
});

/**
 * Get transaction history - PROTEGIDO POR PRIVACIDAD
 * Solo el propietario de la wallet puede ver sus transacciones
 */
router.get('/:address/transactions', async (req, res) => {
    try {
        const { address } = req.params;
        const requestingWallet = req.headers['x-wallet-address']?.toLowerCase();

        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }

        // PRIVACIDAD: Solo el propietario puede ver sus transacciones
        if (!requestingWallet || requestingWallet !== address.toLowerCase()) {
            return res.status(403).json({
                error: 'PRIVACY_PROTECTED',
                message: 'Las transacciones de otros usuarios son información privada',
                transactions: []
            });
        }

        // Mock transactions for now - replace with real blockchain data
        const now = Date.now();
        const mockTransactions = [
            {
                id: '1',
                hash: '0x1234567890abcdef1234567890abcdef12345678901234567890abcdef12345678',
                type: 'receive',
                amount: '100',
                token: 'BZH',
                timestamp: now - 86400000, // 1 day ago
                from: '0xabcdef1234567890abcdef1234567890abcdef12',
                to: address
            },
            {
                id: '2',
                hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
                type: 'send',
                amount: '25',
                token: 'BZH',
                timestamp: now - 172800000, // 2 days ago
                from: address,
                to: '0x1234567890abcdef1234567890abcdef12345678'
            },
            {
                id: '3',
                hash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
                type: 'receive',
                amount: '50',
                token: 'BZH',
                timestamp: now - 259200000, // 3 days ago
                from: '0x9876543210fedcba9876543210fedcba98765432',
                to: address
            }
        ];

        res.json(mockTransactions);
    } catch (error) {
        console.error('Error getting transactions:', error);
        res.status(500).json({ error: 'Error al obtener transacciones', message: error.message });
    }
});

// Send tokens (placeholder for future implementation)
router.post('/send', async (req, res) => {
    try {
        const { from, to, amount, token } = req.body;

        // TODO: Implement actual token transfer logic with smart contracts
        res.json({
            success: true,
            txHash: '0x' + Math.random().toString(16).substr(2, 64),
            message: 'Transacción enviada exitosamente'
        });
    } catch (error) {
        console.error('Error sending tokens:', error);
        res.status(500).json({ error: 'Error al enviar tokens' });
    }
});

// Get wallet stats
router.get('/:address/stats', async (req, res) => {
    try {
        const { address } = req.params;
        const user = db.findUserByWallet(address.toLowerCase());

        if (!user) {
            return res.json({
                totalBalance: 0,
                stakedAmount: 0,
                rewardsEarned: 0,
                nftsOwned: 0
            });
        }

        res.json({
            totalBalance: (user.tokenBalance || 0) + (user.stakedBalance || 0),
            stakedAmount: user.stakedBalance || 0,
            rewardsEarned: user.rewardsEarned || 0,
            nftsOwned: user.nfts?.length || 0
        });
    } catch (error) {
        console.error('Error getting wallet stats:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

module.exports = router;
