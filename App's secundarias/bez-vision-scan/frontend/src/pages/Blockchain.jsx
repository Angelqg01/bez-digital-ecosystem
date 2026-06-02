import React, { useState, useEffect } from 'react';
import { useContractCall, CONTRACTS } from '@bezhas/platform-sdk/blockchain';

export default function Blockchain() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadBlockchainEvents() {
      try {
        // En un entorno real se leen eventos emitidos por el contrato LogisticsNFT o QualityEscrow
        const fetchedEvents = [
          { type: 'CargoManifestMinted', desc: 'CID registered to decentralized storage', tx: '0x82...f9a1', time: '2 mins ago' },
          { type: 'EscrowLocked', desc: 'Asset locked in smart contract escrow', tx: '0xa4...e3d2', time: '5 mins ago' },
          { type: 'AssetTokenized', desc: 'ERC-721 mint complete on Polygon', tx: '0x1c...72b5', time: '12 mins ago' },
          { type: 'QualityVerified', desc: 'AI audit passed — score 98/100', tx: '0xd7...a1c3', time: '15 mins ago' },
          { type: 'SIFTRegistered', desc: 'Golden Image fingerprint stored', tx: '0x3f...9e21', time: '18 mins ago' },
        ];
        // Simular latencia de indexador RPC
        await new Promise(r => setTimeout(r, 800));
        setEvents(fetchedEvents);
      } catch (error) {
        console.error("Error reading events", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadBlockchainEvents();
  }, []);

  return (
    <>
      {/* Header Card */}
      <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: 32 }}>
        <span className="badge badge-verified" style={{ marginBottom: 12 }}>● ON-CHAIN VERIFIED</span>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>Proof of State #7721</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 500, margin: '20px auto 0' }}>
          <div className="stat-card"><div className="stat-label">Timestamp</div><div style={{ fontSize: 14, fontWeight: 600 }}>{new Date().toLocaleString()} UTC</div></div>
          <div className="stat-card"><div className="stat-label">Asset Class</div><div style={{ fontSize: 14, fontWeight: 600 }}>Logistics Box 3D Scan</div><div className="stat-sub">ID: #BEZ-88219</div></div>
        </div>
      </div>

      {/* Network Stats */}
      <h3 className="card-title" style={{ marginBottom: 12 }}>❄ Network Stats</h3>
      <div className="stats-row" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-label">Mainnet</div><div className="stat-value">Polygon (137)</div></div>
        <div className="stat-card"><div className="stat-label">Gas Used</div><div className="stat-value orange">214,532</div><div className="stat-sub">units</div></div>
        <div className="stat-card"><div className="stat-label">Block Number</div><div className="stat-value">48,921,034</div></div>
      </div>

      {/* Protocol Architecture */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 className="card-title">📋 Protocol Architecture</h3>
          <span className="badge badge-verified">● SDK Connected</span>
        </div>
        <div className="stat-card" style={{ marginBottom: 8 }}><div className="stat-label">LogisticsNFT Contract</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{CONTRACTS.mainnet.logistics}</div></div>
        <div className="stat-card"><div className="stat-label">QualityEscrow Contract</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{CONTRACTS.mainnet.escrow}</div></div>
      </div>

      {/* IPFS */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="card-title" style={{ marginBottom: 12 }}>🔗 IPFS Documentation</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span>📄</span><div><div style={{ fontWeight: 600, fontSize: 13 }}>Legal_Framework.pdf</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bez-text-muted)' }}>QmXoyp...3V6A</div></div></div>
          <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span>🗂️</span><div><div style={{ fontWeight: 600, fontSize: 13 }}>Spatial_Cloud_Data.obj</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bez-text-muted)' }}>QmZ4tk...9Yp2</div></div></div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>👁 View on Pinata</button>
      </div>

      {/* Event Log */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 16 }}>Blockchain Event Log</h3>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--bez-text-muted)' }}>Leyendo nodos RPC...</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--bez-text-muted)' }}>No hay eventos registrados</div>
        ) : (
          events.map((e, i) => (
            <div key={i} className="chain-event">
              <span className="dot verified"></span>
              <div>
                <div className="event-title">{e.type}</div>
                <div className="event-hash">{e.desc}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bez-text-muted)', marginTop: 2 }}>Tx: {e.tx} · {e.time}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
