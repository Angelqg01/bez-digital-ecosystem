/**
 * SKILL: skill_creator_ai
 * 
 * Dynamic skill/workflow generator for BeZhas SDK:
 * - Generate custom automation workflows
 * - Create composable skill definitions
 * - Build multi-step pipelines (Web3 + AI + IoT)
 * - Export skill configs for SDK integration
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { config } from '../config.js';

export interface SkillDefinition {
    id: string;
    name: string;
    description: string;
    category: string;
    steps: Array<{
        order: number;
        action: string;
        tool: string;
        params: Record<string, unknown>;
        condition?: string;
    }>;
    triggers: string[];
    outputFormat: string;
    estimatedCostBEZ: number;
}

export interface SkillCreatorResult {
    action: string;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    skill: SkillDefinition | null;
    reasoning: string;
}

export function registerSkillCreatorAi(server: McpServer): void {
    server.tool(
        'skill_creator_ai',
        'Generador dinámico de skills y workflows para BeZhas SDK: crea automatizaciones personalizadas, pipelines multi-paso (Web3 + AI + IoT) y definiciones exportables.',
        {
            action: z.enum([
                'create_skill',
                'compose_pipeline',
                'list_templates',
                'validate_skill',
                'export_config',
            ]),
            name: z.string().optional().describe('Skill name'),
            description: z.string().optional().describe('What the skill should do'),
            category: z.enum([
                'blockchain', 'ai', 'iot', 'marketplace',
                'governance', 'analytics', 'security', 'custom',
            ]).optional().default('custom'),
            steps: z.array(z.object({
                action: z.string(),
                tool: z.string(),
                params: z.record(z.unknown()).optional(),
            })).optional(),
        },
        async ({ action, name, description, category, steps }) => {
            try {
                let result: SkillCreatorResult;

                switch (action) {
                    case 'create_skill': {
                        const skillId = `skill_${name?.toLowerCase().replace(/\s+/g, '_') || 'unnamed'}_${Date.now()}`;

                        const generatedSteps = steps?.map((s, i) => ({
                            order: i + 1,
                            action: s.action,
                            tool: s.tool,
                            params: s.params || {},
                        })) || generateDefaultSteps(category || 'custom');

                        const estimatedCost = generatedSteps.length * 0.05; // 0.05 BEZ per step

                        const skill: SkillDefinition = {
                            id: skillId,
                            name: name || 'Unnamed Skill',
                            description: description || `Auto-generated ${category} skill`,
                            category: category || 'custom',
                            steps: generatedSteps,
                            triggers: generateTriggers(category || 'custom'),
                            outputFormat: 'json',
                            estimatedCostBEZ: parseFloat(estimatedCost.toFixed(4)),
                        };

                        result = {
                            action,
                            status: 'SUCCESS',
                            skill,
                            reasoning: `Skill "${skill.name}" created with ${generatedSteps.length} steps. Estimated cost: ${estimatedCost.toFixed(4)} BEZ per execution.`,
                        };
                        break;
                    }

                    case 'compose_pipeline': {
                        const pipelineSteps = [
                            { order: 1, action: 'validate_input', tool: 'verify_regulatory_compliance', params: {} },
                            { order: 2, action: 'analyze_gas', tool: 'analyze_gas_strategy', params: { urgency: 'medium' } },
                            { order: 3, action: 'execute_swap', tool: 'calculate_smart_swap', params: {} },
                            { order: 4, action: 'verify_result', tool: 'blockscout_explorer', params: { action: 'transaction_history' } },
                            { order: 5, action: 'notify_user', tool: 'obliq_ai_sre', params: { action: 'check_alerts' } },
                        ];

                        const skill: SkillDefinition = {
                            id: `pipeline_${Date.now()}`,
                            name: name || 'BEZ Transaction Pipeline',
                            description: description || 'End-to-end BEZ transaction with compliance, gas optimization, and verification.',
                            category: 'blockchain',
                            steps: pipelineSteps,
                            triggers: ['user_swap_request', 'scheduled', 'api_call'],
                            outputFormat: 'json',
                            estimatedCostBEZ: 0.25,
                        };

                        result = {
                            action,
                            status: 'SUCCESS',
                            skill,
                            reasoning: `Pipeline composed with ${pipelineSteps.length} steps: compliance → gas → swap → verify → notify.`,
                        };
                        break;
                    }

                    case 'list_templates': {
                        const templates = [
                            { name: 'BEZ Swap Pipeline', category: 'blockchain', steps: 5, costBEZ: 0.25 },
                            { name: 'IoT Data Ingest', category: 'iot', steps: 3, costBEZ: 0.15 },
                            { name: 'DAO Proposal Workflow', category: 'governance', steps: 4, costBEZ: 0.20 },
                            { name: 'Security Audit Flow', category: 'security', steps: 6, costBEZ: 0.30 },
                            { name: 'AI Content Analysis', category: 'ai', steps: 3, costBEZ: 0.15 },
                            { name: 'Marketplace Listing', category: 'marketplace', steps: 4, costBEZ: 0.20 },
                            { name: 'Treasury Rebalance', category: 'blockchain', steps: 5, costBEZ: 0.25 },
                            { name: 'Competitor Monitor', category: 'analytics', steps: 3, costBEZ: 0.15 },
                        ];

                        result = {
                            action,
                            status: 'SUCCESS',
                            skill: null,
                            reasoning: `${templates.length} skill templates available. Use 'create_skill' with a template category to get started.`,
                        };
                        // Attach templates to the output
                        return {
                            content: [{
                                type: 'text' as const,
                                text: JSON.stringify({ ...result, templates }, null, 2),
                            }],
                        };
                    }

                    case 'validate_skill': {
                        const issues: string[] = [];
                        if (!name) issues.push('Skill name is required');
                        if (!steps || steps.length === 0) issues.push('At least one step is required');
                        if (steps && steps.length > 20) issues.push('Maximum 20 steps per skill');

                        const availableTools = [
                            'analyze_gas_strategy', 'calculate_smart_swap', 'verify_regulatory_compliance',
                            'github_repo_manager', 'firecrawl_scraper', 'playwright_automation',
                            'blockscout_explorer', 'skill_creator_ai', 'auditmos_security',
                            'tally_dao_governance', 'obliq_ai_sre', 'kinaxis_supply_chain',
                            'alpaca_markets',
                        ];

                        steps?.forEach((s, i) => {
                            if (!availableTools.includes(s.tool)) {
                                issues.push(`Step ${i + 1}: Unknown tool "${s.tool}"`);
                            }
                        });

                        result = {
                            action,
                            status: issues.length === 0 ? 'SUCCESS' : 'PARTIAL',
                            skill: null,
                            reasoning: issues.length === 0
                                ? 'Skill definition is valid and ready for deployment.'
                                : `Validation issues: ${issues.join('; ')}`,
                        };
                        break;
                    }

                    case 'export_config': {
                        const exportConfig = {
                            version: '1.0.0',
                            sdk: 'bezhas-sdk',
                            mcpEndpoint: `http://localhost:${config.http.port}/api/mcp`,
                            skills: [{
                                name: name || 'exported-skill',
                                category: category || 'custom',
                                steps: steps?.length || 0,
                            }],
                            format: 'bezhas-skill-v1',
                            exportedAt: new Date().toISOString(),
                        };

                        result = {
                            action,
                            status: 'SUCCESS',
                            skill: null,
                            reasoning: `Skill config exported in bezhas-skill-v1 format. Ready for SDK import.`,
                        };

                        return {
                            content: [{
                                type: 'text' as const,
                                text: JSON.stringify({ ...result, exportConfig }, null, 2),
                            }],
                        };
                    }

                    default:
                        result = { action, status: 'FAILED', skill: null, reasoning: `Unknown action: ${action}` };
                }

                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                };
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Unknown error';
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            action, status: 'FAILED', skill: null,
                            reasoning: `Skill Creator error: ${msg}`,
                        }),
                    }],
                };
            }
        }
    );
}

function generateDefaultSteps(category: string) {
    const templates: Record<string, Array<{ order: number; action: string; tool: string; params: Record<string, unknown> }>> = {
        blockchain: [
            { order: 1, action: 'check_compliance', tool: 'verify_regulatory_compliance', params: {} },
            { order: 2, action: 'optimize_gas', tool: 'analyze_gas_strategy', params: { urgency: 'medium' } },
            { order: 3, action: 'execute', tool: 'calculate_smart_swap', params: {} },
        ],
        ai: [
            { order: 1, action: 'scrape_data', tool: 'firecrawl_scraper', params: { action: 'scrape_page' } },
            { order: 2, action: 'analyze', tool: 'skill_creator_ai', params: {} },
            { order: 3, action: 'report', tool: 'obliq_ai_sre', params: { action: 'health_report' } },
        ],
        iot: [
            { order: 1, action: 'ingest_telemetry', tool: 'kinaxis_supply_chain', params: { action: 'ingest_telemetry' } },
            { order: 2, action: 'optimize_gas', tool: 'analyze_gas_strategy', params: { transactionType: 'iot_ingest' } },
            { order: 3, action: 'store_onchain', tool: 'blockscout_explorer', params: { action: 'transaction_history' } },
        ],
        custom: [
            { order: 1, action: 'input_validation', tool: 'verify_regulatory_compliance', params: {} },
            { order: 2, action: 'process', tool: 'skill_creator_ai', params: {} },
        ],
    };
    return templates[category] || templates.custom;
}

function generateTriggers(category: string): string[] {
    const triggers: Record<string, string[]> = {
        blockchain: ['on_transaction', 'scheduled', 'api_call'],
        ai: ['on_content_upload', 'scheduled', 'user_request'],
        iot: ['on_telemetry', 'threshold_alert', 'scheduled'],
        marketplace: ['on_listing', 'on_purchase', 'api_call'],
        governance: ['on_proposal', 'on_vote', 'scheduled'],
        analytics: ['scheduled', 'on_data_change', 'api_call'],
        security: ['on_deploy', 'scheduled', 'alert_trigger'],
        custom: ['api_call', 'scheduled'],
    };
    return triggers[category] || triggers.custom;
}
