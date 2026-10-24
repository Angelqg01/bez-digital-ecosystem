import React, { useState } from 'react';
import { useGasTank, eur, num } from '../hooks/useGasTank';
import GasTankGate from '../components/GasTankGate';

export default function Recharge() {
  const gas = useGasTank({ withPackages: true });
  const [selected, setSelected] = useState(null);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const status = new URLSearchParams(window.location.search).get('status');
  const pk = gas.packages;

  const pay = async () => {
    setBusy(true); setError(null);
    try {
      await gas.checkout(selected ? { packageId: selected } : { amountEur: Number(custom) });
    } catch (err) {
      setError(err.message); setBusy(false);
    }
  };
  const customOk = pk && Number(custom) >= pk.minEur && Number(custom) <= pk.maxEur;

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Recargar Gas Tank</h1>
        <p className="page-subtitle">Paga en euros: tu equipo opera sin tocar crypto. Factura disponible.</p>
      </div>

      {status === 'ok' && <div role="status" className="card" style={{ marginBottom: '1rem' }}>Pago recibido. El saldo se actualiza en unos segundos.</div>}
      {status === 'cancelled' && <div role="status" className="card" style={{ marginBottom: '1rem' }}>Pago cancelado: no se ha cobrado nada.</div>}

      <GasTankGate gas={gas}>
        {pk && !gas.canRecharge && (
          <div role="status" className="card">Sólo el propietario, un administrador o finanzas pueden recargar el Gas Tank.</div>
        )}
        {pk && gas.canRecharge && (
          <>
            <div className="recharge-grid animate-in-d1">
              {pk.packages.map((p) => (
                <div key={p.id} className={`recharge-option ${selected === p.id ? 'selected' : ''}`}
                  onClick={() => { setSelected(p.id); setCustom(''); }}>
                  <div className="recharge-amount">{eur(p.eur).replace(',00', '')}</div>
                  <div className="recharge-txs">{num(p.credits)} créditos</div>
                  {p.bonusPct > 0 && <div className="recharge-bonus">+{p.bonusPct}% extra</div>}
                </div>
              ))}
            </div>

            <div className="form-group" style={{ maxWidth: 280, marginTop: '1.5rem' }}>
              <label className="form-label">Otro importe (€{pk.minEur}–{pk.maxEur})</label>
              <input className="form-input" type="number" min={pk.minEur} max={pk.maxEur} value={custom}
                onChange={(e) => { setCustom(e.target.value); setSelected(null); }} />
            </div>

            {error && <div role="alert" style={{ color: 'var(--bezhas-warning)', margin: '0.75rem 0' }}>{error}</div>}
            <div style={{ maxWidth: 480, marginTop: '1rem' }}>
              <button className="btn-primary" disabled={busy || !(selected || customOk)} onClick={pay}>
                {busy ? 'Redirigiendo a Stripe…' : 'Pagar con tarjeta o SEPA →'}
              </button>
              <p style={{ fontSize: '0.75rem', color: 'var(--bezhas-text-muted)', textAlign: 'center', marginTop: '0.75rem' }}>
                Pago procesado por Stripe · 1 crédito = {pk.eurPerCredit} € · IVA según tu país
              </p>
            </div>
          </>
        )}
      </GasTankGate>
    </div>
  );
}
