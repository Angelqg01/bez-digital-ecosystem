/**
 * Unit tests: skill_creator_ai
 * Pure logic — no external API mocking needed.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockMcpServer, parseToolResult } from '../helpers/mockMcpServer.js';
import { registerSkillCreatorAi } from '../../tools/skillCreatorAi.js';

describe('skill_creator_ai', () => {
    let handler: Function;

    beforeEach(() => {
        const { server, getHandler } = createMockMcpServer();
        registerSkillCreatorAi(server as any);
        handler = getHandler('skill_creator_ai')!;
    });

    it('should register the tool', () => {
        expect(handler).toBeDefined();
    });

    describe('create_skill', () => {
        it('should create a new skill with given name and category', async () => {
            const response = await handler({ action: 'create_skill', name: 'price_tracker', category: 'analytics' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
            expect(result).toHaveProperty('action', 'create_skill');
        });

        it('should create a blockchain skill', async () => {
            const response = await handler({ action: 'create_skill', name: 'token_monitor', category: 'blockchain' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });

        it('should create an AI skill', async () => {
            const response = await handler({ action: 'create_skill', name: 'sentiment_analyzer', category: 'ai' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });

        it('should create an IoT skill', async () => {
            const response = await handler({ action: 'create_skill', name: 'sensor_reader', category: 'iot' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('compose_pipeline', () => {
        it('should compose a skill pipeline', async () => {
            const response = await handler({ action: 'compose_pipeline', name: 'data_pipeline', category: 'analytics' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
            expect(result).toHaveProperty('action', 'compose_pipeline');
        });
    });

    describe('list_templates', () => {
        it('should return available skill templates', async () => {
            const response = await handler({ action: 'list_templates' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('validate_skill', () => {
        it('should validate a complete skill configuration', async () => {
            const response = await handler({
                action: 'validate_skill',
                name: 'my_skill',
                category: 'custom',
                steps: [
                    { action: 'analyze', tool: 'analyze_gas_strategy', params: {} },
                ],
            });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });

        it('should return PARTIAL when steps are missing', async () => {
            const response = await handler({ action: 'validate_skill', name: 'my_skill', category: 'custom' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'PARTIAL');
        });
    });

    describe('export_config', () => {
        it('should export skill as JSON config', async () => {
            const response = await handler({ action: 'export_config', name: 'export_test', category: 'blockchain' });
            const result = parseToolResult(response);

            expect(result).toHaveProperty('status', 'SUCCESS');
        });
    });

    describe('response format', () => {
        it('should return content array', async () => {
            const response = await handler({ action: 'list_templates' });
            expect(response.content).toHaveLength(1);
            expect(response.content[0].type).toBe('text');
        });
    });
});
