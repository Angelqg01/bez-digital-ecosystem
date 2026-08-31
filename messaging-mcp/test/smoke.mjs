/**
 * Smoke test del Messaging MCP.  Uso: pnpm test
 *
 * Tres bloques, de dentro afuera:
 *
 *   1. El cliente de Telegram, con `fetch` interceptado. Cubre la puerta de
 *      aprobación —que es la parte con consecuencias— y la política de
 *      reintentos.
 *   2. El registro de tools, contra un McpServer real por InMemoryTransport.
 *   3. El servidor entero como subproceso stdio, que es como lo va a lanzar el
 *      cliente MCP de verdad, contra un doble de la Bot API en localhost.
 *
 * Ninguno toca la red ni necesita un bot real.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { TelegramClient } from '../src/telegram.js';
import { registerMessagingTools } from '../src/tools.js';

const RAIZ = path.resolve(import.meta.dirname, '..');

let fallos = 0;
const check = (titulo, condicion, detalle = '') => {
    console.log(`${condicion ? '  ✅' : '  ❌'} ${titulo}${condicion ? '' : `  ${detalle}`}`);
    if (!condicion) fallos++;
};
const bloque = (t) => console.log(`\n▸ ${t}`);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════════════════
//  1. Cliente de Telegram
// ═══════════════════════════════════════════════════════════════════════════
bloque('Cliente de Telegram');

const fetchOriginal = globalThis.fetch;
const llamadas = [];
let guion = [];

globalThis.fetch = async (url, init) => {
    const metodo = String(url).split('/').pop();
    const cuerpo = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : {};
    llamadas.push({ metodo, cuerpo });

    // `guion` permite forzar una respuesta concreta (un 429, un 400) una vez.
    const paso = guion.find((g) => g.metodo === metodo && !g.usado);
    if (paso) { paso.usado = true; return paso.res; }

    const resultados = {
        getMe: { id: 7, username: 'bezhas_test_bot', first_name: 'Test' },
        sendMessage: { message_id: llamadas.length, chat: { id: cuerpo.chat_id } },
        getUpdates: [], deleteWebhook: true, answerCallbackQuery: true,
        editMessageReplyMarkup: true, getWebhookInfo: { url: '', pending_update_count: 0 },
    };
    return { ok: true, status: 200, json: async () => ({ ok: true, result: resultados[metodo] ?? true }) };
};

const ultimoCallbackData = () =>
    llamadas.filter((l) => l.metodo === 'sendMessage').at(-1)
        .cuerpo.reply_markup.inline_keyboard[0][0].callback_data;

const tg = new TelegramClient({ token: 'x', alertChatId: '-100', authorizedUsers: '55501,yoel' });
await tg.initialize(null, { polling: false });
check('initialize valida el token con getMe', llamadas.some((l) => l.metodo === 'getMe'));

// Aprobación de un usuario autorizado.
const pAprobar = tg.requestConfirmation({ question: '¿Liquidar 12.000 €?', timeoutMs: 5000 });
await esperar(20);
const cbData = ultimoCallbackData();
check('callback_data cabe en los 64 B que admite Telegram', cbData.startsWith('cfm:') && cbData.length <= 64, cbData);
tg.processUpdate({ callback_query: { id: 'q1', data: cbData, from: { id: 55501, username: 'yoel' } } });
const aprobado = await pAprobar;
check('un usuario autorizado aprueba', aprobado.status === 'APPROVED' && aprobado.answeredBy === '@yoel', JSON.stringify(aprobado));

// Un extraño NO puede aprobar: la petición debe caducar.
const pIntruso = tg.requestConfirmation({ question: '¿Borrar la base?', timeoutMs: 700 });
await esperar(20);
tg.processUpdate({ callback_query: { id: 'q2', data: ultimoCallbackData(), from: { id: 99999, username: 'intruso' } } });
check('un usuario NO autorizado no aprueba: caduca', (await pIntruso).status === 'TIMEOUT');
check('al intruso se le contesta el callback', llamadas.some((l) => l.metodo === 'answerCallbackQuery' && /autorizado/i.test(l.cuerpo.text || '')));
check('al caducar se retiran los botones', llamadas.some((l) => l.metodo === 'editMessageReplyMarkup'));

// Sin lista blanca no aprueba nadie. Es la propiedad que more importa aquí:
// una puerta de aprobación sin configurar debe estar cerrada, no abierta.
const tgSinLista = new TelegramClient({ token: 'x', alertChatId: '-1', authorizedUsers: '' });
await tgSinLista.initialize(null, { polling: false });
const pSinLista = tgSinLista.requestConfirmation({ question: '¿Sí?', timeoutMs: 600 });
await esperar(20);
tgSinLista.processUpdate({ callback_query: { id: 'q3', data: ultimoCallbackData(), from: { id: 55501, username: 'yoel' } } });
check('sin TELEGRAM_AUTHORIZED_USERS falla cerrado', (await pSinLista).status === 'TIMEOUT');

// Historial.
tg.processUpdate({ message: { message_id: 7, chat: { id: '-100' }, from: { username: 'yoel' }, text: 'estado', date: 1700000000 } });
await esperar(20);
const historial = await tg.getChatHistory('-100', 10);
check('registra entrada y salida en el historial',
    historial.count >= 2 && historial.messages.some((m) => m.direction === 'in' && m.text === 'estado'));

// Reintentos: 429 sí, 400 no.
guion = [{ metodo: 'sendMessage', usado: false, res: { ok: false, status: 429, json: async () => ({ ok: false, description: 'Too Many Requests', parameters: { retry_after: 0 } }) } }];
const antes429 = llamadas.filter((l) => l.metodo === 'sendMessage').length;
await tg.sendMessage('-100', 'reintento');
check('reintenta tras un 429 en vez de perder el mensaje',
    llamadas.filter((l) => l.metodo === 'sendMessage').length - antes429 === 2);

guion = [{ metodo: 'sendMessage', usado: false, res: { ok: false, status: 400, json: async () => ({ ok: false, description: 'chat not found' }) } }];
const antes400 = llamadas.filter((l) => l.metodo === 'sendMessage').length;
const error400 = await tg.sendMessage('-1', 'x').catch((e) => e.message);
check('un 400 falla de inmediato, sin reintentos inútiles',
    llamadas.filter((l) => l.metodo === 'sendMessage').length - antes400 === 1 && /chat not found/.test(error400));

tg.stop();
tgSinLista.stop();
globalThis.fetch = fetchOriginal;

// ═══════════════════════════════════════════════════════════════════════════
//  2. Registro de tools
// ═══════════════════════════════════════════════════════════════════════════
bloque('Registro de tools (MCP en memoria)');

const enviados = [];
const telegramDoble = {
    leadsChannelId: '-100LEADS',
    async sendMessage(chatId, text) { enviados.push({ chatId, text }); return { message_id: enviados.length, chat: { id: chatId || '-100' } }; },
    async sendDocument() { return { message_id: 99, document: { file_id: 'F1', file_size: 12 } }; },
    async requestConfirmation({ question }) { return { status: 'APPROVED', id: 'ab12', question, choice: 'APPROVED', label: '✅ Aprobar', answeredBy: '@yoel', waitedMs: 1200 }; },
    async getChatHistory(id) { return { chat_id: id || '-100', source: 'memoria', count: 1, messages: [{ direction: 'in', text: 'hola' }] }; },
    async getStatus() { return { bot: { username: 'bezhas_test_bot' }, mode: 'polling', redis: 'no disponible' }; },
};

const mcp = new McpServer({ name: 'bezhas-messaging', version: '1.0.0' });
registerMessagingTools(mcp, { telegram: telegramDoble });

const [ladoA, ladoB] = InMemoryTransport.createLinkedPair();
const clienteMem = new Client({ name: 'smoke', version: '1.0.0' });
await Promise.all([mcp.connect(ladoB), clienteMem.connect(ladoA)]);

const ESPERADAS = [
    'get_chat_history', 'get_telegram_status', 'request_human_confirmation',
    'send_lead_notification', 'send_system_alert', 'send_telegram_document',
    'send_telegram_message', 'send_trade_alert',
].sort();

const { tools } = await clienteMem.listTools();
check('tools/list devuelve las 8 herramientas', tools.length === 8, `(${tools.length})`);
check('los nombres son los que anuncia index.js',
    JSON.stringify(tools.map((t) => t.name).sort()) === JSON.stringify(ESPERADAS));
check('todas declaran inputSchema', tools.every((t) => t.inputSchema));
check('las de lectura están marcadas readOnly',
    tools.filter((t) => t.name.startsWith('get_')).every((t) => t.annotations?.readOnlyHint === true));

const alerta = await clienteMem.callTool({ name: 'send_trade_alert', arguments: { pair: 'BEZ/USDT', side: 'BUY', amount: 1500, price: '0.042', reason: 'Cruce de medias (12h)' } });
check('send_trade_alert responde sin error', !alerta.isError);
check('los valores van escapados para MarkdownV2',
    enviados.at(-1).text.includes('BEZ/USDT') && enviados.at(-1).text.includes('\\('));

const confirmacion = await clienteMem.callTool({ name: 'request_human_confirmation', arguments: { question: '¿Liquidar?', requested_by: 'agente-finanzas' } });
check('request_human_confirmation transmite el estado', !confirmacion.isError && confirmacion.content[0].text.includes('Aprobado'));

const severidadMala = await clienteMem.callTool({ name: 'send_system_alert', arguments: { severity: 'apocalipsis', component: 'api', message: 'x' } })
    .catch(() => ({ isError: true }));
check('rechaza una severidad fuera del enum', severidadMala.isError === true);

const docDuplicado = await clienteMem.callTool({ name: 'send_telegram_document', arguments: { filename: 'a.txt', url: 'https://ejemplo.com/a.txt', content: 'dup' } });
check('rechaza url y content a la vez', docDuplicado.isError === true);

telegramDoble.sendMessage = async () => { throw new Error('Telegram 400: chat not found'); };
const conError = await clienteMem.callTool({ name: 'send_telegram_message', arguments: { text: 'hola' } });
check('un fallo del cliente vuelve como isError, no como excepción',
    conError.isError === true && conError.content[0].text.includes('chat not found'));

await clienteMem.close();

// ═══════════════════════════════════════════════════════════════════════════
//  3. El servidor entero por stdio
// ═══════════════════════════════════════════════════════════════════════════
bloque('Servidor completo por stdio');

const recibidos = [];
const apiFalsa = createServer((req, res) => {
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; });
    req.on('end', () => {
        const metodo = req.url.split('/').pop();
        recibidos.push(metodo);
        const resultado = {
            getMe: { id: 7, username: 'bezhas_test_bot', first_name: 'Test' },
            sendMessage: { message_id: recibidos.length, chat: { id: '-100' } },
            getUpdates: [], deleteWebhook: true, getWebhookInfo: { url: '', pending_update_count: 0 },
        }[metodo] ?? true;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, result: resultado }));
    });
});
await new Promise((r) => apiFalsa.listen(0, '127.0.0.1', r));
const puertoFalso = apiFalsa.address().port;

const transporteStdio = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(RAIZ, 'src', 'index.js')],
    env: {
        ...process.env,
        TELEGRAM_API_BASE: `http://127.0.0.1:${puertoFalso}`,
        TELEGRAM_BOT_TOKEN: 'test:token',
        TELEGRAM_ALERT_CHAT_ID: '-100',
        TELEGRAM_AUTHORIZED_USERS: 'yoel',
        REDIS_URL: 'redis://127.0.0.1:1',  // caído a propósito: debe degradar, no morir
        NODE_ENV: 'production',            // ya NO puede decidir el transporte
    },
    stderr: 'pipe',
});

const clienteStdio = new Client({ name: 'smoke-stdio', version: '1.0.0' });
let stdioOk = true;
try {
    await clienteStdio.connect(transporteStdio);
    check('el cliente MCP conecta con index.js por stdio', true);

    const listado = await clienteStdio.listTools();
    check('tools/list funciona sobre stdio', listado.tools.length === 8, `(${listado.tools.length})`);

    const estadoTool = await clienteStdio.callTool({ name: 'get_telegram_status', arguments: {} });
    check('get_telegram_status responde', !estadoTool.isError);

    const estado = JSON.parse(estadoTool.content[0].text.split('\n').slice(1).join('\n'));
    // Regresión: con NODE_ENV=production el polling se apagaba y NINGUNA
    // confirmación humana podía resolverse.
    check('con NODE_ENV=production el modo sigue siendo polling', estado.mode === 'polling', String(estado.mode));
    check('sin Redis arranca igual (historial en memoria)', /no disponible/.test(estado.redis), String(estado.redis));

    const envio = await clienteStdio.callTool({ name: 'send_telegram_message', arguments: { text: 'hola desde stdio' } });
    check('send_telegram_message llega a la Bot API', !envio.isError && recibidos.includes('sendMessage'));
    check('el servidor hace polling (getUpdates)', recibidos.includes('getUpdates'));
    // Si alguna traza se colara por stdout, el protocolo se habría roto y
    // ninguna de las llamadas anteriores habría respondido.
    check('las trazas no contaminan stdout', !estadoTool.isError && !envio.isError);
} catch (err) {
    stdioOk = false;
    check('el bloque stdio se completa', false, err.message);
} finally {
    await clienteStdio.close().catch(() => {});
    apiFalsa.close();
}

console.log(fallos === 0 ? '\nSMOKE OK\n' : `\nSMOKE FALLIDO: ${fallos} comprobación(es)\n`);
process.exit(fallos === 0 && stdioOk ? 0 : 1);
