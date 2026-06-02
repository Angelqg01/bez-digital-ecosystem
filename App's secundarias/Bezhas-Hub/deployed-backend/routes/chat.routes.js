const express = require('express');
const router = express.Router();
const UnifiedAI = require('../services/unified-ai.service');
const chatController = require('../controllers/chat.controller');
const {
    checkAndChargeCredit,
    getUserStats,
    resetUserCounter
} = require('../chat/chatGatekeeper');

// Auth middleware is optional for chat routes
let protect = null;
let groqService = null;
let chatLogService = null;

try {
    const { protect: authMiddleware } = require('../middleware/auth.middleware');
    protect = authMiddleware;
    // groqService = require('../services/groq.service'); // DISABLED: File not found
    // chatLogService = require('../services/chatLog.service'); // DISABLED: File not found
} catch (error) {
    console.log('Some services not available:', error.message);
}

// ==================== NEW: AI CHAT ROUTES ====================
// Estas rutas son para el chat con BeZhas AI (no chat entre usuarios)
if (protect) {
    // Enviar mensaje al AI assistant
    router.post('/send', protect, chatController.sendMessage);

    // Obtener conversaciones del usuario con AI
    router.get('/conversations', protect, chatController.getConversations);

    // Eliminar conversación
    router.delete('/conversations/:conversationId', protect, chatController.deleteConversation);

    // Obtener modelos de AI disponibles
    router.get('/models', protect, chatController.getAIModels);
}

// ==================== EXISTING: USER CHAT ROUTES ====================

// In-memory storage for chats and messages
const chats = new Map();
const messages = new Map();
const onlineUsers = new Set();
const typingUsers = new Map(); // userId -> chatId
const chatPermissions = new Map(); // userId_targetId -> { hasAccess: boolean, expiresAt: number }

// Demo users, companies, and agents
const demoUsers = [
    { id: 'user1', name: 'María García', avatar: '👩', type: 'user', online: true, lastSeen: Date.now(), isVip: true, chatPrice: 10 },
    { id: 'user2', name: 'Carlos Rodríguez', avatar: '👨', type: 'user', online: false, lastSeen: Date.now() - 3600000, isVip: false, chatPrice: 0 },
    { id: 'user3', name: 'Ana Martínez', avatar: '👩‍💼', type: 'user', online: true, lastSeen: Date.now(), isVip: true, chatPrice: 25 },
    { id: 'user4', name: 'Pedro López', avatar: '👨‍💻', type: 'user', online: false, lastSeen: Date.now() - 7200000, isVip: false, chatPrice: 0 }
];

const demoCompanies = [
    { id: 'company1', name: 'TechCorp Solutions', avatar: '🏢', type: 'company', online: true, description: 'Soluciones tecnológicas empresariales', isVerified: true, chatPrice: 50 },
    { id: 'company2', name: 'BlockChain Ventures', avatar: '💼', type: 'company', online: true, description: 'Inversión en Web3 y Blockchain', isVerified: true, chatPrice: 100 },
    { id: 'company3', name: 'NFT Gallery', avatar: '🎨', type: 'company', online: false, description: 'Galería y marketplace de NFTs', isVerified: false, chatPrice: 0 }
];

const demoAgents = [
    { id: 'agent1', name: 'Soporte Técnico', avatar: '🛠️', type: 'agent', online: true, description: 'Asistencia técnica 24/7', isPremium: false, chatPrice: 0 },
    { id: 'agent2', name: 'Asesor Financiero', avatar: '💰', type: 'agent', online: true, description: 'Consultoría de inversiones', isPremium: true, chatPrice: 5 },
    { id: 'agent3', name: 'Community Manager', avatar: '📱', type: 'agent', online: true, description: 'Gestión de comunidad', isPremium: true, chatPrice: 2 }
];

const demoGroups = [
    {
        id: 'group1',
        name: 'Desarrolladores BeZhas',
        avatar: '💻',
        type: 'group',
        members: ['user1', 'user2', 'user3'],
        description: 'Grupo de desarrollo y tecnología',
        memberCount: 15
    },
    {
        id: 'group2',
        name: 'Traders & Inversores',
        avatar: '📈',
        type: 'group',
        members: ['user1', 'user4'],
        description: 'Análisis de mercado y estrategias',
        memberCount: 42
    },
    {
        id: 'group3',
        name: 'Artistas NFT',
        avatar: '🎨',
        type: 'group',
        members: ['user2', 'user3'],
        description: 'Comunidad de creadores digitales',
        memberCount: 28
    }
];

