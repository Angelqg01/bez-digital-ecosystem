import React from 'react';

const ChatPageSimple = () => {
    console.log('🚀 ChatPage Simple renderizando - COMPONENTE CARGADO');

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(to bottom right, #1a1a2e, #16213e, #0f3460)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                textAlign: 'center',
                maxWidth: '600px',
                background: 'rgba(30, 30, 60, 0.5)',
                padding: '40px',
                borderRadius: '20px',
                border: '1px solid rgba(100, 100, 200, 0.3)'
            }}>
                <h1 style={{
                    fontSize: '3rem',
                    marginBottom: '20px',
                    background: 'linear-gradient(to right, #60a5fa, #a78bfa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    🤖 Chat BeZhas
                </h1>
                <p style={{ fontSize: '1.2rem', marginBottom: '20px' }}>
                    Sistema de Chat Integrado
                </p>
                <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px' }}>
                    <p style={{ fontSize: '1.2rem', color: '#4ade80', marginBottom: '10px' }}>
                        ✅ COMPONENTE FUNCIONANDO
                    </p>
                    <p style={{ fontSize: '0.9rem' }}>
                        Si ves este mensaje, la ruta del chat funciona correctamente. El problema era el componente ChatPage.jsx completo.
                    </p>
                    <p style={{ fontSize: '0.8rem', marginTop: '10px', color: '#94a3b8' }}>
                        Ruta: /chat | Componente: ChatPageSimple.jsx
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChatPageSimple;
