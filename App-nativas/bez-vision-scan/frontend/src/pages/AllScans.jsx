import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContractCall, CONTRACTS } from '@bezhas/platform-sdk/blockchain';

const badgeClass = t => t === 'LOGISTIC' ? 'badge-logistic' : t === 'REAL ESTATE' ? 'badge-realestate' : 'badge-medical';
const statusIcon = s => s === 'Verified' ? '✅' : s === 'Warning' ? '⚠️' : '⏳';
const scoreClass = s => s >= 90 ? 'high' : s >= 70 ? 'medium' : 'low';

export default function AllScans() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [statusFilter, setStatusFilter] = useState('All');
  const [scans, setScans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Hook to simulate blockchain read
  useEffect(() => {
    async function fetchAuditLog() {
      try {
        // En producción usa useContractCall para leer getPastEvents('Transfer') de LogisticsNFT
        const fetched = [
          { id: 'LOG-RT-4421', name: 'Cargo Unit #882-LX', type: 'LOGISTIC', status: 'Verified', hash: '0x4a2c...8f12', score: 98, date: 'Oct 24, 2023', time: '14:22:10 GMT' },
          { id: 'RWA-RE-909', name: 'Skyline Plaza B-4', type: 'REAL ESTATE', status: 'Warning', hash: '0x9e12...b66a', score: 72, date: 'Oct 24, 2023', time: '13:05:45 GMT' },
          { id: 'MED-EQ-9102', name: 'Quantum MRI-X1', type: 'MEDICAL', status: 'Pending', hash: '0xbc3d...7c41', score: null, date: 'Oct 23, 2023', time: '23:59:12 GMT' },
          { id: 'LOG-SH-8812', name: 'Horizon Freighter 5', type: 'LOGISTIC', status: 'Verified', hash: '0xf3e2...d912', score: 92, date: 'Oct 23, 2023', time: '21:15:30 GMT' },
          { id: 'RWA-RE-771', name: 'Downtown Retail Hub', type: 'REAL ESTATE', status: 'Verified', hash: '0x7a8b...cc33', score: 89, date: 'Oct 23, 2023', time: '18:44:02 GMT' },
        ];
        // Simulando delay de RPC
        await new Promise(r => setTimeout(r, 600));
        setScans(fetched);
      } catch (err) {
        console.error("Error reading blockchain logs", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAuditLog();
  }, []);

  const filtered = scans.filter(s =>
    (typeFilter === 'All Types' || s.type === typeFilter) &&
    (statusFilter === 'All' || s.status === statusFilter)
  );

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div>
          <p style={{ color: 'var(--bez-text-sec)', fontSize: 13 }}>Real-time surveillance for Logistics and RWA asset tokenization.</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button className="btn btn-outline">↓ Export CSV</button>
          <button className="btn btn-primary" onClick={() => navigate('/scan/new')}>+ New Audit Scan</button>
        </div>
      </div>

      <div className="filters">
        <div className="filter-chip">
          <span>Scan Type:</span>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option>All Types</option><option>LOGISTIC</option><option>REAL ESTATE</option><option>MEDICAL</option>
          </select>
        </div>
        <div className="filter-chip">
          <span>Status:</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option>All</option><option>Verified</option><option>Warning</option><option>Pending</option>
          </select>
        </div>
        <div className="filter-chip">Date Range: <select><option>Last 24 Hours</option><option>Last 7 Days</option><option>All Time</option></select></div>
        <span className="results-count">Showing {filtered.length} results</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="scan-table">
          <thead>
            <tr><th>Asset Name</th><th>Type</th><th>Timestamp</th><th>Status</th><th>Blockchain Hash</th><th>AI Audit Score</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--bez-text-muted)' }}>Conectando con Nodo RPC...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--bez-text-muted)' }}>No se encontraron registros on-chain.</td></tr>
            ) : (
              filtered.map(s => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/scan/${s.id}`)}>
                  <td>
                    <div className="asset-cell">
                      <div className="asset-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                        {s.type === 'LOGISTIC' ? '📦' : s.type === 'REAL ESTATE' ? '🏢' : '🏥'}
                      </div>
                      <div><div className="asset-name">{s.name}</div><div className="asset-sku">SKU: {s.id}</div></div>
                    </div>
                  </td>
                  <td><span className={`badge ${badgeClass(s.type)}`}>{s.type}</span></td>
                  <td><div>{s.date}</div><div style={{ fontSize: 11, color: 'var(--bez-text-muted)' }}>{s.time}</div></td>
                  <td><span style={{ color: s.status === 'Verified' ? 'var(--bez-green)' : s.status === 'Warning' ? 'var(--bez-amber)' : 'var(--bez-text-sec)' }}>{statusIcon(s.status)} {s.status}</span></td>
                  <td><span className="hash">{s.hash}</span></td>
                  <td>{s.score ? <div className={`audit-score ${scoreClass(s.score)}`}>{s.score}</div> : <div className="audit-score" style={{ border: '2px solid var(--bez-text-muted)', color: 'var(--bez-text-muted)' }}>--</div>}</td>
                  <td><button className="btn btn-outline" style={{ padding: '6px 16px', fontSize: 12 }} onClick={e => { e.stopPropagation(); }}>Compare</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button>‹</button><button className="active">1</button><button>2</button><button>3</button>
        <button style={{ width: 'auto', padding: '0 8px' }}>...</button><button>125</button><button>›</button>
        <div className="goto">Go to page: <input defaultValue="1" /> <button style={{ width: 'auto', padding: '0 12px' }}>Jump</button></div>
      </div>
    </>
  );
}
