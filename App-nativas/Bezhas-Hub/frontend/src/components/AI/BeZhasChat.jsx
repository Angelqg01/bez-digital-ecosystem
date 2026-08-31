import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './BeZhasChat.css';

const BeZhasAIChat = () => {
    const [messages, setMessages] = useState([
        { 
            role: 'assistant', 
            content: '👋 ¡Hola! Soy la **Inteligencia Artificial de BeZhas**. Estoy conectado al SDK, MCP y Automation Engine. ¿En qué te puedo ayudar hoy? (ej. "*Dime el balance de mi wallet*" o "*¿Cuál es la estrategia de Gas recomendada?*")'
        }
    ]);
    const [inputQuery, setInputQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Auto-scroll al último mensaje
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputQuery.trim()) return;

        const newUserMsg = { role: 'user', content: inputQuery };
        const newMessagesContext = [...messages, newUserMsg];
        
        setMessages(newMessagesContext);
        setInputQuery('');
        setIsLoading(true);

        try {
            const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
            const response = await axios.post(`${API_URL}/api/ai/chat`, {
                // Solo enviamos los mensajes sin el system prompt (se inyecta en backend)
                messages: newMessagesContext.map(m => ({ role: m.role, content: m.content })) 
            });

            if (response.data && response.data.message) {
                setMessages(prev => [...prev, response.data.message]);
            }
        } catch (error) {
            console.error("Error AI Chat:", error);
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: '⚠️ Ocurrió un error al contactar al motor de IA central de BeZhas. Inténtalo de nuevo.' 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bezhas-ai-chat-container">
            <div className="chat-header">
                <div className="ai-avatar">🤖</div>
                <h3>BeZhas AI Central Agent</h3>
                <span className="status-badge">Online (MCP Linked)</span>
            </div>
            
            <div className="chat-history">
                {messages.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.role}`}>
                        {msg.role === 'assistant' && <div className="avatar">🤖</div>}
                        <div className="message-content">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                    </div>
                ))}
                
                {isLoading && (
                    <div className="chat-message assistant">
                        <div className="avatar">🤖</div>
                        <div className="message-content loading-indicator">
                            <span className="dot"></span><span className="dot"></span><span className="dot"></span>
                            <span className="loading-text text-xs text-gray-500 ml-2">Pensando y llamando herramientas SDK...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-area">
                <input 
                    type="text" 
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Consulta balances, estrategias de gas, simulaciones y más..."
                    disabled={isLoading}
                />
                <button type="submit" disabled={isLoading || !inputQuery.trim()}>
                    Enviar
                </button>
            </form>
        </div>
    );
};

export default BeZhasAIChat;
