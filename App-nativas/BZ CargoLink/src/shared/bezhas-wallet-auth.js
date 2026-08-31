/**
 * BeZhas Wallet Auth — Shared SubApp Login / Subscribe layer
 *
 * Dependency-free (uses only `window.ethereum` (EIP-1193) + `fetch`) so it can be
 * dropped into ANY SubApp regardless of whether it bundles `ethers`.
 *
 * Capabilities:
 *   1. connectWallet()          — request injected wallet accounts (MetaMask / bez-wallet)
 *   2. siweLogin()              — Sign-In With Ethereum (EIP-4361) against the Hub
 *                                 backend (/api/auth/siwe/nonce + /verify). First
 *                                 successful verify upserts the user → login == sign-up.
 *                                 Falls back to a clearly-labelled local DEMO session
 *                                 when the backend is unreachable (several SubApp
 *                                 backends are still mocked).
 *   3. subscribeWithBEZ()       — pay a subscription in BEZ-Coin (Polygon) via a raw
 *                                 ERC-20 transfer (no ethers needed).
 *   4. session helpers          — saveSession / getSession / clearSession. Also mirrors
 *                                 to `bezhas-jwt` + `bezhas-user` for cross-app SSO
 *                                 compatibility with existing AuthProviders.
 *
 * @version 1.0.0
 */

// ── Constants (from CLAUDE.md / project memory) ──────────────────────────────
export const BEZ_TOKEN_POLYGON = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8'; // BEZ V1 = moneda de cambio
export const BEZ_TREASURY = '0x89c23890c742d710265dD61be789C71dC8999b12';      // Treasury DAO
export const POLYGON_CHAIN_ID = 137;

const SESSION_KEY = 'bezhas_wallet_session';
const JWT_KEY = 'bezhas-jwt';   // read by existing AuthProviders (CargoLink / Prestige)
const USER_KEY = 'bezhas-user';

function envApiBase() {
  // Vite (import.meta.env) — guarded so this file is safe under Next/SSR too.
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return (
        import.meta.env.VITE_AUTH_API ||
        import.meta.env.VITE_HUB_API ||
        import.meta.env.VITE_API_URL ||
        'https://api.bez.digital'
      );
    }
  } catch { /* not a module env */ }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NEXT_PUBLIC_AUTH_API || process.env.NEXT_PUBLIC_API_URL || 'https://api.bez.digital';
  }
  return 'https://api.bez.digital';
}

// ── Low-level wallet helpers ─────────────────────────────────────────────────

export function isWalletAvailable() {
  return typeof window !== 'undefined' && !!window.ethereum;
}

function getInjected() {
  if (!isWalletAvailable()) {
    throw new Error('No se detectó ninguna wallet Web3. Instala MetaMask o usa bez-wallet.');
  }
  return window.ethereum;
}

/** Request accounts from the injected wallet. Returns { address, chainId }. */
export async function connectWallet() {
  const eth = getInjected();
  const accounts = await eth.request({ method: 'eth_requestAccounts' });
  if (!accounts || !accounts.length) throw new Error('No se autorizó ninguna cuenta.');
  const chainIdHex = await eth.request({ method: 'eth_chainId' });
  return { address: accounts[0], chainId: parseInt(chainIdHex, 16) };
}

/** Best-effort EIP-55 checksum. Uses ethers if the app bundles it, otherwise returns as-is. */
async function checksumAddress(address) {
  // @vite-ignore keeps bundlers from hard-failing in SubApps that don't ship ethers
  // (e.g. bezhas-pay-manager). Checksum is best-effort; falls back to the raw address.
  try {
    const ethers = await import(/* @vite-ignore */ 'ethers');
    return (ethers.getAddress || ethers.utils?.getAddress)(address);
  } catch {
    return address;
  }
}

