const axios = require('axios');
const BaseTool = require('./_base.tool');

const OBSIDIAN_MCP_URL = process.env.OBSIDIAN_MCP_URL || 'http://localhost:4007';

const OBSIDIAN_TOOL_CATALOG = [
    { name: 'search_vault', description: 'Search the BeZhas Obsidian Markdown vault', parameters: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, limit: { type: 'number' } } } },
    { name: 'get_note', description: 'Read a note from the BeZhas Obsidian vault', parameters: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } } },
    { name: 'create_note', description: 'Create a Markdown note in the BeZhas Obsidian vault', parameters: { type: 'object', required: ['title'], properties: { title: { type: 'string' }, folder: { type: 'string' }, content: { type: 'string' }, metadata: { type: 'object' } } } },
    { name: 'update_note', description: 'Append or replace a Markdown note in the BeZhas Obsidian vault', parameters: { type: 'object', required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' }, mode: { type: 'string', enum: ['append', 'replace'] } } } },
    { name: 'list_notes', description: 'List notes in the BeZhas Obsidian vault', parameters: { type: 'object', properties: { limit: { type: 'number' } } } },
    { name: 'get_related_notes', description: 'Get backlinks and outgoing links for a vault note', parameters: { type: 'object', required: ['path'], properties: { path: { type: 'string' }, limit: { type: 'number' } } } },
    { name: 'record_episode', description: 'Record an agent action-result-evaluation episode as persistent memory', parameters: { type: 'object', required: ['goal', 'action', 'result'], properties: { agent: { type: 'string' }, goal: { type: 'string' }, action: { type: 'string' }, result: { type: 'string' }, evaluation: { type: 'object' }, tags: { type: 'array', items: { type: 'string' } } } } },
    { name: 'update_self_model', description: 'Patch the Director Agent self-model after evaluation', parameters: { type: 'object', required: ['patch', 'reason'], properties: { patch: { type: 'object' }, reason: { type: 'string' }, agent: { type: 'string' } } } },
    { name: 'rebuild_canvas', description: 'Rebuild the BeZhas Obsidian JSON Canvas from vault Markdown metadata and links', parameters: { type: 'object', properties: {} } },
];

class ObsidianProxyTool extends BaseTool {
    #toolName;

    constructor(def) {
        super({
            name: `obsidian:${def.name}`,
            description: `[Obsidian MCP] ${def.description}`,
            permissions: [`obsidian:${def.name}:invoke`],
            sector: null,
            timeoutMs: 10000,
            inputSchema: def.parameters || { type: 'object', properties: {} },
            outputSchema: { type: 'object', properties: { result: {} } },
        });
        this.#toolName = def.name;
    }

    async execute(params) {
        try {
            const response = await axios.post(`${OBSIDIAN_MCP_URL}/tools/${this.#toolName}`, params, {
                timeout: this.timeoutMs - 1000,
                headers: { 'Content-Type': 'application/json' },
            });
            return { success: true, data: response.data.data, meta: { source: 'obsidian-mcp', tool: this.#toolName } };
        } catch (err) {
            return {
                success: false,
                data: null,
                meta: {
                    error: err.response?.data?.error || err.message,
                    source: 'obsidian-mcp',
                    tool: this.#toolName,
                },
            };
        }
    }
}

function registerObsidianProxyTools(registry) {
    const registered = [];
    for (const def of OBSIDIAN_TOOL_CATALOG) {
        const tool = new ObsidianProxyTool(def);
        registry.register(tool);
        registered.push(tool.name);
    }
    return registered;
}

module.exports = { registerObsidianProxyTools, ObsidianProxyTool, OBSIDIAN_TOOL_CATALOG };
