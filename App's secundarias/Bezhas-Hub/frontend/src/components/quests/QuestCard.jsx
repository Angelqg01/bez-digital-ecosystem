import React, { useState, memo } from 'react';
import { toast } from 'react-hot-toast';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Clock, Star, CheckCircle, Gift } from 'lucide-react';
import './QuestComponents.css';

const ProgressBar = ({ current, total }) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="progress-bar-container">
      <div className="progress-bar-fill" style={{ width: `${percentage}%` }} />
    </div>
  );
};

const QuestCard = ({ quest, gamificationContract, onQuestJoined, status }) => {
  const [isLoading, setIsLoading] = useState(false);

  const getDifficultyClass = (difficulty) => {
    return `difficulty-${difficulty}`;
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'social': return '👥';
      case 'engagement': return '🔥';
      case 'economic': return '💰';
      case 'profile': return '👤';
      default: return '🎯';
    }
  };

  const handleJoinChallenge = async () => {
    if (!gamificationContract) return;
    
    setIsLoading(true);
    toast.loading('Uniéndote al desafío...');
    try {
      const tx = await gamificationContract.joinChallenge(quest.id);
      await tx.wait();
      toast.dismiss();
      toast.success('¡Te has unido al desafío!');
      if (onQuestJoined) {
        onQuestJoined();
      }
    } catch (error) {
      toast.dismiss();
      console.error('Error joining challenge:', error);
      toast.error(error.reason || 'No se pudo unir al desafío.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderAction = () => {
    switch (status) {
      case 'available':
        return (
          <Button
            variant="primary"
            onClick={handleJoinChallenge}
            disabled={isLoading}
            className="action-button"
          >
            {isLoading ? 'Uniéndote...' : 'Unirse al Desafío'}
          </Button>
        );
      case 'in_progress':
        return (
          <Button variant="secondary" disabled className="action-button in-progress-btn">
            En Progreso
          </Button>
        );
      case 'completed':
        return (
          <div className="quest-completed-status">
            <CheckCircle size={16} />
            <span>Completada</span>
          </div>
        );
      default: return null;
    }
  };

  return (
    <Card className={`quest-card ${status} ${getDifficultyClass(quest.difficulty)}`}>
      <div className="quest-card-content">
        <div className="quest-header">
          <span className="quest-category-icon">{getCategoryIcon(quest.category)}</span>
          <h3 className="quest-title">{quest.title}</h3>
          <div className={`quest-difficulty ${getDifficultyClass(quest.difficulty)}`}>
            {quest.difficulty}
          </div>
        </div>

        <p className="quest-description">{quest.description}</p>


        <div className="quest-rewards">
          <div className="reward-item exp">+{quest.reward.exp} EXP</div>
          <div className="reward-item tokens">+{quest.reward.tokens} BEZ</div>
        </div>

      </div>

      <div className="quest-actions">
        {renderAction()}
      </div>
    </Card>
  );
};

export default memo(QuestCard);