function utf8ToHex(str) {
  let hex = '0x';
  for (const byte of new TextEncoder().encode(str)) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/** personal_sign of a UTF-8 message. Returns the signature hex. */
async function personalSign(address, message) {
  const eth = getInjected();
  return eth.request({ method: 'personal_sign', params: [utf8ToHex(message), address] });
}

/** Build an EIP-4361 (SIWE) message string — byte-identical to siwe's prepareMessage(). */
export function buildSiweMessage({ domain, address, statement, uri, chainId, nonce, issuedAt }) {
  return (
    `${domain} wants you to sign in with your Ethereum account:\n` +
    `${address}\n\n` +
    `${statement}\n\n` +
    `URI: ${uri}\n` +
    `Version: 1\n` +
    `Chain ID: ${chainId}\n` +
    `Nonce: ${nonce}\n` +
    `Issued At: ${issuedAt}`
  );
}

// ── Session storage ──────────────────────────────────────────────────────────

export function saveSession(session) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Mirror to the legacy keys consumed by existing AuthProviders for cross-app SSO.
  if (session.token) localStorage.setItem(JWT_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user || {
    username: shortAddress(session.address),
    role: session.authMethod === 'jwt' ? (session.user?.role || 'user') : 'Wallet (Demo)',
    walletAddress: session.address,
  }));
  // Notify in-app listeners (e.g. useMe) so role-gated UI updates without reload.
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('bezhas-auth-change', { detail: { type: 'login' } }));
  }
}

export function getSession() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(USER_KEY);
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    window.dispatchEvent(new CustomEvent('bezhas-auth-change', { detail: { type: 'logout' } }));
  }
}

export function shortAddress(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
}

// ── SIWE login / subscribe (account) ─────────────────────────────────────────

/** Normalize an API base so `${root}/api/auth/...` is correct whether the
 *  configured base already ends in `/api` (e.g. bez-energy's VITE_API_URL) or not. */
function apiRoot(apiBase) {
  return String(apiBase).replace(/\/api\/?$/, '').replace(/\/$/, '');
}

/**
 * Full Sign-In With Ethereum flow against the real BeZhas JWT auth
 * (`GET /api/auth/nonce` → sign the server message → `POST /api/auth/login`).
 * The returned token is a Bearer JWT carrying the user's **real DB role**
 * (user | operator | admin | …), which gates the operator/admin UI and the
 * backend's requireRole() endpoints. `mode` is cosmetic — the backend upserts
 * the user on first login.
 *
 * @returns {Promise<{address,chainId,authMethod:'jwt'|'demo',token,user}>}
 */
export async function siweLogin({
  apiBase = envApiBase(),
  statement = 'Sign in with Ethereum to the BeZhas Ecosystem.',
  appOrigin = 'subapp',
  mode = 'login',
} = {}) {
  const { chainId } = await connectWallet();
  const eth = getInjected();
  const [rawAddress] = await eth.request({ method: 'eth_accounts' });
  const address = await checksumAddress(rawAddress);
  const root = apiRoot(apiBase);

  try {
    // 1. Server-issued nonce + the exact message to sign (anti-replay).
    const nonceRes = await fetch(`${root}/api/auth/nonce?address=${encodeURIComponent(address)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!nonceRes.ok) throw new Error(`nonce ${nonceRes.status}`);
    const { message } = await nonceRes.json();
    if (!message) throw new Error('nonce response missing message');

    // 2. Sign the server message verbatim (backend extracts its nonce from it).
    const signature = await personalSign(rawAddress, message);

    // 3. Exchange for a JWT (upserts the user, returns its real role).
    const loginRes = await fetch(`${root}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, signature, message, appOrigin, mode }),
      signal: AbortSignal.timeout(12000),
    });
    if (!loginRes.ok) throw new Error(`login ${loginRes.status}`);
    const { token, user } = await loginRes.json();
    if (!token) throw new Error('login response missing token');

    const session = {
      address, chainId: chainId || POLYGON_CHAIN_ID,
      authMethod: 'jwt',
      token, // real Bearer JWT with role — read by api.js authHeaders()
      user: user || { username: shortAddress(address), role: 'user', walletAddress: address },
      signedAt: Date.now(),
    };
    saveSession(session);
    return session;
  } catch (err) {
    // DEMO fallback — backend unreachable / not deployed. We still require a real
    // wallet signature so the UX is genuine, but the session is local-only.
    console.warn('[bezhas-wallet-auth] JWT auth backend unavailable, using DEMO session:', err.message);
    const domain = typeof window !== 'undefined' ? window.location.host : 'app.bez.digital';
    const uri = typeof window !== 'undefined' ? window.location.origin : `https://${domain}`;
    const nonce = Math.random().toString(36).slice(2);
    const message = buildSiweMessage({
      domain, address, statement: `${statement} (demo)`, uri,
      chainId: chainId || POLYGON_CHAIN_ID, nonce, issuedAt: new Date().toISOString(),
    });
    const signature = await personalSign(rawAddress, message); // will throw if user rejects
    const session = {
      address, chainId: chainId || POLYGON_CHAIN_ID,
      authMethod: 'demo',
      token: `demo-${signature.slice(2, 18)}`,
      user: { username: shortAddress(address), role: 'Wallet (Demo)', walletAddress: address },
      signedAt: Date.now(),
    };
    saveSession(session);
    return session;
  }
}

