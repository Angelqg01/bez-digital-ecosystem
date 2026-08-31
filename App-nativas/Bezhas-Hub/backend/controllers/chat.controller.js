const UnifiedAI = require('../services/unified-ai.service');

class ChatController {
    async sendMessage(req, res) {
        try {
            const { message, conversationId, model = 'gemini' } = req.body;
            const userId = req.user?._id || 'anonymous';

            if (!message || !message.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'Message is required'
                });
            }

            // Generar respuesta usando el servicio de AI unificado
            const response = await UnifiedAI.process('CHAT', {
                message: message.trim(),
                context: {
                    userId,
                    conversationId,
                    model,
                    platform: 'BeZhas',
                    feature: 'chat',
                    timestamp: new Date()
                }
            });

            res.json({
                success: true,
                data: {
                    message: response.text,
                    conversationId: conversationId || `conv_${Date.now()}_${userId}`,
                    model: response.provider,
                    timestamp: response.timestamp || new Date()
                }
            });

        } catch (error) {
            console.error('Chat error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process message',
                details: error.message
            });
        }
    }

    async getConversations(req, res) {
        try {
            const userId = req.user._id;

            // Aquí deberías obtener las conversaciones de la DB
            // Por ahora retorno un array vacío
            const conversations = [];

            res.json({
                success: true,
                data: conversations
            });

        } catch (error) {
            console.error('Get conversations error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get conversations'
            });
        }
    }

    async deleteConversation(req, res) {
        try {
            const { conversationId } = req.params;
            const userId = req.user._id;

            // Aquí deberías eliminar la conversación de la DB

            res.json({
                success: true,
                message: 'Conversation deleted successfully'
            });

        } catch (error) {
            console.error('Delete conversation error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete conversation'
            });
        }
    }

    async getAIModels(req, res) {
        try {
            const models = [
                {
                    id: 'gemini',
                    name: 'Google Gemini',
                    description: 'Modelo avanzado de Google AI',
                    available: !!process.env.GEMINI_API_KEY
                },
                {
                    id: 'openai',
                    name: 'OpenAI GPT-4',
                    description: 'Modelo de OpenAI GPT-4',
                    available: !!process.env.OPENAI_API_KEY
                },
                {
                    id: 'bezhasia',
                    name: 'BeZhas AI',
                    description: 'Modelo personalizado de BeZhas',
                    available: true
                }
            ];

            res.json({
                success: true,
                data: models
            });

        } catch (error) {
            console.error('Get models error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get AI models'
            });
        }
    }
}

module.exports = new ChatController();
