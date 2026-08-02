/**
 * BezhasAuthProvider — sesión REAL compartida por todas las SubApps.
 *
 * Sustituye a los AuthProvider copiados app por app, varios de los cuales
 * fabricaban un `mock-jwt-${Date.now()}` en login/registro: cualquiera entraba
 * escribiendo cualquier cosa, el token no lo firmaba nadie y el backend lo
 * rechazaba, así que la app "autenticada" no podía llamar a ningún endpoint.
 * Aquí no hay tokens falsos: email y wallet van contra la API core y el JWT que
 * se guarda es el que firma el servidor.
 *
 * NO depende de react-router. Las SubApps montan el <BrowserRouter> en sitios
 * distintos (unas en main.jsx, otras dentro de App.jsx) y un provider que usara
 * useLocation reventaría en la mitad de ellas; el token SSO se lee de
 * window.location y se limpia con history.replaceState.
 *
 * Uso mínimo (en main.jsx, envolviendo <App/>):
 *   <BezhasAuthProvider appName="BZ Sphere" accent="#00e5ff">
 *     <App />
 *   </BezhasAuthProvider>
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  siweLogin, subscribeWithBEZ, shortAddress,
  getSession, saveSession, clearSession, normalizeApiBase,
} from './bezhas-wallet-auth.js';

const JWT_KEY = 'bezhas-jwt';
const USER_KEY = 'bezhas-user';
const BEZHAS_ID_KEY = 'bezhas-id';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() fuera de <BezhasAuthProvider>.');
  return ctx;
}

function envVar(name, fallback) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
      return import.meta.env[name];
    }
  } catch { /* no es un entorno de módulos Vite */ }
  return fallback;
}

/** API core: login/registro fiat y wallet. */
function coreApiBase() {
  return normalizeApiBase(
    envVar('VITE_API_URL') || envVar('VITE_AUTH_API') || 'https://api.bez.digital',
  );
}

/**
 * Hub: resolución del BeZhas_ID canónico. Si la app no declara VITE_HUB_API cae
 * al mismo base que la API core — incluido el que llegue por prop, para que una
 * SubApp que va por proxy de Vite (apiBase='') no se salte el proxy justo aquí.
 */
function hubApiBase(coreFallback) {
  const hub = envVar('VITE_HUB_API');
  if (hub) return normalizeApiBase(hub);
  return coreFallback != null ? coreFallback : normalizeApiBase(coreApiBase());
}

async function postJson(url, body, timeoutMs = 12000) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Un email a partir de lo que el usuario haya escrito (permite usuario suelto). */
function asEmail(input) {
  const v = String(input || '').trim();
  return v.includes('@') ? v.toLowerCase() : `${v.toLowerCase()}@bezhas.net`;
}

