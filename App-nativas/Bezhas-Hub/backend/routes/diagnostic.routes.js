/**
 * Diagnostic Routes
 * Detailed system connectivity and configuration checks
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ethers } = require('ethers');
const axios = require('axios');
const healthService = require('../services/health.service');

// Simple key protection (optional, but good for semi-public diagnostic)
// Use ?key=debug123 (or configure proper auth)
const DIAGNOSTIC_KEY = process.env.DIAGNOSTIC_KEY || 'debug123';

const checkAuth = (req, res, next) => {
    // If running locally, bypass
    if (process.env.NODE_ENV !== 'production') return next();

    // Check query param or header
    const key = req.query.key || req.headers['x-diagnostic-key'];
    if (key !== DIAGNOSTIC_KEY) {
        return res.status(403).json({ error: 'Unauthorized diagnostic access' });
    }
    next();
};

router.get('/', checkAuth, async (req, res) => {
    const results = {
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
        checks: {}
    };

    // 1. Database Connectivity
    try {
        const dbState = mongoose.connection.readyState;
        const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
        results.checks.database = {
            status: dbState === 1 ? 'ok' : 'error',
            state: states[dbState] || 'unknown',
            host: mongoose.connection.host || 'unknown'
        };

        if (dbState === 1) {
            // Try a simple read
            const collections = await mongoose.connection.db.listCollections().toArray();
            results.checks.database.collections = collections.length;
        }
    } catch (error) {
        results.checks.database = { status: 'error', message: error.message };
    }

    // 2. Environment Variables & Secrets
    // We check existence only, DO NOT return values
    const requiredVars = [
        'MONGODB_URI',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'JWT_SECRET',
        'HOT_WALLET_PRIVATE_KEY'
    ];

    results.checks.secrets = {};
    requiredVars.forEach(v => {
        results.checks.secrets[v] = process.env[v] ? 'present' : 'MISSING';
    });

    // 3. External Connectivity (Outbound)
    try {
        const stripeStart = Date.now();
        await axios.get('https://api.stripe.com/health', { timeout: 5000 });
        results.checks.stripe_api = { status: 'ok', latency: `${Date.now() - stripeStart}ms` };
    } catch (error) {
        results.checks.stripe_api = { status: 'error', message: error.message };
    }

    try {
        const googleStart = Date.now();
        await axios.get('https://www.google.com', { timeout: 5000 });
        results.checks.internet = { status: 'ok', latency: `${Date.now() - googleStart}ms` };
    } catch (error) {
        results.checks.internet = { status: 'error', message: error.message };
    }

    // 4. Blockchain RPC
    try {
        // Use Polygon RPC from config or public
        const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const blockNumber = await provider.getBlockNumber();
        results.checks.blockchain = {
            status: 'ok',
            blockNumber,
            network: 'polygon',
            rpc: rpcUrl.replace(/\/\/.+@/, '//***@') // Mask credentials if any
        };
    } catch (error) {
        results.checks.blockchain = { status: 'error', message: error.message };
    }

    // 5. System Resources
    results.resource_usage = {
        memory: process.memoryUsage(),
        uptime: process.uptime()
    };

    res.json(results);
});

module.exports = router;
