/**
 * Unit tests: Unified AI Service
 * Tests the unified AI service that dispatches tasks to different providers.
 */

// Mock external AI SDKs
jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => ({
        moderations: {
            create: jest.fn().mockResolvedValue({
                results: [{ flagged: false, categories: {} }],
            }),
        },
        chat: {
            completions: {
                create: jest.fn().mockResolvedValue({
                    choices: [{ message: { content: 'AI response test' } }],
                }),
            },
        },
    }));
});

jest.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
            generateContent: jest.fn().mockResolvedValue({
                response: {
                    text: jest.fn().mockReturnValue('Gemini response test'),
                },
            }),
        }),
    })),
}));

jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));

// Set env vars before requiring the service
process.env.AI_MODE = 'LOCAL';
process.env.AI_PROVIDER = 'gemini';

const unifiedAI = require('../../services/unified-ai.service');

describe('UnifiedAIService', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        it('should export a singleton instance', () => {
            expect(unifiedAI).toBeDefined();
        });

        it('should have process method', () => {
            expect(typeof unifiedAI.process).toBe('function');
        });

        it('should have getStatus method', () => {
            expect(typeof unifiedAI.getStatus).toBe('function');
        });
    });

    describe('getStatus', () => {
        it('should return current AI configuration', () => {
            const status = unifiedAI.getStatus();
            expect(status).toHaveProperty('mode');
            expect(status).toHaveProperty('initialized');
            expect(status).toHaveProperty('primaryProvider');
        });
    });

    describe('process — MODERATION', () => {
        it('should moderate safe content as approved', async () => {
            const result = await unifiedAI.process('MODERATION', {
                text: 'This is a normal post about blockchain technology',
            });
            expect(result).toBeDefined();
            expect(result).toHaveProperty('safe');
        });

        it('should flag harmful content', async () => {
            const result = await unifiedAI.process('MODERATION', {
                text: 'This is a scam and fraud illegal operation',
            });
            expect(result).toBeDefined();
            expect(result.safe).toBe(false);
        });
    });

    describe('process — TAGGING', () => {
        it('should extract hashtags from text', async () => {
            const result = await unifiedAI.process('TAGGING', {
                content: 'New DeFi protocol on Polygon with NFT integration and blockchain rewards',
            });
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('process — SEARCH', () => {
        it('should return search-filtered results', async () => {
            const result = await unifiedAI.process('SEARCH', {
                query: 'blockchain',
                context: [
                    'blockchain network update',
                    'cooking recipe',
                ],
            });
            expect(result).toBeDefined();
        });
    });

    describe('process — CHAT', () => {
        it('should return AI chat response', async () => {
            const result = await unifiedAI.process('CHAT', {
                message: 'que es bezhas',
            });
            expect(result).toBeDefined();
            expect(result).toHaveProperty('text');
            expect(result).toHaveProperty('provider', 'local');
        });
    });

    describe('process — SUMMARIZATION', () => {
        it('should summarize text', async () => {
            const longText = 'The blockchain technology enables decentralized applications. '.repeat(20);
            const result = await unifiedAI.process('SUMMARIZATION', {
                text: longText,
            });
            expect(result).toBeDefined();
        });
    });

    describe('process — TRANSLATION', () => {
        it('should handle translation request', async () => {
            const result = await unifiedAI.process('TRANSLATION', {
                text: 'Hello World',
                targetLang: 'es',
            });
            expect(result).toBeDefined();
        });
    });

    describe('process — unknown type', () => {
        it('should throw for unknown task type', async () => {
            await expect(
                unifiedAI.process('UNKNOWN_TYPE', { text: 'test' })
            ).rejects.toThrow('Unknown AI task type: UNKNOWN_TYPE');
        });
    });
});
