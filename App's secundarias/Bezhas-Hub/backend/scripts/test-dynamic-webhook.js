/**
 * Test Dynamic Webhook AI Analysis
 * 
 * Simulates an incoming payment notification from an unknown platform
 * to verify the AI can identify it and trigger blockchain rewards.
 */
process.env.PRIMARY_AI_PROVIDER = 'openai';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Module = require('module');
const originalLoad = Module._load;

// Mock models to avoid MongoDB/Mongoose dependency issues in test environment
const mockModels = require('../models/mockModels');

Module._load = function(request, parent, isMain) {
    if (request === 'mongoose') {
        const MockSchema = class Schema { 
            constructor() { 
                this.index = () => {}; 
                this.pre = () => {};
                this.methods = {};
                this.statics = {};
                this.virtual = () => ({ get: () => ({ set: () => {} }) });
            } 
        };
        return {
            Schema: MockSchema,
            model: (name) => {
                return class MockModel {
                    static create(d) { console.log(`💾 [MOCKDB] Create ${name}:`, d); return Promise.resolve({ save: () => Promise.resolve(d), ...d }); }
                    static find(q) { return { sort: () => ({ limit: () => Promise.resolve([]) }) }; }
                    static findOne(q) { return { sort: () => Promise.resolve(null) }; }
                    static findOneAndUpdate(q, u) { return Promise.resolve({ ...q, ...u }); }
                    constructor(d) { Object.assign(this, d); }
                    save() { return Promise.resolve(this); }
                };
            },
            connect: () => Promise.resolve(),
            connection: { on: () => {} }
        };
    }
    if (request === 'mongodb') {
        return { MongoClient: class MongoClient { connect() { return Promise.resolve(); } } };
    }
    if (request.includes('models/') && (request.endsWith('.model') || request.includes('.model.'))) {
        console.log(`📡 Mocking model: ${request}`);
        return class GenericMock { 
            static create(d) { console.log('💾 Mock Save:', d); return Promise.resolve({ save: () => Promise.resolve(d), ...d }); }
            static findOne(q) { return { sort: () => Promise.resolve(null) }; }
            static find(q) { return { sort: () => ({ limit: () => Promise.resolve([]) }) }; }
            static findOneAndUpdate(q, u) { return Promise.resolve({ ...q, ...u }); }
            constructor(d) { Object.assign(this, d); }
            save() { return Promise.resolve(this); }
        };
    }
    return originalLoad.apply(this, arguments);
};

const { bridgeCore, BRIDGE_EVENTS } = require('../bridge/core/bridgeCore');
const WebhookBridge = require('../services/bridge/WebhookBlockchainBridge');

// Initialize the bridge
WebhookBridge.init();

async function test() {
    console.log('🧪 Testing Dynamic Webhook with AI...');

    // A fake payload from "MercadoLibre" (not registered in BeZhas)
    const meliPayload = {
        action: 'payment.created',
        data: {
            id: '55667788',
            status: 'approved',
            transaction_amount: 150.50,
            currency_id: 'ARS',
            description: 'Venta de Smart TV en MercadoLibre'
        },
        user_id: 123456
    };

    console.log('Incoming Webhook from "MercadoLibre":', JSON.stringify(meliPayload, null, 2));

    try {
        // This will trigger the AI because 'mercadolibre' is not registered
        const result = await bridgeCore.processWebhook('mercadolibre', 'payment.created', meliPayload);

        console.log('AI Analysis Result:', JSON.stringify(result, null, 2));

        if (result.success && result.mode === 'dynamic_ai') {
            console.log('✅ AI correctly identified the payment in the unknown payload!');
        } else {
            console.log('❌ AI failed to identify the payment.');
        }

    } catch (error) {
        console.error('Test Failed:', error);
    }
}

test().catch(console.error);
