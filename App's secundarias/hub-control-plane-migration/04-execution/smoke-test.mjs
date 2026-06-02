import http from 'http';

console.log('========================================================');
console.log('🧪 INICIANDO SMOKE TESTS CROSS-APP (HUB CONTROL PLANE)');
console.log('========================================================\n');

const testEndpoints = [
  // 1. Core Hub Endpoints (should be 200)
  { name: 'Hub API Health', url: 'http://localhost:3001/api/health', expected: 200 },
  
  // 2. Deprecated Operational Endpoints (should be 410)
  { name: 'Deprecated Wallet', url: 'http://localhost:3001/api/wallet', expected: 410 },
  { name: 'Deprecated Staking', url: 'http://localhost:3001/api/staking', expected: 410 },
  { name: 'Deprecated Governance', url: 'http://localhost:3001/api/governance', expected: 410 },
  { name: 'Deprecated Quality Escrow', url: 'http://localhost:3001/api/quality-escrow', expected: 410 }
];

async function checkEndpoint(endpoint) {
  return new Promise((resolve) => {
    http.get(endpoint.url, (res) => {
      const isSuccess = res.statusCode === endpoint.expected;
      if (isSuccess) {
        console.log(`  ✅ [PASS] ${endpoint.name}: Status code is ${res.statusCode} (Expected: ${endpoint.expected})`);
      } else {
        console.error(`  ❌ [FAIL] ${endpoint.name}: Status code is ${res.statusCode} (Expected: ${endpoint.expected})`);
      }
      resolve(isSuccess);
    }).on('error', (err) => {
      console.error(`  ⚠️ [WARN] ${endpoint.name}: Could not connect (${err.message}). Is the Hub backend running?`);
      resolve(false);
    });
  });
}

async function runTests() {
  console.log('▶ Verificando Endpoints del Hub y Delegación a Subapps...\n');
  let passed = 0;
  for (const endpoint of testEndpoints) {
    const success = await checkEndpoint(endpoint);
    if (success) passed++;
  }
  
  console.log('\n========================================================');
  console.log(`🎉 SMOKE TESTS FINALIZADOS. Pasados: ${passed}/${testEndpoints.length}`);
  console.log('========================================================');
}

runTests();
