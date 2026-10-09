import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { useWalletClient } from 'wagmi';
import * as authService from '../services/authService';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(false);
    const [bezhasId, setBezhasId] = useState(null); // identidad ÚNICA BeZhas_ID
    const navigate = useNavigate();
    const { data: walletClient } = useWalletClient();

    useEffect(() => {
        const stored = localStorage.getItem('auth');
        if (stored) {
            const { user, token, bezhasId } = JSON.parse(stored);
            setUser(user);
            setToken(token);
            if (bezhasId) setBezhasId(bezhasId);
        }
    }, []);

    // BeZhas_ID único: una sola resolución para TODOS los métodos de acceso
    // (login email, wallet, OAuth…). Evita duplicar la lógica en cada método.
    useEffect(() => {
        if (!user || bezhasId) return;
        let cancel = false;
        authService.resolveIdentity({
            email: user.email,
            wallet: user.walletAddress || user.wallet,
            userId: user.id || user._id,
            displayName: user.name || user.username,
        }).then((res) => {
            if (cancel || !res?.bezhasId) return;
            setBezhasId(res.bezhasId);
            try {
                const stored = JSON.parse(localStorage.getItem('auth') || '{}');
                localStorage.setItem('auth', JSON.stringify({ ...stored, bezhasId: res.bezhasId }));
            } catch { /* noop */ }
        });
        return () => { cancel = true; };
    }, [user, bezhasId]);

    // `redirect: false` mantiene al usuario en la página actual (p. ej. al iniciar sesión desde el chat flotante).
    const startSession = (data, { redirect = true } = {}) => {
        // La API principal devuelve wallet_address; el resto de la UI lee walletAddress.
        if (data?.user && !data.user.walletAddress && data.user.wallet_address) {
            data = { ...data, user: { ...data.user, walletAddress: data.user.wallet_address } };
        }
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('auth', JSON.stringify({ user: data.user, token: data.token }));
        if (redirect) navigate('/');
        return data;
    };

    const login = async (email, password, { redirect = true } = {}) => {
        setLoading(true);
        try {
            const data = await authService.login(email, password);
            if (data.requires2FA) {
                return data; // Devolvemos el estado 2FA para que el LoginPage muestre el input
            }
            return startSession(data, { redirect });
        } catch (err) {
            setUser(null);
            setToken(null);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const verifyLogin2FA = async (userId, tokenStr, { redirect = true } = {}) => {
        setLoading(true);
        try {
            const data = await authService.verifyLogin2FA(userId, tokenStr);
            return startSession(data, { redirect });
        } catch (err) {
            setUser(null);
            setToken(null);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const loginWithWallet = async (walletAddress, { redirect = true } = {}) => {
        setLoading(true);
        try {
            let signer;

            if (walletClient) {
                const provider = new ethers.BrowserProvider(walletClient);
                signer = await provider.getSigner();
            } else if (window.ethereum) {
                // Fallback for legacy/direct injection
                const provider = new ethers.BrowserProvider(window.ethereum);
                signer = await provider.getSigner();
            } else {
                throw new Error('No wallet provider detected');
            }

            // 1. Get Nonce
            const nonce = await authService.getNonce(walletAddress);

            // 2. Sign the nonce
            const message = `Sign this message to verify your identity: ${nonce}`;
            const signature = await signer.signMessage(message);

            // 3. Send to backend for verification
            const data = await authService.loginWithWallet(walletAddress, signature, message);
            return startSession(data, { redirect });
        } catch (err) {
            console.error("Login failed:", err);
            setUser(null);
            setToken(null);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const register = async (userData, { redirect = true } = {}) => {
        setLoading(true);
        try {
            const data = await authService.register(userData);
            return startSession(data, { redirect });
        } catch (err) {
            setUser(null);
            setToken(null);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const registerWithWallet = async (walletAddress, additionalData = {}, { redirect = true } = {}) => {
        setLoading(true);
        try {
            let signer;

            if (walletClient) {
                const provider = new ethers.BrowserProvider(walletClient);
                signer = await provider.getSigner();
            } else if (window.ethereum) {
                const provider = new ethers.BrowserProvider(window.ethereum);
                signer = await provider.getSigner();
            } else {
                throw new Error('No wallet provider detected');
            }

            // Create a message to sign
            const message = `Registrarse en BeZhas\nAddress: ${walletAddress}\nTimestamp: ${Date.now()}`;
            const signature = await signer.signMessage(message);

            // Send to backend
            const data = await authService.registerWithWallet(walletAddress, signature, message, additionalData);
            return startSession(data, { redirect });
        } catch (err) {
            setUser(null);
            setToken(null);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const sendVerificationCode = async (email) => {
        try {
            await authService.sendVerificationCode(email);
        } catch (err) {
            throw err;
        }
    };

    const verifyCode = async (email, code) => {
        try {
            const result = await authService.verifyCode(email, code);
            return result;
        } catch (err) {
            throw err;
        }
    };

    const loginWithGoogle = async (idToken) => {
        setLoading(true);
        try {
            const data = await authService.loginWithGoogle(idToken);
            setUser(data.user);
            setToken(data.token);
            localStorage.setItem('auth', JSON.stringify({ user: data.user, token: data.token }));
            // Don't navigate here, let the component handle it
            return data;
        } catch (err) {
            setUser(null);
            setToken(null);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const loginWithGitHub = async (code) => {
        setLoading(true);
        try {
            const data = await authService.loginWithGitHub(code);
            setUser(data.user);
            setToken(data.token);
            localStorage.setItem('auth', JSON.stringify({ user: data.user, token: data.token }));
            // Don't navigate here, let the component handle it
            return data;
        } catch (err) {
            setUser(null);
            setToken(null);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const loginWithLinkedIn = async (code, redirectUri) => {
        setLoading(true);
        try {
            const data = await authService.loginWithLinkedIn(code, redirectUri);
            setUser(data.user);
            setToken(data.token);
            localStorage.setItem('auth', JSON.stringify({ user: data.user, token: data.token }));
            return data;
        } catch (err) {
            setUser(null);
            setToken(null);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    // Login si la wallet existe; si no, registro. UNA sola firma: el backend de registro sólo
    // comprueba que la firma corresponda a la dirección, así que se reutiliza la del login.
    // `signMessage(message)` lo inyecta quien llama (el chat usa el firmante de wagmi, que funciona
    // con cualquier conector, incluido WalletConnect); sin él se usa el proveedor del navegador.
    const loginOrRegisterWithWallet = async (walletAddress, { redirect = true, signMessage } = {}) => {
        setLoading(true);
        try {
            const sign = signMessage || (async (message) => {
                let signer;
                if (walletClient) signer = await new ethers.BrowserProvider(walletClient).getSigner();
                else if (window.ethereum) signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
                else throw new Error('No se detecta ninguna wallet para firmar. Vuelve a conectarla.');
                return signer.signMessage(message);
            });
            const challenge = await authService.getWalletChallenge(walletAddress);
            let data;
            if (challenge?.message && challenge?.nonce && String(challenge.message).includes(challenge.nonce)) {
                // API principal: se firma EXACTAMENTE el mensaje del servidor; el mismo endpoint crea la cuenta si no existe.
                const signature = await sign(challenge.message);
                data = await authService.loginWithWalletSigned(walletAddress, signature, challenge.message);
                const u = data.user || {};
                data = { ...data, user: { ...u, walletAddress: u.walletAddress || u.wallet_address, username: u.username || `User_${String(walletAddress).slice(2, 8)}` } };
            } else {
                // Backend del Hub: mensaje propio con el nonce; 404 = wallet sin cuenta y se registra con la misma firma.
                const message = `Sign this message to verify your identity: ${challenge?.nonce}`;
                const signature = await sign(message);
                try {
                    data = await authService.loginWithWallet(walletAddress, signature, message);
                } catch (err) {
                    if (err?.response?.status !== 404) throw err;
                    data = await authService.registerWithWallet(walletAddress, signature, message, {});
                }
            }
            return startSession(data, { redirect });
        } catch (err) {
            setUser(null);
            setToken(null);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const logout = ({ redirect = true } = {}) => {
        setUser(null);
        setToken(null);
        setBezhasId(null);
        localStorage.removeItem('auth');
        if (redirect) navigate('/login');
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            bezhasId,
            loading,
            login,
            loginWithWallet,
            loginOrRegisterWithWallet,
            loginWithGoogle,
            loginWithGitHub,
            loginWithLinkedIn,
            register,
            registerWithWallet,
            sendVerificationCode,
            verifyCode,
            verifyLogin2FA,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
