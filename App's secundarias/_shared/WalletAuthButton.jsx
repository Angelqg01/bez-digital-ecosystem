/**
 * WalletAuthButton — drop-in "Login / Subscribe with Wallet" control for any BeZhas SubApp.
 *
 * ⚠️ CANONICAL TEMPLATE. This file lives in `_shared/`, which has no node_modules of its
 * own, so bundlers cannot resolve the bare `react` import from here. Each consuming SubApp
 * keeps a local copy at `src/WalletAuthButton.jsx` (react/lucide resolve from the app's own
 * deps) that imports the dependency-free core from `../../_shared/bezhas-wallet-auth.js`.
 * Edit this template, then re-copy it into the apps (and fix the core import path).
 *
 * Dependencies: react + lucide-react ONLY (no framer-motion / no ethers / no tailwind
 * required). Styling is inline so it renders consistently in every SubApp.
 *
 * Usage:
 *   import WalletAuthButton from '../../_shared/WalletAuthButton.jsx'
 *   <WalletAuthButton accent="#00D4AA" statement="Sign in to BZ PureScan."
 *                     subscribePlan={{ amountBEZ: 50, label: 'Plan Pro' }} />
 *
 * Props:
 *   accent          — brand color (default teal #00D4AA)
 *   statement       — SIWE statement shown in the wallet signature prompt
 *   apiBase         — override the Hub auth API base (defaults to env)
 *   subscribePlan   — { amountBEZ, label, to?, tokenAddress? } enables the BEZ pay button
 *   onAuthChange    — (session|null) => void, fired on login / logout
 *   compact         — boolean, smaller padding for tight headers
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Wallet, LogOut, ChevronDown, BadgeCheck, Loader2, CreditCard, ShieldAlert } from 'lucide-react';
import {
  isWalletAvailable, siweLogin, siweSubscribe, subscribeWithBEZ,
  getSession, clearSession, shortAddress, onWalletEvent,
} from './bezhas-wallet-auth.js';
import PQCBadge from './PQCBadge.jsx';

export default function WalletAuthButton({
  accent = '#00D4AA',
  statement = 'Sign in with Ethereum to the BeZhas Ecosystem.',
  apiBase,
  subscribePlan = null,
  onAuthChange,
  compact = false,
}) {
  const [session, setSession] = useState(() => getSession());
  const [busy, setBusy] = useState('');           // '', 'login', 'subscribe', 'pay'
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);         // logged-out choices menu
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pqcStatus, setPqcStatus] = useState(() => getSession()?.pqcStatus ?? null);

  const fire = useCallback((s) => { onAuthChange?.(s); }, [onAuthChange]);

  // Re-sync if the wallet account changes externally.
  useEffect(() => onWalletEvent(({ type, accounts }) => {
    if (type === 'accountsChanged' && (!accounts || !accounts.length)) {
      clearSession(); setSession(null); setPqcStatus(null); fire(null);
    }
  }), [fire]);

  // Escuchar verificación PQC asíncrona completada en saveSession()
  useEffect(() => {
    const handler = (e) => {
      setPqcStatus(e.detail);
      // Actualizar también la sesión en state para que los consumidores de onAuthChange lo vean
      setSession(prev => prev ? { ...prev, pqcStatus: e.detail } : prev);
    };
    window.addEventListener('bezhas:pqc-verified', handler);
    return () => window.removeEventListener('bezhas:pqc-verified', handler);
  }, []);

  const pad = compact ? '6px 12px' : '8px 18px';

  const run = async (kind, fn) => {
    setError(''); setNotice(''); setBusy(kind); setMenu(false);
    try {
      const result = await fn();
      return result;
    } catch (e) {
      setError(e?.message || 'Operación cancelada.');
      return null;
    } finally {
      setBusy('');
    }
  };

  const handleLogin = async (mode) => {
    if (!isWalletAvailable()) {
      setError('Instala MetaMask o usa bez-wallet para continuar.');
      return;
    }
    const s = await run(mode, () =>
      (mode === 'subscribe' ? siweSubscribe : siweLogin)({ apiBase, statement }));
    if (s) { setSession(s); fire(s); }
  };

  const handlePay = async () => {
    const res = await run('pay', () => subscribeWithBEZ({
      amountBEZ: subscribePlan.amountBEZ,
      to: subscribePlan.to,
      tokenAddress: subscribePlan.tokenAddress,
    }));
    if (res) {
      setNotice(`Suscripción enviada ✓ tx ${res.txHash.slice(0, 10)}…`);
      setOpen(false);
    }
  };

  const handleLogout = () => {
    clearSession(); setSession(null); setOpen(false); fire(null);
  };

  // ── Logged IN ──────────────────────────────────────────────────────────────
  if (session?.address) {
    const verified = session.authMethod === 'siwe';
    return (
      <div style={{ position: 'relative', display: 'inline-block', fontFamily: 'inherit' }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: pad,
            background: `${accent}14`, border: `1px solid ${accent}55`, borderRadius: 20,
            color: accent, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {verified
            ? <BadgeCheck size={15} />
            : <ShieldAlert size={15} color="#f59e0b" title="Sesión demo (sin backend)" />}
          <span style={{ fontFamily: 'monospace' }}>{shortAddress(session.address)}</span>
          <PQCBadge token={session.token} size="sm" />
          <ChevronDown size={14} />
        </button>

        {open && (
          <div style={menuStyle(accent)}>
            <div style={{ padding: '8px 12px', fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {verified ? 'Wallet verificada' : 'Sesión demo (sin backend)'}
            </div>
            {/* Estado PQC detallado en el menú */}
            {session.token && (
              <div style={{ padding: '0 8px 6px' }}>
                <PQCBadge token={session.token} size="md" showDetails />
              </div>
            )}
            {subscribePlan && (
              <button style={itemStyle} disabled={busy} onClick={handlePay}>
                {busy === 'pay' ? <Loader2 size={15} className="bz-spin" /> : <CreditCard size={15} />}
                <span>Suscribirse · {subscribePlan.amountBEZ} BEZ{subscribePlan.label ? ` (${subscribePlan.label})` : ''}</span>
              </button>
            )}
            <button style={{ ...itemStyle, color: '#ef4444' }} onClick={handleLogout}>
              <LogOut size={15} /> <span>Desconectar</span>
            </button>
          </div>
        )}
        {notice && <Toast color={accent} text={notice} />}
        {error && <Toast color="#ef4444" text={error} />}
        <SpinKeyframes />
      </div>
    );
  }

  // ── Logged OUT ─────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', display: 'inline-block', fontFamily: 'inherit' }}>
      <button
        onClick={() => setMenu((v) => !v)}
        disabled={!!busy}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: pad,
          background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
          border: 'none', borderRadius: 20, color: '#04121b',
          fontSize: 12, fontWeight: 800, cursor: busy ? 'wait' : 'pointer',
          boxShadow: `0 4px 15px ${accent}40`,
        }}
      >
        {busy ? <Loader2 size={15} className="bz-spin" /> : <Wallet size={15} />}
        <span>{busy === 'login' ? 'Firmando…' : busy === 'subscribe' ? 'Registrando…' : 'Wallet'}</span>
      </button>

      {menu && !busy && (
        <div style={menuStyle(accent)}>
          <button style={itemStyle} onClick={() => handleLogin('login')}>
            <Wallet size={15} /> <span>Iniciar sesión</span>
          </button>
          <button style={itemStyle} onClick={() => handleLogin('subscribe')}>
            <BadgeCheck size={15} /> <span>Suscribirse (crear cuenta)</span>
          </button>
        </div>
      )}
      {error && <Toast color="#ef4444" text={error} />}
      <SpinKeyframes />
    </div>
  );
}

const menuStyle = (accent) => ({
  position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 9999,
  minWidth: 220, background: '#0b1018', border: `1px solid ${accent}33`,
  borderRadius: 14, padding: 6, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
  display: 'flex', flexDirection: 'column', gap: 2,
});

const itemStyle = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  background: 'transparent', border: 'none', borderRadius: 10,
  padding: '10px 12px', color: '#e2e8f0', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', textAlign: 'left',
};

function Toast({ color, text }) {
  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 9999,
      maxWidth: 280, background: '#0b1018', border: `1px solid ${color}55`,
      borderRadius: 10, padding: '8px 12px', color, fontSize: 11, fontWeight: 600,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>{text}</div>
  );
}

function SpinKeyframes() {
  return <style>{`.bz-spin{animation:bzspin 0.8s linear infinite}@keyframes bzspin{to{transform:rotate(360deg)}}`}</style>;
}
