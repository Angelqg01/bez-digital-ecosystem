import React from 'react';

export default function RightSidebarTest() {
    return (
        <div style={{
            position: 'fixed',
            right: 0,
            top: 0,
            width: '300px',
            height: '100vh',
            backgroundColor: '#ff00ff',
            zIndex: 9999,
            padding: '20px',
            color: 'white',
            fontSize: '24px'
        }}>
            🎉 TEST SIDEBAR - SI VES ESTO, EL SISTEMA FUNCIONA! 🎉
        </div>
    );
}
