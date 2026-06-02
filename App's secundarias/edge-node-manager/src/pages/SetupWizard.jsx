import React, { useState } from 'react';
import { useEdgeNodes } from '../hooks/useEdgeNodes';
import { useNavigate } from 'react-router-dom';

const STEPS = ['Requirements', 'Configuration', 'API Key', 'Deploy'];

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState({ name: '', region: 'EU-West', tier: 'standard' });
  const [registrationData, setRegistrationData] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const { registerNode } = useEdgeNodes();
  const navigate = useNavigate();

  const content = [
    // Step 0: Requirements
    <div key="req" className="wizard-content">
      <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>System Requirements</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[
          { label: 'OS', value: 'Ubuntu 22.04+ / Windows Server 2022+ / macOS 13+', ok: true },
          { label: 'CPU', value: '4+ cores (8 recommended)', ok: true },
          { label: 'RAM', value: '8 GB minimum (16 GB recommended)', ok: true },
          { label: 'Storage', value: '100 GB SSD (NVMe preferred)', ok: true },
          { label: 'Network', value: '100 Mbps stable connection', ok: true },
          { label: 'Ports', value: '30303 (P2P), 8545 (RPC), 8546 (WS)', ok: false },
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', background: 'var(--bezhas-surface-2)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '1.1rem' }}>{r.ok ? '✅' : '⚠️'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{r.label}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--bezhas-text-muted)' }}>{r.value}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', background: 'var(--bezhas-warning-bg)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--bezhas-warning)' }}>
        ⚠️ Ensure ports 30303, 8545, 8546 are open in your firewall
      </div>
    </div>,

    // Step 1: Configuration
    <div key="conf" className="wizard-content">
      <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Node Configuration</h2>
      <div className="form-group">
        <label className="form-label">Node Name</label>
        <input className="form-input" placeholder="e.g. Madrid-Prod-03" value={config.name} onChange={e => setConfig({ ...config, name: e.target.value })} style={{ fontFamily: 'var(--font-body)' }} />
      </div>
      <div className="form-group">
        <label className="form-label">Region</label>
        <select className="form-input" value={config.region} onChange={e => setConfig({ ...config, region: e.target.value })} style={{ fontFamily: 'var(--font-body)' }}>
          {['EU-West', 'EU-South', 'US-East', 'US-West', 'LATAM', 'Asia-Pacific'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Node Tier</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
          {[
            { id: 'lite', name: 'Lite', desc: 'Light validation, lower rewards', mult: '1x' },
            { id: 'standard', name: 'Standard', desc: 'Full validation + Vision relay', mult: '2x' },
            { id: 'enterprise', name: 'Enterprise', desc: 'Full + AI inference at the edge', mult: '5x' },
          ].map(t => (
            <div key={t.id} onClick={() => setConfig({ ...config, tier: t.id })} style={{
              padding: '1rem', background: config.tier === t.id ? 'rgba(16,185,129,0.08)' : 'var(--bezhas-surface-2)',
              border: `2px solid ${config.tier === t.id ? '#10B981' : 'var(--bezhas-border-subtle)'}`,
              borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center'
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '0.25rem' }}>{t.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--bezhas-text-muted)', marginBottom: '0.5rem' }}>{t.desc}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#10B981', fontWeight: 700 }}>Rewards: {t.mult}</div>
            </div>
          ))}
        </div>
      </div>
    </div>,

    // Step 2: API Key
    <div key="api" className="wizard-content">
      <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Generate API Key</h2>
      {isRegistering ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>Registrando nodo en BeZhas Network...</div>
      ) : registrationData ? (
        <>
          <p style={{ color: 'var(--bezhas-text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            This API key authenticates your node with the BeZhas network. Keep it secure.
          </p>
          <div style={{ padding: '1.25rem', background: 'var(--bezhas-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bezhas-border)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--bezhas-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Your API Key</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', wordBreak: 'break-all', background: 'var(--bezhas-bg)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
              {registrationData.node.apiKey}
            </div>
            <button className="btn-secondary" style={{ marginTop: '0.75rem', width: '100%' }} onClick={() => navigator.clipboard?.writeText(registrationData.node.apiKey)}>
              📋 Copy to Clipboard
            </button>
          </div>
          <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', background: 'var(--bezhas-success-bg)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: '#10B981' }}>
            ✅ API key generated and linked to your DID
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--bezhas-error)' }}>Error al registrar nodo.</div>
      )}
    </div>,

    // Step 3: Deploy
    <div key="deploy" className="wizard-content">
      <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Deploy Your Node</h2>
      <p style={{ color: 'var(--bezhas-text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Run this command on your server to start the BeZhas Edge Node:
      </p>
      {registrationData && (
        <>
          <div style={{ background: '#0D1117', border: '1px solid var(--bezhas-border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', lineHeight: 1.8, overflowX: 'auto' }}>
            <div style={{ color: '#8B949E' }}># Install BeZhas Node</div>
            <div style={{ color: '#C9D1D9' }}>curl -fsSL https://get.bez.digital/node | bash</div>
            <br />
            <div style={{ color: '#8B949E' }}># Configure and start</div>
            <div style={{ color: '#C9D1D9' }}>{registrationData.deployCommand.split(' && ')[0]} \</div>
            <div style={{ color: '#C9D1D9', paddingLeft: '1rem' }}>&& {registrationData.deployCommand.split(' && ')[1]}</div>
          </div>
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bezhas-surface-2)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Or use Docker:</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--bezhas-text-secondary)' }}>
              {registrationData.dockerCommand}
            </div>
          </div>
        </>
      )}
    </div>,
  ];

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Deploy New Node</h1>
        <p className="page-subtitle">Wizard paso a paso para unirte a la red DePIN de BeZhas</p>
      </div>

      {/* Progress Steps */}
      <div className="wizard-steps animate-d1">
        {STEPS.map((s, i) => (
          <div key={s} className={`wizard-step ${i < step ? 'done' : i === step ? 'active' : ''}`} />
        ))}
      </div>
      <div className="animate-d1" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1, textAlign: 'center', fontSize: '0.7rem', color: i <= step ? '#10B981' : 'var(--bezhas-text-muted)', fontWeight: i === step ? 700 : 400 }}>{s}</div>
        ))}
      </div>

      {/* Content */}
      <div className="card animate-d2" style={{ padding: '2rem' }}>
        {content[step]}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
          {step > 0 && <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setStep(step - 1)}>← Back</button>}
          <button 
            className="btn-primary" 
            style={{ flex: 1 }} 
            onClick={async () => {
              if (step === 1) { // Moving from Config to API Key
                setIsRegistering(true);
                setStep(2);
                try {
                  const data = await registerNode(config);
                  setRegistrationData(data);
                } catch (e) {
                  alert("Error registrando nodo: " + e.message);
                  setStep(1);
                }
                setIsRegistering(false);
              } else if (step < 3) {
                setStep(step + 1);
              } else {
                navigate('/');
              }
            }}
          >
            {step === 3 ? '✅ Done — Go to Dashboard' : isRegistering ? 'Registering...' : `Next: ${STEPS[step + 1]} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
