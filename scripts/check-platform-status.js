/**
 * BeZhas Platform Development Status Check
 * Verifies Sprint 3 implementations: SDK Modules, Agents, and Connectors.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('--------------------------------------------------');
console.log('🚀 BeZhas Platform Status Check (Sprint 3 Focus)');
console.log('--------------------------------------------------\n');

let failed = false;

function test(name, fn) {
    try {
        process.stdout.write(`Testing: ${name}... `);
        fn();
        console.log('✅ PASS');
    } catch (err) {
        console.log('❌ FAIL');
        console.error(`   Error: ${err.message}`);
        failed = true;
    }
}

// 1. SDK Check
test('SDK Exports (Sprint 3 Modules)', () => {
    const sdkPath = path.resolve(__dirname, '../sdk/index.js');
    const sdk = require(sdkPath);
    
    assert.ok(sdk.TokenomicsEngine, 'TokenomicsEngine should be exported from SDK');
    assert.ok(sdk.BridgeManager, 'BridgeManager should be exported from SDK');
    assert.ok(sdk.BeZhas, 'Base BeZhas SDK should be exported');
});

// 2. SDK Functionality (Instantiation)
test('SDK Module Instantiation', () => {
    const { TokenomicsEngine, BridgeManager } = require('../sdk/index');
    
    // Test TokenomicsEngine constructor (mock provider)
    const engine = new TokenomicsEngine({ chainId: 137 });
    assert.strictEqual(engine.chainId, 137, 'Engine chainId should be 137');
    assert.ok(engine.getEcosystemSnapshot, 'Engine should have getEcosystemSnapshot method');

    // Test BridgeManager
    const bridge = new BridgeManager();
    assert.ok(bridge.getRoutes(), 'Bridge should have routes defined');
    assert.strictEqual(bridge.getRoutes().length, 3, 'Should have 3 bridge routes');
});

// 3. Agent Runtime Check
test('Agent Runtime Exports', () => {
    const runtimePath = path.resolve(__dirname, '../agent-lib/index.js');
    const runtime = require(runtimePath);
    
    assert.ok(runtime.createRuntime, 'createRuntime should be exported');
    assert.ok(runtime.AgentManager, 'AgentManager should be exported');
    assert.ok(runtime.TokenomicsAgent, 'TokenomicsAgent should be exported');
});

// 4. Runtime Initialization (Agents & Connectors)
test('Runtime Logic & Agent Registration', () => {
    const { createRuntime } = require('../agent-lib/index');
    
    // We mock the environment to avoid connecting to real chain/redis
    process.env.WS_URL = 'ws://localhost:8546';
    
    const rt = createRuntime({ startManager: false, loadPlugins: false });
    
    assert.ok(rt.manager, 'Manager should be created in runtime');
    
    const registeredAgents = Array.from(rt.manager.registry._agents.keys());
    assert.ok(registeredAgents.includes('security-agent'), 'SecurityAgent should be registered');
    assert.ok(registeredAgents.includes('trading-agent'), 'TradingAgent should be registered');
    assert.ok(registeredAgents.includes('tokenomics-agent'), 'TokenomicsAgent should be registered');
    
    console.log(`\n   Agents registered: ${registeredAgents.join(', ')}`);
});

// 5. File System Integrity
test('File System Integrity', () => {
    const criticalFiles = [
        '../sdk/tokenomics-engine.js',
        '../sdk/bridge-manager.js',
        '../agent-lib/connectors/TokenomicsConnector.js',
        '../agent-lib/agents/TokenomicsAgent.js',
    ];

    criticalFiles.forEach(relPath => {
        const fullPath = path.resolve(__dirname, relPath);
        assert.ok(fs.existsSync(fullPath), `File missing: ${relPath}`);
    });
});

console.log('\n--------------------------------------------------');
if (failed) {
    console.log('🛑 PLATFORM STATUS: INCOMPLETE OR ERRORS DETECTED');
    process.exit(1);
} else {
    console.log('✨ PLATFORM STATUS: SPRINT 3 READY & VERIFIED');
    process.exit(0);
}
