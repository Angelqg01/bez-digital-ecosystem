/**
 * Tests for MCP Proxy Tool — registration, invocation, error handling.
 */
const { registerMcpProxyTools, McpProxyTool, MCP_TOOL_CATALOG } = require('../tools/mcp-proxy.tool');
const ToolRegistry = require('../core/ToolRegistry');

// Mock axios
jest.mock('axios', () => ({
    post: jest.fn(),
}));
const axios = require('axios');

describe('MCP Proxy Tools', () => {
    test('catalog contains all 12 MCP tools', () => {
        expect(MCP_TOOL_CATALOG).toHaveLength(12);
        const names = MCP_TOOL_CATALOG.map(t => t.name);
        expect(names).toContain('analyze_gas_strategy');
        expect(names).toContain('verify_regulatory_compliance');
        expect(names).toContain('analyze_sentiment');
        expect(names).toContain('system_health');
        expect(names).toContain('audit_contract');
        expect(names).toContain('predict_demand');
        expect(names).toContain('score_supplier');
        expect(names).toContain('calculate_smart_swap');
        expect(names).toContain('monitor_edge_node');
        expect(names).toContain('assess_fraud_risk');
        expect(names).toContain('monitor_validator');
        expect(names).toContain('slash_check');
    });

    test('registerMcpProxyTools registers all 12 in registry', () => {
        const registry = new ToolRegistry();
        const registered = registerMcpProxyTools(registry);
        expect(registered).toHaveLength(12);
        expect(registry.size).toBe(12);
        expect(registry.has('mcp:analyze_gas_strategy')).toBe(true);
        expect(registry.has('mcp:slash_check')).toBe(true);
    });

    test('MCP proxy tool names are prefixed with mcp:', () => {
        const registry = new ToolRegistry();
        registerMcpProxyTools(registry);
        const tools = registry.list();
        for (const tool of tools) {
            expect(tool.name).toMatch(/^mcp:/);
        }
    });

    test('MCP proxy tool permissions follow mcp:{name}:invoke pattern', () => {
        const registry = new ToolRegistry();
        registerMcpProxyTools(registry);
        const tools = registry.list();
        for (const tool of tools) {
            const mcpName = tool.name.replace('mcp:', '');
            expect(tool.permissions).toContain(`mcp:${mcpName}:invoke`);
        }
    });

    test('MCP proxy tool execute calls AI-Engine endpoint', async () => {
        axios.post.mockResolvedValue({
            status: 200,
            data: { predicted_gas: 12.5, confidence: 0.9 },
        });

        const tool = new McpProxyTool(MCP_TOOL_CATALOG[0]); // analyze_gas_strategy
        const result = await tool.execute({ hour_of_day: 14 }, {});

        expect(result.success).toBe(true);
        expect(result.data.predicted_gas).toBe(12.5);
        expect(result.meta.source).toBe('ai-engine');
        expect(result.meta.endpoint).toBe('/api/mcp/analyze-gas');
        expect(axios.post).toHaveBeenCalledWith(
            expect.stringContaining('/api/mcp/analyze-gas'),
            { hour_of_day: 14 },
            expect.any(Object),
        );
    });

    test('MCP proxy tool handles AI-Engine errors gracefully', async () => {
        axios.post.mockRejectedValue({
            response: { status: 500, data: { error: 'Aegis down' } },
            message: 'Request failed',
        });

        const tool = new McpProxyTool(MCP_TOOL_CATALOG[0]);
        const result = await tool.execute({}, {});

        expect(result.success).toBe(false);
        expect(result.meta.error).toContain('Aegis down');
        expect(result.meta.status).toBe(500);
    });

    test('MCP proxy tool handles network errors', async () => {
        axios.post.mockRejectedValue(new Error('ECONNREFUSED'));

        const tool = new McpProxyTool(MCP_TOOL_CATALOG[0]);
        const result = await tool.execute({}, {});

        expect(result.success).toBe(false);
        expect(result.meta.error).toContain('ECONNREFUSED');
    });

    test('MCP proxy tool has correct inputSchema from catalog', () => {
        const tool = new McpProxyTool(MCP_TOOL_CATALOG.find(t => t.name === 'calculate_smart_swap'));
        expect(tool.inputSchema.required).toContain('amount');
        expect(tool.inputSchema.required).toContain('from_token');
        expect(tool.inputSchema.properties.slippage_pct).toBeDefined();
    });

    test('MCP proxy tool descriptors are complete', () => {
        const tool = new McpProxyTool(MCP_TOOL_CATALOG[0]);
        const desc = tool.toDescriptor();
        expect(desc.name).toBe('mcp:analyze_gas_strategy');
        expect(desc.description).toContain('MCP Proxy');
        expect(desc.permissions).toEqual(['mcp:analyze_gas_strategy:invoke']);
        expect(desc.sector).toBeNull();
        expect(desc.timeoutMs).toBe(15000);
    });
});
