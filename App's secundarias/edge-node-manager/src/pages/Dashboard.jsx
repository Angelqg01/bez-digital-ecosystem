import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useEdgeNodes } from '../hooks/useEdgeNodes';

export default function Dashboard() {
  const navigate = useNavigate();
  const { networkStats, myNodes, isLoading } = useEdgeNodes();

  if (isLoading && !networkStats) {
    return <div style={{ padding: '2rem', color: '#fff' }}>Loading Network Stats...</div>;
  }

  const net = networkStats || {
    totalNodes: 0, online: 0, syncing: 0, offline: 0, tps: 0, avgBlockTime: 0, status: 'unknown'
  };

  const totalPoints = myNodes.reduce((acc, n) => acc + (n.points || 0), 0);
  const pendingRewards = (totalPoints * 0.028).toFixed(2); // Mock conversion from points to BEZ

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">DePIN Network</h1>
        <p className="page-subtitle">Tus nodos Edge validando datos para el ecosistema BeZhas</p>
      </div>

      {/* Network Stats */}
      <div className="stats-row animate-d1">
        <div className="stat-card">
          <div className="stat-label">Your Nodes</div>
          <div className="stat-value">{myNodes.length}</div>
          <div className="stat-sub" style={{ color: '#10B981' }}>
            {myNodes.filter(n => n.status === 'online').length} online
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Points</div>
          <div className="stat-value" style={{ color: 'var(--bezhas-primary)' }}>{totalPoints.toLocaleString()}</div>
          <div className="stat-sub">+{(myNodes.length > 0 ? 340 : 0)} today</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Rewards</div>
          <div className="stat-value" style={{ color: '#10B981' }}>{pendingRewards} BEZ</div>
          <div className="stat-sub">≈ ${(pendingRewards * 0.07).toFixed(2)} USD</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Uptime</div>
          <div className="stat-value">{myNodes.length > 0 ? '99.4%' : '0%'}</div>
          <div className="stat-sub">Last 30 days</div>
        </div>
      </div>

      {/* Global Network Health */}
      <div className="card animate-d2" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Global Network Health</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#10B981' }}>● HEALTHY</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
          {[
            { label: 'Total Nodes', value: net.totalNodes, color: 'var(--bezhas-text)' },
            { label: 'Online', value: net.online, color: '#10B981' },
            { label: 'Network TPS', value: net.tps, color: 'var(--bezhas-primary)' },
            { label: 'Block Height', value: '1,847,293', color: 'var(--bezhas-text)' }, // Mocked
            { label: 'Avg Block Time', value: `${net.avgBlockTime}s`, color: 'var(--bezhas-text)' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--bezhas-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className="network-bar">
          <div className="network-bar-segment" style={{ width: '95.9%', background: '#10B981' }} />
          <div className="network-bar-segment" style={{ width: '2.7%', background: 'var(--bezhas-warning)' }} />
          <div className="network-bar-segment" style={{ width: '1.4%', background: 'var(--bezhas-error)' }} />
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', justifyContent: 'center' }}>
          {[['#10B981', 'Online 812'], ['var(--bezhas-warning)', 'Syncing 23'], ['var(--bezhas-error)', 'Offline 12']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--bezhas-text-muted)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}
            </div>
          ))}
        </div>
      </div>

      {/* Your Nodes */}
      <div className="animate-d3">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>Your Nodes</h2>
          <button className="btn-primary" style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }} onClick={() => navigate('/setup')}>
            + Deploy New Node
          </button>
        </div>
        <div className="node-grid">
          {myNodes.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
              <p style={{ color: 'var(--bezhas-text-muted)' }}>You don't have any Edge Nodes running yet.</p>
            </div>
          ) : myNodes.map(node => (
            <div key={node.id} className="node-card">
              <div className="node-header">
                <div className={`node-status ${node.status}`} />
                <div style={{ flex: 1 }}>
                  <div className="node-name">{node.name}</div>
                  <div className="node-id">{node.id} · {node.region} · {node.tier}</div>
                </div>
                <span style={{
                  fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: 'var(--radius-full)',
                  background: node.status === 'online' ? 'var(--bezhas-success-bg)' : 'var(--bezhas-warning-bg)',
                  color: node.status === 'online' ? '#10B981' : 'var(--bezhas-warning)',
                  fontWeight: 700, textTransform: 'uppercase'
                }}>{node.status}</span>
              </div>
              <div className="node-metrics">
                <div className="node-metric">
                  <div className="node-metric-label">CPU</div>
                  <div className="node-metric-value">{node.metrics?.cpu || 0}%</div>
                </div>
                <div className="node-metric">
                  <div className="node-metric-label">RAM</div>
                  <div className="node-metric-value">{node.metrics?.ram || 0}%</div>
                </div>
                <div className="node-metric">
                  <div className="node-metric-label">Uptime</div>
                  <div className="node-metric-value" style={{ color: '#10B981' }}>{node.uptime || '100%'}</div>
                </div>
                <div className="node-metric">
                  <div className="node-metric-label">Points</div>
                  <div className="node-metric-value" style={{ color: 'var(--bezhas-primary)' }}>{(node.points || 0).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--bezhas-text-muted)' }}>
                <span>Peers: {node.metrics?.peers || 0}</span>
                <span>Disk: {node.metrics?.disk || 0}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
