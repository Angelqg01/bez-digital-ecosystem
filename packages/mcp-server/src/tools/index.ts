/**
 * BeZhas Intelligence - Tool Registry
 * 
 * Registers all MCP tools on the server instance.
 * Master List: Polygon MCP, Balance MCP, Compliance, GitHub, Firecrawl,
 * Playwright, Blockscout, Skill Creator, Auditmos, Tally DAO,
 * Obliq SRE, Kinaxis, Alpaca Markets, Payment Tools (5 new).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ─── Core Tools (original 3) ──────────────────────────────
import { registerGasStrategy } from './analyzeGasStrategy.js';
import { registerSmartSwap } from './calculateSmartSwap.js';
import { registerCompliance } from './verifyRegulatoryCompliance.js';

// ─── Extended MCP Tools (10 existing) ──────────────────────────
import { registerGitHubMcp } from './githubMcp.js';
import { registerFirecrawlMcp } from './firecrawlMcp.js';
import { registerPlaywrightMcp } from './playwrightMcp.js';
import { registerBlockscoutMcp } from './blockscoutMcp.js';
import { registerSkillCreatorAi } from './skillCreatorAi.js';
import { registerAuditmosSecurity } from './auditmosSecurity.js';
import { registerTallyDaoMcp } from './tallyDaoMcp.js';
import { registerObliqAiSre } from './obliqAiSre.js';
import { registerKinaxisMcp } from './kinaxisMcp.js';
import { registerAlpacaMarketsMcp } from './alpacaMarketsMcp.js';

// ─── Payment Tools (5 new) ──────────────────────────────────
import { registerPaymentTools } from './payment-tools.js';

// ─── Communication Tools (Admin <-> AI) ──────────────────────
import { registerTelegramMcp } from './telegramMcp.js';
import { registerSyncContactsMcp } from './syncContactsMcp.js';

export function registerTools(server: McpServer): void {
    // Core
    registerGasStrategy(server);
    registerSmartSwap(server);
    registerCompliance(server);

    // Extended MCP Suite
    registerGitHubMcp(server);
    registerFirecrawlMcp(server);
    registerPlaywrightMcp(server);
    registerBlockscoutMcp(server);
    registerSkillCreatorAi(server);
    registerAuditmosSecurity(server);
    registerTallyDaoMcp(server);
    registerObliqAiSre(server);
    registerKinaxisMcp(server);
    registerAlpacaMarketsMcp(server);

    // Payment Tools
    registerPaymentTools(server);

    // Communication Tools
    registerTelegramMcp(server);
    registerSyncContactsMcp(server);
}
