/**
 * BeZhas LinkedIn Automation — Full E2E Test Script
 * Tests all AI endpoints: process-lead, batch-process, content/generate, content/objections, content/proposal, health
 * Run: node scripts/test-linkedin-automation.js
 */
const http = require('http');

const PORT = process.env.TEST_PORT || 8080;
const BASE = `/api/ai`;

function request(method, path, body) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: `${BASE}${path}`,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (payload) req.write(payload);
        req.end();
    });
}

function printResult(testName, result) {
    const icon = result.status >= 200 && result.status < 300 ? '✅' : '❌';
    console.log(`\n${icon} [${result.status}] ${testName}`);
    console.log('─'.repeat(60));
    if (typeof result.body === 'object') {
        // Print a summarized version
        if (result.body.structured) {
            console.log('  Category:', result.body.structured.category || 'N/A');
            console.log('  Lead Score:', result.body.structured.leadScore || 'N/A');
            console.log('  Confidence:', result.body.structured.confidence || 'N/A');
            const msg = result.body.structured.connectionMessage || '';
            console.log('  Message:', msg.substring(0, 200) + (msg.length > 200 ? '...' : ''));
        } else if (result.body.content) {
            console.log('  Content:', result.body.content.substring(0, 300) + '...');
        } else if (result.body.response) {
            const r = typeof result.body.response === 'string' ? result.body.response : JSON.stringify(result.body.response);
            console.log('  Response:', r.substring(0, 300) + '...');
        } else if (result.body.proposal) {
            console.log('  Proposal:', result.body.proposal.substring(0, 300) + '...');
        } else if (result.body.rawResponse) {
            console.log('  Raw:', result.body.rawResponse.substring(0, 300) + '...');
        } else {
            console.log('  ', JSON.stringify(result.body, null, 2).substring(0, 400));
        }
    } else {
        console.log('  ', String(result.body).substring(0, 300));
    }
}

async function runAllTests() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  BeZhas LinkedIn AI Automation — Full E2E Test Suite');
    console.log(`  Server: http://localhost:${PORT}`);
    console.log('═══════════════════════════════════════════════════════════');

    let passed = 0;
    let failed = 0;

    // ─── Test 1: Health Check ───
    try {
        const r = await request('GET', '/health');
        printResult('AI Health Check', r);
        r.status === 200 ? passed++ : failed++;
    } catch (e) {
        console.error(`\n❌ FATAL: Cannot connect to backend at localhost:${PORT}`);
        console.error('   Run: npm run start (from backend folder) first.');
        process.exit(1);
    }

    // ─── Test 2: List Agents ───
    try {
        const r = await request('GET', '/agents');
        printResult('List All Agents', r);
        console.log(`  Total agents: ${Array.isArray(r.body) ? r.body.length : 'N/A'}`);
        r.status === 200 ? passed++ : failed++;
    } catch (e) { failed++; console.error('  Error:', e.message); }

    // ─── Test 3: Get LinkedIn Agent ───
    try {
        const r = await request('GET', '/agents/linkedin-sales-director');
        printResult('Get LinkedIn Sales Director Agent', r);
        r.status === 200 ? passed++ : failed++;
    } catch (e) { failed++; console.error('  Error:', e.message); }

    // ─── Test 4: Process Lead — Developer ───
    try {
        const r = await request('POST', '/linkedin/process-lead', {
            leadData: 'Soy CTO de una empresa fintech. Busco integrar blockchain en nuestros sistemas de pago para reducir costos de infraestructura y automatizar flujos de trabajo con APIs modernas.',
            language: 'es'
        });
        printResult('Process Lead — DEVELOPER/EMPRESA', r);
        r.status === 200 ? passed++ : failed++;
    } catch (e) { failed++; console.error('  Error:', e.message); }

    // ─── Test 5: Process Lead — Tokenizer RWA ───
    try {
        const r = await request('POST', '/linkedin/process-lead', {
            leadData: 'I manage a real estate portfolio worth $50M. Looking for secure blockchain solutions to fractionally tokenize commercial properties and provide transparent audit trails to our investors.',
            language: 'en'
        });
        printResult('Process Lead — TOKENIZER (RWA)', r);
        r.status === 200 ? passed++ : failed++;
    } catch (e) { failed++; console.error('  Error:', e.message); }

    // ─── Test 6: Process Lead — Investor ───
    try {
        const r = await request('POST', '/linkedin/process-lead', {
            leadData: 'Inversor privado con portfolio en DeFi y cryptomonedas. Busco protocolos con Real Yield, tokenomics deflacionarios y utilidad real en gobernanza. No memecoins.',
            language: 'es'
        });
        printResult('Process Lead — INVESTOR', r);
        r.status === 200 ? passed++ : failed++;
    } catch (e) { failed++; console.error('  Error:', e.message); }

    // ─── Test 7: Batch Process ───
    try {
        const r = await request('POST', '/linkedin/batch-process', {
            leads: [
                { id: 'lead-001', name: 'Carlos', data: 'DAO contributor, Web3 governance researcher' },
                { id: 'lead-002', name: 'Elena', data: 'Asset Manager at Blackstone, interested in tokenized securities' }
            ],
            language: 'es'
        });
        printResult('Batch Process (2 leads)', r);
        if (r.body.results) console.log(`  Processed: ${r.body.totalProcessed}`);
        r.status === 200 ? passed++ : failed++;
    } catch (e) { failed++; console.error('  Error:', e.message); }

    // ─── Test 8: Content Generation — LinkedIn Governance Update ───
    try {
        const r = await request('POST', '/content/generate', {
            type: 'governance-update',
            platform: 'linkedin',
            language: 'es',
            data: 'Tesorería: 1.2M BEZ — Propuestas Activas: 3 — Votantes Activos: 847 — SDK Downloads: +34%'
        });
        printResult('Content Generation — LinkedIn Governance Post', r);
        r.status === 200 ? passed++ : failed++;
    } catch (e) { failed++; console.error('  Error:', e.message); }

    // ─── Test 9: Content Generation — Twitter ROI Comparison ───
    try {
        const r = await request('POST', '/content/generate', {
            type: 'roi-comparison',
            platform: 'twitter',
            language: 'en'
        });
        printResult('Content Generation — Twitter ROI Thread', r);
        r.status === 200 ? passed++ : failed++;
    } catch (e) { failed++; console.error('  Error:', e.message); }

    // ─── Test 10: Objection Handling ───
    try {
        const r = await request('POST', '/content/objections', {
            objection: '¿Por qué debería confiar en un token de gobernanza nuevo cuando hay tantos que han fracasado?',
            audienceType: 'inversor',
            language: 'es'
        });
        printResult('Objection Handling — Investor Concern', r);
        r.status === 200 ? passed++ : failed++;
    } catch (e) { failed++; console.error('  Error:', e.message); }

    // ─── Test 11: Enterprise Proposal ───
    try {
        const r = await request('POST', '/content/proposal', {
            companyType: 'Empresa de Real Estate con 50 propiedades comerciales',
            estimatedVolume: '50 activos tokenizados/mes',
            language: 'es'
        });
        printResult('Enterprise Proposal Generation', r);
        r.status === 200 ? passed++ : failed++;
    } catch (e) { failed++; console.error('  Error:', e.message); }

    // ─── Summary ───
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log('═══════════════════════════════════════════════════════════');

    process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
