const express = require('express');
const router = express.Router();
const Workflow = require('../models/workflow.model');
const { executeWorkflow, TOOL_ENDPOINTS } = require('../services/automationEngine');
const { findLeads, enrichLead } = require('../services/leadFinder');

// ─── Templates ───
const WORKFLOW_TEMPLATES = [
    {
        id: 'lead-finder-linkedin',
        name: '🔍 Lead Finder — LinkedIn',
        description: 'Busca leads en LinkedIn según criterios, enriquece perfiles y envía un resumen por email.',
        category: 'Sales',
        steps: [
            { toolId: 'firecrawl_scraper', toolName: 'Firecrawl MCP', category: 'Intelligence', params: { action: 'scrape_page', targetPlatform: 'linkedin' }, order: 0 },
            { toolId: 'filter', toolName: 'Filtrar Resultados', category: 'Logic', params: { field: 'title', operator: 'contains', value: '' }, order: 1 },
            { toolId: 'send_email', toolName: 'Enviar Resumen Email', category: 'Communication', params: { to: '', subject: 'Nuevos leads encontrados' }, order: 2 },
        ],
    },
    {
        id: 'market-alert',
        name: '📊 Alerta de Mercado BEZ',
        description: 'Monitorea el precio de BEZ, analiza gas y envía alerta si hay oportunidad.',
        category: 'Trading',
        steps: [
            { toolId: 'alpaca_markets', toolName: 'Alpaca Markets MCP', category: 'Trading', params: { action: 'price_analysis' }, order: 0 },
            { toolId: 'analyze_gas_strategy', toolName: 'Polygon Gas MCP', category: 'Blockchain', params: { action: 'iot_ingest' }, order: 1 },
            { toolId: 'send_email', toolName: 'Enviar Alerta', category: 'Communication', params: { to: '', subject: 'Alerta: Oportunidad BEZ detectada' }, order: 2 },
        ],
    },
    {
        id: 'security-audit',
        name: '🛡️ Auditoría de Seguridad',
        description: 'Audita un smart contract, verifica compliance y reporta por email.',
        category: 'Security',
        steps: [
            { toolId: 'auditmos_security', toolName: 'Auditmos Security', category: 'Security', params: { action: 'audit_contract' }, order: 0 },
            { toolId: 'verify_regulatory_compliance', toolName: 'Compliance MCP', category: 'Compliance', params: { action: 'transfer' }, order: 1 },
            { toolId: 'send_email', toolName: 'Enviar Reporte', category: 'Communication', params: { to: '', subject: 'Reporte de Auditoría de Seguridad' }, order: 2 },
        ],
    },
    {
        id: 'github-auto-docs',
        name: '📝 Auto-Documentación GitHub',
        description: 'Analiza un repositorio, genera documentación y crea PR automáticamente.',
        category: 'DevOps',
        steps: [
            { toolId: 'github_repo_manager', toolName: 'GitHub MCP', category: 'DevOps', params: { action: 'analyze_repo' }, order: 0 },
            { toolId: 'github_repo_manager', toolName: 'GitHub MCP', category: 'DevOps', params: { action: 'generate_docs' }, order: 1 },
            { toolId: 'github_repo_manager', toolName: 'GitHub MCP', category: 'DevOps', params: { action: 'create_pr' }, order: 2 },
        ],
    },
    {
        id: 'competitor-monitor',
        name: '👁️ Monitor de Competencia',
        description: 'Rastrea páginas de competidores Web3 y reporta cambios.',
        category: 'Intelligence',
        steps: [
            { toolId: 'firecrawl_scraper', toolName: 'Firecrawl MCP', category: 'Intelligence', params: { action: 'monitor_competitors', urls: [] }, order: 0 },
            { toolId: 'transform', toolName: 'Generar Resumen', category: 'Logic', params: { template: 'Cambios detectados: {{changes}}' }, order: 1 },
            { toolId: 'send_email', toolName: 'Enviar Reporte', category: 'Communication', params: { to: '', subject: 'Informe de Competencia' }, order: 2 },
        ],
    },
    {
        id: 'dao-governance-report',
        name: '🗳️ Reporte de Gobernanza DAO',
        description: 'Consulta propuestas activas, analiza quórum y envía resumen semanal.',
        category: 'Governance',
        steps: [
            { toolId: 'tally_dao_governance', toolName: 'Tally DAO MCP', category: 'Governance', params: { action: 'list_proposals' }, order: 0 },
            { toolId: 'tally_dao_governance', toolName: 'Tally DAO MCP', category: 'Governance', params: { action: 'check_quorum' }, order: 1 },
            { toolId: 'send_email', toolName: 'Enviar Resumen', category: 'Communication', params: { to: '', subject: 'Resumen Semanal de Gobernanza DAO' }, order: 2 },
        ],
    },
];

