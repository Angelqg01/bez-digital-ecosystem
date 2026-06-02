// Script de prueba para el servicio multi-proveedor de IA
require('dotenv').config();
const aiProviderService = require('./services/ai-provider.service');

console.log('\n🧪 Testing AI Provider Service\n');
console.log('='.repeat(50));

// 1. Test: Proveedores disponibles
console.log('\n1️⃣ Available Providers:');
const providers = aiProviderService.getAvailableProviders();
console.log('   Providers:', providers.length > 0 ? providers.join(', ') : 'None (no API keys configured)');

// 2. Test: Verificar cada proveedor
console.log('\n2️⃣ Provider Status:');
const allProviders = ['openai', 'anthropic', 'google', 'xai', 'deepseek'];
allProviders.forEach(provider => {
    const available = aiProviderService.isProviderAvailable(provider);
    console.log(`   ${provider.padEnd(12)}: ${available ? '✅ Available' : '❌ Not configured'}`);
});

// 3. Test: Modelos disponibles
console.log('\n3️⃣ Available Models:');
const allModels = [
    { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini' },
    { id: 'claude-3-sonnet-20240229', provider: 'anthropic', name: 'Claude 3 Sonnet' },
    { id: 'gemini-pro', provider: 'google', name: 'Gemini Pro' },
    { id: 'grok-2', provider: 'xai', name: 'Grok 2' },
    { id: 'deepseek-chat', provider: 'deepseek', name: 'DeepSeek Chat' },
];

const availableModels = allModels.filter(m => providers.includes(m.provider));
if (availableModels.length > 0) {
    availableModels.forEach(model => {
        console.log(`   - ${model.name} (${model.id})`);
    });
} else {
    console.log('   No models available. Please configure at least one API key in .env');
}

// 4. Test: Prueba de chat (solo si hay proveedores disponibles)
async function testChat() {
    if (providers.length === 0) {
        console.log('\n⚠️  No API keys configured. Skipping chat test.');
        console.log('   To test chat, add an API key to your .env file:');
        console.log('   OPENAI_API_KEY=sk-your-key-here');
        return;
    }

    console.log('\n4️⃣ Testing Chat (with first available provider):');
    const testProvider = providers[0];
    const testModel = availableModels[0];

    console.log(`   Provider: ${testProvider}`);
    console.log(`   Model: ${testModel.name}`);
    console.log('   Sending test message...');

    try {
        const response = await aiProviderService.chat({
            provider: testProvider,
            model: testModel.id,
            messages: [
                { role: 'system', content: 'You are a helpful assistant.' },
                { role: 'user', content: 'Say "Hello from BeZhas!" in one short sentence.' }
            ],
            temperature: 0.7,
            maxTokens: 50
        });

        console.log(`   ✅ Response: "${response.content}"`);
        console.log(`   Usage: ${response.usage?.total_tokens || 'N/A'} tokens`);
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
}

// Ejecutar test de chat
testChat().then(() => {
    console.log('\n' + '='.repeat(50));
    console.log('✨ Test complete!\n');
}).catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
});
