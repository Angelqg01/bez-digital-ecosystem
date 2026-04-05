import React, { useState } from 'react';
import http from '../../services/http';

export default function AdminAegisChatPanel() {
    const [messages, setMessages] = useState([
        { sender: 'ai', text: '¡Hola! Soy Aegis, tu asistente de IA. ¿En qué puedo ayudarte hoy?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;
        const userMsg = { sender: 'user', text: input };
        setMessages((msgs) => [...msgs, userMsg]);
        const userInput = input;
        setInput('');
        setLoading(true);
        try {
            // Send message to Aegis AI chat
            const res = await http.post('/api/chat/send', {
                chatId: 'ai-assistant', // AI assistant chat ID
                sender: 'admin',
                content: userInput,
                timestamp: Date.now()
            });

            // Simulate AI response (in real scenario this would come from AI service)
            setTimeout(() => {
                setMessages((msgs) => [...msgs, {
                    sender: 'ai',
                    text: `Aegis: He recibido tu mensaje "${userInput}". Esta es una respuesta demo. La integración completa con Aegis Control API está en desarrollo.`
                }]);
            }, 1000);

        } catch (e) {
            console.error('Error comunicando con Aegis:', e);
            setMessages((msgs) => [...msgs, {
                sender: 'ai',
                text: 'Error al comunicar con la IA. Verifica que el backend esté ejecutándose en el puerto 3001.'
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-800 rounded-xl p-4 shadow-xl max-w-2xl mx-auto">
            <h2 className="text-lg font-bold mb-2 text-white">Chat con IA (Aegis)</h2>
            <div className="h-64 overflow-y-auto bg-gray-900 rounded p-3 mb-3 text-sm text-gray-200">
                {messages.map((msg, i) => (
                    <div key={i} className={`mb-2 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`px-3 py-2 rounded-lg max-w-xs ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {loading && <div className="text-gray-400">Aegis está escribiendo...</div>}
            </div>
            <form onSubmit={sendMessage} className="flex gap-2">
                <input
                    className="flex-1 px-3 py-2 rounded bg-gray-700 text-white focus:outline-none"
                    placeholder="Escribe tu mensaje o comando..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    disabled={loading}
                />
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" disabled={loading}>
                    Enviar
                </button>
            </form>
        </div>
    );
}
