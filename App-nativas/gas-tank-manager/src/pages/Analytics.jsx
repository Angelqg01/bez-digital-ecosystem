import React, { useState } from 'react';

const DAILY_DATA = [
  { day: 'Mon', txs: 890, cost: 4.45, apps: { Scanner: 340, Hub: 280, Capital: 170, Other: 100 } },
  { day: 'Tue', txs: 1120, cost: 5.60, apps: { Scanner: 450, Hub: 310, Capital: 220, Other: 140 } },
  { day: 'Wed', txs: 980, cost: 4.90, apps: { Scanner: 380, Hub: 260, Capital: 200, Other: 140 } },
  { day: 'Thu', txs: 1340, cost: 6.70, apps: { Scanner: 520, Hub: 380, Capital: 250, Other: 190 } },
  { day: 'Fri', txs: 1560, cost: 7.80, apps: { Scanner: 620, Hub: 420, Capital: 300, Other: 220 } },
  { day: 'Sat', txs: 420, cost: 2.10, apps: { Scanner: 180, Hub: 120, Capital: 60, Other: 60 } },
  { day: 'Sun', txs: 280, cost: 1.40, apps: { Scanner: 100, Hub: 80, Capital: 50, Other: 50 } },
];

const TOP_OPERATIONS = [
  { op: 'mintLogisticsNFT', app: 'BEZ Scanner', count: 1240, avgCost: '$0.008', total: '$9.92' },
  { op: 'registerSensorData', app: 'BEZ Scanner', count: 890, avgCost: '$0.004', total: '$3.56' },
  { op: 'transfer', app: 'BEZ Wallet', count: 680, avgCost: '$0.003', total: '$2.04' },
  { op: 'stake', app: 'BZ Capital', count: 340, avgCost: '$0.006', total: '$2.04' },
  { op: 'castVote', app: 'DAO Governance', count: 120, avgCost: '$0.002', total: '$0.24' },
  { op: 'createEscrow', app: 'Customs', count: 95, avgCost: '$0.012', total: '$1.14' },
];

export default function Analytics() {
  const [period, setPeriod] = useState('7d');
  const maxTxs = Math.max(...DAILY_DATA.map(d => d.txs));
  const totalTxs = DAILY_DATA.reduce((s, d) => s + d.txs, 0);
  const totalCost = DAILY_DATA.reduce((s, d) => s + d.cost, 0);

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Gas Analytics</h1>
        <p className="page-subtitle">Análisis detallado del consumo de gas por app y operación</p>
      </div>

      {/* Period selector */}
      <div className="animate-in-d1" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['24h', '7d', '30d', '90d'].map(p => (
          <button key={p} className="btn-secondary" onClick={() => setPeriod(p)} style={{
            background: period === p ? 'rgba(var(--bezhas-accent-rgb),0.1)' : undefined,
            borderColor: period === p ? 'var(--bezhas-accent)' : undefined,
            color: period === p ? 'var(--bezhas-accent)' : undefined,
            fontSize: '0.8rem', padding: '0.4rem 0.85rem'
          }}>{p}</button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="stats-row animate-in-d1">
        <div className="stat-card">
          <div className="stat-label">Total Transactions</div>
          <div className="stat-value">{totalTxs.toLocaleString()}</div>
          <div className="stat-sub" style={{ color: 'var(--bezhas-success)' }}>+18% vs prev period</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Gas Cost</div>
          <div className="stat-value" style={{ color: 'var(--bezhas-accent)' }}>${totalCost.toFixed(2)}</div>
          <div className="stat-sub">Avg $0.005 / tx</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Aegis Savings</div>
          <div className="stat-value" style={{ color: 'var(--bezhas-success)' }}>$4.80</div>
          <div className="stat-sub">Saved by timing optimization</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Apps</div>
          <div className="stat-value">6</div>
          <div className="stat-sub">of 14 ecosystem apps</div>
        </div>
      </div>

      {/* Bar Chart (CSS-only) */}
      <div className="card animate-in-d2" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Daily Transaction Volume</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--bezhas-text-muted)' }}>
            Last 7 days
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', height: '180px', paddingTop: '1rem' }}>
          {DAILY_DATA.map(d => {
            const height = (d.txs / maxTxs) * 100;
            return (
              <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--bezhas-text-muted)' }}>
                  {d.txs}
                </div>
                <div style={{
                  width: '100%', height: `${height}%`, minHeight: '8px',
                  background: `linear-gradient(180deg, var(--bezhas-accent), var(--bezhas-warning))`,
                  borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                  transition: 'height 0.5s ease',
                  position: 'relative',
                }}>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: `${(d.apps.Scanner / d.txs) * 100}%`,
                    background: 'rgba(0, 212, 255, 0.3)',
                    borderRadius: '0 0 0 0',
                  }} />
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--bezhas-text-muted)' }}>{d.day}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--bezhas-text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--bezhas-accent)' }} /> Total TXs
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--bezhas-text-muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(0,212,255,0.5)' }} /> Scanner
          </div>
        </div>
      </div>

      {/* Top Operations */}
      <div className="card animate-in-d3">
        <div className="card-header">
          <span className="card-title">Top Operations by Gas Cost</span>
        </div>
        <table className="usage-table">
          <thead>
            <tr>
              <th>Operation</th>
              <th>App</th>
              <th>Count</th>
              <th>Avg Cost</th>
              <th>Total Cost</th>
            </tr>
          </thead>
          <tbody>
            {TOP_OPERATIONS.map(op => (
              <tr key={op.op}>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--bezhas-primary)' }}>{op.op}</td>
                <td>{op.app}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{op.count.toLocaleString()}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{op.avgCost}</td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--bezhas-accent)', fontWeight: 600 }}>{op.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
