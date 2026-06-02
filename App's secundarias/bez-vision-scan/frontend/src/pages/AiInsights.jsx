import React, { useState, useEffect } from 'react';
import { useGeminiVision } from '@bezhas/platform-sdk/vision';

export default function AiInsights() {
  const [insightData, setInsightData] = useState(null);
  const { analyzeAsset, isAnalyzing, error } = useGeminiVision();

  useEffect(() => {
    async function loadOracleInsights() {
      try {
        // En producción: llamar a la API del AI Oracle a través del SDK
        const result = await analyzeAsset('mock-image-data-or-url', 'quality-check');
        
        // Mapeamos el resultado de VisionResult (fingerprintHash, verdict, metadata, etc.)
        if (result) {
          setInsightData({
            assetId: result.metadata?.assetId || 'BZ-99281',
            scanDate: new Date().toLocaleDateString(),
            scratchesDelta: result.metadata?.scratchesDelta || '+12.4%',
            integrityDelta: result.metadata?.integrityDelta || '-2.1%',
            fatigueStatus: result.verdict === 'REJECTED' ? 'High Risk' : (result.metadata?.fatigueStatus || 'Normal'),
            elasticityLoss: result.metadata?.elasticityLoss || '-5.0%',
            valueLossBez: result.metadata?.valueLossBez || '2,450',
            valueLossUsd: result.metadata?.valueLossUsd || '$1,182.00',
            txHash: result.fingerprintHash || '0x71C4...3a4E',
            carrier: result.metadata?.carrier || 'J. Henderson',
            receiver: result.metadata?.receiver || 'Sarah Zhang'
          });
        }
      } catch (err) {
        console.error("Error reading AI insights from SDK", err);
        // Fallback
        setInsightData({
          assetId: 'BZ-99281',
          scanDate: new Date().toLocaleDateString(),
          scratchesDelta: '+12.4%',
          integrityDelta: '-2.1%',
          fatigueStatus: 'High Risk',
          elasticityLoss: '-5.0%',
          valueLossBez: '2,450',
          valueLossUsd: '$1,182.00',
          txHash: '0x71C4...3a4E',
          carrier: 'J. Henderson',
          receiver: 'Sarah Zhang'
        });
      }
    }
    
    loadOracleInsights();
  }, [analyzeAsset]);

  if (isAnalyzing || (!insightData && !error)) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--bez-text-muted)' }}>Cargando análisis del AI Oracle (SDK)...</div>;
  }

  if (!insightData) return <div>No insights available</div>;

  return (
    <>
      <div className="card" style={{ marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className="badge badge-finalized">Finalized</span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: '12px 0 4px' }}>AI Audit Report</h2>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
          <div style={{ width: 180, height: 140, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, #0a2a2a, #1a1a2a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60 }}>⚙️</div>
          <div>
            <div className="stat-label">Asset Summary</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>Asset ID: {insightData.assetId}</div>
            <div style={{ fontSize: 13, color: 'var(--bez-text-sec)', marginTop: 4 }}>📅 Scan Date: {insightData.scanDate}</div>
            <button className="btn btn-primary" style={{ marginTop: 12 }}>View 3D Model</button>
          </div>
        </div>
      </div>

      <h3 className="card-title" style={{ marginBottom: 12 }}>📊 Damage & Delta Analysis</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-label">Surface Scratches</div><div className="stat-value" style={{ color: 'var(--bez-red)' }}>{insightData.scratchesDelta} 📈</div></div>
        <div className="stat-card"><div className="stat-label">Structural Integrity</div><div className="stat-value" style={{ color: 'var(--bez-teal)' }}>{insightData.integrityDelta} 📉</div></div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div className="stat-label">Material Fatigue</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{insightData.fatigueStatus}</div><div style={{ color: 'var(--bez-red)', fontSize: 13 }}>{insightData.elasticityLoss} Elasticity</div></div>
          <span className="badge badge-critical">Critical</span>
        </div>
        <div className="progress-bar" style={{ marginTop: 12 }}><div className="progress-fill" style={{ width: '78%', background: 'linear-gradient(90deg, var(--bez-red), var(--bez-amber))' }}></div></div>
      </div>

      <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(255,107,0,.3)', background: 'rgba(255,107,0,.05)' }}>
        <div className="stat-label">💰 Financial Impact</div>
        <div style={{ display: 'flex', gap: 40, marginTop: 12 }}>
          <div><div style={{ fontSize: 11, color: 'var(--bez-text-muted)' }}>Estimated Value Loss</div><div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--bez-orange)' }}>{insightData.valueLossBez} <span style={{ fontSize: 14 }}>BEZ</span></div></div>
          <div><div style={{ fontSize: 11, color: 'var(--bez-text-muted)' }}>USD Equivalent</div><div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700 }}>{insightData.valueLossUsd}</div></div>
        </div>
        <div className="card" style={{ marginTop: 16, background: 'rgba(239,68,68,.1)', borderColor: 'rgba(239,68,68,.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 18 }}>⚠️</span>
            <div><div style={{ fontWeight: 700, fontSize: 13 }}>Recommendation</div><div style={{ fontSize: 13, color: 'var(--bez-text-sec)' }}>Claim Required: Immediate Action</div></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 50, height: 50, borderRadius: 'var(--radius-md)', background: 'var(--bez-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔒</div>
          <div><div style={{ fontWeight: 700, fontSize: 14 }}>Blockchain Certificate</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bez-text-sec)' }}>HASH: {insightData.txHash}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}><span className="badge badge-logistic">Polygon Mainnet</span><span className="badge badge-finalized">IPFS Record</span></div></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, fontSize: 13 }}>
        <div><div className="stat-label">Origin Carrier</div><div style={{ color: 'var(--bez-orange)', fontWeight: 600, fontSize: 15, marginTop: 4 }}>{insightData.carrier}</div><div style={{ color: 'var(--bez-text-muted)', fontSize: 11 }}>Digitally Verified 10:42 AM</div></div>
        <div><div className="stat-label">Destination Receiver</div><div style={{ color: 'var(--bez-orange)', fontWeight: 600, fontSize: 15, marginTop: 4 }}>{insightData.receiver}</div><div style={{ color: 'var(--bez-text-muted)', fontSize: 11 }}>Digitally Verified 11:15 AM</div></div>
      </div>

      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 15 }}>🔥 Initiate Claim</button>
      <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}>📄 Export PDF Report</button>
    </>
  );
}
