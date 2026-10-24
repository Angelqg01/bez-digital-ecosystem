import React from 'react';
import { useNavigate } from 'react-router-dom';
import BetaNotice from '../components/BetaNotice';

const STATS = ['Consumo de hoy', 'Este mes', 'Coste medio / tx', 'Total recargado'];

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-header animate-in">
        <h1 className="page-title">Gas Tank Dashboard</h1>
        <p className="page-subtitle">Gestión centralizada de gas — tu equipo nunca toca crypto</p>
      </div>

      <BetaNotice />

      <div className="card animate-in-d1" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', marginBottom: '1.5rem' }}>
        <div className="tank-gauge">
          <div className="tank-gauge-circle" style={{ '--fill-deg': '0deg' }}>
            <div className="tank-gauge-inner">
              <div className="tank-gauge-value">—</div>
              <div className="tank-gauge-label">Balance</div>
            </div>
          </div>
        </div>
        <button className="btn-primary" style={{ marginTop: '1.5rem', maxWidth: '240px' }} onClick={() => navigate('/recharge')}>
          💳 Solicitar recarga
        </button>
      </div>

      <div className="stats-row animate-in-d2">
        {STATS.map((label) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">—</div>
            <div className="stat-sub">Sin datos</div>
          </div>
        ))}
      </div>
    </div>
  );
}
