import React, { useState } from 'react';

export default function Settings() {
  const [autoRecharge, setAutoRecharge] = useState(true);
  const [threshold, setThreshold] = useState('10');
  const [rechargeAmount, setRechargeAmount] = useState('50');
  const [alerts, setAlerts] = useState({ low: true, recharge: true, weekly: false, anomaly: true });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configura auto-recarga, alertas y permisos del Gas Tank</p>
      </div>

      {/* Auto-Recharge Config */}
      <div className="card animate-in-d1" style={{ marginBottom: '1.5rem', maxWidth: '600px' }}>
        <div className="card-header">
          <span className="card-title">Auto-Recharge</span>
          <button className={`toggle ${autoRecharge ? 'on' : ''}`} onClick={() => setAutoRecharge(!autoRecharge)}>
            <div className="toggle-knob" />
          </button>
        </div>

        {autoRecharge && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Trigger when balance drops below</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>$</span>
                <input className="form-input" type="number" value={threshold} onChange={e => setThreshold(e.target.value)}
                  style={{ maxWidth: '120px' }} min="5" max="100" />
                <span style={{ fontSize: '0.8rem', color: 'var(--bezhas-text-muted)' }}>
                  (~{Math.floor(parseInt(threshold || '0') / 0.005).toLocaleString()} txs)
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Recharge amount</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>$</span>
                <input className="form-input" type="number" value={rechargeAmount} onChange={e => setRechargeAmount(e.target.value)}
                  style={{ maxWidth: '120px' }} min="10" max="500" />
                <span style={{ fontSize: '0.8rem', color: 'var(--bezhas-text-muted)' }}>
                  (~{Math.floor(parseInt(rechargeAmount || '0') / 0.005).toLocaleString()} txs)
                </span>
              </div>
            </div>

            <div style={{
              padding: '0.75rem 1rem', background: 'var(--bezhas-success-bg)',
              borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--bezhas-success)',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              <span>✅</span>
              <span>Payment method: Visa •••• 4242 · Auto-recharge will use this card</span>
            </div>
          </div>
        )}
      </div>

      {/* Alert Preferences */}
      <div className="card animate-in-d2" style={{ marginBottom: '1.5rem', maxWidth: '600px' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Alert Preferences</div>
        {[
          { key: 'low', label: 'Low Balance Alert', desc: 'Notify when gas tank drops below threshold', icon: '⚠️' },
          { key: 'recharge', label: 'Recharge Confirmation', desc: 'Email receipt after each recharge', icon: '💳' },
          { key: 'weekly', label: 'Weekly Report', desc: 'Gas usage summary every Monday', icon: '📊' },
          { key: 'anomaly', label: 'Anomaly Detection', desc: 'Alert if usage spikes 300%+ above normal', icon: '🚨' },
        ].map(alert => (
          <div key={alert.key} style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '0.85rem 0', borderBottom: '1px solid var(--bezhas-border-subtle)'
          }}>
            <span style={{ fontSize: '1.2rem' }}>{alert.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{alert.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--bezhas-text-muted)' }}>{alert.desc}</div>
            </div>
            <button className={`toggle ${alerts[alert.key] ? 'on' : ''}`}
              onClick={() => setAlerts(prev => ({ ...prev, [alert.key]: !prev[alert.key] }))}>
              <div className="toggle-knob" />
            </button>
          </div>
        ))}
      </div>

      {/* Team Permissions */}
      <div className="card animate-in-d3" style={{ marginBottom: '1.5rem', maxWidth: '600px' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Team Permissions</div>
        {[
          { name: 'Admin (You)', role: 'Owner', did: 'did:bezhas:0x7a3...f4b2', canRecharge: true },
          { name: 'Maria García', role: 'CFO', did: 'did:bezhas:0x3bF...9aE7', canRecharge: true },
          { name: 'Carlos López', role: 'Operations', did: 'did:bezhas:0x8a2...c3D1', canRecharge: false },
        ].map(member => (
          <div key={member.did} style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '0.85rem 0', borderBottom: '1px solid var(--bezhas-border-subtle)'
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, var(--bezhas-primary), var(--bezhas-secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.85rem', fontWeight: 700, color: '#fff'
            }}>
              {member.name.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{member.name}</div>
              <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--bezhas-text-muted)' }}>
                {member.did}
              </div>
            </div>
            <span style={{
              fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)',
              background: member.role === 'Owner' ? 'rgba(var(--bezhas-accent-rgb),0.1)' : 'var(--bezhas-surface-2)',
              color: member.role === 'Owner' ? 'var(--bezhas-accent)' : 'var(--bezhas-text-secondary)',
              fontWeight: 600
            }}>
              {member.role}
            </span>
          </div>
        ))}
        <button className="btn-secondary" style={{ marginTop: '1rem', width: '100%' }}>
          + Invite Team Member
        </button>
      </div>

      {/* Save Button */}
      <div style={{ maxWidth: '600px' }}>
        <button className="btn-primary" onClick={handleSave}>
          {saved ? '✅ Settings Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
