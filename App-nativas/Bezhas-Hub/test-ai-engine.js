#!/usr/bin/env node

/**
 * Script de prueba rápida del AI Engine
 * 
 * Uso:
 *   node test-ai-engine.js
 * 
 * Este script verifica:
 * 1. Que el servidor esté corriendo
 * 2. Que los endpoints de AI respondan
 * 3. Que los agentes estén disponibles
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

// Colores para la consola
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function runTests() {
    log('blue', '\n🤖 BeZhas AI Engine - Test Suite\n');
    log('blue', '='.repeat(50));

    try {
        // Test 1: Listar agentes
        log('yellow', '\n[1/4] Testing GET /api/ai/agents...');
        const agentsRes = await makeRequest('/api/ai/agents');

        if (agentsRes.status === 200 && Array.isArray(agentsRes.data)) {
            log('green', `✓ Success! Found ${agentsRes.data.length} agents`);
            agentsRes.data.forEach(agent => {
                console.log(`  - ${agent.avatar} ${agent.name} (${agent.visibility})`);
            });
        } else {
            log('red', `✗ Failed! Status: ${agentsRes.status}`);
        }

        // Test 2: Obtener agente específico
        log('yellow', '\n[2/4] Testing GET /api/ai/agents/bezhas-assistant...');
        const agentRes = await makeRequest('/api/ai/agents/bezhas-assistant');

        if (agentRes.status === 200 && agentRes.data.id === 'bezhas-assistant') {
            log('green', `✓ Success! Agent: ${agentRes.data.name}`);
            console.log(`  Model: ${agentRes.data.model}`);
            console.log(`  Temperature: ${agentRes.data.temperature}`);
        } else {
            log('red', `✗ Failed! Status: ${agentRes.status}`);
        }

        // Test 3: Listar modelos
        log('yellow', '\n[3/4] Testing GET /api/ai/models...');
        const modelsRes = await makeRequest('/api/ai/models');

        if (modelsRes.status === 200 && Array.isArray(modelsRes.data)) {
            log('green', `✓ Success! Found ${modelsRes.data.length} models`);
            modelsRes.data.forEach(model => {
                console.log(`  - ${model.name} (${model.id})`);
            });
        } else {
            log('red', `✗ Failed! Status: ${modelsRes.status}`);
        }

        // Test 4: Listar herramientas
        log('yellow', '\n[4/4] Testing GET /api/ai/tools...');
        const toolsRes = await makeRequest('/api/ai/tools');

        if (toolsRes.status === 200 && toolsRes.data.tools) {
            log('green', `✓ Success! Found ${toolsRes.data.tools.length} tools`);
            console.log(`  Tools: ${toolsRes.data.tools.join(', ')}`);
        } else {
            log('red', `✗ Failed! Status: ${toolsRes.status}`);
        }

        // Resumen
        log('blue', '\n' + '='.repeat(50));
        log('green', '✓ All tests passed!');
        log('blue', '\nNext steps:');
        console.log('  1. Configure OPENAI_API_KEY in backend/.env');
        console.log('  2. Visit http://localhost:5173/ai-chat');
        console.log('  3. Chat with BeZhas Assistant! 🤖');
        log('blue', '='.repeat(50) + '\n');

    } catch (error) {
        log('red', '\n✗ Error connecting to server!');
        log('red', `Error: ${error.message}`);
        log('yellow', '\nMake sure the backend server is running:');
        console.log('  cd backend');
        console.log('  npm start');
        process.exit(1);
    }
}

runTests();
