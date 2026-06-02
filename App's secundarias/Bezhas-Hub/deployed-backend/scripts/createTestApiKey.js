/**
 * Script para crear una API Key de prueba para el Bridge
 */

require('dotenv').config();
const mongoose = require('mongoose');
const BridgeApiKey = require('../models/BridgeApiKey.model');
const User = require('../models/user.model');

async function createTestApiKey() {
    try {
        // Conectar a MongoDB
        console.log('🔌 Conectando a MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado a MongoDB');

        // Buscar un usuario admin
        const adminUser = await User.findOne({ role: 'admin' });
        if (!adminUser) {
            console.error('❌ No se encontró un usuario admin');
            process.exit(1);
        }
        console.log(`✅ Usuario admin encontrado: ${adminUser.username} (${adminUser._id})`);

        // Generar nueva API key
        const key = BridgeApiKey.generateKey();
        console.log(`🔑 API Key generada: ${key}`);

        // Crear la API key
        const apiKey = await BridgeApiKey.create({
            key,
            name: 'Test Bridge API Key',
            description: 'API key de prueba para testing del Bridge Universal',
            userId: adminUser._id,
            platform: 'other',
            permissions: {
                inventory: true,
                logistics: true,
                payments: true,
                orders: true
            },
            rateLimit: {
                requestsPerMinute: 100,
                requestsPerDay: 10000
            },
            active: true
        });

        console.log('✅ API Key creada exitosamente!');
        console.log('');
        console.log('===== DETALLES DE LA API KEY =====');
        console.log(`ID: ${apiKey._id}`);
        console.log(`Name: ${apiKey.name}`);
        console.log(`Key: ${apiKey.key}`);
        console.log(`Platform: ${apiKey.platform}`);
        console.log(`User: ${adminUser.username}`);
        console.log(`Permissions:`);
        console.log(`  - Inventory: ${apiKey.permissions.inventory}`);
        console.log(`  - Logistics: ${apiKey.permissions.logistics}`);
        console.log(`  - Payments: ${apiKey.permissions.payments}`);
        console.log(`  - Orders: ${apiKey.permissions.orders}`);
        console.log(`Rate Limit:`);
        console.log(`  - Per Minute: ${apiKey.rateLimit.requestsPerMinute}`);
        console.log(`  - Per Day: ${apiKey.rateLimit.requestsPerDay}`);
        console.log('==================================');
        console.log('');
        console.log('💡 Usa esta API key en el header:');
        console.log(`   X-Bridge-API-Key: ${apiKey.key}`);
        console.log('');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

createTestApiKey();
