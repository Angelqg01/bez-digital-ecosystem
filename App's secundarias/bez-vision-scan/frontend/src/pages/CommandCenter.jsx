import React from 'react';

const TELEMETRY = [
  { time: '14:22:01', tag: 'verified', text: 'Golden Image Hash: BZ-993-X' },
  { time: '14:21:55', tag: 'warning', text: 'Stability Threshold Low: Ship A1' },
  { time: '14:21:40', tag: 'sync', text: 'Customs API Handshake v4.2' },
  { time: '14:21:12', tag: 'verified', text: 'Cargo ID: #TR-4422 Accepted' },
  { time: '14:20:58', tag: 'sdk', text: 'Encrypted Payload Transmitted' },
  { time: '14:20:45', tag: 'verified', text: 'Golden Image Hash: BZ-993-Y' },
];

const ROUTES = [
  { type: 'VESSEL', count: 124 }, { type: 'LAND', count: 48 }, { type: 'PORT', count: 12 },
];

export default function CommandCenter() {
  return (
    <>
      {/* Header Stats */}
      <div className="cmd-header">
        <div className="cmd-stat"><div className="label">System</div><div className="value operational">Operational</div></div>
        <div className="cmd-stat"><div className="label">Latency</div><div className="value">12ms</div></div>
        <div className="cmd-stat"><div className="label">SDK Connectivity</div><div className="value active">Active</div></div>
        <div className="cmd-stat"><div className="label">Global Stability</div><div className="value orange">98.4%</div></div>
        <div className="cmd-stat"><div className="label">Claims Prevented</div><div className="value">1,204</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginTop: 16 }}>
        {/* Active Transit Routes */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">● Active Transit Routes</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {ROUTES.map(r => (
              <span key={r.type} className="badge" style={{ background: r.type === 'VESSEL' ? 'var(--bez-orange-dim)' : 'var(--bez-surface-2)', color: r.type === 'VESSEL' ? 'var(--bez-orange)' : 'var(--bez-text-sec)', border: '1px solid var(--bez-border)' }}>
                {r.type}: {r.count}
              </span>
            ))}
          </div>
          <div style={{ height: 200, background: 'var(--bez-surface-2)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bez-text-muted)' }}>🌍 Route Map Visualization</div>
          </div>
          <div className="card" style={{ marginTop: 12, background: 'var(--bez-surface-2)' }}>
            <div className="stat-label">Current Focus</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>Atlantic Route Alpha-4</div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: '67%' }}></div></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--bez-text-muted)' }}>
              <span>EST: 14h 22m</span><span>67% Complete</span>
            </div>
          </div>
        </div>

        {/* Stability Matrix */}
        <div className="card">
          <div className="card-header"><span className="card-title">Stability Matrix</span></div>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto' }}>
              <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--bez-surface-3)" strokeWidth="8" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--bez-orange)" strokeWidth="8" strokeDasharray={`${2 * Math.PI * 52 * 0.984} ${2 * Math.PI * 52}`} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>98</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-display)', marginTop: 8 }}>98.4%</div>
            <div style={{ fontSize: 12, color: 'var(--bez-text-muted)' }}>System Confidence</div>
          </div>
          <div className="stat-card" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="stat-label">Active Scan IDs</span><span style={{ color: 'var(--bez-orange)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>41,209</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            <div className="stat-card" style={{ textAlign: 'center', padding: 10 }}><div style={{ fontSize: 11 }}>Fingerprint</div><div style={{ color: 'var(--bez-green)', fontSize: 16 }}>●</div></div>
            <div className="stat-card" style={{ textAlign: 'center', padding: 10 }}><div style={{ fontSize: 11 }}>Stowage</div><div style={{ color: 'var(--bez-green)', fontSize: 16 }}>●</div></div>
            <div className="stat-card" style={{ textAlign: 'center', padding: 10 }}><div style={{ fontSize: 11 }}>Sync</div><div style={{ color: 'var(--bez-amber)', fontSize: 16 }}>●</div></div>
          </div>
          <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }}>⚡ Run System Diagnostic</button>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        {/* Live Telemetry */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span className="card-title">Live Telemetry</span>
            <span className="badge badge-live">Live Stream</span>
          </div>
          <div className="telemetry-feed">
            {TELEMETRY.map((t, i) => (
              <div key={i} className="telemetry-entry">
                <span className="time">{t.time}</span>
                <span className={`tag ${t.tag}`}>{t.tag.toUpperCase()}</span>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Throughput Analytics */}
        <div className="card">
          <span className="card-title">Throughput Analytics</span>
          <div style={{ marginTop: 12, marginBottom: 16 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700 }}>14m</span>
            <span style={{ fontSize: 13, color: 'var(--bez-text-sec)', marginLeft: 8 }}>avg. Customs Latency</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: 160, gap: 8, padding: '0 8px' }}>
            {[45, 55, 40, 65, 50, 70, 75, 60, 80, 85, 70, 90].map((h, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'stretch' }}>
                <div style={{ height: h * 1.4, background: i === 11 ? 'var(--bez-orange)' : 'var(--bez-surface-3)', borderRadius: '3px 3px 0 0', transition: 'height .3s' }}></div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--bez-text-muted)', marginTop: 6, padding: '0 8px' }}>
            <span>24H AGO</span><span>18H</span><span>12H</span><span>6H</span><span>CURRENT</span>
          </div>
        </div>
      </div>

      {/* Footer Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--bez-border)', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--bez-text-muted)' }}>
        <div style={{ display: 'flex', gap: 20 }}>
          <span>● <span style={{ color: 'var(--bez-green)' }}>UPLINK: ACTIVE</span></span>
          <span>● <span style={{ color: 'var(--bez-green)' }}>CARGO FINGERPRINT: SYNCED</span></span>
          <span>● <span style={{ color: 'var(--bez-amber)' }}>SMART STOWAGE: RECALCULATING...</span></span>
        </div>
        <span>BUILD v4.11.0 // SESSION: 449-ALPHA</span>
      </div>
    </>
  );
}