export function BezhasAuthProvider({
  children,
  appName = 'BeZhas',
  accent = '#00D4AA',
  apiBase,
  subscribePlan = null,
}) {
  // `apiBase=''` es legítimo: significa "rutas relativas", que es lo que usan
  // las SubApps con proxy de Vite. Por eso se compara con undefined y no con
  // un booleano, que lo convertiría en el dominio de producción.
  const CORE = normalizeApiBase(apiBase !== undefined ? apiBase : coreApiBase());

  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [bezhasId, setBezhasId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  /**
   * Pide al Hub el BeZhas_ID canónico (BZ-XXXXXXXXXX) y lo persiste. Es lo que
   * une la identidad entre SubApps: sin esto, cada app conoce al usuario solo
   * por su email o su wallet y no puede cruzarlo con las demás.
   * Fallo silencioso: no tener el ID no debe impedir usar la app.
   */
  const resolveBezhasId = useCallback(async (session) => {
    const payload = {};
    if (session?.email) payload.email = session.email;
    if (session?.walletAddress) payload.wallet = session.walletAddress;
    if (session?.userId) payload.userId = session.userId;
    if (!Object.keys(payload).length) return null;

    try {
      const data = await postJson(`${hubApiBase(CORE)}/api/identity/resolve`, payload, 8000);
      if (data.bezhasId) {
        localStorage.setItem(BEZHAS_ID_KEY, data.bezhasId);
        setBezhasId(data.bezhasId);
        return data.bezhasId;
      }
    } catch { /* el Hub puede no estar desplegado todavía */ }
    return null;
  }, [CORE]);

  /** Persiste una sesión real: JWT firmado por el servidor + usuario de BD. */
  const applySession = useCallback((jwt, backendUser, extra = {}) => {
    localStorage.setItem(JWT_KEY, jwt);
    localStorage.setItem(USER_KEY, JSON.stringify(backendUser));
    setToken(jwt);
    setUser(backendUser);
    setModalOpen(false);

    if (extra.pqc || extra.address) {
      saveSession({
        token: jwt,
        address: extra.address || backendUser.walletAddress || null,
        authMethod: extra.authMethod || 'jwt',
        pqc: extra.pqc || null,
        user: backendUser,
        signedAt: Date.now(),
      });
    }

    const canonical = backendUser.bezhas_id || backendUser.bezhasId;
    if (canonical) {
      localStorage.setItem(BEZHAS_ID_KEY, canonical);
      setBezhasId(canonical);
    } else {
      resolveBezhasId({
        email: backendUser.email,
        walletAddress: extra.address || backendUser.walletAddress,
        userId: backendUser.id,
      });
    }
  }, [resolveBezhasId]);

  // Arranque: token por SSO en la URL → localStorage → sesión de wallet previa.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const ssoToken = url.searchParams.get('token');

      if (ssoToken) {
        localStorage.setItem(JWT_KEY, ssoToken);
        setToken(ssoToken);

        // El Hub manda el usuario en el mismo query cuando puede; si no, se
        // deja un placeholder que /identity/resolve completará.
        const ssoUser = (() => {
          try { return JSON.parse(decodeURIComponent(url.searchParams.get('user') || '')); }
          catch { return null; }
        })() || { username: 'Sesión BeZhas', role: 'user' };

        localStorage.setItem(USER_KEY, JSON.stringify(ssoUser));
        setUser(ssoUser);

        // Quitar el token de la barra de direcciones: si no, queda en el
        // historial, en los Referer y en cualquier captura de pantalla.
        url.searchParams.delete('token');
        url.searchParams.delete('user');
        window.history.replaceState({}, '', url.pathname + (url.search || '') + url.hash);

        const storedId = localStorage.getItem(BEZHAS_ID_KEY);
        if (storedId) setBezhasId(storedId);
        else resolveBezhasId({ email: ssoUser.email, walletAddress: ssoUser.walletAddress, userId: ssoUser.id });

        setIsLoading(false);
        return;
      }

      const localToken = localStorage.getItem(JWT_KEY);
      if (localToken) {
        setToken(localToken);
        try { setUser(JSON.parse(localStorage.getItem(USER_KEY) || 'null')); } catch { setUser(null); }
        const storedId = localStorage.getItem(BEZHAS_ID_KEY);
        if (storedId) setBezhasId(storedId);
      } else {
        // Sesión de wallet guardada por WalletAuthButton sin pasar por aquí.
        const walletSession = getSession();
        if (walletSession?.token) {
          setToken(walletSession.token);
          setUser(walletSession.user || null);
          if (walletSession.bezhasId) setBezhasId(walletSession.bezhasId);
        }
      }
    } catch { /* localStorage bloqueado (modo incógnito estricto) */ }
    setIsLoading(false);
  }, [resolveBezhasId]);

  // ── Acciones ──────────────────────────────────────────────────────────────

  const login = useCallback(async (usernameOrEmail, password) => {
    const email = asEmail(usernameOrEmail);
    const data = await postJson(`${CORE}/api/auth/fiat/login`, { email, password });
    if (!data.token) throw new Error('El servidor no devolvió sesión.');
    applySession(data.token, data.user || { username: email.split('@')[0], role: 'user', email }, { pqc: data.pqc });
    return data;
  }, [CORE, applySession]);

  const register = useCallback(async (usernameOrEmail, password, extra = {}) => {
    const email = asEmail(usernameOrEmail);
    const data = await postJson(`${CORE}/api/auth/fiat/register`, {
      email,
      password,
      username: extra.username || email.split('@')[0],
    });
    if (!data.token) throw new Error('El servidor no devolvió sesión.');
    applySession(data.token, data.user || { username: email.split('@')[0], role: 'user', email }, { pqc: data.pqc });
    return data;
  }, [CORE, applySession]);

  const loginWithWallet = useCallback(async (mode = 'login') => {
    const session = await siweLogin({
      apiBase: CORE,
      statement: `Inicia sesión en ${appName} con tu wallet.`,
      appOrigin: appName,
      mode,
    });
    const walletUser = session.user || {
      username: shortAddress(session.address),
      role: session.authMethod === 'siwe' ? 'Wallet Verified' : 'Wallet (Demo)',
      walletAddress: session.address,
    };
    applySession(session.token, walletUser, {
      address: session.address,
      pqc: session.pqc,
      authMethod: session.authMethod,
    });
    return session;
  }, [CORE, appName, applySession]);

  const subscribeWithBEZPlan = useCallback(
    async (amountBEZ = subscribePlan?.amountBEZ || 50) => subscribeWithBEZ({ amountBEZ }),
    [subscribePlan],
  );

  const logout = useCallback(() => {
    clearSession();
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(BEZHAS_ID_KEY);
    setToken(null);
    setUser(null);
    setBezhasId(null);
  }, []);

  /** Cabeceras para llamar a la API con la sesión actual. */
  const authHeaders = useCallback(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const value = useMemo(() => ({
    token, user, bezhasId, isLoading,
    isAuthenticated: Boolean(token),
    appName, accent, subscribePlan,
    login, register, loginWithWallet, subscribeWithBEZPlan, logout, authHeaders,
    isLoginModalOpen: modalOpen,
    openLoginModal: () => setModalOpen(true),
    closeLoginModal: () => setModalOpen(false),
  }), [token, user, bezhasId, isLoading, appName, accent, subscribePlan,
    login, register, loginWithWallet, subscribeWithBEZPlan, logout, authHeaders, modalOpen]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {modalOpen && <AuthModal onClose={() => setModalOpen(false)} />}
    </AuthContext.Provider>
  );
}

