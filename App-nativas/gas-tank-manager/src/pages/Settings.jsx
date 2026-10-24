import React, { useEffect, useState } from 'react';
import { useGasTank, eur } from '../hooks/useGasTank';
import GasTankGate from '../components/GasTankGate';

const EUR_PER_CREDIT = 0.001;
const toEur = (credits) => (credits == null ? '' : String(Math.round(credits * EUR_PER_CREDIT * 100) / 100));

export default function Settings() {
  const gas = useGasTank();
  const ar = gas.balance?.autoRecharge;
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState('10');
  const [amount, setAmount] = useState('50');
  const [cap, setCap] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!gas.balance) return;
    setEnabled(gas.balance.autoRecharge.enabled);
    setThreshold(toEur(gas.balance.autoRecharge.thresholdCredits));
    setAmount(toEur(gas.balance.autoRecharge.rechargeCredits));
    setCap(toEur(gas.balance.monthlyCapCredits));
  }, [gas.balance?.autoRecharge?.enabled, gas.balance?.autoRecharge?.thresholdCredits, gas.balance?.autoRecharge?.rechargeCredits, gas.balance?.monthlyCapCredits]);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await gas.saveSettings({
        autoRecharge: enabled,
        thresholdEur: Number(threshold),
        rechargeEur: Number(amount),
        monthlyCapEur: cap === '' ? null : Number(cap),
      });
      setMsg({ ok: true, text: 'Ajustes guardados.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Ajustes</h1>
        <p className="page-subtitle">Auto-recarga del Gas Tank con el método de pago guardado de tu organización</p>
      </div>

      <GasTankGate gas={gas}>
        {ar && (
          <div className="card animate-in-d1" style={{ maxWidth: 600 }}>
            <div className="card-header">
              <span className="card-title">Auto-recarga</span>
              <button className={`toggle ${enabled ? 'on' : ''}`} disabled={!gas.canRecharge} aria-pressed={enabled}
                onClick={() => setEnabled(!enabled)}><div className="toggle-knob" /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--bezhas-text-muted)' }}>
              Cuando el saldo baje del umbral se cobra el importe indicado al método de pago de la organización
              (se guarda en Facturación, en el Hub). Saldo actual: {eur(gas.balance.balanceEur)}.
            </p>

            <div className="form-group">
              <label className="form-label">Umbral (€)</label>
              <input className="form-input" type="number" min="0" value={threshold} disabled={!gas.canRecharge} onChange={(e) => setThreshold(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Importe de cada recarga (€)</label>
              <input className="form-input" type="number" min="10" value={amount} disabled={!gas.canRecharge} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Tope mensual de recargas automáticas (€, vacío = sin tope)</label>
              <input className="form-input" type="number" min="10" value={cap} disabled={!gas.canRecharge} onChange={(e) => setCap(e.target.value)} />
            </div>

            {gas.balance.lastAutoError && (
              <div role="alert" style={{ color: 'var(--bezhas-warning)', margin: '0.5rem 0', fontSize: '0.85rem' }}>
                Última recarga automática fallida: {gas.balance.lastAutoError}
              </div>
            )}
            {msg && <div role={msg.ok ? 'status' : 'alert'} style={{ margin: '0.5rem 0', color: msg.ok ? 'var(--bezhas-success)' : 'var(--bezhas-warning)' }}>{msg.text}</div>}

            {gas.canRecharge
              ? <button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar ajustes'}</button>
              : <p style={{ fontSize: '0.85rem' }}>Sólo el propietario, un administrador o finanzas pueden cambiar estos ajustes.</p>}
          </div>
        )}
      </GasTankGate>
    </div>
  );
}