// Initialize demo chats
const initializeDemoChats = (userAddress) => {
    const userChats = [];

    // Add AI assistant
    userChats.push({
        id: 'ai-assistant',
        type: 'ai',
        name: 'Asistente IA BeZhas',
        avatar: '🤖',
        lastMessage: '¡Hola! Soy tu asistente de IA. ¿En qué puedo ayudarte?',
        timestamp: Date.now() - 3600000,
        unread: 0,
        online: true,
        description: 'Asistente inteligente 24/7'
    });

    // Add some demo user chats
    demoUsers.slice(0, 2).forEach((user, index) => {
        userChats.push({
            id: user.id,
            type: 'direct',
            name: user.name,
            avatar: user.avatar,
            lastMessage: index === 0 ? '¡Hola! ¿Cómo estás?' : 'Perfecto, gracias por la info',
            timestamp: Date.now() - (index + 1) * 1800000,
            unread: index === 0 ? 2 : 0,
            online: user.online,
            lastSeen: user.lastSeen
        });
    });

    // Add a company chat
    userChats.push({
        id: demoCompanies[0].id,
        type: 'company',
        name: demoCompanies[0].name,
        avatar: demoCompanies[0].avatar,
        lastMessage: 'Tenemos nuevas oportunidades de inversión',
        timestamp: Date.now() - 7200000,
        unread: 1,
        online: demoCompanies[0].online,
        description: demoCompanies[0].description
    });

    // Add a group chat
    userChats.push({
        id: demoGroups[0].id,
        type: 'group',
        name: demoGroups[0].name,
        avatar: demoGroups[0].avatar,
        lastMessage: 'Nueva actualización disponible 🚀',
        timestamp: Date.now() - 5400000,
        unread: 5,
        online: true,
        memberCount: demoGroups[0].memberCount,
        description: demoGroups[0].description
    });

    return userChats;
};

// OpenAI integration (optional - will use simple AI if not available)
let openai = null;
try {
    const { OpenAI } = require('openai');
    if (process.env.OPENAI_API_KEY) {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
} catch (error) {
    console.log('OpenAI not available, using fallback AI');
}

// Simple AI responses for fallback
const simpleAIResponses = {
    greeting: [
        '¡Hola! ¿En qué puedo ayudarte hoy?',
        '¡Bienvenido! Estoy aquí para ayudarte.',
        'Hola, ¿cómo puedo asistirte?'
    ],
    help: [
        'Puedo ayudarte con:\n• Información sobre BeZhas\n• Gestión de wallet\n• Staking y recompensas\n• Preguntas generales\n\n¿Qué te gustaría saber?',
        'Estoy aquí para ayudarte con cualquier pregunta sobre BeZhas. ¿Qué necesitas?'
    ],
    wallet: [
        'Tu wallet es tu identidad en BeZhas. Puedes usarla para:\n• Hacer transacciones\n• Participar en staking\n• Comprar NFTs\n• Conectarte con otros usuarios',
        'La wallet de BeZhas te permite gestionar tus tokens BZH, participar en la comunidad y más.'
    ],
    staking: [
        'El staking en BeZhas te permite:\n• Ganar recompensas pasivas\n• Apoyar la red\n• Obtener beneficios exclusivos\n\n¿Quieres saber más sobre algún pool específico?',
        'Actualmente tenemos varios pools de staking disponibles con diferentes APY. ¿Te gustaría conocer los detalles?'
    ],
    nft: [
        'Los NFTs en BeZhas son únicos y pueden usarse para:\n• Coleccionar arte digital\n• Acceder a contenido exclusivo\n• Participar en eventos especiales',
        'Nuestro marketplace de NFTs está activo. ¿Quieres explorar las colecciones disponibles?'
    ],
    support: [
        'Si necesitas soporte adicional, puedo:\n• Contactar al equipo de soporte\n• Conectarte con un administrador\n• Proporcionar documentación\n\n¿Qué prefieres?',
        'El equipo de soporte está disponible 24/7. ¿Quieres que te conecte con ellos?'
    ],
    default: [
        'Entiendo tu pregunta. ¿Podrías darme más detalles?',
        'Interesante pregunta. Déjame ayudarte con eso.',
        'Estoy aquí para ayudarte. ¿Puedes ser más específico?'
    ]
};

// Get AI response
const getAIResponse = async (message, userContext = {}) => {
    const messageLower = message.toLowerCase();

    // Check for keywords
    if (messageLower.match(/hola|hi|hello|hey/)) {
        return simpleAIResponses.greeting[Math.floor(Math.random() * simpleAIResponses.greeting.length)];
    }
    if (messageLower.match(/ayuda|help|ayudar/)) {
        return simpleAIResponses.help[Math.floor(Math.random() * simpleAIResponses.help.length)];
    }
    if (messageLower.match(/wallet|billetera|cartera/)) {
        return simpleAIResponses.wallet[Math.floor(Math.random() * simpleAIResponses.wallet.length)];
    }
    if (messageLower.match(/staking|stake|recompensas/)) {
        return simpleAIResponses.staking[Math.floor(Math.random() * simpleAIResponses.staking.length)];
    }
    if (messageLower.match(/nft|token|coleccion/)) {
        return simpleAIResponses.nft[Math.floor(Math.random() * simpleAIResponses.nft.length)];
    }
    if (messageLower.match(/soporte|support|ayuda|problema/)) {
        return simpleAIResponses.support[Math.floor(Math.random() * simpleAIResponses.support.length)];
    }

    // Try OpenAI if available
    if (openai) {
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: `Eres el asistente virtual de BeZhas, una plataforma Web3 de redes sociales y marketplace. 
                        Eres amigable, útil y conocedor de blockchain, NFTs, staking y la plataforma BeZhas.
                        Responde en español de manera concisa y clara.`
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                max_tokens: 300,
                temperature: 0.7
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI error:', error);
        }
    }

    // Default response
    return simpleAIResponses.default[Math.floor(Math.random() * simpleAIResponses.default.length)];
};

