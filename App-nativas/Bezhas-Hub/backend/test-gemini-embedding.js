require('dotenv').config();
const unifiedAIService = require('./services/unified-ai.service');

async function testGeminiEmbeddings() {
    console.log('--- TEST: Gemini Embedding 2 & Multimodal ---');
    
    // Check if Google provider is available
    const status = unifiedAIService.getStatus();
    console.log('AI Service Status:', status);
    
    if (!status.available.includes('google')) {
        console.error('❌ Google provider is not available. Please check GOOGLE_API_KEY or GEMINI_API_KEY in .env');
        process.exit(1);
    }

    try {
        // 1. Multimodal Search Test
        console.log('\n1. Testing MULTIMODAL_SEARCH...');
        const searchResult = await unifiedAIService.process('MULTIMODAL_SEARCH', {
            text: '¿Cómo funciona el pago en la plataforma?',
            mediaParts: [], // Empty for basic test, tests path
            context: ['El pago VIP se hace por Stripe.', 'Los pagos Crypto usan Polygon.']
        });
        console.log('✅ MULTIMODAL_SEARCH result:');
        console.log('- Embedding Vector Length:', searchResult.embeddingVector.length);
        console.log('- Results:', searchResult.results);
        console.log('- Method:', searchResult.method);

        // 2. Logistics Image Test
        console.log('\n2. Testing LOGISTICS_IMAGE...');
        // Mocking a Base64 tiny 1x1 pixel for testing
        const mockImage = {
            inlineData: {
                data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
                mimeType: 'image/png'
            }
        };
        const logisticsResult = await unifiedAIService.process('LOGISTICS_IMAGE', {
            imagePart: mockImage,
            expectedStatusText: 'Paquete pequeño de color negro'
        });
        console.log('✅ LOGISTICS_IMAGE result:', logisticsResult);

        console.log('\n✅ Todos los tests finalizaron exitosamente.');
    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message || error);
        if (error.response) {
            console.error('Error Details:', error.response.data);
        }
    }
    
    process.exit(0);
}

testGeminiEmbeddings();
