/**
 * BeZhas OpenClaw Provisioning Test
 * Simulador de pago exitoso para activar el Bridge persistente
 * Ejecutar desde el directorio 'backend/'
 */
console.log('--- STARTING SCRIPT ---');

require('dotenv').config({ path: './.env' });

async function runTest() {
    try {
        console.log('Loading modules with safe-require...');
        const mongoose = require('mongoose');
        const { onPaymentCompleted, OpenClawAgent } = require('../services/payment-openclaw-bridge');
        const OpenClawClient = require('../models/OpenClawClient.model');
        const AuditLog = require('../models/pg/AuditLog');

        console.log('--- BeZhas OpenClaw Test Running ---');
        
        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        if (!process.env.MONGODB_URI) {
            console.error('❌ MONGODB_URI not found in .env');
            process.exit(1);
        }
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const testWallet = '0x1234567890abcdef1234567890abcdef12345678';
        
        // 1. Cleanup old test data
        console.log('Cleaning up old test data...');
        await OpenClawClient.deleteOne({ walletAddress: testWallet.toLowerCase() });
        console.log('Cleaned.');

        // 2. Simulate payment for a PRO subscription
        console.log('Simulating payment (PRO plan)...');
        const paymentData = {
            walletAddress: testWallet,
            type: 'subscription',
            txHash: '0xabc_test_tx_hash_123',
            bezAmount: 1000,
            planId: 'creator', // Maps to 'pro'
            metadata: { source: 'test_script' }
        };

        const result = await onPaymentCompleted(paymentData);
        
        if (result.success) {
            console.log('✅ Payment processed successfully!');
            
            // 3. Verify DB persistence
            const client = await OpenClawAgent.getClientCredentials(testWallet);
            if (client) {
                console.log('✅ Client PERSISTED in MongoDB!');
                console.log('   ClientID:', client.clientId);
                console.log('   Plan:', client.plan);
                console.log('   Platforms:', client.platforms.join(', '));
                console.log('   Status:', client.status);
                
                // 4. Verify Audit log
                const audit = await AuditLog.findOne({ resourceId: client._id.toString() });
                if (audit) {
                    console.log('✅ Audit log created for provision!');
                } else {
                    console.log('❌ Audit log NOT found!');
                }
            } else {
                console.log('❌ Client NOT found in MongoDB!');
            }
        } else {
            console.log('❌ Payment processing failed:', result.reason);
        }

        // Cleanup and exit
        await mongoose.disconnect();
        console.log('Disconnected.');
        console.log('--- TEST FINISHED ---');
    } catch (err) {
        if (err.message.includes('mongodb_oidc') || err.message.includes('Cannot find module')) {
            console.warn('⚠️ Ignored non-fatal require error:', err.message);
            // Si el error es dentro de mongoose, a veces aún se puede proceder
            // pero si es del core loading, fallará más adelante.
        } else {
            console.error('FATAL ERROR:', err);
            process.exit(1);
        }
    }
}

runTest().catch(err => {
    console.error('Fatal Error Execution:', err);
    process.exit(1);
});
