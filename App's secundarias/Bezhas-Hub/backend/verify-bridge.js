/**
 * Focused Verification Script for BeZhas Ecosystem Bridge
 * Verifies adapter registration and syntax without loading full DB models.
 */

try {
    console.log('🔍 Testing Adapter registration...');
    const { ADAPTER_REGISTRY, createAdapter } = require('./bridge/adapters/index');
    
    if (ADAPTER_REGISTRY.ecosystem) {
        console.log('✅ Ecosystem Adapter found in registry');
    } else {
        console.error('❌ Ecosystem Adapter NOT found in registry');
        process.exit(1);
    }

    const EcosystemAdapter = require('./bridge/adapters/EcosystemAdapter');
    const adapter = new EcosystemAdapter({ apiKey: 'test_key' });
    
    if (adapter.platformId === 'ecosystem') {
        console.log('✅ Ecosystem Adapter instantiated correctly');
    }

    console.log('🔍 Checking Bridge Main Entry...');
    // We try to require the main bridge file but without running it
    const bridge = require('./bridge/index');
    console.log('✅ Bridge index loaded');

    console.log('🚀 Verification Complete: Adapter is correctly registered and accessible.');
    process.exit(0);
} catch (error) {
    console.error('❌ Verification Failed:', error);
    process.exit(1);
}
