const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let agentRegistry;

function loadAgentRegistryForJest() {
    const registryPath = path.resolve(__dirname, '../../core/AgentToolRegistry.js');
    const source = fs.readFileSync(registryPath, 'utf8')
        .replace('export const MCP_SERVERS =', 'const MCP_SERVERS =')
        .replace('export const AGENT_REGISTRY =', 'const AGENT_REGISTRY =')
        .replace('export class AgentToolRegistry', 'class AgentToolRegistry')
        .replace('export const agentRegistry =', 'const agentRegistry =');
    const sandbox = { module: { exports: {} }, exports: {} };
    vm.runInNewContext(`${source}\nmodule.exports = { MCP_SERVERS, AGENT_REGISTRY, AgentToolRegistry, agentRegistry };`, sandbox, {
        filename: registryPath,
    });
    return sandbox.module.exports.agentRegistry;
}

function createMockObsidianServer() {
    const calls = [];
    const server = http.createServer((req, res) => {
        if (req.method !== 'POST' || !req.url.startsWith('/tools/')) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'not found' }));
            return;
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            const tool = req.url.replace('/tools/', '');
            const payload = body ? JSON.parse(body) : {};
            calls.push({ tool, payload });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: {
                    tool,
                    path: tool === 'record_episode' ? '00-Episodic-Memory/test.md' : undefined,
                    received: payload,
                },
            }));
        });
    });

    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({
                url: `http://127.0.0.1:${port}`,
                calls,
                close: () => new Promise((done) => server.close(done)),
            });
        });
    });
}

describe('BeZhas agentic system + Obsidian knowledge ops', () => {
    const originalUrl = process.env.OBSIDIAN_MCP_URL;
    let mockServer;
    let createRuntime;

    beforeAll(async () => {
        agentRegistry = loadAgentRegistryForJest();
        mockServer = await createMockObsidianServer();
        process.env.OBSIDIAN_MCP_URL = mockServer.url;
        delete require.cache[require.resolve('../tools/obsidian-proxy.tool')];
        delete require.cache[require.resolve('../index')];
        ({ createRuntime } = require('../index'));
    });

    afterAll(async () => {
        process.env.OBSIDIAN_MCP_URL = originalUrl;
        if (mockServer) await mockServer.close();
    });

    test('runtime boots lean and registers all Obsidian memory tools', () => {
        const { registry } = createRuntime({
            startAgents: false,
            startManager: false,
            startOllama: false,
            startTokenomics: false,
            loadPlugins: false,
        });

        const obsidianTools = registry
            .list()
            .filter((tool) => tool.name.startsWith('obsidian:'))
            .map((tool) => tool.name)
            .sort();

        expect(obsidianTools).toEqual([
            'obsidian:create_note',
            'obsidian:get_note',
            'obsidian:get_related_notes',
            'obsidian:list_notes',
            'obsidian:rebuild_canvas',
            'obsidian:record_episode',
            'obsidian:search_vault',
            'obsidian:update_note',
            'obsidian:update_self_model',
        ].sort());
    });

    test('Director owns full memory loop while execution agents remain constrained', () => {
        const directorTools = agentRegistry
            .getAvailableTools('director-agent')
            .filter((tool) => tool.mcp === 'obsidian')
            .map((tool) => tool.tool);

        expect(directorTools).toEqual(expect.arrayContaining([
            'search_vault',
            'get_note',
            'create_note',
            'update_note',
            'list_notes',
            'get_related_notes',
            'record_episode',
            'update_self_model',
        ]));

        expect(agentRegistry.canExecute('trading-agent', 'trading', 'place_order').allowed).toBe(true);
        expect(agentRegistry.requiresHumanApproval('trading-agent', 'place_order').required).toBe(true);
        expect(agentRegistry.canExecute('director-agent', 'blockchain', 'deploy_contract').allowed).toBe(false);
        expect(agentRegistry.canExecute('finance-agent', 'blockchain', 'deploy_contract').allowed).toBe(false);
    });

    test('Obsidian proxy records closed-loop agent episodes', async () => {
        const { registry } = createRuntime({
            startAgents: false,
            startManager: false,
            startOllama: false,
            startTokenomics: false,
            loadPlugins: false,
        });

        const result = await registry.invoke('obsidian:record_episode', {
            agent: 'director-agent',
            goal: 'validate full agentic loop',
            action: 'perceive-plan-act-evaluate',
            result: 'all critical tools registered and guarded',
            evaluation: {
                goal_achieved: true,
                strategy_effectiveness: 0.95,
                update_self_model: false,
            },
            tags: ['unit-test', 'feedback-loop'],
        }, { user: { role: 'admin', address: '0xAdmin' } });

        expect(result.success).toBe(true);
        expect(result.data.path).toBe('00-Episodic-Memory/test.md');
        expect(mockServer.calls.at(-1)).toMatchObject({
            tool: 'record_episode',
            payload: {
                agent: 'director-agent',
                goal: 'validate full agentic loop',
            },
        });
    });
});
