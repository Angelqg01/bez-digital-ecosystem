/**
 * Tool: incident-report
 * Creates an incident for the Aegis AutoHealer system.
 * Reports anomalies, degraded services, or security events.
 */
const BaseTool = require('./_base.tool');

class IncidentReportTool extends BaseTool {
    constructor() {
        super({
            name: 'incident-report',
            description: 'Creates an incident report for Aegis AutoHealer — tracks anomalies, outages, and security events',
            permissions: ['runtime:write', 'incident:create'],
            sector: null,
            timeoutMs: 10000,
            inputSchema: {
                type: 'object',
                properties: {
                    sector: { type: 'string', description: 'Affected sector (or "global")' },
                    severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                    title: { type: 'string', minLength: 3, maxLength: 200 },
                    description: { type: 'string', maxLength: 2000 },
                    source: { type: 'string', description: 'Reporting agent/tool name' },
                },
                required: ['sector', 'severity', 'title'],
                additionalProperties: false,
            },
            outputSchema: {
                type: 'object',
                properties: {
                    incident_id: { type: 'string' },
                    status: { type: 'string' },
                    created_at: { type: 'string' },
                },
            },
        });
    }

    async execute(params, context) {
        const { sector, severity, title, description, source } = params;

        const incident = {
            incident_id: `INC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            sector: sector || 'global',
            severity,
            title,
            description: description || '',
            source: source || context?.user?.address || 'runtime',
            reported_by: context?.user?.address || 'anonymous',
            status: 'open',
            created_at: new Date().toISOString(),
        };

        // In production this would POST to Aegis AutoHealer endpoint
        // For now, return the created incident object
        return {
            success: true,
            data: {
                incident_id: incident.incident_id,
                status: incident.status,
                created_at: incident.created_at,
                sector: incident.sector,
                severity: incident.severity,
                title: incident.title,
            },
            meta: { tool: this.name, timestamp: Date.now() },
        };
    }
}

module.exports = new IncidentReportTool();
