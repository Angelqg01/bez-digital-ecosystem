import axios from 'axios';
import { API_BASE, apiUrl } from '../utils/apiBase';

/** Cliente del AI Workspace. El token es el JWT de la sesión (AuthContext); nunca se envía la identidad en el cuerpo. */
export function createAiWorkspaceClient(getToken) {
    const client = axios.create({ baseURL: API_BASE, headers: { 'Content-Type': 'application/json' } });
    client.interceptors.request.use((config) => {
        const token = getToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    });
    return client;
}

export const streamUrl = () => apiUrl('/api/ai-workspace/chat/stream');
