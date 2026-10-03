import { afterEach, describe, expect, test, vi } from 'vitest';

const load = async (url) => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', url);
    return import('./apiBase');
};

afterEach(() => vi.unstubAllEnvs());

describe('apiBase', () => {
    test.each([
        ['https://api.bezhas.com', 'https://api.bezhas.com'],
        ['https://api.bezhas.com/', 'https://api.bezhas.com'],
        ['https://api.bezhas.com/api', 'https://api.bezhas.com'],
        ['https://api.bezhas.com/api/', 'https://api.bezhas.com'],
        ['  http://localhost:5000  ', 'http://localhost:5000'],
        ['/api', ''],
        ['', ''],
    ])('VITE_API_URL=%j → base %j', async (input, base) => {
        const m = await load(input);
        expect(m.API_BASE).toBe(base);
    });

    test('apiUrl no duplica /api ni deja barras sueltas', async () => {
        const a = await load('https://api.bezhas.com/api');
        expect(a.apiUrl('/api/ai-workspace/chat')).toBe('https://api.bezhas.com/api/ai-workspace/chat');
        expect(a.apiUrl('api/x')).toBe('https://api.bezhas.com/api/x');
        const b = await load('');
        expect(b.apiUrl('/api/x')).toBe('/api/x');
    });
});
