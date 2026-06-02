import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Test simple component
function TestApp() {
    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontFamily: 'system-ui'
        }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅ BeZhas Funcionando</h1>
            <p style={{ fontSize: '1.5rem', opacity: 0.9 }}>Servidor Vite cargando correctamente</p>
            <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                <p>React: {React.version}</p>
                <p>Timestamp: {new Date().toLocaleString()}</p>
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <TestApp />
    </React.StrictMode>
);
