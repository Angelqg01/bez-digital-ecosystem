/**
 * Unit tests: Tool Registry
 * Verifies all 20 MCP tools are registered correctly.
 */
import { describe, it, expect } from 'vitest';
import { createMockMcpServer } from '../helpers/mockMcpServer.js';
import { registerTools } from '../../tools/index.js';

const EXPECTED_TOOL_COUNT = 20;

describe('Tool Registry', () => {
    it('should register all 20 MCP tools', () => {
        const { server, getToolNames } = createMockMcpServer();
        registerTools(server as any);

        const names = getToolNames();
        expect(names).toHaveLength(EXPECTED_TOOL_COUNT);
    });

    it('should register the 3 core tools', () => {
        const { server, getToolNames } = createMockMcpServer();
        registerTools(server as any);

        const names = getToolNames();
        expect(names).toContain('analyze_gas_strategy');
        expect(names).toContain('calculate_smart_swap');
        expect(names).toContain('verify_regulatory_compliance');
    });

    it('should register all 10 extended tools', () => {
        const { server, getToolNames } = createMockMcpServer();
        registerTools(server as any);

        const names = getToolNames();
        expect(names).toContain('github_repo_manager');
        expect(names).toContain('firecrawl_scraper');
        expect(names).toContain('playwright_automation');
        expect(names).toContain('blockscout_explorer');
        expect(names).toContain('skill_creator_ai');
        expect(names).toContain('auditmos_security');
        expect(names).toContain('tally_dao_governance');
        expect(names).toContain('obliq_ai_sre');
        expect(names).toContain('kinaxis_supply_chain');
        expect(names).toContain('alpaca_markets');
    });

    it('should register payment and communication tools', () => {
        const { server, getToolNames } = createMockMcpServer();
        registerTools(server as any);

        const names = getToolNames();
        expect(names).toContain('get_payment_quote');
        expect(names).toContain('process_stripe_payment');
        expect(names).toContain('check_payment_status');
        expect(names).toContain('get_wallet_balance');
        expect(names).toContain('initiate_crypto_payment');
        expect(names).toContain('send_telegram_message');
        expect(names).toContain('sync_contacts');
    });

    it('should call server.tool exactly 20 times', () => {
        const { server } = createMockMcpServer();
        registerTools(server as any);

        expect(server.tool).toHaveBeenCalledTimes(EXPECTED_TOOL_COUNT);
    });

    it('each tool should have name, description, schema, and handler', () => {
        const { server } = createMockMcpServer();
        registerTools(server as any);

        for (const call of server.tool.mock.calls) {
            expect(call).toHaveLength(4);
            expect(typeof call[0]).toBe('string');      // name
            expect(typeof call[1]).toBe('string');      // description
            expect(typeof call[2]).toBe('object');      // schema
            expect(typeof call[3]).toBe('function');    // handler
        }
    });
});

/**
 * Las pruebas de arriba usan un servidor simulado, que acepta cualquier cosa
 * como esquema. Por eso no vieron que dos herramientas declaraban el suyo en
 * JSON-Schema crudo y el SDK las rechazaba al registrarlas: el servidor MCP no
 * arrancaba, ni por STDIO ni por HTTP, y ninguna prueba lo detectaba.
 *
 * Este bloque registra contra un `McpServer` de verdad, que es lo único que
 * reproduce el fallo.
 */
describe('registro contra un McpServer real', () => {
    it('registra las 20 herramientas sin que el SDK rechace ningún esquema', async () => {
        const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
        const server = new McpServer({ name: 'registry-test', version: '0.0.0' });

        expect(() => registerTools(server as any)).not.toThrow();
    });

    it('sigue registrándolas con el vigilante de por medio', async () => {
        // El blindaje envuelve `.tool()`, así que también tiene que dejar
        // pasar los esquemas intactos hasta el SDK.
        const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
        const { hardenServer } = await import('../../security/harden.js');
        const server = new McpServer({ name: 'registry-test-harden', version: '0.0.0' });

        expect(() => registerTools(hardenServer(server as any))).not.toThrow();
    });
});
