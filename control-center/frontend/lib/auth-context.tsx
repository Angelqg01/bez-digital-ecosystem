'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api from '@/lib/api';

export interface AuthUser {
    id: number;
    wallet_address: string | null;
    username: string | null;
    email?: string | null;
    role: string;
    avatar_url: string | null;
}

interface AuthState {
    user: AuthUser | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (address: string, signature: string, message: string) => Promise<void>;
    loginWithEmail: (email: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    logout: () => void;
    isLoginModalOpen: boolean;
    openLoginModal: () => void;
    closeLoginModal: () => void;
    loginWithEmailDemo: (usernameOrEmail: string, password: string) => Promise<void>;
    registerDemo: (username: string, email: string, role: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

    const openLoginModal = useCallback(() => setIsLoginModalOpen(true), []);
    const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

    useEffect(() => {
        const storedToken = localStorage.getItem('bezhas_token');
        const storedUser = localStorage.getItem('bezhas_user');

        if (!storedToken || !storedUser) {
            setIsLoading(false);
            return;
        }

        try {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        } catch {
            localStorage.removeItem('bezhas_token');
            localStorage.removeItem('bezhas_user');
            document.cookie = 'bezhas_token=; path=/; max-age=0';
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ── Helper: persist session ──────────────────────────────────────────
    const persistSession = useCallback((t: string, u: AuthUser) => {
        setToken(t);
        setUser(u);
        localStorage.setItem('bezhas_token', t);
        localStorage.setItem('bezhas_user', JSON.stringify(u));
        document.cookie = `bezhas_token=${t}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
    }, []);

    // ── Web3 Wallet Login ────────────────────────────────────────────────
    const login = useCallback(async (address: string, signature: string, message: string) => {
        const res = await api.post<{ success: boolean; token: string; user: AuthUser }>(
            '/auth/login',
            { address, signature, message },
        );
        persistSession(res.token, res.user);
    }, [persistSession]);

    // ── Email + Password Login ───────────────────────────────────────────
    const loginWithEmail = useCallback(async (email: string, password: string) => {
        const res = await fetch('/api/auth/login-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        persistSession(data.token, data.user);
    }, [persistSession]);

    // ── Register ─────────────────────────────────────────────────────────
    const register = useCallback(async (username: string, email: string, password: string) => {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        persistSession(data.token, data.user);
    }, [persistSession]);

    // ── Demo login / register bypass ──────────────────────────────────────
    const loginWithEmailDemo = useCallback(async (usernameOrEmail: string, password: string) => {
        try {
            await loginWithEmail(usernameOrEmail, password);
        } catch (err) {
            console.warn('⚠️ API login failed. Falling back to virtual session...', err);
            const mockToken = `mock-jwt-${Date.now()}`;
            const virtualUser: AuthUser = {
                id: Date.now(),
                wallet_address: null,
                username: usernameOrEmail.split('@')[0],
                email: usernameOrEmail.includes('@') ? usernameOrEmail : `${usernameOrEmail}@bezhas.net`,
                role: 'Inversor Especial',
                avatar_url: null
            };
            persistSession(mockToken, virtualUser);
        }
    }, [loginWithEmail, persistSession]);

    const registerDemo = useCallback(async (username: string, email: string, role: string, password: string) => {
        try {
            await register(username, email, password);
            const storedUser = localStorage.getItem('bezhas_user');
            if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                parsedUser.role = role;
                localStorage.setItem('bezhas_user', JSON.stringify(parsedUser));
                setUser(parsedUser);
            }
        } catch (err) {
            console.warn('⚠️ API register failed. Falling back to virtual session...', err);
            const mockToken = `mock-jwt-${Date.now()}`;
            const virtualUser: AuthUser = {
                id: Date.now(),
                wallet_address: null,
                username,
                email,
                role,
                avatar_url: null
            };
            persistSession(mockToken, virtualUser);
        }
    }, [register, persistSession]);

    // ── Logout ───────────────────────────────────────────────────────────
    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('bezhas_token');
        localStorage.removeItem('bezhas_user');
        document.cookie = 'bezhas_token=; path=/; max-age=0';
        document.cookie = 'bezhas_auth=; path=/; max-age=0';
    }, []);

    return (
        <AuthContext.Provider value={{
            user, token, isLoading,
            isAuthenticated: !!token,
            login, loginWithEmail, register, logout,
            isLoginModalOpen, openLoginModal, closeLoginModal,
            loginWithEmailDemo, registerDemo
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
