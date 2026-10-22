'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ApiError, api } from '../../lib/hubApi';
import { appLabel, safeReturnTo } from '../../lib/returnTo';
import { saveSession } from '../../lib/session';
import { useUserStore } from '../../stores/userStore';

type Mode = 'registro' | 'entrar';

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeReturnTo(params.get('return'));
  const plan = params.get('plan');
  const yaConfirmado = params.get('verified') === '1';
  const qs = (extra: Record<string, string> = {}) => {
    const u = new URLSearchParams(extra);
    if (returnTo) u.set('return', returnTo);
    if (plan) u.set('plan', plan);
    const s = u.toString();
    return s ? `?${s}` : '';
  };

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<{ email: string; sent: boolean } | null>(null);
  const [resent, setResent] = useState<string | null>(null);
  const token = useUserStore((s) => s.token);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'registro') {
      if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
      if (password !== password2) return setError('Las contraseñas no coinciden.');
      if (!accepted) return setError('Para crear tu BeZhas ID debes aceptar la política de privacidad.');
    }
    setBusy(true);
    try {
      if (mode === 'registro') {
        const r = await api('/api/auth/register-email', {
          body: { username: username.trim() || undefined, email: email.trim(), password, ...(returnTo ? { returnTo } : {}) },
        });
        saveSession(r.token, r.user);
        setSentTo({ email: r.user?.email || email.trim(), sent: !!r.emailVerification?.sent });
      } else {
        const r = await api('/api/auth/login-email', { body: { email: email.trim(), password } });
        saveSession(r.token, r.user);
        if (r.user?.email_verified_at) router.push(`/planes${qs()}`);
        else setSentTo({ email: r.user?.email || email.trim(), sent: false });
      }
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.status === 409) setError('Ya existe una cuenta con ese email. Entra con tu contraseña.');
      else if (e2.status === 401) setError('Email o contraseña incorrectos.');
      else setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setResent(null);
    try {
      const r = await api('/api/auth/resend-verification', { token, body: { ...(returnTo ? { returnTo } : {}) } });
      setResent(r.alreadyVerified ? 'Tu email ya está confirmado.' : r.sent ? 'Correo reenviado. Revisa también la carpeta de spam.' : 'No hemos podido enviar el correo ahora. Inténtalo en unos minutos.');
      if (r.alreadyVerified) router.push(`/planes${qs()}`);
    } catch (err) {
      setResent((err as ApiError).message);
    }
  }

  if (sentTo) {
    return (
      <div className="hub-card" role="status">
        <span className="hub-tag">Último paso</span>
        <h2 style={{ fontSize: 26 }}>{sentTo.sent ? 'Revisa tu email' : 'Confirma tu email'}</h2>
        <p>
          {sentTo.sent
            ? <>Te hemos enviado un correo a <strong>{sentTo.email}</strong>. Pulsa el botón «Confirmar email y elegir plan» y te llevará a escoger tu plan.</>
            : <>Tu cuenta <strong>{sentTo.email}</strong> está creada, pero falta confirmar el email. Pulsa «Reenviar» para recibir el enlace.</>}
        </p>
        <p style={{ fontSize: 14 }}>El enlace caduca en 24 horas. Hasta que lo confirmes no se activa ningún plan.</p>
        <div className="hub-hero-cta" style={{ marginTop: 6 }}>
          <button className="hub-btn hub-btn-ghost" onClick={resend} type="button">Reenviar correo</button>
          <Link className="hub-btn hub-btn-ghost" href={`/planes${qs()}`}>Ver planes</Link>
        </div>
        {resent && <p className="hub-alert" data-kind="info" role="status">{resent}</p>}
      </div>
    );
  }

  return (
    <form className="hub-card hub-form" onSubmit={onSubmit} noValidate>
      {mode === 'entrar' && yaConfirmado && (
        <p className="hub-alert" data-kind="ok" role="status">Tu email ya está confirmado. Entra con tu contraseña para elegir plan.</p>
      )}
      {returnTo && (
        <p className="hub-alert" data-kind="info">Al terminar volverás a <strong>{appLabel(returnTo)}</strong>.</p>
      )}
      {mode === 'registro' && (
        <label className="hub-field">
          <span>Usuario</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" minLength={3} maxLength={40} placeholder="Cómo quieres que te llamemos" />
        </label>
      )}
      <label className="hub-field">
        <span>Email</span>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="tu@empresa.com" />
      </label>
      <label className="hub-field">
        <span>Contraseña</span>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'registro' ? 'new-password' : 'current-password'} minLength={mode === 'registro' ? 8 : 1} />
      </label>
      {mode === 'registro' && (
        <>
          <label className="hub-field">
            <span>Repite la contraseña</span>
            <input type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="hub-check">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>He leído la <a href="https://www.bezhas.com/privacy" style={{ textDecoration: 'underline' }}>política de privacidad</a>.</span>
          </label>
        </>
      )}
      {error && <p className="hub-alert" data-kind="error" role="alert">{error}</p>}
      <button className="hub-btn hub-btn-primary" type="submit" disabled={busy}>
        {busy ? 'Un momento…' : mode === 'registro' ? 'Crear mi BeZhas ID' : 'Entrar'}
      </button>
      <p style={{ fontSize: 14, color: 'var(--ink-3)' }}>
        {mode === 'registro'
          ? <>¿Ya tienes cuenta? <Link href={`/entrar${qs()}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>Entra aquí</Link></>
          : <>¿Aún no tienes BeZhas ID? <Link href={`/registro${qs()}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>Créalo gratis</Link></>}
      </p>
    </form>
  );
}
