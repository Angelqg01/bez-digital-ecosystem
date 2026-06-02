import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function GitHubCallback() {
    const [searchParams] = useSearchParams();
    const { loginWithGitHub } = useAuth();
    const navigate = useNavigate();
    const code = searchParams.get('code');
    const [error, setError] = useState(null);

    useEffect(() => {
        if (code) {
            loginWithGitHub(code)
                .then(() => {
                    // Success - navigate to feed
                    setTimeout(() => navigate('/feed'), 500);
                })
                .catch((err) => {
                    console.error('GitHub Login Error:', err);
                    setError(err.message || 'Error en autenticación con GitHub');
                    setTimeout(() => navigate('/login?error=github_failed'), 2000);
                });
        } else {
            navigate('/login');
        }
    }, [code, loginWithGitHub, navigate]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6 max-w-md">
                    <h2 className="text-xl font-semibold text-red-400 mb-2">Error de Autenticación</h2>
                    <p className="text-gray-300">{error}</p>
                    <p className="text-gray-400 text-sm mt-2">Redirigiendo a la página principal...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <div className="absolute inset-0 w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            </div>
            <h2 className="text-xl font-semibold text-white mt-4">Autenticando con GitHub...</h2>
            <p className="text-gray-400 text-sm mt-2">Por favor espera un momento</p>
        </div>
    );
}