/** Alias: "subscribe" (create account) is the same SIWE flow with mode=subscribe. */
export const siweSubscribe = (opts = {}) => siweLogin({ ...opts, mode: 'subscribe' });

// ── BEZ paid subscription ────────────────────────────────────────────────────

/** Parse a decimal BEZ amount into 18-decimal base units (BigInt), no ethers needed. */
function parseUnits18(amount) {
  const [whole, frac = ''] = String(amount).split('.');
  const fracPadded = (frac + '0'.repeat(18)).slice(0, 18);
  return BigInt(whole || '0') * 10n ** 18n + BigInt(fracPadded || '0');
}

function encodeErc20Transfer(to, amountBaseUnits) {
  const selector = 'a9059cbb';
  const addr = to.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const amt = amountBaseUnits.toString(16).padStart(64, '0');
  return '0x' + selector + addr + amt;
}

async function ensureChain(targetChainId) {
  const eth = getInjected();
  const current = parseInt(await eth.request({ method: 'eth_chainId' }), 16);
  if (current === targetChainId) return;
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x' + targetChainId.toString(16) }],
    });
  } catch (e) {
    if (e && e.code === 4902 && targetChainId === POLYGON_CHAIN_ID) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x89',
          chainName: 'Polygon',
          rpcUrls: ['https://polygon-rpc.com'],
          nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
          blockExplorerUrls: ['https://polygonscan.com'],
        }],
      });
    } else {
      throw e;
    }
  }
}

/**
 * Pay a subscription in BEZ-Coin (ERC-20 transfer on Polygon by default).
 * @returns {Promise<{ txHash: string, amount: string|number, to: string }>}
 */
export async function subscribeWithBEZ({
  amountBEZ,
  to = BEZ_TREASURY,
  tokenAddress = BEZ_TOKEN_POLYGON,
  chainId = POLYGON_CHAIN_ID,
} = {}) {
  if (!amountBEZ || Number(amountBEZ) <= 0) throw new Error('Importe de suscripción inválido.');
  const { address } = await connectWallet();
  await ensureChain(chainId);
  const data = encodeErc20Transfer(to, parseUnits18(amountBEZ));
  const eth = getInjected();
  const txHash = await eth.request({
    method: 'eth_sendTransaction',
    params: [{ from: address, to: tokenAddress, data }],
  });
  return { txHash, amount: amountBEZ, to };
}

// ── Event subscription helper (account / chain changes) ──────────────────────

export function onWalletEvent(handler) {
  if (!isWalletAvailable()) return () => {};
  const onAccounts = (accounts) => handler({ type: 'accountsChanged', accounts });
  const onChain = (chainId) => handler({ type: 'chainChanged', chainId: parseInt(chainId, 16) });
  window.ethereum.on?.('accountsChanged', onAccounts);
  window.ethereum.on?.('chainChanged', onChain);
  return () => {
    window.ethereum.removeListener?.('accountsChanged', onAccounts);
    window.ethereum.removeListener?.('chainChanged', onChain);
  };
}

export default {
  isWalletAvailable, connectWallet, siweLogin, siweSubscribe,
  subscribeWithBEZ, saveSession, getSession, clearSession,
  shortAddress, onWalletEvent, buildSiweMessage,
  BEZ_TOKEN_POLYGON, BEZ_TREASURY, POLYGON_CHAIN_ID,
};
