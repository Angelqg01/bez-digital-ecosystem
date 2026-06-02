import { Tool } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import 'dotenv/config';

// Load these from environment
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_SECURITY_CHAT_ID;

export const TELEGRAM_TOOLS: Tool[] = [
    {
        name: "send_telegram_message",
        description: "Send a message proactively to the system Administrator via Telegram. Use this to report critical security alerts, summaries of platform status, or request human intervention. Do not overuse to avoid rate-limiting.",
        inputSchema: {
            type: "object",
            properties: {
                message: {
                    type: "string",
                    description: "The main content of the message. You can use markdown formatting (bold, italic, code blocks).",
                },
                severity: {
                    type: "string",
                    enum: ["low", "medium", "high", "critical"],
                    description: "The urgency of the message. High and critical will use more urgent emojis.",
                    default: "medium"
                }
            },
            required: ["message"],
        },
    }
];

export async function handleTelegramTool(
    name: string,
    args: any
): Promise<any> {
    switch (name) {
        case "send_telegram_message":
            return await sendTelegramMessage(args);
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

async function sendTelegramMessage(args: any) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        return {
            content: [{
                type: "text",
                text: "Error: Missing TELEGRAM_BOT_TOKEN or TELEGRAM_SECURITY_CHAT_ID in environment setup. Please tell the administrator to configure these.",
            }],
            isError: true,
        };
    }

    const { message, severity = "medium" } = args;
    
    // Add severity prefixes based on standard Bezhas telegramNotifier mapping
    let finalMessage = message;
    if (severity === "critical") {
        finalMessage = `🚨 *CRÍTICO* 🚨\n\n${message}`;
    } else if (severity === "high") {
        finalMessage = `⚠️ *ALTA PRIORIDAD* ⚠️\n\n${message}`;
    }

    // Attempt to send using the direct telegram API
    try {
        const response = await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                chat_id: TELEGRAM_CHAT_ID,
                text: finalMessage,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            },
            {
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.ok) {
            return {
                content: [{
                    type: "text",
                    text: `Successfully sent message to Administrator on Telegram (Msg ID: ${response.data.result.message_id}).`,
                }],
            };
        } else {
             return {
                content: [{
                    type: "text",
                    text: `Failed to send Telegram message. API returned: ${JSON.stringify(response.data)}`,
                }],
                isError: true,
            };
        }
    } catch (error: any) {
        return {
            content: [{
                type: "text",
                text: `Network or internal error sending Telegram message: ${error.message}`,
            }],
            isError: true,
        };
    }
}

export function registerTelegramMcp(server: any): void {
    server.tool(
        "send_telegram_message",
        "Send a message proactively to the system Administrator via Telegram. Use this to report critical security alerts, summaries of platform status, or request human intervention. Do not overuse to avoid rate-limiting.",
        {
            message: {
                type: "string",
                description: "The main content of the message. You can use markdown formatting (bold, italic, code blocks).",
            },
            severity: {
                type: "string",
                enum: ["low", "medium", "high", "critical"],
                description: "The urgency of the message. High and critical will use more urgent emojis.",
            }
        },
        async (args: any) => {
            return await sendTelegramMessage(args);
        }
    );
}
