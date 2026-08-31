import React, { useState } from 'react';

const PACKS = [
  { credits: 5, name: 'Starter Pack', price: '50 BEZ', best: false },
  { credits: 15, name: 'Explorer Pack', price: '120 BEZ', best: true },
  { credits: 50, name: 'Pro Creator', price: '400 BEZ', best: false },
];

const ACTIVITY = [
  { icon: '📦', name: 'Logistics Scan', date: 'Oct 24, 2023 · Warehouse A', delta: -2 },
  { icon: '🛒', name: 'Purchase: 15 Credits', date: 'Oct 20, 2023 · BEZ-Coin', delta: +15 },
  { icon: '🏗️', name: 'Real Estate Scan', date: 'Oct 18, 2023 · High-Res Unit', delta: -5 },
];

export default function ScanCredits() {
  const [selected, setSelected] = useState(1);
  const [payment, setPayment] = useState('bez');

  return (
    <>
      <div className="credit-hero">
        <div className="credit-label">Current Balance</div>
        <div className="credit-value">12</div>
        <div className="credit-sub">Credits Available</div>
        <div className="credit-valid">✅ VALID FOREVER</div>
      </div>

      <div className="card" style={{ marginBottom: 24, background: 'var(--bez-surface-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>ℹ️</span>
          <p style={{ fontSize: 13, color: 'var(--bez-text-sec)' }}>Scan Credits are tokenized usage units required for generating high-fidelity 3D scans within the BeZhas ecosystem. Each scan consumes credits based on complexity.</p>
        </div>
      </div>

      <div style={{ color: 'var(--bez-orange)', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', marginBottom: 12 }}>Get More Credits</div>
      <div className="credit-packs">
        {PACKS.map((p, i) => (
          <div key={i} className={`credit-pack ${selected === i ? 'selected' : ''}`} onClick={() => setSelected(i)}>
            <div>
              <div className="pack-name">{p.credits} Credits</div>
              <div className="pack-tier">{p.name}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {p.best && <span className="best-value">Best Value</span>}
              <div className="pack-price">{p.price}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ color: 'var(--bez-orange)', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', marginBottom: 12 }}>Payment Method</div>
      <div className="payment-methods">
        <button className={`payment-btn ${payment === 'bez' ? 'active' : ''}`} onClick={() => setPayment('bez')}>◉ BEZ Balance</button>
        <button className={`payment-btn ${payment === 'card' ? 'active' : ''}`} onClick={() => setPayment('card')}>💳 Card</button>
        <button className={`payment-btn ${payment === 'apple' ? 'active' : ''}`} onClick={() => setPayment('apple')}>🍎 Apple Pay</button>
      </div>

      <div style={{ color: 'var(--bez-orange)', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', marginBottom: 12, marginTop: 24 }}>Recent Activity</div>
      <div className="card" style={{ padding: 0 }}>
        {ACTIVITY.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: i < ACTIVITY.length - 1 ? '1px solid var(--bez-border)' : 'none' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--bez-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{a.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
              <div style={{ fontSize: 11, color: 'var(--bez-text-muted)' }}>{a.date}</div>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: a.delta > 0 ? 'var(--bez-green)' : 'var(--bez-orange)' }}>{a.delta > 0 ? '+' : ''}{a.delta}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--bez-text-muted)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bez-surface)', padding: '6px 16px', borderRadius: 20, border: '1px solid var(--bez-border)' }}>🔒 ON-CHAIN VERIFIED</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 6 }}>Contract: 0xBeZhas77...F42a9B</div>
        <div style={{ marginTop: 6 }}>© 2026 BEZHAS SDK ECOSYSTEM</div>
      </div>
    </>
  );
}
