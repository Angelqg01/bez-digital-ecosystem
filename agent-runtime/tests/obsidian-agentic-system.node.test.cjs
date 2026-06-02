const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

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

test('BeZhas agentic system registers Obsidian tools and keeps critical actions guarded', async (t) => {
    const { agentRegistry } = await import('../../core/AgentToolRegistry.js');
    const originalUrl = process.env.OBSIDIAN_MCP_URL;
    const mockServer = await createMockObsidianServer();
    process.env.OBSIDIAN_MCP_URL = mockServer.url;
    delete require.cache[require.resolve('../tools/obsidian-proxy.tool')];
    delete require.cache[require.resolve('../index')];
    const { createRuntime } = require('../index');

    t.after(async () => {
        process.env.OBSIDIAN_MCP_URL = originalUrl;
        await mockServer.close();
    });

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

    assert.deepEqual(obsidianTools, [
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

    const directorTools = agentRegistry
        .getAvailableTools('director-agent')
        .filter((tool) => tool.mcp === 'obsidian')
        .map((tool) => tool.tool);

    for (const expectedTool of ['record_episode', 'update_self_model', 'search_vault', 'get_related_notes']) {
        assert.ok(directorTools.includes(expectedTool), `director-agent missing ${expectedTool}`);
    }

    assert.equal(agentRegistry.requiresHumanApproval('trading-agent', 'place_order').required, true);
    assert.equal(agentRegistry.canExecute('director-agent', 'blockchain', 'deploy_contract').allowed, false);
    assert.equal(agentRegistry.canExecute('finance-agent', 'blockchain', 'deploy_contract').allowed, false);

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

    assert.equal(result.success, true);
    assert.equal(result.data.path, '00-Episodic-Memory/test.md');
    assert.equal(mockServer.calls.at(-1).tool, 'record_episode');
    assert.equal(mockServer.calls.at(-1).payload.agent, 'director-agent');
});
