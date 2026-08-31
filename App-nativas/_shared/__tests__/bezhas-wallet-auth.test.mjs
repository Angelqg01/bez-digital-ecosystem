/**
 * bezhas-wallet-auth.test.mjs — login con wallet compartido por las SubApps.
 *
 * Dos regresiones que cubre este archivo:
 *
 *  1. siweLogin() llamaba a /api/auth/siwe/nonce y /api/auth/siwe/verify, que no
 *     existen en NINGÚN backend del ecosistema. El fetch fallaba siempre y el
 *     flujo caía al fallback demo, así que "iniciar sesión con wallet" nunca
 *     producía una sesión real — y como el fallback también pide firma, en la
 *     UI se veía idéntico a un login correcto.
 *  2. normalizeApiBase(): unas SubApps configuran VITE_API_URL con `/api` y
 *     otras sin él, y las rutas de este módulo ya lo incluyen, así que media
 *     docena pedía /api/api/auth/...
 *
 * ESM puro — Node 18+. Se ejecuta con:  node --test __tests__/
 */

import assert from 'assert';
import test from 'node:test';

// ─── Stubs del entorno de navegador, ANTES de importar el módulo ─────────────

const ADDRESS = '0x1111111111111111111111111111111111111111';
const CHAIN_ID_HEX = '0x89'; // Polygon

function installBrowserGlobals() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  globalThis.window = {
    location: { host: 'sphere.localhost:3020', origin: 'http://sphere.localhost:3020' },
    ethereum: makeWallet(),
    dispatchEvent: () => {},
    addEventListener: () => {},
  };
  globalThis.CustomEvent = class { constructor(t, o) { this.type = t; Object.assign(this, o); } };
  return store;
}

/** Wallet inyectada mínima: devuelve la cuenta y firma lo que le pidan. */
function makeWallet() {
  const signed = [];
  return {
    signed,
    isMetaMask: true,
    on: () => {},
    removeListener: () => {},
    async request({ method, params }) {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [ADDRESS];
        case 'eth_chainId':
          return CHAIN_ID_HEX;
        case 'personal_sign':
          signed.push(params[0]);
          return '0x' + 'ab'.repeat(65);
        default:
          return null;
      }
    },
  };
}

installBrowserGlobals();

const { siweLogin, normalizeApiBase, getSession, clearSession, shortAddress } =
  await import('../bezhas-wallet-auth.js');

// ─── normalizeApiBase ────────────────────────────────────────────────────────

test('normalizeApiBase deja la base en la raíz del servicio', () => {
  // Las rutas del módulo ya incluyen /api; si la base lo trae también, sale
  // /api/api/auth/... y todo devuelve 404 sin decir por qué.
  assert.equal(normalizeApiBase('http://localhost:3001/api'), 'http://localhost:3001');
  assert.equal(normalizeApiBase('http://localhost:3001/api/'), 'http://localhost:3001');
  assert.equal(normalizeApiBase('http://localhost:3001/'), 'http://localhost:3001');
  assert.equal(normalizeApiBase('http://localhost:3001'), 'http://localhost:3001');
  assert.equal(normalizeApiBase('https://api.bez.digital/api'), 'https://api.bez.digital');
});

test('normalizeApiBase conserva la base vacía (rutas relativas por proxy)', () => {
  // bez-wallet, prestige, edge y gas-tank proxyan /api en Vite y pasan ''.
  assert.equal(normalizeApiBase(''), '');
  assert.equal(normalizeApiBase(undefined), '');
  assert.equal(normalizeApiBase(null), '');
});

test('normalizeApiBase no destroza un path que sólo acaba en "api"', () => {
  // Sólo debe quitar el segmento /api final, no recortar dentro de una palabra.
  assert.equal(normalizeApiBase('https://x.com/superapi'), 'https://x.com/superapi');
});

// ─── siweLogin ───────────────────────────────────────────────────────────────

