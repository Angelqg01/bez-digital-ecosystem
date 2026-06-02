console.log('Start');
const express = require('express');
console.log('Express loaded');
const app = express();
console.log('App created');
const PORT = 3003;

try {
    const aiRoutes = require('../backend/src/routes/ai.routes');
    console.log('Routes loaded');
    app.use('/api/ai', aiRoutes);
    console.log('Routes mounted');
} catch (e) {
    console.error('Error loading routes:', e);
}

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Test AI Server running on port ${PORT}`);
});

server.on('error', (e) => console.error('Server error:', e));
server.on('close', () => console.log('Server closed'));

setInterval(() => {
    console.log('Heartbeat');
}, 1000);
