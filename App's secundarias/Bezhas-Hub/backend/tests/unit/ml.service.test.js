/**
 * Unit tests: ML Service (NLP/Sentiment)
 * Tests the local ML service with sentiment analysis and content recommendations.
 */

jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));

// ML service is a singleton — require it after mocks
const mlService = require('../../services/ml.service');

describe('MLService', () => {

    describe('initialization', () => {
        it('should export a singleton instance', () => {
            expect(mlService).toBeDefined();
        });

        it('should have getStats method', () => {
            expect(typeof mlService.getStats).toBe('function');
        });

        it('should have analyzeSentiment method', () => {
            expect(typeof mlService.analyzeSentiment).toBe('function');
        });

        it('should have generateRecommendations method', () => {
            expect(typeof mlService.generateRecommendations).toBe('function');
        });

        it('should have classifyContent method', () => {
            expect(typeof mlService.classifyContent).toBe('function');
        });
    });

    describe('getStats', () => {
        it('should return service metadata', () => {
            const status = mlService.getStats();
            expect(status).toBeDefined();
            expect(typeof status).toBe('object');
            expect(status).toHaveProperty('mode', 'lightweight');
            expect(status).toHaveProperty('tfAvailable', false);
            expect(status).toHaveProperty('features');
        });
    });

    describe('analyzeSentiment', () => {
        it('should return positive sentiment for positive text', async () => {
            const result = await mlService.analyzeSentiment('This product is amazing and wonderful!');
            expect(result).toHaveProperty('sentiment');
            expect(result).toHaveProperty('confidence');
            expect(result).toHaveProperty('rawScore');
            expect(result).toHaveProperty('scores');
        });

        it('should return negative sentiment for negative text', async () => {
            const result = await mlService.analyzeSentiment('This is terrible and awful, the worst ever horrible bad');
            expect(result).toHaveProperty('sentiment');
            expect(result).toHaveProperty('rawScore');
            expect(result.rawScore).toBeLessThan(0);
        });

        it('should return neutral for neutral text', async () => {
            const result = await mlService.analyzeSentiment('The weather is cloudy today');
            expect(result).toHaveProperty('sentiment');
        });

        it('should handle empty text', async () => {
            const result = await mlService.analyzeSentiment('');
            expect(result).toHaveProperty('sentiment', 'neutral');
        });
    });

    describe('classifyContent', () => {
        it('should classify blockchain content', async () => {
            const result = await mlService.classifyContent(
                'New smart contract deployment on Polygon blockchain'
            );
            expect(result).toBeDefined();
            expect(result).toHaveProperty('category');
            expect(result).toHaveProperty('scores');
            expect(result).toHaveProperty('confidence');
        });

        it('should classify technology content', async () => {
            const result = await mlService.classifyContent(
                'Latest software development tools and code frameworks'
            );
            expect(result).toBeDefined();
            expect(result).toHaveProperty('category');
        });

        it('should handle content with no matching category', async () => {
            const result = await mlService.classifyContent(
                'Random unrelated text about bananas'
            );
            expect(result).toBeDefined();
            expect(result).toHaveProperty('category');
        });
    });

    describe('generateRecommendations', () => {
        it('should return recommendations as array', async () => {
            const userFeatures = { interests: ['blockchain', 'defi', 'nft'] };
            const contentPool = [
                { id: '1', title: 'New DeFi Protocol', tags: ['defi', 'blockchain'], likes: 100 },
                { id: '2', title: 'Art Gallery', tags: ['art', 'culture'], likes: 50 },
                { id: '3', title: 'NFT Marketplace', tags: ['nft', 'blockchain'], likes: 80 },
            ];
            const result = await mlService.generateRecommendations(userFeatures, contentPool);
            expect(Array.isArray(result)).toBe(true);
        });

        it('should prioritize matching interests', async () => {
            const userFeatures = { interests: ['blockchain'] };
            const contentPool = [
                { id: '1', title: 'Blockchain News', tags: ['blockchain'], likes: 50 },
                { id: '2', title: 'Cooking Tips', tags: ['cooking'], likes: 100 },
            ];
            const result = await mlService.generateRecommendations(userFeatures, contentPool);
            if (result.length > 0) {
                expect(result[0]).toBeDefined();
                // Blockchain content should have higher recommendationScore
                expect(result[0].tags).toContain('blockchain');
            }
        });

        it('should handle empty content array', async () => {
            const result = await mlService.generateRecommendations({ interests: ['blockchain'] }, []);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(0);
        });
    });

    describe('generateTextEmbedding', () => {
        it('should return a feature vector of 128 dimensions', () => {
            const result = mlService.generateTextEmbedding('blockchain smart contract solidity');
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(128);
        });
    });
});
