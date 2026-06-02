import React, { useState } from 'react';
import { useEdgeNodes } from '../hooks/useEdgeNodes';

const REWARD_HISTORY = [
  { date: '2026-05-03', points: 340, bez: 9.5, source: 'Validation + Vision relay', nodes: 3 },
  { date: '2026-05-02', points: 312, bez: 8.7, source: 'Validation + Vision relay', nodes: 3 },
  { date: '2026-05-01', points: 298, bez: 8.3, source: 'Validation', nodes: 2 },
  { date: '2026-04-30', points: 325, bez: 9.1, source: 'Validation + Vision relay', nodes: 3 },
  { date: '2026-04-29', points: 310, bez: 8.7, source: 'Validation', nodes: 3 },
  { date: '2026-04-28', points: 0, bez: 0, source: 'Maintenance window', nodes: 0 },
  { date: '2026-04-27', points: 345, bez: 9.7, source: 'Validation + Vision relay', nodes: 3 },
];

export default function Rewards() {
  const [claimed, setClaimed] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const { myNodes, claimRewards, isLoading } = useEdgeNodes();
  
  const totalPoints = myNodes.reduce((acc, n) => acc + (n.points || 0), 0);
  const pending = (totalPoints * 0.028).toFixed(2);
  const totalEarned = 4250;

  const handleClaim = async () => {
    setIsClaiming(true);
    try {
      const nodesWithPoints = myNodes.filter(n => n.points > 0);
      for (const node of nodesWithPoints) {
        await claimRewards(node.id);
      }
      setClaimed(true);
    } catch (err) {
      alert("Error claiming rewards: " + err.message);
    }
    setIsClaiming(false);
  };

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Node Rewards</h1>
        <p className="page-subtitle">Gana BEZ-Coin por validar datos y procesar visión en la red DePIN</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="animate-d1">
        {/* Pending Claim */}
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--bezhas-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Pending Rewards</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 800, color: '#10B981' }}>
            {claimed ? '0' : pending} <span style={{ fontSize: '1rem' }}>BEZ</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--bezhas-text-muted)', marginBottom: '1.5rem' }}>
            ≈ ${(claimed ? 0 : pending * 0.07).toFixed(2)} USD
          </div>
          <button className="btn-primary" style={{ maxWidth: '280px', width: '100%' }}
            disabled={claimed || pending <= 0 || isClaiming || isLoading} onClick={handleClaim}>
            {isClaiming ? 'Claiming...' : claimed ? '✅ Claimed!' : '💎 Claim Rewards'}
          </button>
          {claimed && <p style={{ fontSize: '0.75rem', color: '#10B981', marginTop: '0.75rem' }}>Sent to your BEZ Wallet · TX confirming...</p>}
        </div>

        {/* Lifetime Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="stat-card">
            <div className="stat-label">Total Earned (Lifetime)</div>
            <div className="stat-value">{totalEarned.toLocaleString()} BEZ</div>
            <div className="stat-sub">≈ ${(totalEarned * 0.07).toFixed(2)} USD</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Points Accumulated</div>
            <div className="stat-value" style={{ color: 'var(--bezhas-primary)' }}>{totalPoints.toLocaleString()}</div>
            <div className="stat-sub">Rank: #142 / 847 operators</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Reward Multiplier</div>
            <div className="stat-value" style={{ color: '#10B981' }}>2.4x</div>
            <div className="stat-sub">Standard tier + high uptime bonus</div>
          </div>
        </div>
      </div>

      {/* How Rewards Work */}
      <div className="card animate-d2" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>How Rewards Work</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {[
            { icon: '🔗', title: 'Block Validation', desc: 'Earn points for each block validated', rate: '1 pt/block' },
            { icon: '👁️', title: 'Vision Relay', desc: 'Process Gemini Vision requests at the edge', rate: '5 pts/scan' },
            { icon: '⏱️', title: 'Uptime Bonus', desc: '99%+ uptime = 1.5x multiplier', rate: '1.5x mult' },
            { icon: '⬆️', title: 'Tier Multiplier', desc: 'Enterprise nodes earn 5x base rate', rate: '1x-5x' },
          ].map(r => (
            <div key={r.title} style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{r.icon}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.25rem' }}>{r.title}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--bezhas-text-muted)', marginBottom: '0.5rem' }}>{r.desc}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>{r.rate}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily History */}
      <div className="card animate-d3">
        <div className="card-title" style={{ marginBottom: '1rem' }}>Daily Reward History</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              {['Date', 'Points', 'BEZ Earned', 'Source', 'Active Nodes'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: '0.7rem', color: 'var(--bezhas-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.75rem 1rem', borderBottom: '1px solid var(--bezhas-border-subtle)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REWARD_HISTORY.map(row => (
              <tr key={row.date}>
                <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--bezhas-border-subtle)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{row.date}</td>
                <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--bezhas-border-subtle)', fontFamily: 'var(--font-mono)', color: 'var(--bezhas-primary)' }}>{row.points}</td>
                <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--bezhas-border-subtle)', fontFamily: 'var(--font-mono)', color: '#10B981', fontWeight: 600 }}>{row.bez > 0 ? `+${row.bez}` : '—'}</td>
                <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--bezhas-border-subtle)', color: 'var(--bezhas-text-secondary)' }}>{row.source}</td>
                <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--bezhas-border-subtle)' }}>{row.nodes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
