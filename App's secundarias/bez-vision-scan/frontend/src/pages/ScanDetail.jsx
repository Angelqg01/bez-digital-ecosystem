import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useContractCall, CONTRACTS } from '@bezhas/platform-sdk/blockchain';

export default function ScanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('split');
  const [scanData, setScanData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAssetData() {
      try {
        // En producción: leer metadata de IPFS usando el ID del token/RWA en LogisticsNFT
        // Para demo, simulamos la respuesta basada en el ID
        const fakeData = {
          id: id || 'V12-Cylinder',
          name: `Logistics Asset ${id || '001'}`,
          category: 'Industrial / Automotive',
          creator: 'BeZhas_Lab_04',
          valuation: '4,250 BEZ',
          yieldAPY: '+8.5%',
          txHash: '0x52Df82...044E',
          ipfsCid: 'QmXoyp...38vLp6Kz7f',
          contract: CONTRACTS.mainnet.logistics,
        };
        await new Promise(r => setTimeout(r, 600));
        setScanData(fakeData);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadAssetData();
  }, [id]);

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--bez-text-muted)' }}>Cargando datos RWA de la blockchain...</div>;
  }

  if (!scanData) return <div>Asset not found</div>;

  return (
    <>
      {/* Asset Header */}
      <div className="card" style={{ marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ width: 200, height: 200, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, #2a1a0a, #1a1a1a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80, flexShrink: 0 }}>⚙️</div>
          <div style={{ flex: 1 }}>
            <span className="badge badge-finalized">● Interactive Preview Ready</span>
            <span className="badge badge-logistic" style={{ marginLeft: 8 }}>HIGH FIDELITY</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginTop: 12 }}>{scanData.name}</h2>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button className="btn btn-primary">◎ Quick AR View</button>
              <button className="btn btn-outline">📁 Export Assets</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, marginTop: 20, fontSize: 13 }}>
              <div><span style={{ color: 'var(--bez-text-muted)' }}>Name</span><br />{scanData.id}</div>
              <div><span style={{ color: 'var(--bez-text-muted)' }}>Category</span><br />{scanData.category}</div>
              <div><span style={{ color: 'var(--bez-text-muted)' }}>Creator</span><br /><span style={{ color: 'var(--bez-teal)' }}>{scanData.creator}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* RWA Economics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div className="stat-label">RWA Economics</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>BeZhasRWAFactory</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bez-text-muted)' }}>Contract: {scanData.contract.substring(0, 12)}...</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <div><span style={{ color: 'var(--bez-text-muted)', fontSize: 11 }}>VALUATION</span><div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--bez-orange)', fontWeight: 700 }}>{scanData.valuation}</div></div>
            <div><span style={{ color: 'var(--bez-text-muted)', fontSize: 11 }}>Monthly Yield</span><div style={{ color: 'var(--bez-green)', fontWeight: 600, fontSize: 14, marginTop: 4 }}>{scanData.yieldAPY} APY</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
            <div className="stat-card"><div className="stat-label">Tokenization Fee</div><div style={{ fontSize: 13, fontWeight: 600 }}>100 BEZ (~$1)</div></div>
            <div className="stat-card"><div className="stat-label">Asset Category</div><div style={{ fontSize: 13, fontWeight: 600 }}>Industrial (RWA)</div></div>
          </div>
        </div>

        <div className="card">
          <div className="stat-label">On-Chain Identity</div>
          <div style={{ marginTop: 12, fontSize: 13 }}>
            <div style={{ marginBottom: 10 }}><span style={{ color: 'var(--bez-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Polygon TX Hash</span><div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bez-orange)', marginTop: 2 }}>{scanData.txHash} ↗</div></div>
            <div style={{ marginBottom: 10 }}><span style={{ color: 'var(--bez-text-muted)', fontSize: 11, textTransform: 'uppercase' }}>IPFS Content ID</span><div style={{ fontFamily: 'var(--font-mono)', marginTop: 2 }}>{scanData.ipfsCid} ↓</div></div>
            <div style={{ background: 'rgba(34,197,94,.1)', borderRadius: 'var(--radius-md)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>✅</span><span style={{ color: 'var(--bez-green)', fontWeight: 600, fontSize: 12 }}>MAINNET DEPLOYMENT VERIFIED</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>Manage Fractions</button>
            <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center', fontSize: 12, color: 'var(--bez-orange)' }}>Market Data</button>
          </div>
        </div>
      </div>

      {/* Comparison */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 12 }}>Scan Comparison Audit</h3>
        <div className="comparison-tabs">
          <div className={`comparison-tab ${tab === 'split' ? 'active' : ''}`} onClick={() => setTab('split')}>Split View</div>
          <div className={`comparison-tab ${tab === 'overlay' ? 'active' : ''}`} onClick={() => setTab('overlay')}>Overlay Mode</div>
        </div>
        <div className="split-view">
          <div className="split-panel" style={{ background: 'linear-gradient(135deg, #1a2a2a, #1a1a1a)', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, borderRadius: 'var(--radius-lg)' }}>
            🔩<span className="split-label origin">Origin</span><span className="split-date">Dec 12, 2023</span>
          </div>
          <div className="split-panel" style={{ background: 'linear-gradient(135deg, #2a1a0a, #1a1a1a)', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, borderRadius: 'var(--radius-lg)' }}>
            🔩<span className="split-label destination">Destination</span><span className="split-date">Dec 28, 2023</span>
          </div>
        </div>
        <div className="delta-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="card-title" style={{ color: 'var(--bez-text-sec)' }}>AI Analysis Delta</span>
            <span className="badge badge-warning">Attention Required</span>
          </div>
          <div className="delta-row"><div className="delta-label">📈 Surface Scratches</div><div className="delta-value danger">+12% detected</div></div>
          <div className="delta-row"><div className="delta-label">📐 Structural Deformation</div><div className="delta-value warning">0.02mm variance</div></div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>LIST ON MARKETPLACE</button>
      </div>
    </>
  );
}
