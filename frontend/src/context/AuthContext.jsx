import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { useWalletClient } from 'wagmi';
import * as authService from '../services/authService';
import { buildSiweMessage } from '../utils/siwe';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { data: walletClient } = useWalletClient();

    // Firma un mensaje SIWE con nonce del servidor. Devuelve { message, signature }.
    const signSiwe = async (walletAddress) => {
        let signer;
        if (walletClient) {
            signer = await new ethers.BrowserProvider(walletClient).getSigner();
        } else if (window.ethereum) {
            signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
        } else {
            throw new Error('No wallet provider detected');
        }
        const address = ethers.getAddress(walletAddress); // EIP-55
        const nonce = await authService.getNonce(address);
        const { chainId } = await signer.provider.getNetwork();
        const message = buildSiweMessage({
            domain: window.location.host,
            address,
            statement: 'Iniciar sesion en BeZhas. Esta firma no mueve fondos ni cuesta gas.',
            uri: window.location.origin,
            chainId: Number(chainId),
            nonce,
            issuedAt: new Date().toISOString(),
            expirationTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });
        return { message, signature: await signer.signMessage(message) };
    };

    // `redirect: false` mantiene al usuario en la página actual (p. ej. al iniciar sesión desde el chat flotante).
    const startSession = (data, { redirect = true } = {}) => {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('auth', JSON.stringify({ user: data.user, token: data.token }));
        if (redirect) navigate('/');
        return data;
    };

    useEffect(() => {
        const stored = localStorage.getItem('auth');
        if (stored) {
            const { user, token } = JSON.parse(stored);
            setUser(user);
            setToken(token);
        }
    }, []);

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

    const verifyLogin2FA = async (twoFactorToken, tokenStr, { redirect = true } = {}) => {
        setLoading(true);
        try {
            const data = await authService.verifyLogin2FA(twoFactorToken, tokenStr);
            return startSession(data, { redirect });
        } catch (err) {
            setUser(null);
            setToken(null);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const loginWithWallet = async (walletAddress) => {
        setLoading(true);
        try {
            const { message, signature } = await signSiwe(walletAddress);
            startSession(await authService.loginWithWallet(message, signature));
        } catch (err) {
            console.error("Login failed:", err);
            setUser(null);
            setToken(null);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    // Login si la wallet existe; si no, registro (misma firma SIWE).
    const loginOrRegisterWithWallet = async (walletAddress, { referralCode, redirect = true } = {}) => {
        setLoading(true);
        try {
            const { message, signature } = await signSiwe(walletAddress);
            return startSession(await authService.loginOrRegisterWithWallet(message, signature, referralCode), { redirect });
        } catch (err) {
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
            return startSession(await authService.register(userData), { redirect });
        } catch (err) {
            setUser(null);
            setToken(null);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const registerWithWallet = async (walletAddress, additionalData = {}) => {
        setLoading(true);
        try {
            const { message, signature } = await signSiwe(walletAddress);
            startSession(await authService.registerWithWallet(message, signature, additionalData));
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

    const loginWithLinkedIn = async (code) => {
        setLoading(true);
        try {
            const data = await authService.loginWithLinkedIn(code);
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

    const logout = ({ redirect = true } = {}) => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('auth');
        if (redirect) navigate('/login');
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
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
