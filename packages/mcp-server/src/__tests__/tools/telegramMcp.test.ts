/**
 * Pruebas del canal de aviso al administrador.
 *
 * Lo que se comprueba aquí no es el formato del mensaje, es que el aviso
 * LLEGUE. Un aviso de seguridad que se pierde es peor que no tenerlo, porque
 * nadie sabe que falta.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockMcpServer } from '../helpers/mockMcpServer.js';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

import axios from 'axios';
import { registerTelegramMcp, sendTelegramMessage } from '../../tools/telegramMcp.js';

const post = axios.post as unknown as ReturnType<typeof vi.fn>;

const TOKEN = '123456:ABC-DEF_token_de_prueba';
const CHAT = '-1001234567890';

/** Error tal y como lo levanta axios cuando Telegram no sabe leer el Markdown. */
const errorDeFormato = () => ({
    response: {
        status: 400,
        data: { ok: false, description: "Bad Request: can't parse entities: Can't find end of the entity" },
    },
    message: 'Request failed with status code 400',
});

const entregado = (id = 42) => ({ data: { ok: true, result: { message_id: id } } });

beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = TOKEN;
    process.env.TELEGRAM_SECURITY_CHAT_ID = CHAT;
});

afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_SECURITY_CHAT_ID;
});

describe('send_telegram_message', () => {
    it('entrega un mensaje normal con formato Markdown', async () => {
        post.mockResolvedValueOnce(entregado(7));

        const r = await sendTelegramMessage({ message: 'Todo en orden', severity: 'low' });

        expect(r.isError).toBeUndefined();
        expect(post).toHaveBeenCalledTimes(1);
        expect(post.mock.calls[0][1].parse_mode).toBe('Markdown');
        expect(r.content[0].text).toContain('7');
    });

    it('marca los mensajes críticos', async () => {
        post.mockResolvedValueOnce(entregado());

        await sendTelegramMessage({ message: 'Fuga de fondos', severity: 'critical' });

        expect(post.mock.calls[0][1].text).toContain('CRÍTICO');
    });

    it('reintenta en texto plano cuando Telegram rechaza el Markdown', async () => {
        // El caso real: una alerta que lleva dentro un nombre de variable con
        // guion bajo. Telegram devolvía 400 y el aviso se perdía entero.
        post.mockRejectedValueOnce(errorDeFormato()).mockResolvedValueOnce(entregado(99));

        const original = 'Fallo en max_gas_price: el valor _no_ cuadra con *nada';
        const r = await sendTelegramMessage({ message: original, severity: 'critical' });

        expect(r.isError).toBeUndefined();
        expect(post).toHaveBeenCalledTimes(2);

        const segundoIntento = post.mock.calls[1][1];
        expect(segundoIntento.parse_mode).toBeUndefined();
        // El texto original va entero, sin recortar ni escapar nada para que
        // pase: lo que se pierde es el formato, no el contenido.
        expect(segundoIntento.text).toContain(original);
        expect(r.content[0].text).toMatch(/texto plano/i);
    });

    it('no reintenta cuando el fallo no es de formato', async () => {
        // Un token inválido no se arregla quitando el Markdown; reintentar solo
        // duplicaría la llamada contra la API.
        post.mockRejectedValueOnce({ response: { status: 401, data: { description: 'Unauthorized' } } });

        const r = await sendTelegramMessage({ message: 'hola' });

        expect(post).toHaveBeenCalledTimes(1);
        expect(r.isError).toBe(true);
        expect(r.content[0].text).toMatch(/401/);
    });

    it('explica un 403 sin dejar que parezca un problema de red', async () => {
        post.mockRejectedValueOnce({ response: { status: 403, data: { description: 'Forbidden: bot blocked' } } });

        const r = await sendTelegramMessage({ message: 'hola' });

        expect(r.isError).toBe(true);
        expect(r.content[0].text).toMatch(/permiso/i);
    });

    it('nunca devuelve el token del bot en un mensaje de error', async () => {
        // El token va dentro de la URL, así que un error que la incluya lo
        // filtraría al modelo y de ahí al registro.
        post.mockRejectedValueOnce({ message: `connect ECONNREFUSED https://api.telegram.org/bot${TOKEN}/sendMessage` });

        const r = await sendTelegramMessage({ message: 'hola' });

        expect(r.content[0].text).not.toContain(TOKEN);
        expect(r.content[0].text).toContain('[token redactado]');
    });

    it('dice que el aviso NO se ha entregado cuando falla', async () => {
        post.mockRejectedValueOnce({ code: 'ECONNABORTED' });

        const r = await sendTelegramMessage({ message: 'urgente', severity: 'critical' });

        expect(r.isError).toBe(true);
        expect(r.content[0].text).toMatch(/NO se ha entregado/);
    });

    it('avisa de que faltan credenciales en vez de fallar callando', async () => {
        delete process.env.TELEGRAM_BOT_TOKEN;

        const r = await sendTelegramMessage({ message: 'hola' });

        expect(r.isError).toBe(true);
        expect(r.content[0].text).toContain('TELEGRAM_BOT_TOKEN');
        expect(post).not.toHaveBeenCalled();
    });

    it('lee las credenciales en cada llamada, no al importar el módulo', async () => {
        // Leídas al importar quedan congeladas antes de que nadie haya podido
        // configurarlas, y no hay forma de comprobarlo.
        delete process.env.TELEGRAM_SECURITY_CHAT_ID;
        expect((await sendTelegramMessage({ message: 'x' })).isError).toBe(true);

        process.env.TELEGRAM_SECURITY_CHAT_ID = CHAT;
        post.mockResolvedValueOnce(entregado());
        expect((await sendTelegramMessage({ message: 'x' })).isError).toBeUndefined();
    });

    it('rechaza un mensaje vacío sin gastar una llamada', async () => {
        const r = await sendTelegramMessage({ message: '   ' });

        expect(r.isError).toBe(true);
        expect(post).not.toHaveBeenCalled();
    });

    it('se registra en el servidor MCP', () => {
        const { server, getToolNames } = createMockMcpServer();
        registerTelegramMcp(server as any);

        expect(getToolNames()).toContain('send_telegram_message');
    });
});
