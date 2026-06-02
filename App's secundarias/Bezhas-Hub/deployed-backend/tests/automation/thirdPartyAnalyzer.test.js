const ThirdPartyAnalyzer = require('../../services/automation/thirdPartyAnalyzer.service');
const UnifiedAI = require('../../services/unified-ai.service');
const fs = require('fs/promises');
const path = require('path');

// Mocks
jest.mock('../../services/unified-ai.service', () => ({
    generateText: jest.fn()
}));
jest.mock('fs/promises');

describe('ThirdPartyAnalysisService', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should analyze platform data and generate a report file', async () => {
        const mockPlatformData = { loadTime: '5s', bounceRate: '80%' };
        const mockPlatformName = 'CompetitorApp';

        // Mock AI Response
        UnifiedAI.generateText.mockResolvedValue('## AI Analysis\nThis platform is slow.');

        // Mock FS operations
        fs.mkdir.mockResolvedValue(true);
        fs.writeFile.mockResolvedValue(true);

        const result = await ThirdPartyAnalyzer.analyzeAndReport(mockPlatformData, mockPlatformName);

        // Verify AI was called with correct context
        expect(UnifiedAI.generateText).toHaveBeenCalledWith(expect.stringContaining('CompetitorApp'));

        // Verify File was written
        expect(fs.writeFile).toHaveBeenCalled();
        const [filePath, content] = fs.writeFile.mock.calls[0];

        expect(filePath).toContain('UX_ANALYSIS_COMPETITORAPP');
        expect(content).toContain('# 📊 Informe de Optimización');
        expect(content).toContain('This platform is slow');

        expect(result.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
        UnifiedAI.generateText.mockRejectedValue(new Error('AI API Error'));

        await expect(
            ThirdPartyAnalyzer.analyzeAndReport({}, 'BadApp')
        ).rejects.toThrow('AI API Error');
    });
});
