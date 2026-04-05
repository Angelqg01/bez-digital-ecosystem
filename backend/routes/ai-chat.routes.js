const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const BeZhasAPIClient = require('../../sdk/api-client');

// Initialize OpenAI specific for chat
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize SDK locally for the AI context execution
const apiClient = new BeZhasAPIClient({
    apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3001',
    rpcUrl: process.env.POLYGON_RPC_URL,
    apiKey: process.env.SDK_API_KEY
});

// ==========================================
// SYSTEM PROMPT FOR BEZHAS AI
// ==========================================
const BEZHAS_SYSTEM_PROMPT = `
# ROL Y OBJETIVO GLOBAL
Eres la "Inteligencia Artificial Central de BeZhas" (BeZhas AI), un agente autónomo y cognitivo que orquesta el ecosistema descentralizado de BeZhas. BeZhas es una plataforma Web3 integral que combina Tokenomics (BEZ), Staking, DAO, Logística, Tokenización de Activos Reales (RWA) y Redes Sociales.
Tu objetivo principal es asistir al usuario (inversores, VIPs, administradores o usuarios de la DAO) ejecutando acciones complejas, respondiendo dudas y optimizando su experiencia, actuando siempre con precisión, seguridad e imparcialidad.

# TU ENTORNO Y HERRAMIENTAS (MCP / SDK)
No eres un simple asistente de texto. Estás conectado directamente a la blockchain de Polygon y al backend de BeZhas a través de nuestro SDK y el Model Context Protocol (MCP). Posees un conjunto de herramientas (tools/functions) que PUEDES y DEBES usar cuando el usuario te pida realizar una acción o consultar un dato real.

# REGLAS DE OPERACIÓN CRÍTICAS
1. **Verificación de Datos On-Chain:** Nunca inventes ni asumas saldos, APYs, estados de envíos o precios. SIEMPRE utiliza la herramienta correspondiente (ej. get_wallet_balance, get_staking_apy) para obtener el estado actual de la blockchain o la base de datos antes de responder.
2. **Autorización y Ejecución:** Si un usuario te pide ejecutar una transacción financiera, debes formular la transacción y solicitar *explícitamente* su confirmación advirtiendo sobre el gas y la firma.
3. **Razonamiento Transparente:** Usa el enfoque "Chain of thought" para cruzar datos.
4. **Seguridad Ante Todo:** Si detectas intenciones maliciosas, detén la operación.

# INSTRUCCIONES DE RESPUESTA
- Estructura tus respuestas en Markdown.
- Mantén un tono profesional, analítico y directo, al estilo de Manus.AI o un consultor DeFi.
`;

// ==========================================
// TOOLS DEFINITION FOR OPENAI
// ==========================================
const tools = [
    {
        type: "function",
        function: {
            name: "get_wallet_balance",
            description: "Obtiene el balance actual (BEZ u otra moneda permitida) de una dirección de wallet en Polygon utilizando el SDK o MCP.",
            parameters: {
                type: "object",
                properties: {
                    walletAddress: { type: "string", description: "La dirección Ethereum/Polygon de la wallet (ej. 0x123...)" }
                },
                required: ["walletAddress"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "analyze_gas_strategy",
            description: "Consulta el servidor MCP de BeZhas para analizar el gas actual en Polygon e indicar el mejor momento para una transacción.",
            parameters: {
                type: "object",
                properties: {
                    urgency: { type: "string", enum: ["low", "medium", "high"], description: "Nivel de urgencia de la transacción." }
                },
                required: ["urgency"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_staking_apy",
            description: "Obtiener desde el SDK el APY actual del yield farming de BeZhas.",
            parameters: {
                type: "object",
                properties: {
                    poolId: { type: "integer", description: "ID opcional del pool (ej. 1 para core BEZ, 2 para LP)." }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "simulate_logistics_route",
            description: "Simula o predice el estado y optimización de ruta de un envío usando Logistics Simulator de BeZhas a través del SDK",
            parameters: {
                type: "object",
                properties: {
                    origin: { type: "string" },
                    destination: { type: "string" }
                },
                required: ["origin", "destination"]
            }
        }
    }
];

// ==========================================
// CHAT ENDPOINT POST /api/ai/chat
// ==========================================
router.post('/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Falta un array de messages.' });
        }

        // Add System Prompt if not present
        const conversationContext = [
            { role: "system", content: BEZHAS_SYSTEM_PROMPT },
            ...messages
        ];

        // 1. Initial Call with tools context
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: conversationContext,
            tools: tools,
            tool_choice: "auto",
        });

        const responseMessage = response.choices[0].message;

        // 2. Check if AI decided to call a Function/Tool
        if (responseMessage.tool_calls) {
            conversationContext.push(responseMessage); // Add assistant's tool call intent

            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                let toolResult = "";

                try {
                    console.log(`[AI] Calling Tool: ${functionName} with args:`, functionArgs);

                    // Execute real SDK/MCP code mapping
                    if (functionName === 'get_wallet_balance') {
                        const mcpCall = await apiClient.mcp.getWalletBalance(functionArgs.walletAddress);
                        toolResult = mcpCall.success ? JSON.stringify(mcpCall.result) : "Error al obtener balance: " + mcpCall.error;
                    } 
                    else if (functionName === 'analyze_gas_strategy') {
                        const mcpCall = await apiClient.mcp.callTool('analyze_gas_strategy', { urgency: functionArgs.urgency });
                        toolResult = mcpCall.success ? JSON.stringify(mcpCall.result) : "Error calculando Gas: " + mcpCall.error;
                    }
                    else if (functionName === 'get_staking_apy') {
                        const apyData = await apiClient.staking.getPoolDetails(functionArgs.poolId || 1);
                        toolResult = apyData.success ? JSON.stringify(apyData.data.apy) : "No se pudo obtener el APY.";
                    }
                    else if (functionName === 'simulate_logistics_route') {
                        // Dummy route check just using the SDK skeleton for demo integration purposes 
                        // Actually, mapping to logistics getDeliveryPrediction or similar in SDK
                        toolResult = JSON.stringify({ optimalRouteFound: true, estimatedHours: 48, externalFactors: "None" });
                    }
                    else {
                        toolResult = `Function ${functionName} not perfectly implemented in endpoint map.`;
                    }
                } catch (toolError) {
                    console.error("Tool execution error: ", toolError);
                    toolResult = `Error ejecutando herramienta internamente: ${toolError.message}`;
                }

                // Inject result to conversation
                conversationContext.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: toolResult
                });
            }

            // 3. Recursive Call after Tools Result
            const finalResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: conversationContext
            });

            return res.status(200).json({
                message: finalResponse.choices[0].message,
                status: "tool_executed"
            });
        } 
        
        // 4. Fallback Direct Return (No tools called)
        res.status(200).json({
            message: responseMessage,
            status: "direct"
        });

    } catch (error) {
        console.error("AI Chat Error: ", error);
        res.status(500).json({ error: 'AI Orchestrator Execution Failed', details: error.message });
    }
});

module.exports = router;
