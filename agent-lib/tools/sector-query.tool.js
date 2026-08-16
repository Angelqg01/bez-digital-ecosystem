/**
 * Tool: sector-query
 * Queries agent information and status for a specific sector.
 * Returns registered agents, tool counts, and health summary.
 */
const BaseTool = require('./_base.tool');

class SectorQueryTool extends BaseTool {
    constructor() {
        super({
            name: 'sector-query',
            description: 'Queries agents, tools, and status for a specific sector',
            permissions: ['runtime:read'],
            sector: null, // global — sector filtering is via params
            timeoutMs: 10000,
            inputSchema: {
                type: 'object',
                properties: {
                    sector: { type: 'string', description: 'Sector ID to query (e.g. "logistics", "defi")' },
                    include_tools: { type: 'boolean', default: true },
                    include_agents: { type: 'boolean', default: true },
                },
                required: ['sector'],
                additionalProperties: false,
            },
            outputSchema: {
                type: 'object',
                properties: {
                    sector: { type: 'string' },
                    agents_count: { type: 'number' },
                    tools_count: { type: 'number' },
                    status: { type: 'string' },
                },
            },
        });

        // Known sectors from the BeZhas 16-sector system
        this.SECTORS = [
            'logistics', 'real-estate', 'health', 'energy', 'automotive',
            'manufacturing', 'agriculture', 'insurance', 'education',
            'entertainment', 'legal', 'supply-chain', 'gobierno',
            'finanzas', 'servicios', 'otros',
        ];
    }

    async execute(params, context) {
        const { sector, include_tools = true, include_agents = true } = params;

        const sectorNorm = sector.toLowerCase().trim();
        const known = this.SECTORS.includes(sectorNorm);

        // Build sector info using the runtime registry if available
        const registry = context?.registry;
        let sectorTools = [];
        if (include_tools && registry) {
            const allTools = registry.list({ sector: sectorNorm });
            sectorTools = allTools.map(t => ({ name: t.name, description: t.description }));
        }

        // Each sector has 4 agents (as per the 16-phase deployment)
        const agentsPerSector = known ? 4 : 0;

        return {
            success: true,
            data: {
                sector: sectorNorm,
                known,
                status: known ? 'active' : 'unknown',
                agents_count: include_agents ? agentsPerSector : undefined,
                tools: include_tools ? sectorTools : undefined,
                tools_count: sectorTools.length,
                available_sectors: !known ? this.SECTORS : undefined,
            },
            meta: { tool: this.name, timestamp: Date.now() },
        };
    }
}

module.exports = new SectorQueryTool();
