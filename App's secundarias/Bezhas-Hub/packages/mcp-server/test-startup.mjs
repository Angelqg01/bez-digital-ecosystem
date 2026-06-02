// Quick test to diagnose startup issues
try {
    console.log('Step 1: Loading config...');
    const { config } = await import('./dist/config.js');
    console.log('Config loaded. Network:', config.network.mode);

    console.log('Step 2: Loading express...');
    const express = await import('express');
    console.log('Express loaded.');

    console.log('Step 3: Loading ethers...');
    const { ethers } = await import('ethers');
    console.log('Ethers loaded.');

    console.log('Step 4: Loading MCP SDK...');
    const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
    console.log('MCP SDK loaded.');

    console.log('Step 5: Loading tools...');
    const { registerTools } = await import('./dist/tools/index.js');
    console.log('Tools loaded.');

    console.log('Step 6: Starting HTTP server...');
    const app = express.default();
    app.get('/test', (req, res) => res.json({ ok: true }));
    app.listen(8080, '0.0.0.0', () => {
        console.log('✅ Test server running on port 8080');
    });
} catch (err) {
    console.error('❌ FAILED at step:', err);
    process.exit(1);
}
