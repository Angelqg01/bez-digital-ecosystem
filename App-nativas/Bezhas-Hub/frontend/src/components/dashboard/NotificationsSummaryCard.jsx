import React from 'react';
import Card from '../ui/Card';
import { Bell } from 'lucide-react';
import './DashboardComponents.css';

const NotificationsSummaryCard = () => {
  // Mock data from NotificationSystem.sol
  const notifications = [
    { id: 1, text: 'A @amiyoe le ha gustado tu publicación.', time: 'hace 10 min', type: 'like' },
    { id: 2, text: 'Has ganado la insignia "Explorador".', time: 'hace 30 min', type: 'achievement' },
    { id: 3, text: 'Nuevo mensaje de @CryptoExplorer.', time: 'hace 1 hora', type: 'message' },
  ];

  return (
    <Card>
      <h3 className="card-title"><Bell size={18} /> Notificaciones</h3>
      <div className="summary-list">
        {notifications.map(n => (
          <div key={n.id} className="notification-item">
            <div className="notification-text">{n.text}</div>
            <div className="notification-time">{n.time}</div>
          </div>
        ))}
        <a href="/notifications" className="view-all-link">Ver todas las notificaciones</a>
      </div>
    </Card>
  );
};

export default NotificationsSummaryCard;