// @route   POST /api/chat
// @desc    Send message to AI assistant
// @access  Public
router.post('/', async (req, res) => {
    try {
        const { message, context, userId } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // --- GATEKEEPER CHECK ---
        if (userId) {
            const gateResult = await checkAndChargeCredit(userId, message);
            if (!gateResult.allowed) {
                return res.status(402).json({
                    success: false,
                    error: 'Payment Required',
                    message: gateResult.message || 'Crédito insuficiente para consultar IA.',
                    reason: gateResult.reason,
                    details: gateResult
                });
            }
        }
        // ------------------------

        const reply = await getAIResponse(message, context);

        res.json({
            success: true,
            reply,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('AI chat error:', error);
        res.status(500).json({
            error: 'Error processing message',
            reply: 'Lo siento, estoy teniendo problemas técnicos. Por favor, intenta de nuevo.'
        });
    }
});

// @route   GET /api/chat/conversations/:address
// @desc    Get all conversations for a user
// @access  Public
router.get('/conversations/:address', (req, res) => {
    try {
        const { address } = req.params;

        // Get or create user chats with demo data
        if (!chats.has(address)) {
            const demoChats = initializeDemoChats(address);
            chats.set(address, demoChats);
        }

        const userChats = chats.get(address);

        res.json({
            success: true,
            chats: userChats
        });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Error loading conversations' });
    }
});

// @route   GET /api/chat/messages/:chatId/:address
// @desc    Get messages for a specific chat
// @access  Public
router.get('/messages/:chatId/:address', (req, res) => {
    try {
        const { chatId, address } = req.params;

        // Initialize demo messages if chat doesn't have any
        if (!messages.has(chatId)) {
            const demoMessages = [];

            // Add demo messages based on chat type
            if (chatId.startsWith('user')) {
                demoMessages.push({
                    id: 'msg1',
                    sender: chatId,
                    content: '¡Hola! ¿Cómo estás?',
                    timestamp: Date.now() - 3600000,
                    status: 'read'
                });
                demoMessages.push({
                    id: 'msg2',
                    sender: address,
                    content: '¡Muy bien! ¿Y tú?',
                    timestamp: Date.now() - 3400000,
                    status: 'read'
                });
                demoMessages.push({
                    id: 'msg3',
                    sender: chatId,
                    content: 'Perfecto, gracias por preguntar 😊',
                    timestamp: Date.now() - 3200000,
                    status: 'read'
                });
            } else if (chatId.startsWith('company')) {
                demoMessages.push({
                    id: 'msg1',
                    sender: chatId,
                    content: 'Bienvenido a nuestro servicio de atención. ¿En qué podemos ayudarte?',
                    timestamp: Date.now() - 7200000,
                    status: 'read'
                });
            } else if (chatId.startsWith('group')) {
                demoMessages.push({
                    id: 'msg1',
                    sender: 'user1',
                    content: '¡Hola a todos! 👋',
                    timestamp: Date.now() - 5400000,
                    status: 'read',
                    senderName: 'María García'
                });
                demoMessages.push({
                    id: 'msg2',
                    sender: 'user2',
                    content: '¿Alguien vio la nueva actualización?',
                    timestamp: Date.now() - 5200000,
                    status: 'read',
                    senderName: 'Carlos Rodríguez'
                });
                demoMessages.push({
                    id: 'msg3',
                    sender: 'user3',
                    content: 'Sí! Está increíble 🚀',
                    timestamp: Date.now() - 5000000,
                    status: 'read',
                    senderName: 'Ana Martínez'
                });
            }

            messages.set(chatId, demoMessages);
        }

        const chatMessages = messages.get(chatId) || [];

        res.json({
            success: true,
            messages: chatMessages
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Error loading messages' });
    }
});

// @route   POST /api/chat/send
// @desc    Send a message to a chat
// @access  Public
router.post('/send', async (req, res) => {
    try {
        const { chatId, sender, content, timestamp } = req.body;

        if (!chatId || !sender || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // --- GATEKEEPER CHECK ---
        const gateResult = await checkAndChargeCredit(sender, content);

        if (!gateResult.allowed) {
            return res.status(402).json({
                success: false,
                error: 'ayment Required',
                message: gateResult.message || 'Crédito insuficiente para enviar mensaje.',
                reason: gateResult.reason,
                details: gateResult
            });
        }
        // ------------------------

        const messageId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const newMessage = {
            id: messageId,
            sender,
            content,
            timestamp: timestamp || Date.now(),
            status: 'sent'
        };

        // Get or create messages array for this chat
        if (!messages.has(chatId)) {
            messages.set(chatId, []);
        }

        const chatMessages = messages.get(chatId);
        chatMessages.push(newMessage);

        // Update last message in chat list
        // This would be implemented with WebSocket for real-time updates

        res.json({
            success: true,
            messageId,
            message: newMessage
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Error sending message' });
    }
});

// @route   POST /api/chat/create
// @desc    Create a new chat
// @access  Public
router.post('/create', async (req, res) => {
    try {
        const { type, name, members, creator } = req.body;

        if (!type || !name || !creator) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const chatId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const newChat = {
            id: chatId,
            type,
            name,
            avatar: null,
            members: members || [creator],
            creator,
            createdAt: Date.now(),
            lastMessage: null,
            timestamp: Date.now(),
            unread: 0,
            online: false
        };

        // Add chat to all members
        const chatMembers = members || [creator];
        chatMembers.forEach(member => {
            if (!chats.has(member)) {
                chats.set(member, []);
            }
            chats.get(member).push(newChat);
        });

        res.json({
            success: true,
            chat: newChat
        });
    } catch (error) {
        console.error('Create chat error:', error);
        res.status(500).json({ error: 'Error creating chat' });
    }
});

// @route   POST /api/chat/admin
// @desc    Admin/Dev chat with AI assistant
// @access  Private (Admin/Dev only)
if (protect) {
    router.post('/admin', protect, async (req, res) => {
        try {
            const { message } = req.body;

            if (!message || !message.trim()) {
                return res.status(400).json({ error: 'Message is required' });
            }

            // Check if user is admin or dev
            const isAdminOrDev = req.user && (req.user.role === 'admin' || req.user.role === 'dev');

            const context = {
                isAdmin: isAdminOrDev,
                user: req.user
            };

            let reply;
            if (isAdminOrDev) {
                // Enhanced AI responses for admin/dev
                reply = await getAIResponse(message, context);
                reply = `[Admin Mode] ${reply}\n\nAcceso a funciones administrativas disponibles.`;
            } else {
                reply = await getAIResponse(message, context);
            }

            res.json({
                success: true,
                reply,
                timestamp: Date.now(),
                isAdmin: isAdminOrDev
            });
        } catch (error) {
            console.error('Admin chat error:', error);
            res.status(500).json({
                error: 'Error processing message',
                reply: 'Lo siento, estoy teniendo problemas técnicos.'
            });
        }
    });
} else {
    // If no auth middleware, admin route returns error
    router.post('/admin', (req, res) => {
        res.status(503).json({
            error: 'Admin chat not available',
            message: 'Authentication system not configured'
        });
    });
}

// @route   GET /api/chat/online
// @desc    Get online users
// @access  Public
router.get('/online', (req, res) => {
    try {
        res.json({
            success: true,
            onlineUsers: Array.from(onlineUsers)
        });
    } catch (error) {
        console.error('Get online users error:', error);
        res.status(500).json({ error: 'Error loading online users' });
    }
});

// @route   POST /api/chat/online
// @desc    Set user online status
// @access  Public
router.post('/online', (req, res) => {
    try {
        const { address, online } = req.body;

        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }

        if (online) {
            onlineUsers.add(address);
        } else {
            onlineUsers.delete(address);
        }

        res.json({
            success: true,
            onlineUsers: Array.from(onlineUsers)
        });
    } catch (error) {
        console.error('Set online status error:', error);
        res.status(500).json({ error: 'Error updating status' });
    }
});

// @route   GET /api/chat/available-users
// @desc    Get list of available users to chat with
// @access  Public
router.get('/available-users', (req, res) => {
    try {
        res.json({
            success: true,
            users: demoUsers,
            companies: demoCompanies,
            agents: demoAgents,
            groups: demoGroups
        });
    } catch (error) {
        console.error('Get available users error:', error);
        res.status(500).json({ error: 'Error loading available users' });
    }
});

// @route   GET /api/chat/check-access/:targetId
// @desc    Check if user has access to chat with target
// @access  Public
router.get('/check-access/:targetId', (req, res) => {
    try {
        const { targetId } = req.params;
        const { userAddress } = req.query;

        if (!userAddress || !targetId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Find target entity to check price
        let targetEntity = demoUsers.find(u => u.id === targetId) ||
            demoCompanies.find(c => c.id === targetId) ||
            demoAgents.find(a => a.id === targetId) ||
            demoGroups.find(g => g.id === targetId);

        if (!targetEntity) {
            // If not found in demo data, assume it's a regular user with no price
            // In a real DB, we would query the user profile
            return res.json({
                success: true,
                hasAccess: true,
                price: 0,
                requiresPayment: false
            });
        }

        const price = targetEntity.chatPrice || 0;

        // If free, access granted
        if (price === 0) {
            return res.json({
                success: true,
                hasAccess: true,
                price: 0,
                requiresPayment: false
            });
        }

        // Check permissions map
        const permissionKey = `${userAddress}_${targetId}`;
        const permission = chatPermissions.get(permissionKey);

        if (permission && permission.hasAccess && permission.expiresAt > Date.now()) {
            return res.json({
                success: true,
                hasAccess: true,
                price,
                requiresPayment: false
            });
        }

        // Access denied, payment required
        return res.json({
            success: true,
            hasAccess: false,
            price,
            requiresPayment: true,
            entityName: targetEntity.name
        });

    } catch (error) {
        console.error('Check access error:', error);
        res.status(500).json({ error: 'Error checking access' });
    }
});

// @route   POST /api/chat/pay-access
// @desc    Record payment for chat access
// @access  Public
router.post('/pay-access', (req, res) => {
    try {
        const { userAddress, targetId, amount, txHash } = req.body;

        if (!userAddress || !targetId || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // In a real app, we would verify the transaction hash on-chain here
        // For now, we trust the frontend (DEMO ONLY)

        const permissionKey = `${userAddress}_${targetId}`;

        // Grant access for 30 days
        chatPermissions.set(permissionKey, {
            hasAccess: true,
            expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000),
            paidAmount: amount,
            txHash
        });

        res.json({
            success: true,
            message: 'Access granted successfully'
        });

    } catch (error) {
        console.error('Pay access error:', error);
        res.status(500).json({ error: 'Error processing payment' });
    }
});

// @route   POST /api/chat/start-chat
// @desc    Start a new chat with user/company/agent
// @access  Public
router.post('/start-chat', (req, res) => {
    try {
        const { userAddress, targetId, targetType } = req.body;

        if (!userAddress || !targetId || !targetType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Find target entity
        let targetEntity;
        let chatType = targetType;

        if (targetType === 'user') {
            targetEntity = demoUsers.find(u => u.id === targetId);
            chatType = 'direct';
        } else if (targetType === 'company') {
            targetEntity = demoCompanies.find(c => c.id === targetId);
        } else if (targetType === 'agent') {
            targetEntity = demoAgents.find(a => a.id === targetId);
        } else if (targetType === 'group') {
            targetEntity = demoGroups.find(g => g.id === targetId);
        }

        if (!targetEntity) {
            return res.status(404).json({ error: 'Target not found' });
        }

        // Get user chats
        if (!chats.has(userAddress)) {
            const demoChats = initializeDemoChats(userAddress);
            chats.set(userAddress, demoChats);
        }

        const userChats = chats.get(userAddress);

        // Check if chat already exists
        const existingChat = userChats.find(chat => chat.id === targetId);
        if (existingChat) {
            return res.json({
                success: true,
                chat: existingChat,
                isNew: false
            });
        }

        // Create new chat
        const newChat = {
            id: targetId,
            type: chatType,
            name: targetEntity.name,
            avatar: targetEntity.avatar,
            lastMessage: '',
            timestamp: Date.now(),
            unread: 0,
            online: targetEntity.online,
            description: targetEntity.description,
            memberCount: targetEntity.memberCount
        };

        userChats.push(newChat);
        chats.set(userAddress, userChats);

        res.json({
            success: true,
            chat: newChat,
            isNew: true
        });
    } catch (error) {
        console.error('Start chat error:', error);
        res.status(500).json({ error: 'Error starting chat' });
    }
});

// @route   POST /api/chat/react
// @desc    Add reaction to a message
// @access  Public
router.post('/react', (req, res) => {
    try {
        const { messageId, chatId, reaction, userId } = req.body;

        if (!messageId || !reaction) {
            return res.status(400).json({ error: 'Message ID and reaction are required' });
        }

        const chatMessages = messages.get(chatId) || [];
        const messageIndex = chatMessages.findIndex(msg => msg.id === messageId);

        if (messageIndex === -1) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Initialize reactions if not exists
        if (!chatMessages[messageIndex].reactions) {
            chatMessages[messageIndex].reactions = {};
        }

        // Add or increment reaction
        if (!chatMessages[messageIndex].reactions[reaction]) {
            chatMessages[messageIndex].reactions[reaction] = 1;
        } else {
            chatMessages[messageIndex].reactions[reaction]++;
        }

        messages.set(chatId, chatMessages);

        res.json({
            success: true,
            message: chatMessages[messageIndex]
        });
    } catch (error) {
        console.error('React to message error:', error);
        res.status(500).json({ error: 'Error adding reaction' });
    }
});

// @route   POST /api/chat/typing
// @desc    Set typing indicator
// @access  Public
router.post('/typing', (req, res) => {
    try {
        const { chatId, userId, isTyping } = req.body;

        if (!chatId || !userId) {
            return res.status(400).json({ error: 'Chat ID and user ID are required' });
        }

        if (isTyping) {
            typingUsers.set(userId, chatId);
        } else {
            typingUsers.delete(userId);
        }

        res.json({
            success: true,
            typingUsers: Array.from(typingUsers.entries()).filter(([_, cid]) => cid === chatId).map(([uid]) => uid)
        });
    } catch (error) {
        console.error('Typing indicator error:', error);
        res.status(500).json({ error: 'Error updating typing status' });
    }
});

// @route   DELETE /api/chat/message/:messageId
// @desc    Delete a message
// @access  Public
router.delete('/message/:messageId', (req, res) => {
    try {
        const { messageId } = req.params;
        const { chatId } = req.query;

        if (!chatId) {
            return res.status(400).json({ error: 'Chat ID is required' });
        }

        const chatMessages = messages.get(chatId) || [];
        const filteredMessages = chatMessages.filter(msg => msg.id !== messageId);

        messages.set(chatId, filteredMessages);

        res.json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Error deleting message' });
    }
});

// @route   PUT /api/chat/message/:messageId
// @desc    Edit a message
// @access  Public
router.put('/message/:messageId', (req, res) => {
    try {
        const { messageId } = req.params;
        const { chatId, content } = req.body;

        if (!chatId || !content) {
            return res.status(400).json({ error: 'Chat ID and content are required' });
        }

        const chatMessages = messages.get(chatId) || [];
        const messageIndex = chatMessages.findIndex(msg => msg.id === messageId);

        if (messageIndex === -1) {
            return res.status(404).json({ error: 'Message not found' });
        }

        chatMessages[messageIndex].content = content;
        chatMessages[messageIndex].edited = true;
        chatMessages[messageIndex].editedAt = Date.now();

        messages.set(chatId, chatMessages);

        res.json({
            success: true,
            message: chatMessages[messageIndex]
        });
    } catch (error) {
        console.error('Edit message error:', error);
        res.status(500).json({ error: 'Error editing message' });
    }
});

module.exports = router;
