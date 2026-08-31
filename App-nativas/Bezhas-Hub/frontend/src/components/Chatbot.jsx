import { useState } from 'react';
import http from '../services/http';

const Chatbot = () => {
    const [message, setMessage] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!message.trim() || isLoading) return;

        const newUserMessage = { sender: 'user', text: message };
        setChatHistory(prev => [...prev, newUserMessage]);
        setMessage('');
        setIsLoading(true);

        try {
            const { data } = await http.post('/api/chat', { message: newUserMessage.text });
            const aiResponse = { sender: 'ai', text: data.reply };
            setChatHistory(prev => [...prev, aiResponse]);
            setIsLoading(false);

        } catch (error) {
            console.error('Error al contactar la IA:', error);
            const errorResponse = { sender: 'ai', text: 'Lo siento, no pude procesar tu solicitud en este momento.' };
            setChatHistory(prev => [...prev, errorResponse]);
            setIsLoading(false);
        }
    };

    return (
        <div style={styles.chatContainer}>
            <div style={styles.chatHistory}>
                {chatHistory.map((msg, index) => (
                    <div key={index} style={msg.sender === 'user' ? styles.userMessage : styles.aiMessage}>
                        <p style={styles.messageText}>{msg.text}</p>
                    </div>
                ))}
                {isLoading && <div style={styles.loadingIndicator}>AI está pensando...</div>}
            </div>
            <form onSubmit={handleSendMessage} style={styles.chatForm}>
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escribe tu mensaje..."
                    style={styles.input}
                    disabled={isLoading}
                />
                <button type="submit" style={styles.button} disabled={isLoading}>
                    Enviar
                </button>
            </form>
        </div>
    );
};

// Estilos básicos para el componente
const styles = {
    chatContainer: {
        width: '400px',
        height: '600px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Arial, sans-serif',
        margin: '20px auto',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
    },
    chatHistory: {
        flex: 1,
        padding: '10px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    userMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#007bff',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '18px 18px 4px 18px',
        maxWidth: '80%',
    },
    aiMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#f1f1f1',
        color: 'black',
        padding: '8px 12px',
        borderRadius: '18px 18px 18px 4px',
        maxWidth: '80%',
    },
    messageText: {
        margin: 0,
    },
    loadingIndicator: {
        textAlign: 'center',
        color: '#888',
        fontStyle: 'italic',
    },
    chatForm: {
        display: 'flex',
        padding: '10px',
        borderTop: '1px solid #ccc',
    },
    input: {
        flex: 1,
        padding: '10px',
        borderRadius: '20px',
        border: '1px solid #ccc',
        marginRight: '10px',
    },
    button: {
        padding: '10px 20px',
        borderRadius: '20px',
        border: 'none',
        backgroundColor: '#007bff',
        color: 'white',
        cursor: 'pointer',
    },
};

export default Chatbot;