// ── UI ──────────────────────────────────────────────────────────────────────

export function HeaderAuthButton({ compact = false }) {
  const { token, user, bezhasId, accent, openLoginModal, logout, subscribePlan, subscribeWithBEZPlan } = useAuth();
  const [payBusy, setPayBusy] = useState(false);
  const [payMsg, setPayMsg] = useState('');

  const pay = async () => {
    setPayMsg('');
    setPayBusy(true);
    try {
      const { txHash } = await subscribeWithBEZPlan(subscribePlan.amountBEZ);
      setPayMsg(`Pago enviado: ${txHash.slice(0, 10)}…`);
    } catch (e) {
      setPayMsg(e?.message || 'Pago cancelado.');
    } finally {
      setPayBusy(false);
    }
  };

  if (!token) {
    return (
      <button
        onClick={openLoginModal}
        style={{
          background: accent, border: 'none', borderRadius: 20, color: '#04070f',
          padding: compact ? '6px 14px' : '8px 20px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
        }}
      >
        Conectar / Registro
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
        background: 'rgba(255,255,255,0.05)', border: `1px solid ${accent}55`,
        borderRadius: 20, color: accent, fontSize: 12, fontWeight: 700,
      }}>
        <span>{user?.username || 'Usuario'}</span>
        {bezhasId && (
          <span
            title="BeZhas_ID — tu identidad única en todo el ecosistema"
            style={{
              fontSize: 10, background: 'rgba(255,255,255,0.08)', color: '#cbd5e1',
              padding: '2px 8px', borderRadius: 10, fontFamily: 'Space Mono, monospace',
            }}
          >
            {bezhasId}
          </span>
        )}
      </div>
      {subscribePlan?.amountBEZ && (
        <button
          onClick={pay}
          disabled={payBusy}
          title={payMsg || `Pagar ${subscribePlan.amountBEZ} BEZ en Polygon`}
          style={{
            background: 'rgba(255,255,255,0.05)', border: `1px solid ${accent}55`,
            borderRadius: 20, color: accent, padding: '6px 14px',
            fontSize: 11, fontWeight: 700, cursor: payBusy ? 'wait' : 'pointer',
          }}
        >
          {payBusy ? 'Pagando…' : `${subscribePlan.label || 'Suscribirse'} · ${subscribePlan.amountBEZ} BEZ`}
        </button>
      )}
      <button
        onClick={logout}
        style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 20, color: '#ef4444', padding: '6px 16px',
          fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Salir
      </button>
    </div>
  );
}

