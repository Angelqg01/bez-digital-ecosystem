console.log('1. Start');
try {
    const aiRoutes = require('../backend/src/routes/ai.routes');
    console.log('2. Routes loaded');
} catch (e) {
    console.error('Error:', e);
}
console.log('3. Done');
