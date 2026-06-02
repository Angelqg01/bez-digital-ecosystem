/**
 * Test Script - Admin Endpoint Verification
 * Tests if /api/admin/verify-permissions works for SuperAdmin
 */

const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/admin/verify-permissions',
    method: 'GET',
    headers: {
        'x-wallet-address': '0x52df82920cbae522880dd7657e43d1a754ed044e',
        'Content-Type': 'application/json'
    }
};

console.log('\n🔍 Testing Admin Endpoint...');
console.log('URL:', `http://${options.hostname}:${options.port}${options.path}`);
console.log('Wallet:', options.headers['x-wallet-address']);
console.log('\n---\n');

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Headers:', JSON.stringify(res.headers, null, 2));
        console.log('\nResponse Body:');
        try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2));
            
            if (json.authorized && json.role === 'SUPER_ADMIN') {
                console.log('\n✅ SUCCESS: SuperAdmin access verified!');
            } else {
                console.log('\n❌ FAILED: SuperAdmin not recognized');
            }
        } catch (e) {
            console.log(data);
            console.log('\n❌ ERROR: Invalid JSON response');
        }
    });
});

req.on('error', (e) => {
    console.error('❌ REQUEST ERROR:', e.message);
    console.error('\n💡 Is the backend running on port 3001?');
    console.error('   Run: cd backend && pnpm start');
});

req.end();
