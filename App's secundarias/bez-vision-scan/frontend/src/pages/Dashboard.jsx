import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContractCall, CONTRACTS } from '@bezhas/platform-sdk/blockchain';

const SECTORS = [
  { icon: '📦', name: 'Logistics', color: 'var(--bez-teal)' },
  { icon: '🏗️', name: 'Real Estate', color: 'var(--bez-orange)' },
  { icon: '🏥', name: 'Medical', color: '#8B5CF6' },
  { icon: '🏪', name: 'Rental', color: 'var(--bez-amber)' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [recentScans, setRecentScans] = useState([]);
  const [chainEvents, setChainEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const { read: readNFT } = useContractCall('BeZhasLogisticsNFT');

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch real data from the contract
        let fetchedScans = [];
        let fetchedEvents = [];

        try {
          // Intentamos leer el totalSupply del contrato real
          const totalSupply = await readNFT('totalSupply');
          const count = totalSupply ? Number(totalSupply.toString()) : 0;
          
          if (count > 0) {
            for (let i = 0; i < Math.min(2, count); i++) {
              const tokenId = count - i - 1;
              fetchedScans.push({
                id: `LOG-${tokenId}`,
                name: `On-Chain Asset #${tokenId}`,
                size: 'Verified',
                time: 'Recent',
                tag: 'NFT',
                tagClass: 'lidar',
                img: '📦'
              });
              fetchedEvents.push({
                type: 'verified',
                title: `NFT Minted (Token ${tokenId})`,
                hash: `0xBEZ...${tokenId}`,
                time: new Date().toLocaleTimeString()
              });
            }
          }
        } catch (contractError) {
          console.warn("No se pudo leer del contrato (quizás no está desplegado o el método no existe), usando fallback:", contractError);
        }

        // Fallback a datos simulados si la cadena está vacía o hubo error
        if (fetchedScans.length === 0) {
          fetchedScans = [
            { id: 'LOG-889', name: 'Contenedor #102', size: '18MB', time: 'Just now', tag: 'LIDAR', tagClass: 'lidar', img: '📦' },
            { id: 'RWA-304', name: 'Activo Inmobiliario', size: '54MB', time: '2 hours ago', tag: 'BIM', tagClass: 'bim', img: '🏢' },
          ];
          fetchedEvents = [
            { type: 'verified', title: 'NFT Minted (Tx_29)', hash: '0x8a2f...b3c9', time: new Date().toLocaleTimeString() },
            { type: 'confirmed', title: 'Quality Escrow Lock', hash: '0x4d1e...a1f0', time: '11:30:22' },
          ];
        }
        
        setRecentScans(fetchedScans);
        setChainEvents(fetchedEvents);
      } catch (error) {
        console.error("Error fetching blockchain data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (readNFT) {
      fetchDashboardData();
    }
  }, [readNFT]);

  return (
    <>
      {/* Recent Scans */}
      <div className="card-header">
        <h2 className="card-title">Recent Scans</h2>
        <button className="btn-ghost" onClick={() => navigate('/scans')}>View All</button>
      </div>

      <div className="scans-grid">
        {isLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--bez-text-muted)' }}>Cargando datos on-chain...</div>
        ) : recentScans.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--bez-text-muted)' }}>No hay escaneos recientes</div>
        ) : (
          recentScans.map(scan => (
            <div key={scan.id} className="scan-card card" onClick={() => navigate(`/scan/${scan.id}`)}>
              <div className="scan-img" style={{
                background: 'linear-gradient(135deg, var(--bez-surface-2), var(--bez-surface-3))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px'
              }}>
                {scan.img}
              </div>
              <span className={`scan-tag ${scan.tagClass}`}>{scan.tag}</span>
              <div className="scan-card-info">
                <h4>{scan.name}</h4>
                <div className="meta">
                  <span>{scan.size} · {scan.time}</span>
                  <span style={{ cursor: 'pointer' }}>⟳</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sector Shortcuts */}
      <h2 className="card-title" style={{ marginBottom: 14 }}>Sector Shortcuts</h2>
      <div className="sectors-grid">
        {SECTORS.map(s => (
          <div key={s.name} className="sector-card" onClick={() => navigate('/scans')}>
            <span className="sector-icon">{s.icon}</span>
            <span className="sector-name">{s.name}</span>
          </div>
        ))}
      </div>

      {/* Blockchain Status */}
      <div className="chain-status">
        <div className="chain-header">
          <h2 className="card-title">Blockchain Status</h2>
          <span className="badge badge-live">● LIVE</span>
        </div>

        <div className="chain-ledger">
          <span>🔗</span> BEZ-HAS Immutable Ledger <span style={{ marginLeft: 'auto', cursor: 'pointer' }}>⚙</span>
        </div>

        {isLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--bez-text-muted)', fontSize: 12 }}>Syncing with Polygon...</div>
        ) : (
          chainEvents.map((e, i) => (
            <div key={i} className="chain-event">
              <span className={`dot ${e.type}`}></span>
              <div>
                <div className="event-title">{e.title}</div>
                <div className="event-hash">{e.hash}</div>
              </div>
              <span className="event-time">{e.time}</span>
            </div>
          ))
        )}

        <button className="btn btn-audit" onClick={() => navigate('/blockchain')}>AUDIT FULL CHAIN</button>
      </div>
    </>
  );
}
