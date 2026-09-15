/**
 * Pruebas de la sincronización de contactos.
 *
 * Lo que se vigila aquí es que la agenda no salga en claro del proceso, y que
 * cuando algo falle la respuesta diga si se sincronizó o no. Un «error» sin esa
 * precisión deja al modelo sin saber si debe reintentar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'crypto';
import { createMockMcpServer } from '../helpers/mockMcpServer.js';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

import axios from 'axios';
import { registerSyncContactsMcp, syncContacts } from '../../tools/syncContactsMcp.js';

const post = axios.post as unknown as ReturnType<typeof vi.fn>;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const aceptado = (status = 202) => ({ status, data: {} });

beforeEach(() => {
    delete process.env.BEZHAS_API_URL;
});

afterEach(() => {
    delete process.env.BEZHAS_API_URL;
});

describe('sync_contacts', () => {
    it('envía hashes, nunca el correo ni el teléfono en claro', async () => {
        post.mockResolvedValueOnce(aceptado());

        await syncContacts([{ name: 'Ana', email: 'ana@example.com', phone: '+34600111222' }], 'jwt');

        const cuerpo = JSON.stringify(post.mock.calls[0][1]);
        expect(cuerpo).not.toContain('ana@example.com');
        expect(cuerpo).not.toContain('+34600111222');
        expect(cuerpo).toContain(sha256('ana@example.com'));
        expect(cuerpo).toContain(sha256('+34600111222'));
    });

    it('normaliza antes de resumir: mayúsculas y espacios dan el mismo hash', async () => {
        post.mockResolvedValueOnce(aceptado()).mockResolvedValueOnce(aceptado());

        await syncContacts([{ email: '  ANA@Example.COM ' }], 'jwt');
        await syncContacts([{ email: 'ana@example.com' }], 'jwt');

        expect(post.mock.calls[0][1].contacts[0].emailHash).toBe(post.mock.calls[1][1].contacts[0].emailHash);
    });

    it('manda el token del usuario y pone un plazo a la llamada', async () => {
        post.mockResolvedValueOnce(aceptado());

        await syncContacts([{ email: 'a@b.com' }], 'jwt-usuario');

        const opciones = post.mock.calls[0][2];
        expect(opciones.headers.Authorization).toBe('Bearer jwt-usuario');
        expect(opciones.timeout).toBeGreaterThan(0);
    });

    it('descarta los contactos sin email ni teléfono y lo dice', async () => {
        post.mockResolvedValueOnce(aceptado());

        const r = await syncContacts([{ email: 'a@b.com' }, { name: 'Sin datos' }], 'jwt');

        expect(post.mock.calls[0][1].contacts).toHaveLength(1);
        expect(r.content[0].text).toMatch(/1 descartado/);
    });

    it('no llama al backend si ningún contacto es utilizable', async () => {
        const r = await syncContacts([{ name: 'Solo nombre' }], 'jwt');

        expect(r.isError).toBe(true);
        expect(post).not.toHaveBeenCalled();
    });

    it('rechaza un lote desmesurado: eso es volcar una agenda, no sincronizarla', async () => {
        const agenda = Array.from({ length: 1001 }, (_, i) => ({ email: `u${i}@example.com` }));

        const r = await syncContacts(agenda, 'jwt');

        expect(r.isError).toBe(true);
        expect(r.content[0].text).toMatch(/máximo/i);
        expect(post).not.toHaveBeenCalled();
    });

    it('distingue un rechazo de autenticación de un fallo de red', async () => {
        post.mockResolvedValueOnce({ status: 401, data: {} });

        const r = await syncContacts([{ email: 'a@b.com' }], 'caducado');

        expect(r.isError).toBe(true);
        expect(r.content[0].text).toMatch(/401/);
        expect(r.content[0].text).toMatch(/caducado|falta|permiso/i);
    });

    it('al agotarse el plazo dice que no se ha sincronizado nada', async () => {
        post.mockRejectedValueOnce({ code: 'ECONNABORTED' });

        const r = await syncContacts([{ email: 'a@b.com' }], 'jwt');

        expect(r.isError).toBe(true);
        expect(r.content[0].text).toMatch(/No se ha sincronizado nada/);
    });

    it('exige el token del usuario', async () => {
        const r = await syncContacts([{ email: 'a@b.com' }], '');

        expect(r.isError).toBe(true);
        expect(post).not.toHaveBeenCalled();
    });

    it('rechaza una lista vacía', async () => {
        expect((await syncContacts([], 'jwt')).isError).toBe(true);
        expect(post).not.toHaveBeenCalled();
    });

    it('se registra con un tope de contactos en el esquema', () => {
        const { server, getToolNames, getSchema } = createMockMcpServer();
        registerSyncContactsMcp(server as any);

        expect(getToolNames()).toContain('sync_contacts');
        // El tope tiene que estar también en el esquema: si solo está en el
        // cuerpo de la función, el modelo lo descubre gastando la llamada.
        const esquema = getSchema('sync_contacts') as any;
        expect(esquema.contacts.safeParse(Array.from({ length: 1001 }, () => ({ email: 'a@b.com' }))).success).toBe(
            false,
        );
    });
});
