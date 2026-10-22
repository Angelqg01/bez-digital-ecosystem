'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../../lib/hubApi';
import { useAccount } from './useAccount';

type Usage = {
  plan: { id: string; name: string; status: string } | null;
  trial: { active: boolean; endsAt: string; daysLeft: number } | null;
  cycle: { from: string; to: string } | null;
  usage: { calls: number; credits: number; eur: number };
  comparison: {
    usageEUR: number;
    plans: { id: string; name: string; priceEUR: number; aiActions: number | null; fits: boolean; diffEUR: number }[];
    suggestion: { kind: 'switch' | 'stay'; planId: string; planName: string; savingsEUR: number; message: string };
  } | null;
};

const eur = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

/** Mi cuenta: BeZhas ID, plan, consumo del ciclo y comparación con los otros planes (Starter). */
export default function AccountUsage() {
  const { token, account, loading } = useAccount();
  const [data, setData] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !account) return;
    api<Usage>('/api/billing/usage', { token }).then(setData).catch((e: ApiError) => setError(e.message));
  }, [token, account]);

  if (loading) return <div className="hub-card" aria-busy="true"><p>Cargando tu cuenta…</p></div>;
  if (!token || !account) {
    return (
      <div className="hub-card">
        <h2 style={{ fontSize: 24 }}>Entra para ver tu cuenta</h2>
        <p>Aquí verás tu BeZhas ID, tu plan y tu consumo de la API, el SDK y el MCP.</p>
        <div className="hub-hero-cta"><Link className="hub-btn hub-btn-primary" href="/entrar">Entrar</Link><Link className="hub-btn hub-btn-ghost" href="/registro">Crear mi BeZhas ID</Link></div>
      </div>
    );
  }

  const starter = data?.plan?.id === 'starter';
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="hub-card">
        <span className="hub-tag">Tu cuenta</span>
        <p>BeZhas ID <span className="hub-mono" style={{ fontWeight: 700 }}>{account.bezhasId}</span> · {account.email}{account.emailVerified ? '' : ' (email sin confirmar)'}</p>
        <p>Plan actual: <strong>{account.plan?.name || 'ninguno todavía'}</strong>{' '}
          {!account.plan && <Link href="/planes" style={{ color: 'var(--accent)', fontWeight: 600 }}>Elegir plan</Link>}</p>
      </div>

      {error && <p className="hub-alert" data-kind="error" role="alert">{error}</p>}

      {starter && data?.trial?.active && (
        <p className="hub-alert" data-kind="ok" role="status">
          Estás en tu <strong>prueba gratuita</strong>: te quedan <strong>{data.trial.daysLeft} {data.trial.daysLeft === 1 ? 'día' : 'días'}</strong> (hasta el {fecha(data.trial.endsAt)}).
          Tu tarjeta está guardada y no se cobra nada hasta entonces; el consumo ya se va contando.
        </p>
      )}

      {data && data.plan && (
        <div className="hub-grid hub-grid-4" style={{ marginTop: 0 }}>
          <div className="hub-card"><span className="hub-tag">Llamadas</span><div className="hub-price">{data.usage.calls.toLocaleString('es-ES')}</div><p>API, SDK y MCP</p></div>
          <div className="hub-card"><span className="hub-tag">Créditos</span><div className="hub-price">{data.usage.credits.toLocaleString('es-ES')}</div><p>1 crédito = 0,001 €</p></div>
          <div className="hub-card"><span className="hub-tag">Consumo</span><div className="hub-price">{eur(data.usage.eur)}</div><p>sin IVA{data.cycle ? ` · desde el ${fecha(data.cycle.from)}` : ''}</p></div>
        </div>
      )}

      {starter && data?.comparison && (
        <div className="hub-card">
          <span className="hub-tag">Comparado con los otros planes</span>
          <h3>{data.comparison.suggestion.kind === 'switch' ? `Te compensaría ${data.comparison.suggestion.planName}` : 'Te conviene seguir por uso'}</h3>
          <p>{data.comparison.suggestion.message}</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--ink-3)' }}><th style={{ padding: '8px 6px' }}>Plan</th><th>Cuota al mes (sin IVA)</th><th>Frente a tu consumo</th></tr></thead>
              <tbody>
                <tr style={{ borderTop: '1px solid var(--line)' }}><td style={{ padding: '10px 6px' }}><strong>Starter (por uso)</strong></td><td>{eur(data.usage.eur)} este periodo</td><td>—</td></tr>
                {data.comparison.plans.map((p) => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 6px' }}>{p.name}{!p.fits && <span className="hub-tag"> · no cubre tus acciones</span>}</td>
                    <td>{eur(p.priceEUR)}</td>
                    <td>{p.diffEUR > 0 ? `${eur(p.diffEUR)} menos` : p.diffEUR < 0 ? `${eur(-p.diffEUR)} más` : 'igual'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="hub-hero-cta" style={{ marginTop: 6 }}>
            {data.comparison.suggestion.kind === 'switch'
              ? <Link className="hub-btn hub-btn-primary" href="/planes">Cambiar a {data.comparison.suggestion.planName}</Link>
              : <Link className="hub-btn hub-btn-ghost" href="/planes">Ver los planes</Link>}
            <span style={{ alignSelf: 'center', fontSize: 14, color: 'var(--ink-3)' }}>O sigue pagando solo lo que uses: no tienes que hacer nada.</span>
          </div>
        </div>
      )}

      {data?.plan && !starter && <p className="hub-alert" data-kind="info">Tu plan {data.plan.name} tiene cuota fija; el consumo de arriba es informativo.</p>}
    </div>
  );
}
