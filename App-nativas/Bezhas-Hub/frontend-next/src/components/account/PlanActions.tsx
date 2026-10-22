'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api } from '../../lib/hubApi';
import { safeReturnTo } from '../../lib/returnTo';
import { useAccount } from './useAccount';

/** Botones de contratación de un plan: depende de si hay sesión y de si el email está confirmado. */
export default function PlanActions({ planId, hasAnnual }: { planId: string; hasAnnual: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeReturnTo(params.get('return'));
  const { token, account, loading } = useAccount();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = new URLSearchParams({ plan: planId });
  if (returnTo) q.set('return', returnTo);

  async function contratar(billing: 'monthly' | 'annual') {
    setError(null);
    setBusy(billing);
    try {
      const r = await api<{ url: string }>('/api/billing/plan-checkout', { token, body: { planId, billing, ...(returnTo ? { returnTo } : {}) } });
      window.location.href = r.url; // Stripe Checkout (Starter: tarjeta y 15 días gratis); al terminar vuelve a /suscripcion/listo
    } catch (err) {
      const e = err as ApiError;
      setError(e.code === 'EMAIL_NOT_VERIFIED' ? 'Confirma primero tu email: te hemos enviado un enlace.' : e.message);
      setBusy(null);
    }
  }

  if (loading) return <div style={{ marginTop: 'auto', paddingTop: 10 }}><span className="hub-btn hub-btn-ghost" aria-busy="true">Cargando…</span></div>;

  if (!token || !account) {
    return (
      <div style={{ marginTop: 'auto', display: 'grid', gap: 8, paddingTop: 10 }}>
        <Link className="hub-btn hub-btn-primary" href={`/registro?${q.toString()}`}>{planId === 'starter' ? 'Probar 15 días gratis' : 'Crear cuenta y contratar'}</Link>
        <Link className="hub-btn hub-btn-ghost" href={`/entrar?${q.toString()}`}>Ya tengo cuenta</Link>
      </div>
    );
  }

  const bloqueado = !account.emailVerified;
  const esActual = account.plan?.id === planId && account.plan.status === 'active';
  return (
    <div style={{ marginTop: 'auto', display: 'grid', gap: 8, paddingTop: 10 }}>
      {esActual ? (
        <span className="hub-btn hub-btn-ghost" aria-disabled="true">Tu plan actual</span>
      ) : (
        <>
          <button className="hub-btn hub-btn-primary" type="button" disabled={bloqueado || !!busy} onClick={() => contratar('monthly')}>
            {busy === 'monthly' ? 'Un momento…' : planId === 'starter' ? 'Probar 15 días gratis' : 'Contratar mensual'}
          </button>
          {hasAnnual && (
            <button className="hub-btn hub-btn-ghost" type="button" disabled={bloqueado || !!busy} onClick={() => contratar('annual')}>
              {busy === 'annual' ? 'Un momento…' : 'Contratar anual'}
            </button>
          )}
        </>
      )}
      {bloqueado && <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Confirma tu email para contratar.</p>}
      {planId === 'starter' && !esActual && !bloqueado && (
        <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Pedimos tu tarjeta para empezar, pero no se cobra nada durante 15 días.</p>
      )}
      {error && <p className="hub-alert" data-kind="error" role="alert">{error}</p>}
    </div>
  );
}
