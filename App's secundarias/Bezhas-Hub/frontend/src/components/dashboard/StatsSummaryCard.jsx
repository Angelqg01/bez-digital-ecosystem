import React from 'react';
import Card from '../ui/Card';
import { BarChart2 } from 'lucide-react';
import './DashboardComponents.css';

const StatsSummaryCard = () => {
  // Mock data from SocialInteractions.sol
  const stats = {
    newFollowers: 5,
    likesReceived: 28,
  };

  return (
    <Card>
      <h3 className="card-title"><BarChart2 size={18} /> Resumen de Estadísticas</h3>
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-value">{stats.newFollowers}</span>
          <span className="stat-label">Nuevos Seguidores</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.likesReceived}</span>
          <span className="stat-label">Likes Recibidos</span>
        </div>
      </div>
    </Card>
  );
};

export default StatsSummaryCard;
