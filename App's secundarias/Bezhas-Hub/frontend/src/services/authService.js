import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export async function getNonce(walletAddress) {
    const res = await axios.get(`${API_URL}/auth/nonce`, {
        params: { address: walletAddress }
    });
    return res.data.nonce;
}

export async function login(email, password) {
    const res = await axios.post(`${API_URL}/auth/login-email`, { email, password });
    return res.data;
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

export async function loginWithLinkedIn(accessToken) {
    const res = await axios.post(`${API_URL}/auth/linkedin`, { accessToken });
    return res.data;
}

