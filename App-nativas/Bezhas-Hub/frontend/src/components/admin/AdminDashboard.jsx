import React from 'react';
import { Users, Shield, DollarSign, BarChart2 } from 'lucide-react';
import Card from '../ui/Card';
import './AdminComponents.css';

const AdminDashboard = () => {
  // Mock data for admin dashboard
  const stats = {
    newUsers: 24,
    pendingReports: 5,
    tvl: 1250345.78,
    marketplaceVolume: 15234.50
  };

  return (
    <div className="admin-dashboard">
      <h2>Dashboard del Administrador</h2>
      <div className="stats-grid">
        <Card className="stat-card-admin">
          <div className="stat-icon-admin users"><Users /></div>
          <div className="stat-info-admin">
            <div className="stat-value-admin">{stats.newUsers}</div>
            <div className="stat-label-admin">Nuevos Usuarios (24h)</div>
          </div>
        </Card>
        <Card className="stat-card-admin">
          <div className="stat-icon-admin reports"><Shield /></div>
          <div className="stat-info-admin">
            <div className="stat-value-admin">{stats.pendingReports}</div>
            <div className="stat-label-admin">Reportes Pendientes</div>
          </div>
        </Card>
        <Card className="stat-card-admin">
          <div className="stat-icon-admin tvl"><DollarSign /></div>
          <div className="stat-info-admin">
            <div className="stat-value-admin">${stats.tvl.toLocaleString()}</div>
            <div className="stat-label-admin">Total Valor Bloqueado (TVL)</div>
          </div>
        </Card>
        <Card className="stat-card-admin">
          <div className="stat-icon-admin volume"><BarChart2 /></div>
          <div className="stat-info-admin">
            <div className="stat-value-admin">${stats.marketplaceVolume.toLocaleString()}</div>
            <div className="stat-label-admin">Volumen Marketplace (24h)</div>
          </div>
        </Card>
      </div>
      {/* Add charts and other widgets here */}
    </div>
  );
};

export default AdminDashboard; 
