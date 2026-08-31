import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import http from '../../services/http';

const BezhasGuideWidget = ({ currentUser }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const location = useLocation();

    // Mapeo de roles a emoji/iconos para visual feedback
    const roleIcons = {
        user: '👤',
        creator: '✍️',
        'nft-artist': '🎨',
        business: '💼',
        investor: '📈',
        enterprise: '🏢',
        developer: '👨‍💻',
        admin: '👑'
    };

    const roleLabels = {
        user: 'Usuario',
        creator: 'Creador',
        'nft-artist': 'Artista NFT',
        business: 'Business',
        investor: 'Inversor',
        enterprise: 'Enterprise',
        developer: 'Developer',
        admin: 'Super Admin'
    };

    // Mensaje de bienvenida inicial (solo se carga una vez)
    useEffect(() => {
        if (messages.length === 0) {
            const role = currentUser?.role || 'user';
            const emoji = roleIcons[role] || '🤖';
            const label = roleLabels[role] || 'Usuario';

            setMessages([{
                sender: 'ai',
                text: `${emoji} ¡Hola! Soy tu guía Bezhas en modo **${label.toUpperCase()}**. ¿En qué puedo ayudarte hoy?`
            }]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-scroll al último mensaje
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen]);

    const handleSend = useCallback(async () => {
        const trimmedInput = input.trim();
        if (!trimmedInput) return;

        const userMsg = { sender: 'user', text: trimmedInput };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await http.post('/api/ai/guide-chat', {
                message: userMsg.text,
                userRole: currentUser?.role || 'user',
                pageContext: location.pathname
            }, {
                timeout: 30000 // 30 second timeout
            });

            if (response.data?.reply) {
                setMessages(prev => [...prev, {
                    sender: 'ai',
                    text: response.data.reply
                }]);
            } else {
                throw new Error("No se recibió respuesta");
            }
        } catch (error) {
            console.error('Guide Chat Error:', error);
            const errorMsg = error.code === 'ECONNABORTED'
                ? "⏱️ Timeout: El servidor tardó demasiado en responder. Intenta de nuevo."
                : error.response?.status === 404
                    ? "⚠️ Endpoint no encontrado. Verifica que el backend esté actualizado."
                    : "⚠️ Error de conexión con el servicio de IA. Intenta de nuevo en unos segundos.";

            setMessages(prev => [...prev, {
                sender: 'ai',
                text: errorMsg
            }]);
        } finally {
            setIsLoading(false);
            // Focus input again after send
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [input, currentUser?.role, location.pathname]);

    const handleKeyPress = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    const toggleFullscreen = useCallback(() => {
        setIsFullscreen(prev => !prev);
    }, []);

    // Atajos de teclado
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Escape para cerrar fullscreen o chat
            if (e.key === 'Escape') {
                if (isFullscreen) {
                    setIsFullscreen(false);
                } else if (isOpen) {
                    setIsOpen(false);
                }
            }
            // Ctrl/Cmd + K para abrir/cerrar chat
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(!isOpen);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isFullscreen]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen && !isFullscreen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen, isFullscreen]);

    // Componente del Header - Memoizado para prevenir re-renders
    const ChatHeader = useMemo(() => (
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-4 flex justify-between items-center text-white shadow-md">
            <div className="flex items-center gap-2">
                <span className="text-lg">{roleIcons[currentUser?.role] || '🤖'}</span>
                <h3 className="font-bold text-sm">Bezhas AI Guide</h3>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded border border-white/10 uppercase tracking-wider">
                    {roleLabels[currentUser?.role] || 'GUEST'}
                </span>
                <button
                    onClick={toggleFullscreen}
                    className="hover:bg-white/10 p-1.5 rounded transition-colors"
                    title={isFullscreen ? "Minimizar (Esc)" : "Pantalla completa"}
                >
                    {isFullscreen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    ), [currentUser?.role, isFullscreen, toggleFullscreen]);

    // Componente del Chat Area - Memoizado para prevenir re-renders
    const ChatArea = useMemo(() => (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-800/50 custom-scrollbar">
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${msg.sender === 'user'
                        ? 'bg-violet-600 text-white rounded-br-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-sm'
                        }`}>
                        <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                    </div>
                </div>
            ))}
            {isLoading && (
                <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="flex gap-1">
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
    ), [messages, isLoading]);

    // Componente del Input - MEMOIZADO para prevenir pérdida de foco
    const ChatInput = useMemo(() => (
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            <div className="relative flex items-center">
                <input
                    type="text"
                    className="w-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-none rounded-full pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-violet-500 outline-none transition-all placeholder:text-slate-400"
                    placeholder="Pregunta sobre Bezhas..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                    ref={inputRef}
                />
                <button
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="absolute right-1 p-2 bg-violet-600 hover:bg-violet-700 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                    </svg>
                </button>
            </div>
        </div>
    ), [input, isLoading, handleSend, handleKeyPress]);

    return (
        <>
            {/* Modo Fullscreen - Overlay completo */}
            {isFullscreen && isOpen && (
                <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="absolute inset-4 md:inset-8 lg:inset-16 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
                        {ChatHeader}
                        {ChatArea}
                        {ChatInput}
                    </div>
                </div>
            )}

            {/* Modo Normal - Widget flotante */}
            <div className="fixed md:bottom-5 md:right-5 bottom-20 right-4 z-[9999] font-sans flex flex-col items-end">
                {isOpen && !isFullscreen && (
                    <div className="mb-4 w-80 md:w-96 h-[500px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden transition-all duration-300 animate-fade-in-up">
                        {ChatHeader}
                        {ChatArea}
                        {ChatInput}
                    </div>
                )}

                {/* Floating Toggle Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-all duration-300 hover:scale-110 active:scale-95 ${isOpen ? 'bg-slate-800 rotate-90' : 'bg-gradient-to-r from-violet-600 to-indigo-600'
                        }`}
                    aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat'}
                >
                    {isOpen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                        </svg>
                    )}
                </button>
            </div>

            <style>{`
                @keyframes fade-in-up {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.3s ease-out;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(148, 163, 184, 0.5);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(148, 163, 184, 0.7);
                }
            `}</style>
        </>
    );
};

export default BezhasGuideWidget;
