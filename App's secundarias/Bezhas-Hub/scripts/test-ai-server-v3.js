const express = require('express');
const cors = require('cors');

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

const app = express();
const PORT = 3007;

app.use(cors());
app.use(express.json());

console.log('Starting server on 3007...');

try {
    const aiRoutes = require('../backend/src/routes/ai.routes');
    app.use('/api/ai', aiRoutes);
    console.log('Routes mounted');
} catch (error) {
    console.error('Error mounting routes:', error);
}

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});

setInterval(() => { }, 1000); // Keep alive
