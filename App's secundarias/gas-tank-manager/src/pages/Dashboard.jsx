import React from 'react';
import { useNavigate } from 'react-router-dom';

const RECENT_USAGE = [
  { app: 'BEZ Scanner', txs: 142, cost: '$0.71', time: 'Today' },
  { app: 'Bezhas Hub', txs: 87, cost: '$0.44', time: 'Today' },
  { app: 'BZ Capital', txs: 34, cost: '$0.17', time: 'Yesterday' },
  { app: 'Customs', txs: 12, cost: '$0.06', time: 'Yesterday' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const balance = 47.50;
  const fillPercent = (balance / 100) * 100;
  const fillDeg = (fillPercent / 100) * 360;

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Gas Tank Dashboard</h1>
        <p className="page-subtitle">Gestión centralizada de gas — tu equipo nunca toca crypto</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="animate-in-d1">
        {/* ── Tank Gauge ──────────────────────────── */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem' }}>
          <div className="tank-gauge">
            <div className="tank-gauge-circle" style={{ '--fill-deg': `${fillDeg}deg` }}>
              <div className="tank-gauge-inner">
                <div className="tank-gauge-value">${balance.toFixed(2)}</div>
                <div className="tank-gauge-label">Balance</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--bezhas-text-secondary)' }}>
              ~{Math.floor(balance / 0.005).toLocaleString()} transactions remaining
            </div>
            <button className="btn-primary" style={{ marginTop: '1rem', maxWidth: '240px' }} onClick={() => navigate('/recharge')}>
              💳 Recharge Now
            </button>
          </div>
        </div>

        {/* ── Aegis Prediction ────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="aegis-card">
            <div className="aegis-header">
              <div className="aegis-icon">🧠</div>
              <div>
                <div className="aegis-title">Aegis Gas Predictor</div>
                <div className="aegis-subtitle">ML-powered optimal timing</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--bezhas-text-muted)', marginBottom: '0.25rem' }}>CURRENT GAS</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700 }}>1.2 <span style={{ fontSize: '0.75rem', color: 'var(--bezhas-text-muted)' }}>gwei</span></div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--bezhas-text-muted)', marginBottom: '0.25rem' }}>PREDICTED LOW</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--bezhas-success)' }}>0.8 <span style={{ fontSize: '0.75rem', color: 'var(--bezhas-text-muted)' }}>gwei</span></div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--bezhas-text-muted)', marginBottom: '0.25rem' }}>OPTIMAL HOUR</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700 }}>14:00 <span style={{ fontSize: '0.75rem', color: 'var(--bezhas-text-muted)' }}>UTC</span></div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--bezhas-text-muted)', marginBottom: '0.25rem' }}>SAVINGS</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--bezhas-success)' }}>33%</div>
              </div>
            </div>
            <div className="aegis-recommendation now">
              <span>✅</span> Execute now — gas is near daily low
            </div>
          </div>

          <div className="card">
            <div className="card-title">Auto-Recharge Status</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Enabled</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--bezhas-text-muted)' }}>
                  Triggers at $10.00 · Recharges $50.00
                </div>
              </div>
              <div className="toggle on"><div className="toggle-knob" /></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Row ─────────────────────────────── */}
      <div className="stats-row animate-in-d2" style={{ marginTop: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-label">Today's Usage</div>
          <div className="stat-value">$1.32</div>
          <div className="stat-sub">264 transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">This Month</div>
          <div className="stat-value">$28.40</div>
          <div className="stat-sub">5,680 transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Cost / TX</div>
          <div className="stat-value" style={{ color: 'var(--bezhas-success)' }}>$0.005</div>
          <div className="stat-sub">−12% vs last month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Recharged</div>
          <div className="stat-value">$350.00</div>
          <div className="stat-sub">7 recharges (Stripe)</div>
        </div>
      </div>

      {/* ── Usage by App ──────────────────────────── */}
      <div className="card animate-in-d3" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Usage by App</span>
          <button className="btn-secondary" onClick={() => navigate('/analytics')}>Full Analytics</button>
        </div>
        <table className="usage-table">
          <thead>
            <tr>
              <th>Application</th>
              <th>Transactions</th>
              <th>Cost</th>
              <th>Period</th>
            </tr>
          </thead>
          <tbody>
            {RECENT_USAGE.map(row => (
              <tr key={row.app}>
                <td style={{ fontWeight: 500 }}>{row.app}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{row.txs}</td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--bezhas-accent)' }}>{row.cost}</td>
                <td style={{ color: 'var(--bezhas-text-muted)' }}>{row.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
