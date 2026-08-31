const http = require('http');

function makeRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(body));
                    } else {
                        reject({ statusCode: res.statusCode, body });
                    }
                } catch (e) {
                    reject({ statusCode: res.statusCode, body, error: e });
                }
            });
        });

        req.on('error', (e) => reject(e));

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function verifyAI() {
    console.log('🔍 Verifying AI Endpoints...');

    // 1. Get Agents
    console.log('\n1️⃣ Fetching Agents...');
    try {
        const agents = await makeRequest({
            hostname: 'localhost',
            port: 3007,
            path: '/api/ai/agents',
            method: 'GET'
        });
        console.log('✅ Agents fetched successfully:', agents.length, 'agents found.');
        agents.forEach(a => console.log(`   - ${a.name} (${a.id})`));

        if (agents.length === 0) {
            console.error('❌ No agents found. Aborting chat test.');
            return;
        }

        // 2. Test Chat
        const agentId = agents[0].id;
        console.log(`\n2️⃣ Testing Chat with agent: ${agentId}...`);

        const chatResponse = await makeRequest({
            hostname: 'localhost',
            port: 3007,
            path: '/api/ai/chat',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }, {
            agentId: agentId,
            messages: [{ role: 'user', content: 'Hello, are you working?' }],
            userAddress: '0x0000000000000000000000000000000000000000'
        });

        console.log('✅ Chat response received:');
        console.log('   ', chatResponse.choices[0]?.message?.content);

    } catch (error) {
        console.error('❌ Error:', error);
        if (error.code === 'ECONNREFUSED') {
            console.error('   Backend seems to be down. Please start the backend server.');
        }
    }
}

verifyAI();
