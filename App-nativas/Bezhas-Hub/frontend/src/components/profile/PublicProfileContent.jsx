import React from 'react';
import Card from '../ui/Card';
import { Award, Image, Star } from 'lucide-react';
import './ProfileComponents.css';

const PublicProfileContent = ({ user }) => {
  const { gamification, badges, nfts } = user;

  return (
    <div className="profile-summary-container">
      <div className="stats-grid">
        <Card className="stat-highlight-card">
          <Star className="stat-icon" />
          <div className="stat-value">{gamification.questsCompleted}</div>
          <div className="stat-label">Misiones Completadas</div>
        </Card>
        <Card className="stat-highlight-card">
          <div className="stat-value">{gamification.bezBalance.toLocaleString()}</div>
          <div className="stat-label">BEZ Acumulados</div>
        </Card>
        <Card className="stat-highlight-card">
          <Award className="stat-icon" />
          <div className="stat-value">{badges.length}</div>
          <div className="stat-label">Insignias Obtenidas</div>
        </Card>
      </div>

      <Card className="profile-section-card">
        <h3 className="section-title"><Award /> Insignias</h3>
        <div className="badges-grid">
          {badges.map(badge => (
            <div key={badge.id} className="badge-item" title={badge.description}>
              <span className="badge-icon">{badge.icon}</span>
              <span className="badge-name">{badge.name}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="profile-section-card">
        <h3 className="section-title"><Image /> NFTs Destacados</h3>
        <div className="nfts-grid">
          {nfts.map(nft => (
            <div key={nft.id} className="nft-item">
              <img src={nft.image} alt={nft.name} />
              <div className="nft-name">{nft.name}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default PublicProfileContent;
