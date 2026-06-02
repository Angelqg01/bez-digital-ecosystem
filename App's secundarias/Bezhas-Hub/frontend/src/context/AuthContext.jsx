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
    const navigate = useNavigate();
    const { data: walletClient } = useWalletClient();

    useEffect(() => {
        const stored = localStorage.getItem('auth');
        if (stored) {
            const { user, token } = JSON.parse(stored);
            setUser(user);
            setToken(token);
        }
    }, []);

    const login = async (email, password) => {
        setLoading(true);
        try {
            const data = await authService.login(email, password);
            if (data.requires2FA) {
                return data; // Devolvemos el estado 2FA para que el LoginPage muestre el input
            }
            setUser(data.user);
            setToken(data.token);
            localStorage.setItem('auth', JSON.stringify({ user: data.user, token: data.token }));
            navigate('/');
        } catch (err) {
            setUser(null);
            setToken(null);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const verifyLogin2FA = async (userId, tokenStr) => {
        setLoading(true);
        try {
            const data = await authService.verifyLogin2FA(userId, tokenStr);
            setUser(data.user);
            setToken(data.token);
            localStorage.setItem('auth', JSON.stringify({ user: data.user, token: data.token }));
            navigate('/');
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
            setUser(data.user);
            setToken(data.token);
            localStorage.setItem('auth', JSON.stringify({ user: data.user, token: data.token }));
            navigate('/');
        } catch (err) {
            console.error("Login failed:", err);
            setUser(null);
            setToken(null);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const register = async (userData) => {
        setLoading(true);
        try {
            const data = await authService.register(userData);
            setUser(data.user);
            setToken(data.token);
            localStorage.setItem('auth', JSON.stringify({ user: data.user, token: data.token }));
            navigate('/');
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
            setUser(data.user);
            setToken(data.token);
            localStorage.setItem('auth', JSON.stringify({ user: data.user, token: data.token }));
            navigate('/');
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

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('auth');
        navigate('/login');
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            loading,
            login,
            loginWithWallet,
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
