const assert = require('assert');
const { BeZhas, VIPSubscriptionManager, StakingManager } = require('../index');

console.log('Running SDK Smoke Tests...');

try {
    // Test 1: Instantiation
    console.log('Test 1: Instantiation...');
    const sdk = new BeZhas({ network: 'amoy', apiUrl: 'http://localhost:3000' });
    assert.ok(sdk, 'SDK instance should be created');
    assert.strictEqual(sdk.config.network, 'amoy', 'Network config should be set');
    console.log('PASS');

    // Test 2: Module Exports
    console.log('Test 2: Module Exports...');
    assert.ok(VIPSubscriptionManager, 'VIPSubscriptionManager should be exported');
    assert.ok(StakingManager, 'StakingManager should be exported');
    console.log('PASS');

    // Test 3: Contracts Module Access
    console.log('Test 3: Contract Access...');
    // Mock getContract if it relies on external files that might allow this check
    // Here just checking method existence
    assert.strictEqual(typeof sdk.getContract, 'function', 'getContract method should exist');
    console.log('PASS');

    console.log('✅ All Smoke Tests Passed!');
} catch (error) {
    console.error('❌ Test Failed:', error);
    process.exit(1);
}
