import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const ADMIN_WALLETS = [
    '0x52Df82920CBAE522880dD7657e43d1A754eD044E',
    '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3',
    '0x89c23890c742d710265dd61be789c71dc8999b12',
    '0xc0ec3b1fcb7dc0c764371919837c13b58cdc330a',
].map(addr => addr.toLowerCase());

function grantWalletAdminAccess(walletAddress, navigate) {
    localStorage.setItem('adminToken', 'demo-admin-token-123');
    localStorage.setItem('bezhas-jwt', 'demo-admin-token-123');
    localStorage.setItem('isAdmin', 'true');
    localStorage.setItem('adminWalletAddress', walletAddress);
    navigate('/admin');
}

export default function AdminLogin() {
    const navigate = useNavigate();
    const { address } = useAccount();
    const [step, setStep] = useState('LOGIN'); // LOGIN, SETUP_2FA, VERIFY_2FA
    const [tempToken, setTempToken] = useState('');
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [backupCodes, setBackupCodes] = useState([]);
    const [totpCode, setTotpCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isWalletLoging, setIsWalletLoging] = useState(false);

    const readApiResponse = async (response) => {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return response.json();
        }

        const text = await response.text();
        return { error: text || `Error HTTP ${response.status}` };
    };

    useEffect(() => {
        if (address && ADMIN_WALLETS.includes(address.toLowerCase())) {
            grantWalletAdminAccess(address, navigate);
        }
    }, [address, navigate]);

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/admin-auth/oauth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: credentialResponse.credential })
            });
            const data = await readApiResponse(res);
            
            if (!res.ok) throw new Error(data.error || 'Error en autenticación');
            
            setTempToken(data.tempToken);

            if (data.requiresSetup2FA) {
                // Fetch 2FA Setup data
                const setupRes = await fetch(`${API_BASE_URL}/admin-auth/2fa/setup`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${data.tempToken}` }
                });
                const setupData = await readApiResponse(setupRes);
                if (!setupRes.ok) throw new Error(setupData.error || 'Error configurando 2FA');

                setQrCodeUrl(setupData.qrCodeUrl);
                setBackupCodes(setupData.backupCodes);
                setStep('SETUP_2FA');
            } else if (data.requires2FA) {
                setStep('VERIFY_2FA');
            } else {
                // If 2FA is totally disabled for some reason
                localStorage.setItem('adminToken', data.token);
                localStorage.setItem('bezhas-jwt', data.token);
                navigate('/admin');
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

            const res = await fetch(`${API_BASE_URL}/admin-auth/2fa/verify`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tempToken}`
                },
                body: JSON.stringify(bodyData)
            });
            const data = await readApiResponse(res);

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

    const handleWalletLogin = async () => {
        setIsWalletLoging(true);
        setError('');
        try {
            if (!window.ethereum) throw new Error('MetaMask o Wallet Web3 no detectada. Por favor instala MetaMask.');

            const [walletAddress] = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (!walletAddress) throw new Error('No se pudo leer la dirección de la wallet.');

            if (ADMIN_WALLETS.includes(walletAddress.toLowerCase())) {
                grantWalletAdminAccess(walletAddress, navigate);
                return;
            }
            
            // Try to authenticate via WA
            const res = await fetch(`${API_BASE_URL}/admin-auth/wallet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress })
            });
            const data = await readApiResponse(res);
            
            if (!res.ok) throw new Error(data.error || 'Wallet no autorizada como Administrador.');

            setTempToken(data.tempToken);

            if (data.requiresSetup2FA) {
                const setupRes = await fetch(`${API_BASE_URL}/admin-auth/2fa/setup`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${data.tempToken}` }
                });
                const setupData = await readApiResponse(setupRes);
                if (!setupRes.ok) throw new Error(setupData.error || 'Error configurando 2FA');

                setQrCodeUrl(setupData.qrCodeUrl);
                setBackupCodes(setupData.backupCodes);
                setStep('SETUP_2FA');
            } else if (data.requires2FA) {
                setStep('VERIFY_2FA');
            } else {
                localStorage.setItem('adminToken', data.token);
                localStorage.setItem('bezhas-jwt', data.token);
                navigate('/admin');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsWalletLoging(false);
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
                        <div className="flex flex-col items-center justify-center space-y-4 my-6 w-full">
                            {loading ? (
                                <p className="text-gray-500">Autenticando...</p>
                            ) : (
                                <>
                                    <GoogleLogin
                                        onSuccess={handleGoogleSuccess}
                                        onError={() => setError('Google Login Falló')}
                                        useOneTap={false}
                                    />
                                    
                                    <div className="flex items-center w-full my-2">
                                        <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                                        <span className="px-3 text-sm text-gray-500 font-medium">O</span>
                                        <div className="flex-1 border-t border-gray-300 dark:border-gray-600"></div>
                                    </div>
                                    
                                    <button 
                                        onClick={handleWalletLogin}
                                        disabled={isWalletLoging}
                                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded shadow transition-all"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                                            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                                            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                                            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                                        </svg>
                                        {isWalletLoging ? 'Conectando...' : 'Iniciar Sesión con WA (Wallet)'}
                                    </button>
                                </>
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
