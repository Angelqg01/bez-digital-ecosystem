import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LinkedInCallback() {
    const [searchParams] = useSearchParams();
    const { loginWithLinkedIn } = useAuth();
    const navigate = useNavigate();
    const code = searchParams.get('code');
    const returnedState = searchParams.get('state');
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!code) {
            navigate('/login');
            return;
        }

        // El `state` viaja y vuelve para que un callback lanzado por otro origen
        // (CSRF) no pueda colarse como si fuera esta sesión — se guardó en
        // sessionStorage justo antes de salir hacia LinkedIn (ver OAuthButtons).
        const expectedState = sessionStorage.getItem('linkedin_oauth_state');
        sessionStorage.removeItem('linkedin_oauth_state');
        if (!expectedState || returnedState !== expectedState) {
            setError('El estado de la sesión de LinkedIn no coincide. Vuelve a intentarlo.');
            setTimeout(() => navigate('/login?error=linkedin_failed'), 2000);
            return;
        }

        // Debe ser byte a byte el mismo valor que se envió en la petición de
        // autorización — LinkedIn rechaza el intercambio si no coincide.
        const redirectUri = `${window.location.origin}/auth/linkedin/callback`;

        loginWithLinkedIn(code, redirectUri)
            .then(() => {
                // Success - navigate to feed
                setTimeout(() => navigate('/feed'), 500);
            })
            .catch((err) => {
                console.error('LinkedIn Login Error:', err);
                setError(err.message || 'Error en autenticación con LinkedIn');
                setTimeout(() => navigate('/login?error=linkedin_failed'), 2000);
            });
    }, [code, returnedState, loginWithLinkedIn, navigate]);

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
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <div className="absolute inset-0 w-16 h-16 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            </div>
            <h2 className="text-xl font-semibold text-white mt-4">Autenticando con LinkedIn...</h2>
            <p className="text-gray-400 text-sm mt-2">Por favor espera un momento</p>
        </div>
    );
}
