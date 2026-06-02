import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminAccessButton() {
    const navigate = useNavigate();
    return (
        <button
            className="fixed bottom-4 right-4 z-50 bg-red-700 text-white px-4 py-2 rounded-full shadow-lg hover:bg-red-800 transition"
            onClick={() => navigate('/admin-login')}
            title="Acceso exclusivo admin"
        >
            Panel Admin
        </button>
    );
}
