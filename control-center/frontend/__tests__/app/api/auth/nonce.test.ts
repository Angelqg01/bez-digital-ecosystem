/**
 * @jest-environment node
 */
import { GET } from '@/app/api/auth/nonce/route';

describe('GET /api/auth/nonce', () => {
    it('devuelve un nonce no vacío', async () => {
        const { nonce } = await (await GET()).json();

        expect(typeof nonce).toBe('string');
        expect(nonce.length).toBeGreaterThan(0);
    });

    it('nunca repite el mismo nonce, ni en llamadas seguidas dentro del mismo milisegundo', async () => {
        // El nonce mezcla Date.now() con un contador. Si se quedara sólo en la marca
        // de tiempo, dos peticiones simultáneas recibirían el mismo valor y una firma
        // capturada valdría para las dos.
        const nonces = await Promise.all(
            Array.from({ length: 50 }, async () => (await (await GET()).json()).nonce),
        );

        expect(new Set(nonces).size).toBe(nonces.length);
    });
});
