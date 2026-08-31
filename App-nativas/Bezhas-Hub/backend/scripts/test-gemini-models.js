const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function listModels() {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
        // En v1beta de @google/generative-ai, listModels no está directamente en genAI?
        // Vamos a probar con gemini-pro que es seguro
        console.log('Testing gemini-pro...');
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent('Hello');
        console.log('Gemini-pro works:', result.response.text());
    } catch (error) {
        console.error('Gemini-pro failed:', error.message);
    }
}

listModels();
