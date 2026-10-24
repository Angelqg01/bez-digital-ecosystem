import React, { useState } from 'react';

const OPTIONS = [
  { amount: 10, txs: '~2,000', bonus: null },
  { amount: 25, txs: '~5,000', bonus: null },
  { amount: 50, txs: '~10,000', bonus: '+5% extra', popular: true },
  { amount: 100, txs: '~20,000', bonus: '+10% extra' },
  { amount: 250, txs: '~50,000', bonus: '+15% extra' },
  { amount: 500, txs: '~100,000', bonus: '+20% extra' },
];

export default function Recharge() {
  const [selected, setSelected] = useState(50);
  const [step, setStep] = useState('select'); // select | checkout | success
  const [payMethod, setPayMethod] = useState('card');

  if (step === 'success') {
    return (
      <div>
        <div className="page-header animate-in">
          <h1 className="page-title">Recharge Complete ✅</h1>
        </div>
        <div className="card animate-in-d1" style={{ maxWidth: 480, textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⛽</div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>${selected}.00 Added</h2>
          <p style={{ color: 'var(--bezhas-text-muted)', fontSize: '0.9rem' }}>
            Your Gas Tank is now ready for ~{(selected / 0.005).toLocaleString()} transactions
          </p>
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bezhas-success-bg)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--bezhas-success)' }}>
            Receipt sent to billing@yourcompany.com
          </div>
          <button className="btn-secondary" style={{ marginTop: '1.5rem' }} onClick={() => { setStep('select'); setSelected(50); }}>
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (step === 'checkout') {
    const option = OPTIONS.find(o => o.amount === selected);
    return (
      <div>
        <div className="page-header animate-in">
          <h1 className="page-title">Checkout</h1>
          <p className="page-subtitle">Factura corporativa disponible</p>
        </div>
        <div className="card animate-in-d1" style={{ maxWidth: 480, padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>${selected}.00</div>
            <div style={{ color: 'var(--bezhas-text-muted)', fontSize: '0.85rem' }}>{option?.txs} transactions estimated</div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {['card', 'crypto'].map(m => (
              <button key={m} className="btn-secondary" style={{
                flex: 1, background: payMethod === m ? 'rgba(var(--bezhas-accent-rgb),0.1)' : undefined,
                borderColor: payMethod === m ? 'var(--bezhas-accent)' : undefined,
                color: payMethod === m ? 'var(--bezhas-accent)' : undefined,
              }} onClick={() => setPayMethod(m)}>
                {m === 'card' ? '💳 Card / Bank' : '🔷 Crypto'}
              </button>
            ))}
          </div>

          {payMethod === 'card' && (
            <div className="form-group">
              <label className="form-label">Company Name (for invoice)</label>
              <input className="form-input" placeholder="Your Company S.L." style={{ fontFamily: 'var(--font-body)' }} />
            </div>
          )}

          {payMethod === 'crypto' && (
            <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bezhas-surface-2)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔷</div>
              <p style={{ color: 'var(--bezhas-text-secondary)', fontSize: '0.85rem' }}>
                El pago con BEZ aún no está disponible. Solicita la recarga y te indicamos cómo hacerla.
              </p>
            </div>
          )}

          <div style={{ padding: '0.75rem 1rem', background: 'var(--bezhas-surface-2)', borderRadius: 'var(--radius-md)', margin: '1rem 0', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--bezhas-text-muted)' }}>Subtotal</span>
              <span>${selected}.00</span>
            </div>
            {option?.bonus && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--bezhas-success)' }}>Bonus</span>
                <span style={{ color: 'var(--bezhas-success)' }}>{option.bonus}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--bezhas-border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
              <span>Total</span>
              <span>${selected}.00</span>
            </div>
          </div>

          {/* La API todavía no tiene endpoint de recarga (routes/gas.js sólo expone
              /status y /balances). Antes este botón saltaba a «Recharge Complete,
              $X Added» sin cobrar ni acreditar nada. */}
          <div role="status" style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--bezhas-surface-2)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            La recarga online del Gas Tank aún no está disponible. Para recargar ahora escribe a info.bezcoin@bezhas.com
            y te enviaremos la factura.
          </div>
          <a className="btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
             href={`mailto:info.bezcoin@bezhas.com?subject=${encodeURIComponent(`Recarga Gas Tank ${selected} USD`)}`}>
            Solicitar recarga de ${selected}.00
          </a>
          <button className="btn-secondary" style={{ width: '100%', marginTop: '0.75rem' }} onClick={() => setStep('select')}>
            ← Change Amount
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Recharge Gas Tank</h1>
        <p className="page-subtitle">Selecciona un monto — paga con tarjeta y tu equipo opera sin fricciones</p>
      </div>

      <div className="recharge-grid animate-in-d1">
        {OPTIONS.map(opt => (
          <div
            key={opt.amount}
            className={`recharge-option ${selected === opt.amount ? 'selected' : ''} ${opt.popular ? 'popular' : ''}`}
            onClick={() => setSelected(opt.amount)}
          >
            <div className="recharge-amount">${opt.amount}</div>
            <div className="recharge-txs">{opt.txs} txs</div>
            {opt.bonus && <div className="recharge-bonus">{opt.bonus}</div>}
          </div>
        ))}
      </div>

      <div className="animate-in-d2" style={{ maxWidth: 480, marginTop: '2rem' }}>
        <button className="btn-primary" onClick={() => setStep('checkout')}>
          Continue — ${selected}.00 →
        </button>
        <p style={{ fontSize: '0.75rem', color: 'var(--bezhas-text-muted)', textAlign: 'center', marginTop: '0.75rem' }}>
          Factura disponible · IVA incluido
        </p>
      </div>
    </div>
  );
}
