import React from 'react';
import Card from '../ui/Card';
import { MessageCircle, Heart, Share2 } from 'lucide-react';
import './DashboardComponents.css';

const ActivityFeed = () => {
  // Mock data from PersonalizedFeed.sol
  const feedItems = [
    { 
      id: 1, 
      author: 'BeZhas', 
      authorAvatar: 'B', 
      content: '¡Bienvenido a la nueva era de BeZhas! Explora las nuevas funcionalidades y conecta con la comunidad.', 
      time: 'hace 5 minutos',
      likes: 12,
      comments: 3
    },
    { 
      id: 2, 
      author: 'amiyoe', 
      authorAvatar: 'Y', 
      content: 'Acabo de completar la misión "Pionero". ¡El sistema de gamificación es increíble! 🎮', 
      time: 'hace 1 hora',
      likes: 8,
      comments: 2
    },
    { 
      id: 3, 
      author: 'CryptoExplorer', 
      authorAvatar: 'C', 
      content: 'Nuevo artículo en el marketplace: "Guía completa de DeFi para principiantes" 📚', 
      time: 'hace 2 horas',
      likes: 15,
      comments: 7
    },
  ];

  return (
    <Card>
      <h3 className="card-title">Actividad Reciente</h3>
      <div className="feed-list">
        {feedItems.map(item => (
          <div key={item.id} className="feed-item">
            <div className="feed-item-avatar">{item.authorAvatar}</div>
            <div className="feed-item-content">
              <p><strong>{item.author}</strong> {item.content}</p>
              <div className="feed-item-meta">
                <span className="feed-item-time">{item.time}</span>
                <div className="feed-item-actions">
                  <span className="action-item">
                    <Heart size={14} /> {item.likes}
                  </span>
                  <span className="action-item">
                    <MessageCircle size={14} /> {item.comments}
                  </span>
                  <span className="action-item">
                    <Share2 size={14} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default ActivityFeed;
