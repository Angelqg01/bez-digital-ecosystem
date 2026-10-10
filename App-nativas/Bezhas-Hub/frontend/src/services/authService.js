import axios from 'axios';

import { API_BASE } from '../utils/apiBase';

// VITE_API_URL llega con o sin sufijo `/api` (en producción, sin él): se normaliza para no pedir `/auth/...` a secas.
const API_URL = `${API_BASE}/api`;

export async function getNonce(walletAddress) {
    const res = await axios.get(`${API_URL}/auth/nonce`, {
        params: { address: walletAddress }
    });
    return res.data.nonce;
}

/** Desafío completo del servidor ({nonce, message, ...}); la API principal exige firmar `message` tal cual. */
export async function getWalletChallenge(walletAddress) {
    const res = await axios.get(`${API_URL}/auth/nonce`, { params: { address: walletAddress } });
    return res.data;
}

/** Login de la API principal: valida la firma y crea la cuenta si la wallet es nueva. */
export async function loginWithWalletSigned(address, signature, message) {
    const res = await axios.post(`${API_URL}/auth/login`, { address, signature, message });
    return res.data;
}

/** Envía un código de un solo uso al email. La respuesta es la misma exista o no la cuenta. */
export async function forgotPassword(email) {
    const res = await axios.post(`${API_URL}/auth/forgot-password`, { email });
    return res.data;
}

export async function resetPassword(email, code, password) {
    const res = await axios.post(`${API_URL}/auth/reset-password`, { email, code, password });
    return res.data;
}

export async function login(email, password) {
    const res = await axios.post(`${API_URL}/auth/login-email`, { email, password });
    return res.data;
}

/**
 * Resuelve la identidad ÚNICA BeZhas_ID del usuario (email/wallet/OAuth → 1 id).
 * Capa adicional sobre la auth existente; no la reemplaza ni la duplica.
 * @returns {Promise<{bezhasId:string, identity:object}|null>}
 */
export async function resolveIdentity({ email, wallet, userId, displayName } = {}) {
    if (!email && !wallet && !userId) return null;
    try {
        const res = await axios.post(`${API_URL}/identity/resolve`, { email, wallet, userId, displayName });
        return res.data; // { bezhasId, created, merged, identity }
    } catch {
        return null; // identidad opcional: nunca bloquea el login
    }
}

export async function verifyLogin2FA(userId, token) {
    const res = await axios.post(`${API_URL}/auth/verify-login-2fa`, { userId, token });
    return res.data;
}

export async function loginWithWallet(walletAddress, signature, message) {
    const res = await axios.post(`${API_URL}/auth/login-wallet`, {
        walletAddress,
        signature,
        message
    });
    return res.data;
}

export async function register(userData) {
    const res = await axios.post(`${API_URL}/auth/register-email`, userData);
    return res.data;
}

export async function registerWithWallet(walletAddress, signature, message, additionalData) {
    const res = await axios.post(`${API_URL}/auth/register-wallet`, {
        walletAddress,
        signature,
        message,
        ...additionalData
    });
    return res.data;
}

export async function sendVerificationCode(email) {
    const res = await axios.post(`${API_URL}/auth/send-verification`, { email });
    return res.data;
}

export async function verifyCode(email, code) {
    const res = await axios.post(`${API_URL}/auth/verify-code`, { email, code });
    return res.data;
}

export async function loginWithGoogle(idToken) {
    const res = await axios.post(`${API_URL}/auth/google`, { idToken });
    return res.data;
}

export async function loginWithGitHub(code) {
    const res = await axios.post(`${API_URL}/auth/github`, { code });
    return res.data;
}

export async function loginWithLinkedIn(code, redirectUri) {
    const res = await axios.post(`${API_URL}/auth/linkedin`, { code, redirectUri });
    return res.data;
}

