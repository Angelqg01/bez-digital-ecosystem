const fs = require('fs');
const path = require('path');

console.log('==================================================');
console.log('📊 BEZHAS PLATFORM DEVELOPMENT STATUS REPORT');
console.log('==================================================\n');

const modules = [
    { name: 'Core API', path: 'api' },
    { name: 'Agent Runtime', path: 'agent-runtime' },
    { name: 'AI Engine', path: 'ai-engine' },
    { name: 'Aegis Security', path: 'aegis' },
    { name: 'DeFi Backend', path: 'bezhas-defi/backend' },
    { name: 'DeFi Frontend', path: 'bezhas-defi/frontend' },
    { name: 'Control Center', path: 'control-center/frontend' },
    { name: 'Smart Contracts', path: 'smart-contracts' },
    { name: 'SDK', path: 'sdk' }
];

let totalModules = modules.length;
let readyModules = 0;

modules.forEach(mod => {
    const fullPath = path.resolve(__dirname, '..', mod.path);
    const exists = fs.existsSync(fullPath);
    const hasPackage = fs.existsSync(path.join(fullPath, 'package.json')) || fs.existsSync(path.join(fullPath, 'requirements.txt')) || fs.existsSync(path.join(fullPath, 'foundry.toml'));
    
    if (exists && hasPackage) {
        console.log(`✅ [READY] ${mod.name.padEnd(20)} | Path: ${mod.path}`);
        readyModules++;
    } else if (exists) {
        console.log(`⚠️ [PARTIAL] ${mod.name.padEnd(20)} | Missing config/package.json`);
    } else {
        console.log(`❌ [MISSING] ${mod.name.padEnd(20)} | Path not found`);
    }
});

console.log(`\nOverall Readiness: ${Math.round((readyModules / totalModules) * 100)}% (${readyModules}/${totalModules} modules detected)`);

// 2. Critical Files Check
console.log('\n--------------------------------------------------');
console.log('🔍 CRITICAL FILES CHECK');
console.log('--------------------------------------------------');

const criticalFiles = [
    'api/index.js',
    'agent-runtime/index.js',
    'agent-runtime/core/ToolRegistry.js',
    'sdk/index.js',
    'smart-contracts/src/core/BeZhasPayment.sol',
    'smart-contracts/src/core/BeZhasWorkflowRegistry.sol',
    'aegis/main.py'
];

criticalFiles.forEach(file => {
    const fullPath = path.resolve(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} (MISSING)`);
    }
});

// 3. Test Ability
console.log('\n--------------------------------------------------');
console.log('🧪 UNIT TEST CAPABILITY');
console.log('--------------------------------------------------');

modules.forEach(mod => {
    const pkgPath = path.resolve(__dirname, '..', mod.path, 'package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = require(pkgPath);
        if (pkg.scripts && pkg.scripts.test) {
            console.log(`✅ ${mod.name.padEnd(20)} : 'npm test' available`);
        } else {
            console.log(`⚪ ${mod.name.padEnd(20)} : No test script`);
        }
    }
});

console.log('\n==================================================');
console.log('🏁 REPORT FINISHED');
console.log('==================================================');
