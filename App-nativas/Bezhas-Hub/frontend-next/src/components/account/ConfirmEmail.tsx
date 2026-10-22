'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/hubApi';
import { safeReturnTo } from '../../lib/returnTo';
import { saveSession } from '../../lib/session';
import { useUserStore } from '../../stores/userStore';

export default function ConfirmEmail() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<'working' | 'ok' | 'error'>('working');
  const [message, setMessage] = useState('');
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return; // el modo estricto de React lanzaría la confirmación dos veces y la segunda fallaría
    once.current = true;
    if (!/^[0-9a-f]{64}$/.test(token)) { setState('error'); setMessage('Este enlace no es válido.'); return; }
    api('/api/auth/verify-email', { body: { token } })
      .then((r) => {
        const back = safeReturnTo(r.returnTo) || safeReturnTo(params.get('return'));
        const q = new URLSearchParams({ verified: '1' });
        if (back) q.set('return', back);
        if (r.alreadyVerified) {
          // El enlace ya se usó: el email está confirmado. El botón del correo sirve para volver a elegir plan:
          // con sesión abierta va directo a /planes; sin ella, a entrar (el enlace no vuelve a dar sesión).
          setState('ok');
          const sesion = !!useUserStore.getState().token;
          setTimeout(() => router.replace(`${sesion ? '/planes' : '/entrar'}?${q.toString()}`), 1000);
          return;
        }
        saveSession(r.token, r.user);
        setState('ok');
        setTimeout(() => router.replace(`/planes?${q.toString()}`), 1400);
      })
      .catch((e) => { setState('error'); setMessage(e.message || 'No hemos podido confirmar el email.'); });
  }, [token, params, router]);

  return (
    <div className="hub-card" role="status" aria-live="polite">
      {state === 'working' && <><h2 style={{ fontSize: 26 }}>Confirmando tu email…</h2><p>Un segundo.</p></>}
      {state === 'ok' && <><h2 style={{ fontSize: 26 }}>Email confirmado</h2><p>Tu email está confirmado y tu BeZhas ID activo. Te llevamos a elegir tu plan…</p></>}
      {state === 'error' && (
        <>
          <h2 style={{ fontSize: 26 }}>No hemos podido confirmar tu email</h2>
          <p>{message} Los enlaces caducan a las 24 horas y solo valen una vez.</p>
          <div className="hub-hero-cta" style={{ marginTop: 6 }}>
            <Link className="hub-btn hub-btn-primary" href="/entrar">Entrar y reenviar el correo</Link>
          </div>
        </>
      )}
    </div>
  );
}
