import 'dotenv/config';
import { handleTelegramTool } from './src/tools/telegramMcp.js';

async function test() {
    console.log("Testing send_telegram_message tool...");

    const args = {
        message: "🤖 *Test Message from AI/MCP*\n\nThis is an automated test to verify that the `send_telegram_message` tool is working correctly and the AI can communicate proactively with the Administrator.",
        severity: "medium"
    };

    try {
        const result = await handleTelegramTool('send_telegram_message', args);
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Test failed with exception:", e);
    }
}

test();