// ─── LLM Workflow Generator ───

async function generateWorkflowFromPrompt(prompt) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    const toolList = Object.keys(TOOL_ENDPOINTS).join(', ');

    const systemPrompt = `You are a workflow automation assistant for BeZhas platform.
Available tools: ${toolList}

Given a user prompt, return a JSON object with:
{
  "name": "workflow name",
  "description": "brief description",
  "steps": [
    { "toolId": "tool_id_from_list", "toolName": "human name", "category": "category", "params": { key: value }, "order": 0 }
  ]
}

Rules:
- Use ONLY tools from the available list
- Steps execute sequentially, output of step N becomes input of step N+1
- For email sending, use "send_email" tool with params: { to, subject, body }
- For lead finding, use "firecrawl_scraper" with action "scrape_page"
- For market data, use "alpaca_markets"
- For security audits, use "auditmos_security"
- Return ONLY valid JSON, no markdown.`;

    try {
        if (process.env.GEMINI_API_KEY) {
            const axios = require('axios');
            const res = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
                {
                    contents: [{ parts: [{ text: `${systemPrompt}\n\nUser prompt: ${prompt}` }] }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
                },
                { timeout: 15000 }
            );

            const rawText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
        }

        if (process.env.OPENAI_API_KEY) {
            const axios = require('axios');
            const res = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt },
                    ],
                    temperature: 0.3,
                    response_format: { type: 'json_object' },
                },
                {
                    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
                    timeout: 15000,
                }
            );

            return JSON.parse(res.data.choices[0].message.content);
        }
    } catch (err) {
        console.error('LLM generation failed:', err.message);
    }

    return keywordBasedGeneration(prompt);
}

function keywordBasedGeneration(prompt) {
    const p = prompt.toLowerCase();
    const steps = [];

    if (p.includes('lead') || p.includes('linkedin') || p.includes('prospectar') || p.includes('contacto')) {
        steps.push({ toolId: 'firecrawl_scraper', toolName: 'Firecrawl MCP', category: 'Intelligence', params: { action: 'scrape_page', query: prompt }, order: 0 });
        steps.push({ toolId: 'filter', toolName: 'Filtrar Resultados', category: 'Logic', params: { field: 'title', operator: 'contains', value: '' }, order: 1 });
    }
    if (p.includes('precio') || p.includes('mercado') || p.includes('trading') || p.includes('market')) {
        steps.push({ toolId: 'alpaca_markets', toolName: 'Alpaca Markets MCP', category: 'Trading', params: { action: 'market_overview' }, order: steps.length });
    }
    if (p.includes('seguridad') || p.includes('audit') || p.includes('smart contract')) {
        steps.push({ toolId: 'auditmos_security', toolName: 'Auditmos Security', category: 'Security', params: { action: 'audit_contract' }, order: steps.length });
    }
    if (p.includes('github') || p.includes('repo') || p.includes('documentar') || p.includes('pr')) {
        steps.push({ toolId: 'github_repo_manager', toolName: 'GitHub MCP', category: 'DevOps', params: { action: 'analyze_repo' }, order: steps.length });
    }
    if (p.includes('compet') || p.includes('monitor') || p.includes('scrape') || p.includes('web3')) {
        steps.push({ toolId: 'firecrawl_scraper', toolName: 'Firecrawl MCP', category: 'Intelligence', params: { action: 'discover_web3_projects' }, order: steps.length });
    }
    if (p.includes('dao') || p.includes('propuesta') || p.includes('gobernanza') || p.includes('vot')) {
        steps.push({ toolId: 'tally_dao_governance', toolName: 'Tally DAO MCP', category: 'Governance', params: { action: 'list_proposals' }, order: steps.length });
    }
    if (p.includes('gas') || p.includes('polygon') || p.includes('transaccion')) {
        steps.push({ toolId: 'analyze_gas_strategy', toolName: 'Polygon Gas MCP', category: 'Blockchain', params: { action: 'iot_ingest' }, order: steps.length });
    }
    if (p.includes('email') || p.includes('correo') || p.includes('notific') || p.includes('enviar')) {
        steps.push({ toolId: 'send_email', toolName: 'Enviar Email', category: 'Communication', params: { to: '', subject: 'Automatización BeZhas' }, order: steps.length });
    }

    if (steps.length === 0) {
        steps.push(
            { toolId: 'blockscout_explorer', toolName: 'Blockscout MCP', category: 'Blockchain', params: { action: 'token_info' }, order: 0 },
            { toolId: 'skill_creator_ai', toolName: 'Skill Creator AI', category: 'AI', params: { action: 'create_skill' }, order: 1 }
        );
    }

    return {
        name: `Flujo: ${prompt.substring(0, 50)}`,
        description: `Generado automáticamente del prompt: "${prompt}"`,
        steps,
    };
}