test('siweLogin usa las rutas reales de la API core y devuelve el JWT del servidor', async () => {
  clearSession();
  const calls = [];
  const SERVER_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.firma';

  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || 'GET' });
    if (String(url).includes('/api/auth/nonce')) {
      return jsonResponse({ success: true, nonce: 'deadbeef', message: 'BeZhas Login\nnonce: deadbeef' });
    }
    if (String(url).includes('/api/auth/login')) {
      return jsonResponse({
        success: true,
        token: SERVER_TOKEN,
        pqc: { sig: 'c2ln', pub: 'ab12', alg: 'ML-DSA-65' },
        user: { username: 'tester', role: 'user', bezhas_id: 'BZ-K4R7M2X9PQ' },
      });
    }
    throw new Error(`ruta inesperada: ${url}`);
  };

  const session = await siweLogin({ apiBase: 'http://localhost:3001/api' });

  // Las rutas que existen de verdad, y sin /api duplicado.
  assert.ok(calls[0].url.startsWith('http://localhost:3001/api/auth/nonce?address='),
    `nonce pedido a ${calls[0].url}`);
  assert.equal(calls[1].url, 'http://localhost:3001/api/auth/login');
  assert.equal(calls[1].method, 'POST');
  assert.ok(!calls.some(c => c.url.includes('/siwe/')), 'no debe usar las rutas /siwe/ inexistentes');

  // La sesión es la del servidor, no una fabricada aquí.
  assert.equal(session.authMethod, 'siwe');
  assert.equal(session.token, SERVER_TOKEN);
  assert.equal(session.bezhasId, 'BZ-K4R7M2X9PQ');
  assert.equal(session.user.username, 'tester');

  // Y queda persistida para el resto de SubApps (SSO por localStorage).
  assert.equal(localStorage.getItem('bezhas-jwt'), SERVER_TOKEN);
  assert.equal(getSession().token, SERVER_TOKEN);
});

test('siweLogin firma el mensaje que manda el servidor, no uno propio', async () => {
  clearSession();
  const SERVER_MESSAGE = 'BeZhas Login\naddress: ' + ADDRESS.toLowerCase() + '\nnonce: cafe1234';
  globalThis.window.ethereum = makeWallet();

  globalThis.fetch = async (url) => {
    if (String(url).includes('/api/auth/nonce')) {
      return jsonResponse({ nonce: 'cafe1234', message: SERVER_MESSAGE });
    }
    return jsonResponse({ token: 'tok', user: {} });
  };

  await siweLogin({ apiBase: 'http://localhost:3001' });

  // El backend extrae el nonce del mensaje recibido y lo consume: si el cliente
  // firmara un mensaje construido por su cuenta, la verificación fallaría.
  // personal_sign recibe el mensaje hex-encoded, así que hay que decodificarlo.
  assert.deepEqual(globalThis.window.ethereum.signed.map(hexToUtf8), [SERVER_MESSAGE]);
});

test('siweLogin cae a sesión DEMO cuando el backend no responde, y la etiqueta', async () => {
  clearSession();
  globalThis.window.ethereum = makeWallet();
  globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };

  const session = await siweLogin({ apiBase: 'http://localhost:3001' });

  assert.equal(session.authMethod, 'demo');
  assert.ok(session.token.startsWith('demo-'), 'el token demo debe ser distinguible');
  assert.equal(session.address, ADDRESS);
  // Sigue exigiendo una firma real: la UX es genuina aunque la sesión sea local.
  assert.equal(globalThis.window.ethereum.signed.length, 1);
});

test('siweLogin no acepta un login sin token como si fuera válido', async () => {
  clearSession();
  globalThis.window.ethereum = makeWallet();
  globalThis.fetch = async (url) => {
    if (String(url).includes('/api/auth/nonce')) return jsonResponse({ nonce: 'x', message: 'm' });
    return jsonResponse({ success: true });  // respuesta 200 pero sin token
  };

  const session = await siweLogin({ apiBase: 'http://localhost:3001' });
  assert.equal(session.authMethod, 'demo', 'un 200 sin token no es una sesión real');
});

test('shortAddress abrevia y tolera vacío', () => {
  assert.equal(shortAddress(ADDRESS), '0x1111…1111');
  assert.equal(shortAddress(''), '');
  assert.equal(shortAddress(undefined), '');
});

// ─── helpers ─────────────────────────────────────────────────────────────────

/** personal_sign recibe el mensaje como hex (EIP-191), no como texto. */
function hexToUtf8(hex) {
  return Buffer.from(String(hex).replace(/^0x/, ''), 'hex').toString('utf8');
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}
