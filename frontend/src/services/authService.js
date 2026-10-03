import axios from 'axios';

import { API_BASE } from '../utils/apiBase';

// VITE_API_URL llega con o sin sufijo `/api` (en producción, sin él): se normaliza para no pedir `/auth/...` a secas.
const API_URL = `${API_BASE}/api`;

/** Nonce SIWE de un solo uso emitido por el servidor (ligado a la dirección). */
export async function getNonce(walletAddress) {
    const res = await axios.post(`${API_URL}/wallet-auth/nonce`, { address: walletAddress });
    return res.data.nonce;
}

export async function login(email, password) {
    const res = await axios.post(`${API_URL}/auth/login-email`, { email, password });
    return res.data;
}

export async function verifyLogin2FA(twoFactorToken, token) {
    const res = await axios.post(`${API_URL}/auth/verify-login-2fa`, { twoFactorToken, token });
    return res.data;
}

// Los tres flujos de wallet envían un mensaje SIWE firmado; la dirección la verifica el servidor.
export async function loginWithWallet(message, signature) {
    const res = await axios.post(`${API_URL}/auth/login-wallet`, { message, signature });
    return res.data;
}

export async function loginOrRegisterWithWallet(message, signature, referralCode) {
    const res = await axios.post(`${API_URL}/auth/login-or-register`, { message, signature, referralCode });
    return res.data;
}

export async function register(userData) {
    const res = await axios.post(`${API_URL}/auth/register-email`, userData);
    return res.data;
}

export async function registerWithWallet(message, signature, additionalData) {
    const res = await axios.post(`${API_URL}/auth/register-wallet`, { message, signature, ...additionalData });
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

export async function loginWithLinkedIn(accessToken) {
    const res = await axios.post(`${API_URL}/auth/linkedin`, { accessToken });
    return res.data;
}

