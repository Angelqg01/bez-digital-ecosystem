import React, { useState } from 'react';

export default function Receive() {
  const address = '0x7a3B9c1D4e5F6a8B2c0D3e4F5a6B7c8D9e0F4b2';
  const did = 'did:bezhas:0x7a3b9c1d4e5f6a8b2c0d3e4f5a6b7c8d9e0f4b2';
  const [copied, setCopied] = useState(false);
  const [showDID, setShowDID] = useState(false);

  const displayValue = showDID ? did : address;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayValue).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Receive BEZ</h1>
        <p className="page-subtitle">Comparte tu dirección o QR para recibir BEZ-Coin y activos RWA</p>
      </div>

      <div className="card form-section animate-in-delay-1" style={{ padding: '2rem' }}>
        <div className="qr-container">
          {/* QR Code placeholder — in production, use qrcode library */}
          <div className="qr-code-box">
            <div style={{
              width: 200, height: 200,
              background: 'linear-gradient(135deg, #0A0E1A, #111827)',
              borderRadius: '12px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
            }}>
              <div style={{ fontSize: '3rem' }}>⬡</div>
              <div style={{
                fontFamily: 'var(--font-display)', fontWeight: 800,
                fontSize: '1.2rem', color: '#00D4FF'
              }}>BEZ</div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.55rem',
                color: '#9CA3AF', maxWidth: '160px', textAlign: 'center',
                wordBreak: 'break-all'
              }}>
                {address}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`btn-secondary ${!showDID ? 'active' : ''}`}
              onClick={() => setShowDID(false)}
              style={{
                background: !showDID ? 'rgba(0, 212, 255, 0.1)' : undefined,
                borderColor: !showDID ? 'var(--bezhas-primary)' : undefined,
                color: !showDID ? 'var(--bezhas-primary)' : undefined,
              }}
            >
              Wallet Address
            </button>
            <button
              className={`btn-secondary ${showDID ? 'active' : ''}`}
              onClick={() => setShowDID(true)}
              style={{
                background: showDID ? 'rgba(123, 47, 255, 0.1)' : undefined,
                borderColor: showDID ? 'var(--bezhas-secondary)' : undefined,
                color: showDID ? 'var(--bezhas-secondary)' : undefined,
              }}
            >
              DID W3C
            </button>
          </div>

          <div className="address-copy" onClick={handleCopy}>
            <span className="address-copy-text">
              {displayValue.slice(0, 16)}...{displayValue.slice(-8)}
            </span>
            <span style={{ fontSize: '0.85rem' }}>
              {copied ? '✅' : '📋'}
            </span>
          </div>

          {copied && (
            <div style={{
              padding: '0.5rem 1rem', background: 'var(--bezhas-success-bg)',
              borderRadius: 'var(--radius-full)', color: 'var(--bezhas-success)',
              fontSize: '0.8rem', fontWeight: 600
            }}>
              Copied to clipboard!
            </div>
          )}
        </div>
      </div>

      {/* ── Network Info ────────────────────────── */}
      <div className="card form-section animate-in-delay-2" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Supported Networks</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { name: 'BeZhas L2', chain: '2708', status: 'active', color: 'var(--bezhas-primary)' },
            { name: 'Polygon', chain: '137', status: 'active', color: '#8247E5' },
            { name: 'Ethereum', chain: '1', status: 'bridge', color: '#627EEA' },
          ].map(net => (
            <div key={net.chain} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.65rem 0.85rem', background: 'var(--bezhas-surface-2)',
              borderRadius: 'var(--radius-md)', fontSize: '0.85rem'
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: net.color, boxShadow: `0 0 8px ${net.color}66`
              }} />
              <span style={{ flex: 1 }}>{net.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--bezhas-text-muted)' }}>
                Chain {net.chain}
              </span>
              <span style={{
                fontSize: '0.65rem', padding: '0.15rem 0.5rem',
                background: net.status === 'active' ? 'var(--bezhas-success-bg)' : 'var(--bezhas-warning-bg)',
                color: net.status === 'active' ? 'var(--bezhas-success)' : 'var(--bezhas-warning)',
                borderRadius: 'var(--radius-full)', fontWeight: 600, textTransform: 'uppercase'
              }}>
                {net.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
