// Test básico del endpoint de modelos
const aiProviderService = require('./services/ai-provider.service');

console.log('\n🧪 Testing /models endpoint logic\n');

try {
    const availableProviders = aiProviderService.getAvailableProviders();
    console.log('Available Providers:', availableProviders);

    const allModels = [
        // OpenAI
        { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', contextWindow: 128000, maxTokens: 4096 },
        { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini', contextWindow: 128000, maxTokens: 16384 },
        { id: 'gpt-4-turbo', provider: 'openai', name: 'GPT-4 Turbo', contextWindow: 128000, maxTokens: 4096 },
        { id: 'gpt-4', provider: 'openai', name: 'GPT-4', contextWindow: 8192, maxTokens: 8192 },
        { id: 'gpt-3.5-turbo', provider: 'openai', name: 'GPT-3.5 Turbo', contextWindow: 16385, maxTokens: 4096 },

        // Anthropic (Claude)
        { id: 'claude-3-opus-20240229', provider: 'anthropic', name: 'Claude 3 Opus', contextWindow: 200000, maxTokens: 4096 },
        { id: 'claude-3-sonnet-20240229', provider: 'anthropic', name: 'Claude 3 Sonnet', contextWindow: 200000, maxTokens: 4096 },
        { id: 'claude-3-haiku-20240307', provider: 'anthropic', name: 'Claude 3 Haiku', contextWindow: 200000, maxTokens: 4096 },

        // Google Gemini
        { id: 'gemini-pro', provider: 'google', name: 'Gemini Pro', contextWindow: 32768, maxTokens: 8192 },
        { id: 'gemini-1.5-pro', provider: 'google', name: 'Gemini 1.5 Pro', contextWindow: 1000000, maxTokens: 8192 },
        { id: 'gemini-1.5-flash', provider: 'google', name: 'Gemini 1.5 Flash', contextWindow: 1000000, maxTokens: 8192 },

        // xAI (Grok)
        { id: 'grok-2', provider: 'xai', name: 'Grok 2', contextWindow: 128000, maxTokens: 4096 },
        { id: 'grok-1.5', provider: 'xai', name: 'Grok 1.5', contextWindow: 128000, maxTokens: 4096 },

        // DeepSeek
        { id: 'deepseek-chat', provider: 'deepseek', name: 'DeepSeek Chat', contextWindow: 32768, maxTokens: 4096 },
        { id: 'deepseek-coder', provider: 'deepseek', name: 'DeepSeek Coder', contextWindow: 32768, maxTokens: 4096 },
    ];

    // Filtrar solo modelos de proveedores disponibles
    const models = allModels.filter(model => availableProviders.includes(model.provider));

    const response = {
        models,
        availableProviders,
        totalModels: models.length
    };

    console.log('\nResponse:', JSON.stringify(response, null, 2));
    console.log('\n✅ Test passed!');
} catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
}
