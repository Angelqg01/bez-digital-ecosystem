import React from 'react';
import { Star, Users, Vote, ShoppingCart, Award } from 'lucide-react';
import './ActivityFeed.css';

const ActivityIcon = ({ type }) => {
  const icons = {
    quest_completed: <Star className="icon quest" />,
    new_member: <Users className="icon member" />,
    proposal_created: <Vote className="icon proposal" />,
    item_sold: <ShoppingCart className="icon item" />,
    badge_unlocked: <Award className="icon badge" />,
  };
  return icons[type] || null;
};

const ActivityFeed = ({ activities }) => {
  const renderDetails = (activity) => {
    switch (activity.type) {
      case 'quest_completed':
        return <>{activity.user} ha completado la misión <strong>{activity.details.quest}</strong> y ganó {activity.details.xp} EXP.</>;
      case 'new_member':
        return <>{activity.user} se ha unido al grupo <strong>{activity.details.group}</strong>.</>;
      case 'proposal_created':
        return <>{activity.user} ha creado una nueva propuesta en <strong>{activity.details.group}</strong>: "{activity.details.proposal}".</>;
      case 'item_sold':
        return <>{activity.user} ha vendido <strong>{activity.details.item}</strong> por {activity.details.price} BEZ a {activity.details.buyer}.</>;
      case 'badge_unlocked':
        return <>{activity.user} ha desbloqueado la insignia <strong>{activity.details.badge}</strong>.</>;
      default:
        return 'Nuevo evento en la comunidad.';
    }
  };

  return (
    <div className="activity-feed">
      {activities.map(activity => (
        <div key={activity.id} className={`activity-item type-${activity.type}`}>
          <div className="activity-icon-container">
            <ActivityIcon type={activity.type} />
          </div>
          <div className="activity-content">
            <p className="activity-text">{renderDetails(activity)}</p>
            <span className="activity-timestamp">{activity.timestamp}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityFeed;
