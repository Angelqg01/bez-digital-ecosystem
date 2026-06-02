const express = require('express');
const router = express.Router();
const { audit } = require('../middleware/auditLogger');
const { sendTelegramNotification } = require('../middleware/telegramNotifier');
const UnifiedAI = require('../services/unified-ai.service');

/**
 * Recibe mensajes entrantes del webhook de Telegram
 * Endpoint: POST /api/telegram/webhook
 */
// The webhook needs to parse application/json but sometimes telegram sends raw text.
router.post('/webhook', express.json({ type: ['application/json', 'text/plain'] }), async (req, res) => {
    try {
        const { message } = req.body || {};
        
        // Si no hay mensaje o es un evento distinto a un texto, ignorar
        if (!message || !message.text) {
            return res.status(200).json({ status: 'OK' });
        }

        const chatId = message.chat.id.toString();
        const text = message.text;
        const username = message.from.username || message.from.first_name;

        // VERIFICACIÓN DE SEGURIDAD
        // Solo permitir mensajes del Admin (el CHAT ID configurado o verificar el rol si hubiese BD)
        const ADMIN_CHAT_ID = process.env.TELEGRAM_SECURITY_CHAT_ID;
        
        if (chatId !== ADMIN_CHAT_ID) {
            console.warn(`[Security] Unauthorized Telegram access attempt from ${chatId} (${username})`);
            
            // Opcional: Notificar al admin sobre el intento no autorizado si no es él mismo
            audit('TELEGRAM_UNAUTHORIZED_ACCESS', 'system', 'telegram', 'security', 'high', {
                attemptedId: chatId,
                username: username,
                text: text
            });

            return res.status(200).json({ status: 'Ignored' }); // Mandar 200 para que Telegram no reenvíe
        }

        console.log(`[Telegram Webhook] Received from Admin: ${text}`);

        // Enviar respuesta inicial para que el Admin sepa que estamos procesando
        await sendTelegramNotification(
            '🤖 Procesando...', 
            'Estoy analizando tu solicitud. Esto puede tomar unos segundos.', 
            [], 
            'low'
        );

        // Devolvemos 200 a Telegram rápido (tienen un timeout de pocos segundos)
        res.status(200).json({ status: 'Processing' });

        // Procesar en background el mensaje hacia la IA
        processMessageWithAI(text, chatId);

    } catch (error) {
        console.error('Error in Telegram Webhook:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Procesa el mensaje del admin usando el sistema de Chat de IA de BeZhas
 */
async function processMessageWithAI(text, chatId) {
    try {
         // Process using the UnifiedAI service (the core brain of BeZhas)
         const response = await UnifiedAI.process('CHAT', {
             message: text,
             context: {
                 userId: 'telegram_admin',
                 conversationId: `telegram_${chatId}`,
                 model: 'gemini', // Ensure it uses the smartest model
                 platform: 'BeZhas',
                 feature: 'telegram_admin_chat',
                 timestamp: new Date()
             }
         });

         const aiResponse = response.text || "La IA procesó tu mensaje pero no devolvió texto.";

         // Responder al Administrador
         await sendTelegramNotification(
            '🤖 Respuesta de la IA', 
            aiResponse,
            [], 
            'medium'
        );

    } catch (error) {
        console.error('Error forwarding message to AI:', error);
        await sendTelegramNotification(
            '❌ Error de la IA', 
            'Ocurrió un error al procesar tu mensaje.',
            [{name: 'Error', value: error.message}], 
            'high'
        );
    }
}

module.exports = router;