// ─── ROUTES ───

router.post('/generate', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt requerido' });
        const workflow = await generateWorkflowFromPrompt(prompt);
        res.json({ success: true, data: workflow });
    } catch (err) {
        console.error('Error generating workflow:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/templates', (req, res) => {
    res.json({ success: true, data: WORKFLOW_TEMPLATES });
});

router.get('/tools', (req, res) => {
    const tools = Object.entries(TOOL_ENDPOINTS).map(([id, endpoint]) => ({
        id,
        endpoint: endpoint.startsWith('__') ? null : endpoint,
        builtin: endpoint.startsWith('__'),
    }));
    res.json({ success: true, data: tools });
});

router.post('/workflows', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'];
        if (!walletAddress) return res.status(401).json({ error: 'Wallet address required' });

        const { name, description, steps, trigger, tags } = req.body;
        const workflow = new Workflow({
            name,
            description,
            steps: (steps || []).map((s, i) => ({ ...s, order: i })),
            trigger: trigger || { type: 'manual' },
            createdBy: walletAddress.toLowerCase(),
            tags: tags || [],
            status: 'draft',
        });

        await workflow.save();
        res.status(201).json({ success: true, data: workflow });
    } catch (err) {
        console.error('Error saving workflow:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/workflows', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'];
        if (!walletAddress) return res.status(401).json({ error: 'Wallet address required' });

        const workflows = await Workflow.find({ createdBy: walletAddress.toLowerCase() })
            .select('-runHistory')
            .sort({ updatedAt: -1 })
            .lean();

        res.json({ success: true, data: workflows });
    } catch (err) {
        console.error('Error listing workflows:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/workflows/:id', async (req, res) => {
    try {
        const workflow = await Workflow.findById(req.params.id).lean();
        if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
        res.json({ success: true, data: workflow });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/workflows/:id', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'];
        const workflow = await Workflow.findById(req.params.id);
        if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
        if (workflow.createdBy !== walletAddress?.toLowerCase()) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar este workflow' });
        }
        await Workflow.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Workflow eliminado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/workflows/:id/run', async (req, res) => {
    try {
        const workflow = await Workflow.findById(req.params.id);
        if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

        const runLog = await executeWorkflow(workflow);
        workflow.runHistory.push(runLog);
        workflow.lastRun = new Date();
        workflow.totalRuns += 1;
        if (workflow.runHistory.length > 50) {
            workflow.runHistory = workflow.runHistory.slice(-50);
        }
        await workflow.save();

        res.json({ success: true, data: runLog });
    } catch (err) {
        console.error('Error running workflow:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/run-inline', async (req, res) => {
    try {
        const { steps } = req.body;
        if (!steps || !Array.isArray(steps)) {
            return res.status(400).json({ error: 'Steps array required' });
        }
        const mockWorkflow = { steps: steps.map((s, i) => ({ ...s, order: i })) };
        const runLog = await executeWorkflow(mockWorkflow);
        res.json({ success: true, data: runLog });
    } catch (err) {
        console.error('Error running inline workflow:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/workflows/:id/logs', async (req, res) => {
    try {
        const workflow = await Workflow.findById(req.params.id).select('runHistory name').lean();
        if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
        const limit = parseInt(req.query.limit) || 10;
        const logs = (workflow.runHistory || []).slice(-limit).reverse();
        res.json({ success: true, data: logs, total: workflow.runHistory?.length || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/leads/find', async (req, res) => {
    try {
        const { query, platform, maxResults, filters } = req.body;
        if (!query) return res.status(400).json({ error: 'Query required' });
        const results = await findLeads({ query, platform, maxResults, filters });
        res.json({ success: true, data: results });
    } catch (err) {
        console.error('Error finding leads:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/leads/enrich', async (req, res) => {
    try {
        const enriched = await enrichLead(req.body);
        res.json({ success: true, data: enriched });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
