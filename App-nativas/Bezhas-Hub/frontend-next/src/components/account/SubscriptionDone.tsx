'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { appLabel, safeReturnTo } from '../../lib/returnTo';
import { useAccount } from './useAccount';

const SECONDS = 8;

/** Pantalla tras Stripe: espera a que el webhook active el plan y devuelve al usuario a la app donde trabajaba. */
export default function SubscriptionDone() {
  const params = useSearchParams();
  const returnTo = safeReturnTo(params.get('return'));
  const free = params.get('free') === '1';
  const { account, loading, refresh } = useAccount();
  const [tries, setTries] = useState(0);
  const [left, setLeft] = useState(SECONDS);
  const redirected = useRef(false);

  const active = account?.plan?.status === 'active';
  // El pago se confirma por webhook: puede tardar unos segundos tras volver de Stripe.
  useEffect(() => {
    if (free || active || loading || tries >= 15) return;
    const t = setTimeout(() => { setTries((n) => n + 1); void refresh(); }, 2000);
    return () => clearTimeout(t);
  }, [free, active, loading, tries, refresh]);

  const ready = free ? !loading : active;
  useEffect(() => {
    if (!ready || !returnTo) return;
    if (left <= 0) {
      if (!redirected.current) { redirected.current = true; window.location.href = returnTo; }
      return;
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [ready, returnTo, left]);

  if (!ready) {
    const slow = tries >= 15;
    return (
      <div className="hub-card" role="status" aria-live="polite">
        <span className="hub-tag">Pago recibido</span>
        <h2 style={{ fontSize: 26 }}>{slow ? 'Tu plan se está activando' : 'Activando tu plan…'}</h2>
        <p>{slow
          ? 'Stripe ya ha confirmado el pago, pero la activación está tardando más de lo normal. No pagues otra vez: se completa sola y te llegará el recibo por email.'
          : 'Estamos esperando la confirmación de Stripe. Solo serán unos segundos.'}</p>
        <div className="hub-hero-cta" style={{ marginTop: 6 }}>
          <Link className="hub-btn hub-btn-ghost" href="/planes">Ver mi cuenta</Link>
          {returnTo && <a className="hub-btn hub-btn-ghost" href={returnTo}>Volver a {appLabel(returnTo)}</a>}
        </div>
      </div>
    );
  }

  return (
    <div className="hub-card" role="status" aria-live="polite">
      <span className="hub-tag">Todo listo</span>
      <h2 style={{ fontSize: 26 }}>¡Plan {account?.plan?.name || 'Starter'} activo!</h2>
      <p>Tu BeZhas ID <span className="hub-mono" style={{ fontWeight: 700 }}>{account?.bezhasId}</span> ya funciona en todas las apps nativas de BeZhas con este plan.</p>
      {account?.plan?.id === 'starter' && (
        <p>Tienes <strong>15 días gratis</strong>: tu tarjeta está guardada y no se cobra nada durante la prueba. Después pagarás solo lo que uses de la API, el SDK y el MCP, y cada mes te compararemos tu consumo con los otros planes. <Link href="/cuenta" style={{ color: 'var(--accent)', fontWeight: 600 }}>Ver mi consumo</Link></p>
      )}
      <div className="hub-hero-cta" style={{ marginTop: 6 }}>
        {returnTo ? (
          <>
            <a className="hub-btn hub-btn-primary" href={returnTo}>Volver a {appLabel(returnTo)}</a>
            <span style={{ alignSelf: 'center', fontSize: 14, color: 'var(--ink-3)' }}>Te llevamos de vuelta en {Math.max(left, 0)} s…</span>
          </>
        ) : (
          <>
            <Link className="hub-btn hub-btn-primary" href="/apps">Abrir mis apps</Link>
            <Link className="hub-btn hub-btn-ghost" href="/">Ir al inicio</Link>
          </>
        )}
      </div>
    </div>
  );
}
