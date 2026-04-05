import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';

export default function AdminLogin() {
    const navigate = useNavigate();
    const [step, setStep] = useState('LOGIN'); // LOGIN, SETUP_2FA, VERIFY_2FA
    const [tempToken, setTempToken] = useState('');
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [backupCodes, setBackupCodes] = useState([]);
    const [totpCode, setTotpCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/auth/oauth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: credentialResponse.credential })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Error en autenticación');
            
            setTempToken(data.tempToken);

            if (data.requiresSetup2FA) {
                // Fetch 2FA Setup data
                const setupRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/auth/2fa/setup`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${data.tempToken}` }
                });
                const setupData = await setupRes.json();
                if (!setupRes.ok) throw new Error(setupData.error || 'Error configurando 2FA');

                setQrCodeUrl(setupData.qrCodeUrl);
                setBackupCodes(setupData.backupCodes);
                setStep('SETUP_2FA');
            } else if (data.requires2FA) {
                setStep('VERIFY_2FA');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify2FA = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const bodyData = { code: totpCode };
            if (step === 'SETUP_2FA') {
                bodyData.backupCodes = backupCodes; // Pass backup codes back to save them on first setup
            }

            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/auth/2fa/verify`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tempToken}`
                },
                body: JSON.stringify(bodyData)
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Código 2FA inválido');

            // Success completely, we now have the final token
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('bezhas-jwt', data.token);
            navigate('/admin');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <GoogleOAuthProvider clientId={clientId}>
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
                <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md">
                    <div className="text-center mb-6">
                        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-2">
                            Panel Admin Segurizado
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            {step === 'LOGIN' && 'Inicia sesión con tu cuenta corporativa'}
                            {step === 'SETUP_2FA' && 'Configura el Autenticador (2FA)'}
                            {step === 'VERIFY_2FA' && 'Verificación de dos pasos'}
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-200">
                            {error}
                        </div>
                    )}

                    {step === 'LOGIN' && (
                        <div className="flex justify-center my-6">
                            {loading ? (
                                <p className="text-gray-500">Autenticando...</p>
                            ) : (
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess}
                                    onError={() => setError('Google Login Falló')}
                                    useOneTap={false}
                                />
                            )}
                        </div>
                    )}

                    {step === 'SETUP_2FA' && (
                        <div className="flex flex-col items-center space-y-4">
                            <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
                                Escanea este código QR con Google Authenticator o Authy.
                            </p>
                            {qrCodeUrl && <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48 border-4 border-white rounded-lg shadow-md" />}
                            
                            <div className="w-full text-left bg-gray-50 dark:bg-gray-700 p-3 rounded text-xs text-gray-800 dark:text-gray-200">
                                <p className="font-bold mb-1">Códigos de respaldo (Guárdalos):</p>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    {backupCodes.map((code, idx) => (
                                        <code key={idx} className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-center">{code}</code>
                                    ))}
                                </div>
                            </div>

                            <form onSubmit={handleVerify2FA} className="w-full mt-4">
                                <input
                                    type="text"
                                    placeholder="Código 2FA (6 dígitos)"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                                    value={totpCode}
                                    onChange={(e) => setTotpCode(e.target.value)}
                                    maxLength={6}
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={loading || totpCode.length < 6}
                                    className="w-full mt-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                                >
                                    {loading ? 'Verificando...' : 'Activar y Entrar'}
                                </button>
                            </form>
                        </div>
                    )}

                    {step === 'VERIFY_2FA' && (
                        <form onSubmit={handleVerify2FA} className="flex flex-col items-center space-y-4">
                            <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
                                Introduce el código numérico de tu App de autenticación o tu código de respaldo de 8 caracteres.
                            </p>
                            <input
                                type="text"
                                placeholder="Código 2FA o de respaldo"
                                className="w-full px-4 py-3 text-center tracking-widest text-xl border rounded-lg focus:ring-2 focus:ring-purple-500 bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                                value={totpCode}
                                onChange={(e) => setTotpCode(e.target.value)}
                                required
                            />
                            <button
                                type="submit"
                                disabled={loading || totpCode.length < 6}
                                className="w-full mt-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-lg transition-colors shadow-lg"
                            >
                                {loading ? 'Verificando...' : 'Verificar Acceso'}
                            </button>
                        </form>
                    )}

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => navigate('/')}
                            className="text-sm text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                        >
                            ← Volver al inicio de BeZhas
                        </button>
                    </div>
                </div>
            </div>
        </GoogleOAuthProvider>
    );
}
