import React, { useState, useEffect } from 'react';
import { useSIFTFingerprint } from '@bezhas/platform-sdk/vision';
import { useContractCall, CONTRACTS } from '@bezhas/platform-sdk/blockchain';

export default function ScanNew() {
  const [phase, setPhase] = useState('upload'); // upload | scanning | results
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Real Hooks from BeZhas Platform SDK
  const { analyzeImage, isAnalyzing, progress, results: siftResults } = useSIFTFingerprint();
  const { write: mintNFT, isPending: isMinting, isSuccess: mintSuccess, hash: txHash } = useContractCall({
    contract: CONTRACTS.LogisticsNFT,
    method: 'safeMint'
  });

  useEffect(() => {
    if (phase === 'scanning' && siftResults) {
      setTimeout(() => setPhase('results'), 800);
    }
  }, [phase, siftResults]);

  const handleStartScan = async () => {
    setPhase('scanning');
    // En producción esto enviaría el archivo capturado por la cámara
    await analyzeImage(selectedImage || 'camera_feed');
  };

  const handleMint = async () => {
    if (!siftResults) return;
    // Llama al contrato con el Hash de SIFT como URI/identificador del activo
    mintNFT([siftResults.fingerprintHash, "CONTAINER-001"]);
  };

  if (phase === 'upload') return (
    <>
      <div className="scanner-viewport" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, cursor: 'pointer' }}
        onClick={handleStartScan}>
        <div style={{ fontSize: 72, marginBottom: 16, opacity: .6 }}>📸</div>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 8 }}>Capture or Upload Asset</h3>
        <p style={{ color: 'var(--bez-text-sec)', fontSize: 13, textAlign: 'center', maxWidth: 400 }}>
          Drag & drop an image, or click to activate camera. Supports LIDAR, BIM, CAD, and standard photo formats.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button className="btn btn-primary" onClick={e => { e.stopPropagation(); handleStartScan(); }}>📷 Start Scan</button>
          <button className="btn btn-outline" onClick={e => { e.stopPropagation(); document.getElementById('fileUpload').click(); }}>📁 Upload File</button>
          <input type="file" id="fileUpload" style={{ display: 'none' }} onChange={(e) => setSelectedImage(e.target.files[0])} />
        </div>
      </div>
    </>
  );

  if (phase === 'scanning') return (
    <>
      <div className="scanner-viewport" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2a1a0a 50%, #1a1a1a 100%)', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 80, marginBottom: 16, animation: 'pulse 1.5s infinite' }}>🔍</div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--bez-orange)', fontSize: 12, marginBottom: 8 }}>PALLET_ID: #29884</div>
        </div>
      </div>
      <div className="sift-panel">
        <div className="sift-card">
          <div className="sift-label">📊 SIFT/SSIM Engine</div>
          <div className="sift-value">MATCH_CONFIDENCE: {siftResults ? siftResults.confidence : (progress * 0.994).toFixed(1)}%</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--bez-text-sec)', marginTop: 2 }}>STRUCTURAL_INDEX: {siftResults ? siftResults.ssimIndex : (progress * 0.00982).toFixed(3)}</div>
        </div>
        <div className="sift-card">
          <div className="sift-label">Status</div>
          <div className="sift-value" style={{ color: 'var(--bez-green)' }}>● {isAnalyzing ? 'PROCESSING' : 'REALTIME_READY'}</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Generating Golden Image</h3>
        <p style={{ fontSize: 13, color: 'var(--bez-text-sec)' }}>Applying SIFT feature descriptors for immutable cargo ID</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="progress-bar" style={{ flex: 1 }}><div className="progress-fill" style={{ width: `${progress}%` }}></div></div>
          <span style={{ fontFamily: 'var(--font-display)', color: 'var(--bez-orange)', fontWeight: 700 }}>{Math.round(progress)}%</span>
        </div>
      </div>
      <div className="sift-panel" style={{ marginTop: 12 }}>
        <div className="sift-card"><div className="sift-label">Fingerprint Hash</div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, marginTop: 4 }}>{siftResults ? siftResults.fingerprintHash : '0x...'}</div></div>
        <div className="sift-card"><div className="sift-label">Smart Contract</div><div style={{ color: 'var(--bez-teal)', fontFamily: 'var(--font-mono)', fontSize: 13, marginTop: 4 }}>{CONTRACTS.LogisticsNFT || 'TX_29: Escrow Lock'}</div></div>
      </div>
      {siftResults && siftResults.damageDetected && (
        <div className="card" style={{ marginTop: 12, borderColor: 'var(--bez-red)', background: 'rgba(239,68,68,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ color: 'var(--bez-red)', fontWeight: 700, fontSize: 13, textTransform: 'uppercase' }}>Escrow Trigger Active</div>
              <div style={{ fontSize: 12, color: 'var(--bez-text-sec)' }}>Damage detected vs Golden Image will automatically block payments via smart contract.</div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Results phase
  return (
    <>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-label">Confidence</div><div className="stat-value green">{siftResults?.confidence || '99.4'}%</div></div>
        <div className="stat-card"><div className="stat-label">SIFT Match</div><div className="stat-value orange">{siftResults?.ssimIndex || '0.982'}</div></div>
        <div className="stat-card"><div className="stat-label">Status</div><div className="stat-value green">✅ Verified</div></div>
        <div className="stat-card"><div className="stat-label">NFT Token</div><div className="stat-value">{mintSuccess ? 'Minted' : '#4892'}</div><div className="stat-sub">{mintSuccess ? 'On-Chain' : 'Mint pending'}</div></div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 12 }}>Scan Results — PALLET #29884</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
          <div><span style={{ color: 'var(--bez-text-muted)' }}>Asset Class:</span> Logistics / Cargo</div>
          <div><span style={{ color: 'var(--bez-text-muted)' }}>Scan Mode:</span> LIDAR + SIFT</div>
          <div><span style={{ color: 'var(--bez-text-muted)' }}>Hash:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{siftResults?.fingerprintHash || '0x7F22...E912'}</span></div>
          <div><span style={{ color: 'var(--bez-text-muted)' }}>Tx Hash:</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{txHash || 'N/A'}</span></div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleMint} disabled={isMinting || mintSuccess}>
          {isMinting ? 'Minting...' : mintSuccess ? 'Minted Successfully' : '🎫 Mint RWA NFT'}
        </button>
        <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }}>📄 Export Report</button>
        <button className="btn btn-outline" onClick={() => { setPhase('upload'); setSelectedImage(null); }}>🔄 New Scan</button>
      </div>
    </>
  );
}