export function LockScreen({ title = 'Acceso restringido', description }) {
  const { openLoginModal, accent, appName } = useAuth();
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: '40px 20px', textAlign: 'center',
      background: 'rgba(15,23,42,0.35)', borderRadius: 24,
      border: '1px dashed rgba(255,255,255,0.08)', margin: 20,
    }}>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 12 }}>{title}</h2>
      <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 480, lineHeight: 1.6, marginBottom: 28 }}>
        {description || `Necesitas un BeZhas_ID para operar en ${appName}. Entra con tu email o firma con tu wallet.`}
      </p>
      <button
        onClick={openLoginModal}
        style={{
          background: accent, border: 'none', borderRadius: 24, color: '#04070f',
          padding: '12px 32px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
        }}
      >
        Crear o usar mi BeZhas_ID
      </button>
    </div>
  );
}

export function AuthModal({ onClose }) {
  const { login, register, loginWithWallet, accent, appName } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) return setError('Completa todos los campos.');
    if (!isLogin && password !== confirm) return setError('Las contraseñas no coinciden.');
    if (!isLogin && password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');

    setBusy('form');
    try {
      if (isLogin) await login(email, password);
      else await register(email, password);
    } catch (err) {
      setError(err?.message || 'No se pudo completar la operación.');
    } finally {
      setBusy('');
    }
  };

  const wallet = async () => {
    setError('');
    setBusy('wallet');
    try {
      await loginWithWallet(isLogin ? 'login' : 'subscribe');
    } catch (err) {
      setError(err?.message || 'No se pudo conectar la wallet.');
    } finally {
      setBusy('');
    }
  };

  const field = {
    width: '100%', background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
    padding: '10px 14px', color: '#fff', fontSize: 13, outline: 'none',
  };
  const label = {
    display: 'block', fontSize: 10, textTransform: 'uppercase', color: '#64748b',
    fontWeight: 800, marginBottom: 6, letterSpacing: 0.5,
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(4,7,15,0.85)',
        backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 16,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 420, background: '#090d16',
        border: `1px solid ${accent}33`, borderRadius: 24, padding: 28, position: 'relative',
      }}>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: 'absolute', top: 16, right: 16, background: 'none',
            border: 'none', color: '#475569', fontSize: 18, cursor: 'pointer',
          }}
        >
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>{appName}</h3>
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Un solo BeZhas_ID para todo el ecosistema
          </p>
        </div>

        <div style={{
          display: 'flex', background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.05)', borderRadius: 30, padding: 4, marginBottom: 24,
        }}>
          {[['Iniciar sesión', true], ['Registrarse', false]].map(([text, mode]) => (
            <button
              key={text}
              type="button"
              onClick={() => { setIsLogin(mode); setError(''); }}
              style={{
                flex: 1, background: isLogin === mode ? accent : 'transparent',
                color: isLogin === mode ? '#04070f' : '#94a3b8', border: 'none',
                borderRadius: 25, padding: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer',
              }}
            >
              {text}
            </button>
          ))}
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444', padding: '10px 14px', borderRadius: 10,
            fontSize: 11, marginBottom: 16, fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={label} htmlFor="bz-email">Correo</label>
            <input
              id="bz-email" type="email" autoComplete="email" placeholder="tu@empresa.com"
              value={email} onChange={(e) => setEmail(e.target.value)} style={field}
            />
          </div>
          <div>
            <label style={label} htmlFor="bz-pass">Contraseña</label>
            <input
              id="bz-pass" type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} style={field}
            />
          </div>
          {!isLogin && (
            <div>
              <label style={label} htmlFor="bz-pass2">Confirmar contraseña</label>
              <input
                id="bz-pass2" type="password" autoComplete="new-password" placeholder="••••••••"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} style={field}
              />
            </div>
          )}
          <button
            type="submit"
            disabled={Boolean(busy)}
            style={{
              width: '100%', background: accent, border: 'none', borderRadius: 12,
              color: '#04070f', padding: 12, fontSize: 13, fontWeight: 800,
              cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1, marginTop: 10,
            }}
          >
            {busy === 'form' ? 'Procesando…' : (isLogin ? 'Entrar' : 'Crear cuenta')}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 14px' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>o</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        <button
          type="button"
          onClick={wallet}
          disabled={Boolean(busy)}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${accent}55`, borderRadius: 12, color: accent,
            padding: 12, fontSize: 13, fontWeight: 800, cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy === 'wallet' ? 'Firmando con la wallet…' : 'Continuar con Wallet'}
        </button>
        <p style={{ fontSize: 10, color: '#475569', textAlign: 'center', marginTop: 8 }}>
          Sign-In With Ethereum · firma criptográfica, sin contraseña
        </p>
      </div>
    </div>
  );
}

export default BezhasAuthProvider;
