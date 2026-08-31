const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function testAIConnection() {
    console.log('--- BEZHAS AI INFRASTRUCTURE TEST ---');
    console.log('1. Checking Environment Variables...');
    console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');
    console.log('- ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'Present' : 'Missing');
    console.log('- GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');
    console.log('- DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? 'Present' : 'Missing');

    console.log('\n2. Pinging Local AI Service (Health Check)...');
    try {
        const healthRes = await axios.get('http://localhost:3001/api/ai/health');
        console.log('Health check successful!');
        console.log('Available providers according to health:', healthRes.data.providers);
    } catch (e) {
        console.log('Health check failed:', e.message);
    }

    console.log('\n3. Testing Agent Chat Connection (Gemini)...');
    try {
        const chatRes = await axios.post('http://localhost:3001/api/ai/chat', {
            agentId: 'gemini-assistant',
            messages: [{ role: 'user', content: 'Ping! Test message.' }]
        });
        console.log('Chat response successful!');
        console.log(chatRes.data.choices[0].message.content);
    } catch (e) {
        console.log('Chat test failed.');
        console.log(e.response ? e.response.data : e.message);
    }
}

testAIConnection();
