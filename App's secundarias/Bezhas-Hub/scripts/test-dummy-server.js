const express = require('express');
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

const app = express();
const PORT = 3006;

app.get('/api/ai/agents', (req, res) => {
    res.json([{ id: 'test-agent', name: 'Test Agent' }]);
});

process.on('exit', (code) => {
    console.log(`Process exited with code: ${code}`);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dummy Server running on port ${PORT}`);
});

setInterval(() => { }, 1000);
