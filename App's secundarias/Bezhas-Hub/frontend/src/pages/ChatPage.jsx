import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import {
    Send, Bot, Users, Building2, MessageSquare, Search, Phone, Video,
    MoreVertical, Paperclip, Smile, X, Plus, User, Check, CheckCheck,
    Hash, Lock, Globe, Star, Settings, ArrowLeft, Loader2, Menu, Reply,
    ThumbsUp, Heart, Laugh
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import http from '../services/http';
import { Spinner } from '../components/ui/Spinner';
import { usePageView } from '../utils/telemetry';

const ChatPage = () => {
    usePageView();

    const { address, isConnected } = useAccount();
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    // State
    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [messageSearchQuery, setMessageSearchQuery] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isLoadingChats, setIsLoadingChats] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [activeTab, setActiveTab] = useState('all'); // all, direct, groups, ai
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [replyTo, setReplyTo] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const [showMessageSearch, setShowMessageSearch] = useState(false);
    const [availableContacts, setAvailableContacts] = useState({
        users: [],
        companies: [],
        agents: [],
        groups: []
    });
    const [newChatTab, setNewChatTab] = useState('users'); // users, companies, agents, groups
    const [newChatSearch, setNewChatSearch] = useState('');
    const [chats, setChats] = useState([]);

    // Load chats and agents
    const loadChats = useCallback(async () => {
        if (!address) return;

        setIsLoadingChats(true);
        try {
            // Fetch user's active chats
            const chatsResponse = await http.get(`/api/chat/conversations/${address}`);
            const serverChats = chatsResponse.data?.chats || [];

            // Fetch available AI agents from Admin Panel configuration
            const agentsResponse = await http.get('/api/ai/agents');
            const agents = agentsResponse.data?.agents || (Array.isArray(agentsResponse.data) ? agentsResponse.data : []);

            // Map agents to chat format
            const agentChats = agents.map(agent => ({
                id: agent.id,
                type: 'ai',
                name: agent.name,
                avatar: agent.avatar || '🤖',
                lastMessage: agent.description || 'Soy un agente de IA listo para ayudarte.',
                timestamp: Date.now(),
                unread: 0,
                online: true,
                description: agent.description,
                systemPrompt: agent.systemPrompt,
                model: agent.model
            }));

            // If no agents exist, add a default one
            if (agentChats.length === 0) {
                agentChats.push({
                    id: 'ai-assistant',
                    type: 'ai',
                    name: 'Asistente IA BeZhas',
                    avatar: '🤖',
                    lastMessage: '¡Hola! Soy tu asistente de IA. ¿En qué puedo ayudarte?',
                    timestamp: Date.now(),
                    unread: 0,
                    online: true,
                    description: 'Asistente inteligente 24/7'
                });
            }

            // Filter out server chats that might duplicate agents (if any)
            const uniqueServerChats = serverChats.filter(chat => chat.type !== 'ai');

            setChats([...agentChats, ...uniqueServerChats]);

        } catch (error) {
            console.error('Error loading chats:', error);
            // Fallback default agent
            setChats([{
                id: 'ai-assistant',
                type: 'ai',
                name: 'Asistente IA BeZhas',
                avatar: '🤖',
                lastMessage: '¡Hola! Soy tu asistente de IA. ¿En qué puedo ayudarte?',
                timestamp: Date.now(),
                unread: 0,
                online: true,
                description: 'Asistente inteligente 24/7'
            }]);
        } finally {
            setIsLoadingChats(false);
        }
    }, [address]);

    // Load messages for selected chat
    const loadMessages = useCallback(async (chatId) => {
        if (!chatId || !address) return;

        setIsLoadingMessages(true);
        try {
            const chat = chats.find(c => c.id === chatId);

            if (chat && chat.type === 'ai') {
                // Load AI chat history from localStorage
                const storageKey = `chat_${chatId}_${address}`;
                const storedMessages = localStorage.getItem(storageKey);

                if (storedMessages) {
                    try {
                        setMessages(JSON.parse(storedMessages));
                    } catch (e) {
                        console.error('Error parsing stored messages:', e);
                        localStorage.removeItem(storageKey);
                        setMessages([]);
                    }
                } else {
                    // Initial greeting for this specific agent
                    setMessages([
                        {
                            id: '1',
                            sender: 'ai',
                            content: `¡Hola! Soy ${chat.name}. ${chat.description || '¿En qué puedo ayudarte hoy?'}`,
                            timestamp: Date.now(),
                            status: 'read'
                        }
                    ]);
                }
            } else {
                const response = await http.get(`/api/chat/messages/${chatId}/${address}`);
                setMessages(response.data.messages || []);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            toast.error('Error al cargar mensajes');
        } finally {
            setIsLoadingMessages(false);
        }
    }, [address, chats]);

    // Load available contacts for new chat
    const loadAvailableContacts = useCallback(async () => {
        try {
            const response = await http.get('/api/chat/available-users');
            const agentsResponse = await http.get('/api/ai/agents');
            const agentsList = agentsResponse.data?.agents || (Array.isArray(agentsResponse.data) ? agentsResponse.data : []);

            if (response.data.success) {
                setAvailableContacts({
                    users: response.data.users || [],
                    companies: response.data.companies || [],
                    agents: agentsList, // Use the dynamic agents list
                    groups: response.data.groups || []
                });
            }
        } catch (error) {
            console.error('Error loading available contacts:', error);
        }
    }, []);

    // Start new chat
    const startNewChat = async (targetId, targetType) => {
        try {
            if (targetType === 'ai') {
                // For AI, we just select it from our list since we loaded them all
                const agent = chats.find(c => c.id === targetId);
                if (agent) {
                    setSelectedChat(agent);
                    setShowNewChatModal(false);
                    return;
                }
                // If not in main list (shouldn't happen if we loaded correctly), fetch and add
                const agentsResponse = await http.get('/api/ai/agents');
                const agentsList = agentsResponse.data?.agents || (Array.isArray(agentsResponse.data) ? agentsResponse.data : []);
                const targetAgent = agentsList.find(a => a.id === targetId);
                if (targetAgent) {
                    const newAgentChat = {
                        id: targetAgent.id,
                        type: 'ai',
                        name: targetAgent.name,
                        avatar: targetAgent.avatar || '🤖',
                        lastMessage: targetAgent.description,
                        timestamp: Date.now(),
                        unread: 0,
                        online: true,
                        description: targetAgent.description,
                        systemPrompt: targetAgent.systemPrompt,
                        model: targetAgent.model
                    };
                    setChats(prev => [...prev, newAgentChat]);
                    setSelectedChat(newAgentChat);
                    setShowNewChatModal(false);
                }
                return;
            }

            // Check access first
            const accessRes = await http.get(`/api/chat/check-access/${targetId}?userAddress=${address}`);

            if (accessRes.data && !accessRes.data.hasAccess) {
                const confirmPayment = window.confirm(
                    `Este usuario requiere un pago de ${accessRes.data.price} BEZ para chatear. ¿Deseas pagar ahora?`
                );
                if (!confirmPayment) return;

                // Pay
                const payRes = await http.post('/api/chat/pay-access', {
                    userAddress: address,
                    targetId,
                    amount: accessRes.data.price,
                    txHash: '0x_mock_tx_hash_' + Date.now()
                });

                if (!payRes.data?.success) {
                    toast.error('Error en el pago');
                    return;
                }
                toast.success('Pago exitoso');
            }

            const response = await http.post('/api/chat/start-chat', {
                userAddress: address,
                targetId,
                targetType
            });

            if (response.data?.success) {
                const newChat = response.data.chat;

                // Add to chats list if new
                if (response.data.isNew) {
                    setChats(prev => [...prev, newChat]);
                }

                // Select the chat
                setSelectedChat(newChat);
                setShowNewChatModal(false);
                toast.success(`Chat iniciado con ${newChat.name}`);
            }
        } catch (error) {
            console.error('Error starting chat:', error);
            toast.error('Error al iniciar chat');
        }
    };

    // Send message
    const sendMessage = async () => {
        if (!messageInput.trim() || isSending) return;

        const newMessage = {
            id: Date.now().toString(),
            sender: 'me',
            content: messageInput.trim(),
            timestamp: Date.now(),
            status: 'sending',
            replyTo: replyTo
        };

        setMessages(prev => [...prev, newMessage]);
        setMessageInput('');
        setReplyTo(null);
        setIsSending(true);

        try {
            if (selectedChat?.type === 'ai') {
                // Send to AI
                const response = await http.post('/api/chat', {
                    message: newMessage.content,
                    userId: address, // Required for Gatekeeper credits
                    agentId: selectedChat.id, // Pass the agent ID
                    systemPrompt: selectedChat.systemPrompt, // Optional: pass prompt if backend needs it
                    model: selectedChat.model // Optional: pass model if backend needs it
                });

                const aiResponse = {
                    id: (Date.now() + 1).toString(),
                    sender: 'ai',
                    content: response.data.reply || 'Lo siento, no pude procesar tu mensaje.',
                    timestamp: Date.now(),
                    status: 'read'
                };

                setMessages(prev => {
                    const updated = prev.map(msg =>
                        msg.id === newMessage.id ? { ...msg, status: 'sent' } : msg
                    );
                    const withAI = [...updated, aiResponse];

                    // Save to localStorage
                    localStorage.setItem(`chat_${selectedChat.id}_${address}`, JSON.stringify(withAI));

                    return withAI;
                });
            } else {
                // Send to regular chat
                const response = await http.post('/api/chat/send', {
                    chatId: selectedChat.id,
                    sender: address,
                    content: newMessage.content,
                    timestamp: Date.now(),
                    replyTo: replyTo?.id
                });

                setMessages(prev => prev.map(msg =>
                    msg.id === newMessage.id
                        ? { ...msg, id: response.data.messageId, status: 'sent' }
                        : msg
                ));
            }
        } catch (error) {
            console.error('Error sending message:', error);

            if (error.response && error.response.status === 402) {
                // Gatekeeper limit reached
                const errorMsg = error.response.data.message || 'Límite de palabras alcanzado. Recarga créditos.';
                toast.error(errorMsg, {
                    duration: 6000,
                    icon: '🛑'
                });
            } else {
                toast.error('Error al enviar mensaje');
            }

            setMessages(prev => prev.map(msg =>
                msg.id === newMessage.id ? { ...msg, status: 'failed' } : msg
            ));
        } finally {
            setIsSending(false);
        }
    };

    // Add reaction to message
    const addReaction = async (messageId, emoji) => {
        try {
            setMessages(prev => prev.map(msg => {
                if (msg.id === messageId) {
                    const reactions = msg.reactions || {};
                    reactions[emoji] = (reactions[emoji] || 0) + 1;
                    return { ...msg, reactions };
                }
                return msg;
            }));

            if (selectedChat?.type !== 'ai') {
                await http.post('/api/chat/react', {
                    messageId,
                    reaction: emoji
                });
            }

            toast.success(`Reacción ${emoji} añadida`);
        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    };

    // Simulate typing indicator
    useEffect(() => {
        if (messageInput.length > 0 && selectedChat?.type !== 'ai') {
            setIsTyping(true);
            const timeout = setTimeout(() => setIsTyping(false), 1000);
            return () => clearTimeout(timeout);
        }
    }, [messageInput, selectedChat]);

    // Filter messages by search
    const filteredMessages = messages.filter(msg =>
        !messageSearchQuery || msg.content.toLowerCase().includes(messageSearchQuery.toLowerCase())
    );

    // Handle key press
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isConnected && address) {
            loadChats();
        }
    }, [isConnected, address, loadChats]);

    useEffect(() => {
        if (selectedChat) {
            loadMessages(selectedChat.id);
        }
    }, [selectedChat, loadMessages]);

    // Load available contacts when modal opens
    useEffect(() => {
        if (showNewChatModal) {
            loadAvailableContacts();
        }
    }, [showNewChatModal, loadAvailableContacts]);

    // Filter chats
    const filteredChats = chats.filter(chat => {
        const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTab =
            activeTab === 'all' ||
            (activeTab === 'ai' && chat.type === 'ai') ||
            (activeTab === 'direct' && chat.type === 'direct') ||
            (activeTab === 'groups' && (chat.type === 'group' || chat.type === 'forum'));

        return matchesSearch && matchesTab;
    });

    // Not connected
    if (!isConnected) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
                <div className="text-center p-8 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 max-w-md">
                    <MessageSquare className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Conecta tu Wallet</h2>
                    <p className="text-gray-400 mb-6">
                        Conecta tu wallet para acceder al chat
                    </p>
                    <w3m-button />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            <div className="max-w-7xl mx-auto p-4 h-screen flex flex-col">
                {/* Header */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-t-2xl border border-gray-700 border-b-0 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate(-1)}
                                className="lg:hidden text-gray-400 hover:text-white transition-colors"
                            >
                                <ArrowLeft size={24} />
                            </button>
                            <MessageSquare className="text-blue-400" size={28} />
                            <div>
                                <h1 className="text-2xl font-bold text-white">Chat BeZhas</h1>
                                <p className="text-sm text-gray-400">Mensajería con IA integrada</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowNewChatModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                            title="Nuevo chat"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex bg-gray-800/50 backdrop-blur-sm rounded-b-2xl border border-gray-700 overflow-hidden">
                    {/* Sidebar */}
                    <div className={`w-full lg:w-80 border-r border-gray-700 flex flex-col ${selectedChat ? 'hidden lg:flex' : 'flex'}`}>
                        {/* Tabs */}
                        <div className="p-4 border-b border-gray-700 flex gap-2 overflow-x-auto scrollbar-hide">
                            {[
                                { id: 'all', label: 'Todos', icon: MessageSquare },
                                { id: 'ai', label: 'IA', icon: Bot },
                                { id: 'direct', label: 'Directos', icon: User },
                                { id: 'groups', label: 'Grupos', icon: Users }
                            ].map(tab => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                                            }`}
                                    >
                                        <Icon size={16} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Search */}
                        <div className="p-4 border-b border-gray-700">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Buscar chats..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-gray-900/50 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Chat List */}
                        <div className="flex-1 overflow-y-auto">
                            {isLoadingChats ? (
                                <div className="flex items-center justify-center h-full">
                                    <Spinner size="lg" />
                                </div>
                            ) : filteredChats.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                                    <MessageSquare size={48} className="mb-4 opacity-50" />
                                    <p className="text-center">No hay chats disponibles</p>
                                    <button
                                        onClick={() => setShowNewChatModal(true)}
                                        className="mt-4 text-blue-400 hover:text-blue-300"
                                    >
                                        Crear nuevo chat
                                    </button>
                                </div>
                            ) : (
                                filteredChats.map(chat => (
                                    <button
                                        key={chat.id}
                                        onClick={() => setSelectedChat(chat)}
                                        className={`w-full p-4 border-b border-gray-700 hover:bg-gray-700/30 transition-colors ${selectedChat?.id === chat.id ? 'bg-gray-700/50' : ''} `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-2xl overflow-hidden">
                                                    {chat.avatar && chat.avatar.length > 2 ? (
                                                        <img src={chat.avatar} alt={chat.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        chat.avatar || chat.name.charAt(0)
                                                    )}
                                                </div>
                                                {chat.online && (
                                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full" />
                                                )}
                                            </div>
                                            <div className="flex-1 text-left">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-semibold text-white truncate max-w-[140px]">{chat.name}</h3>
                                                    {chat.timestamp && (
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(chat.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-sm text-gray-400 truncate max-w-[180px]">
                                                        {chat.lastMessage}
                                                    </p>
                                                    {chat.unread > 0 && (
                                                        <span className="ml-2 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                                            {chat.unread}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className={`flex-1 flex flex-col ${!selectedChat ? 'hidden lg:flex' : 'flex'} `}>
                        {/* Chat Header */}
                        {selectedChat && (
                            <div className="p-4 border-b border-gray-700 bg-gray-900/30 flex items-center gap-3 sticky top-0 z-20">
                                <button
                                    onClick={() => setSelectedChat(null)}
                                    className="lg:hidden text-gray-400 hover:text-white transition-colors mr-2"
                                    aria-label="Volver a lista de chats"
                                >
                                    <ArrowLeft size={24} />
                                </button>
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xl overflow-hidden">
                                        {selectedChat.avatar && selectedChat.avatar.length > 2 ? (
                                            <img src={selectedChat.avatar} alt={selectedChat.name} className="w-full h-full object-cover" />
                                        ) : (
                                            selectedChat.avatar || selectedChat.name.charAt(0)
                                        )}
                                    </div>
                                    {selectedChat.online && (
                                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">{selectedChat.name}</h3>
                                    <p className="text-xs text-gray-400">
                                        {selectedChat.online ? 'En línea' : 'Desconectado'}
                                    </p>
                                </div>
                                <div className="flex-1" />
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowMessageSearch(!showMessageSearch)}
                                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                                        title="Buscar mensajes"
                                    >
                                        <Search size={20} />
                                    </button>
                                    {selectedChat.type !== 'ai' && (
                                        <>
                                            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                                                <Phone size={20} />
                                            </button>
                                            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                                                <Video size={20} />
                                            </button>
                                        </>
                                    )}
                                    <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                                        <MoreVertical size={20} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Message Search Bar */}
                        {showMessageSearch && selectedChat && (
                            <div className="p-3 border-b border-gray-700 bg-gray-900/30">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Buscar en mensajes..."
                                        value={messageSearchQuery}
                                        onChange={(e) => setMessageSearchQuery(e.target.value)}
                                        className="w-full bg-gray-900/50 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                    {messageSearchQuery && (
                                        <button
                                            onClick={() => setMessageSearchQuery('')}
                                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Typing Indicator */}
                        {isTyping && selectedChat?.type !== 'ai' && (
                            <div className="px-4 py-2 text-sm text-gray-400 italic">
                                {selectedChat.name} está escribiendo...
                            </div>
                        )}

                        {/* Mensajes */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {isLoadingMessages ? (
                                <div className="flex items-center justify-center h-full">
                                    <Spinner size="lg" />
                                </div>
                            ) : (
                                <>
                                    {filteredMessages.map((message) => {
                                        const isMe = message.sender === 'me';
                                        const isAI = message.sender === 'ai';
                                        const repliedMsg = message.replyTo ? messages.find(m => m.id === message.replyTo.id) : null;

                                        return (
                                            <div
                                                key={message.id}
                                                className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}
                                            >
                                                <div className={`max-w-[85%] lg:max-w-[70%] ${isMe ? 'order-2' : 'order-1'} `}>
                                                    {!isMe && (
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {isAI && <Bot size={14} className="text-blue-400" />}
                                                            <span className="text-xs text-gray-400">
                                                                {isAI ? (selectedChat?.name || 'Asistente IA') : selectedChat.name}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Reply Preview */}
                                                    {repliedMsg && (
                                                        <div className="mb-1 p-2 bg-gray-700/50 rounded-lg border-l-2 border-blue-500 text-xs text-gray-400">
                                                            <p className="font-semibold">↩ Respondiendo a:</p>
                                                            <p className="truncate">{repliedMsg.content}</p>
                                                        </div>
                                                    )}

                                                    <div className="relative group">
                                                        <div
                                                            className={`rounded-2xl p-3 ${isMe
                                                                ? 'bg-blue-600 text-white'
                                                                : isAI
                                                                    ? 'bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/30 text-white'
                                                                    : 'bg-gray-700 text-white'
                                                                } `}
                                                        >
                                                            <p className="whitespace-pre-wrap break-words text-sm lg:text-base">{message.content}</p>

                                                            {/* Reactions */}
                                                            {message.reactions && Object.keys(message.reactions).length > 0 && (
                                                                <div className="flex gap-1 mt-2 flex-wrap">
                                                                    {Object.entries(message.reactions).map(([emoji, count]) => (
                                                                        <span key={emoji} className="text-xs bg-gray-800/50 rounded-full px-2 py-1">
                                                                            {emoji} {count}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Quick Actions */}
                                                        <div className={`absolute top-1/2 -translate-y-1/2 hidden group-hover:flex gap-1 bg-gray-800 rounded-lg shadow-lg p-1 ${isMe ? '-left-2 -translate-x-full' : '-right-2 translate-x-full'}`}>
                                                            <button
                                                                onClick={() => setReplyTo(message)}
                                                                className="p-1 text-gray-400 hover:text-white transition-colors"
                                                                title="Responder"
                                                            >
                                                                <Reply size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => addReaction(message.id, '👍')}
                                                                className="p-1 text-gray-400 hover:text-white transition-colors"
                                                                title="👍"
                                                            >
                                                                <ThumbsUp size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => addReaction(message.id, '❤️')}
                                                                className="p-1 text-gray-400 hover:text-white transition-colors"
                                                                title="❤️"
                                                            >
                                                                <Heart size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => addReaction(message.id, '😂')}
                                                                className="p-1 text-gray-400 hover:text-white transition-colors"
                                                                title="😂"
                                                            >
                                                                <Laugh size={14} />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-gray-400">
                                                            {new Date(message.timestamp).toLocaleTimeString('es-ES', {
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </span>
                                                        {isMe && message.status && (
                                                            <>
                                                                {message.status === 'sending' && (
                                                                    <Loader2 size={12} className="text-gray-400 animate-spin" />
                                                                )}
                                                                {message.status === 'sent' && (
                                                                    <Check size={12} className="text-gray-400" />
                                                                )}
                                                                {message.status === 'read' && (
                                                                    <CheckCheck size={12} className="text-blue-400" />
                                                                )}
                                                                {message.status === 'failed' && (
                                                                    <X size={12} className="text-red-400" />
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>

                        {/* Reply Bar */}
                        {replyTo && (
                            <div className="px-4 py-2 bg-gray-900/50 border-t border-gray-700 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Reply size={16} className="text-blue-400" />
                                    <div className="text-sm">
                                        <p className="text-gray-400">Respondiendo a:</p>
                                        <p className="text-white truncate max-w-md">{replyTo.content}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setReplyTo(null)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        )}

                        {/* Input */}
                        {selectedChat && (
                            <div className="p-4 border-t border-gray-700 bg-gray-900/30">
                                <div className="flex items-end gap-2">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        onChange={() => toast.info('Función de archivos próximamente')}
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors hidden sm:block"
                                    >
                                        <Paperclip size={20} />
                                    </button>
                                    <div className="flex-1 bg-gray-900/50 rounded-lg border border-gray-700 focus-within:border-blue-500 transition-colors">
                                        <textarea
                                            value={messageInput}
                                            onChange={(e) => setMessageInput(e.target.value)}
                                            onKeyPress={handleKeyPress}
                                            placeholder="Escribe un mensaje..."
                                            rows={1}
                                            className="w-full bg-transparent text-white p-3 resize-none focus:outline-none max-h-32"
                                            style={{ minHeight: '44px', maxHeight: '128px' }}
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            setMessageInput(prev => prev + '@IA ');
                                            toast.success('IA invocada. Escribe tu consulta...');
                                            fileInputRef.current?.focus();
                                        }}
                                        className="p-2 text-purple-400 hover:text-purple-300 hover:bg-purple-900/30 rounded-lg transition-colors group relative hidden sm:block"
                                        title="Invocar Agente IA"
                                    >
                                        <Bot size={20} />
                                    </button>
                                    <button
                                        onClick={sendMessage}
                                        disabled={!messageInput.trim() || isSending}
                                        className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Mensaje de selecciona un chat */}
                        {!selectedChat && (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                                <MessageSquare size={64} className="mx-auto mb-4 opacity-50" />
                                <h3 className="text-xl font-semibold mb-2">Selecciona un chat</h3>
                                <p className="text-sm max-w-xs mx-auto">Elige una conversación de la lista o inicia un nuevo chat para comenzar</p>
                                <button
                                    onClick={() => setShowNewChatModal(true)}
                                    className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors lg:hidden"
                                >
                                    Nuevo Chat
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* New Chat Modal - MEJORADO */}
                {showNewChatModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 rounded-2xl border border-gray-700 max-w-2xl w-full max-h-[80vh] flex flex-col">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-700">
                                <h3 className="text-xl font-bold text-white">Iniciar Nuevo Chat</h3>
                                <button
                                    onClick={() => {
                                        setShowNewChatModal(false);
                                        setNewChatSearch('');
                                        setNewChatTab('users');
                                    }}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-2 p-4 border-b border-gray-700 overflow-x-auto scrollbar-hide">
                                <button
                                    onClick={() => setNewChatTab('users')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${newChatTab === 'users'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        } `}
                                >
                                    <User size={18} />
                                    Usuarios ({availableContacts.users.length})
                                </button>
                                <button
                                    onClick={() => setNewChatTab('companies')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${newChatTab === 'companies'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        } `}
                                >
                                    <Building2 size={18} />
                                    Empresas ({availableContacts.companies.length})
                                </button>
                                <button
                                    onClick={() => setNewChatTab('agents')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${newChatTab === 'agents'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        } `}
                                >
                                    <Bot size={18} />
                                    Agentes ({availableContacts.agents.length})
                                </button>
                                <button
                                    onClick={() => setNewChatTab('groups')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${newChatTab === 'groups'
                                        ? 'bg-orange-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        } `}
                                >
                                    <Users size={18} />
                                    Grupos ({availableContacts.groups.length})
                                </button>
                            </div>

                            {/* Search */}
                            <div className="p-4 border-b border-gray-700">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input
                                        type="text"
                                        value={newChatSearch}
                                        onChange={(e) => setNewChatSearch(e.target.value)}
                                        placeholder={`Buscar ${newChatTab === 'users' ? 'usuarios' : newChatTab === 'companies' ? 'empresas' : newChatTab === 'agents' ? 'agentes' : 'grupos'}...`}
                                        className="w-full bg-gray-900/50 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Contact List */}
                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="space-y-2">
                                    {(() => {
                                        const contacts = availableContacts[newChatTab] || [];
                                        const filtered = contacts.filter(contact =>
                                            contact.name.toLowerCase().includes(newChatSearch.toLowerCase())
                                        );

                                        if (filtered.length === 0) {
                                            return (
                                                <div className="text-center py-12 text-gray-400">
                                                    <Search size={48} className="mx-auto mb-3 opacity-50" />
                                                    <p>No se encontraron resultados</p>
                                                </div>
                                            );
                                        }

                                        return filtered.map((contact) => (
                                            <button
                                                key={contact.id}
                                                onClick={() => startNewChat(contact.id, newChatTab === 'agents' ? 'ai' : contact.type)}
                                                className="w-full bg-gray-700 hover:bg-gray-600 text-white p-4 rounded-lg flex items-center gap-3 transition-colors text-left group"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-2xl overflow-hidden">
                                                    {contact.avatar && contact.avatar.length > 2 ? (
                                                        <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        contact.avatar || contact.name.charAt(0)
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold truncate">{contact.name}</p>
                                                        {contact.online && (
                                                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                        )}
                                                    </div>
                                                    {contact.description && (
                                                        <p className="text-sm text-gray-400 truncate">{contact.description}</p>
                                                    )}
                                                    {contact.memberCount && (
                                                        <p className="text-xs text-gray-500">{contact.memberCount} miembros</p>
                                                    )}
                                                </div>
                                                <MessageSquare
                                                    size={20}
                                                    className="text-gray-400 group-hover:text-blue-400 transition-colors flex-shrink-0"
                                                />
                                            </button>
                                        ));
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatPage;
