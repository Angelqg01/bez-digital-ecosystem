'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '../../lib/hubApi';
import { appLabel, safeReturnTo } from '../../lib/returnTo';
import { useAccount } from './useAccount';

/** Franja de estado sobre los planes: sin sesión, email sin confirmar, o cuenta lista. */
export default function AccountBanner() {
  const params = useSearchParams();
  const returnTo = safeReturnTo(params.get('return'));
  const { token, account, loading } = useAccount();
  const [msg, setMsg] = useState<string | null>(null);

  async function resend() {
    try {
      const r = await api('/api/auth/resend-verification', { token, body: { ...(returnTo ? { returnTo } : {}) } });
      setMsg(r.sent ? 'Correo reenviado. Revisa también el spam.' : 'No hemos podido enviar el correo ahora. Inténtalo en unos minutos.');
    } catch (e) { setMsg((e as ApiError).message); }
  }

  const extra = returnTo ? <> Al terminar volverás a <strong>{appLabel(returnTo)}</strong>.</> : null;
  if (params.get('cancelled')) {
    return <p className="hub-alert" data-kind="info" role="status">Has cancelado el pago: no se ha cobrado nada. Puedes elegir otro plan cuando quieras.{extra}</p>;
  }
  if (loading) return null;
  if (!token || !account) {
    return (
      <div className="hub-alert" data-kind="info" role="status">
        Para contratar necesitas un <strong>BeZhas ID</strong>, único para todas las apps nativas. Es gratis y tarda un minuto.{extra}{' '}
        <Link href={`/registro${returnTo ? `?return=${encodeURIComponent(returnTo)}` : ''}`} style={{ textDecoration: 'underline', fontWeight: 600 }}>Crear mi BeZhas ID</Link>
      </div>
    );
  }
  if (!account.emailVerified) {
    return (
      <div className="hub-alert" data-kind="warn" role="status">
        Falta confirmar tu email <strong>{account.email}</strong>. Te hemos enviado un enlace; al pulsarlo podrás contratar.{' '}
        <button type="button" onClick={resend} style={{ textDecoration: 'underline', fontWeight: 600, background: 'none', border: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}>Reenviar correo</button>
        {msg && <> — {msg}</>}
      </div>
    );
  }
  return (
    <div className="hub-alert" data-kind="ok" role="status">
      {params.get('verified') ? 'Email confirmado. ' : ''}Hola{account.username ? ` ${account.username}` : ''} · tu BeZhas ID:{' '}
      <span className="hub-mono" style={{ fontWeight: 700 }}>{account.bezhasId}</span>
      {account.plan ? <> · plan actual: <strong>{account.plan.name}</strong> (<Link href="/cuenta" style={{ textDecoration: 'underline' }}>ver mi consumo</Link>)</> : ' · aún no tienes plan'}.{extra}
    </div>
  );
}
