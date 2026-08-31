const express = require('express');

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('exit', (code) => {
    console.log(`Process exited with code: ${code}`);
});

const app = express();
const PORT = 3005;

console.log('Starting server...');

try {
    const aiRoutes = require('../backend/src/routes/ai.routes');
    app.use('/api/ai', aiRoutes);
    console.log('Routes mounted');
} catch (error) {
    console.error('Error mounting routes:', error);
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
