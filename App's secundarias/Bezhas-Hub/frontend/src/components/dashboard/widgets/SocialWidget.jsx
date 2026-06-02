import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../../../context/Web3Context';
import { Link } from 'react-router-dom';
import { MessageCircle, Users, TrendingUp, Award, Zap, Heart, MessageSquare, Star } from 'lucide-react';

// Datos de ejemplo para actividades recientes
const recentActivities = [
  {
    id: 1,
    user: '0x1a2b...3c4d',
    action: 'commented',
    content: '¡Excelente colección de NFTs!',
    time: 'Hace 5 min',
    likes: 3,
    comments: 1
  },
  {
    id: 2,
    user: '0x5e6f...7g8h',
    action: 'liked',
    content: 'Tu publicación',
    time: 'Hace 2 horas',
    likes: 0,
    comments: 0
  },
  {
    id: 3,
    user: '0x9i8u...7y6t',
    action: 'started following',
    content: 'a ti',
    time: 'Ayer',
    likes: 0,
    comments: 0
  }
];

// Datos de ejemplo para los mejores contribuidores
const topContributors = [
  { id: 1, address: '0x1a2b...3c4d', points: 1250, level: 'Oro' },
  { id: 2, address: '0x5e6f...7g8h', points: 980, level: 'Plata' },
  { id: 3, address: '0x9i8u...7y6t', points: 750, level: 'Bronce' },
  { id: 4, address: '0x3k4l...9p0o', points: 500, level: 'Bronce' }
];

const SocialWidget = () => {
  const { isConnected } = useWeb3();
  const [activeTab, setActiveTab] = useState('actividad');
  const [isLoading, setIsLoading] = useState(false);

  // Simular carga de datos
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const renderActivityIcon = (action) => {
    switch (action) {
      case 'commented':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'liked':
        return <Heart className="w-4 h-4 text-pink-500" />;
      case 'started following':
        return <Users className="w-4 h-4 text-green-500" />;
      default:
        return <MessageCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-dark-surface dark:bg-light-surface rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-dark-text dark:text-light-text">Comunidad</h3>
        </div>
        <div className="text-center py-8">
          <div className="mx-auto w-12 h-12 bg-dark-background/30 dark:bg-light-background/30 rounded-full flex items-center justify-center mb-3">
            <Users className="w-6 h-6 text-dark-text-muted dark:text-light-text-muted" />
          </div>
          <p className="text-dark-text-muted dark:text-light-text-muted">Conecta tu wallet para ver la actividad de la comunidad</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-surface dark:bg-light-surface rounded-2xl p-6">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-dark-text dark:text-light-text">Comunidad</h3>
          <div className="flex space-x-1 bg-dark-background/30 dark:bg-light-background/30 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('actividad')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'actividad'
                  ? 'bg-dark-primary dark:bg-light-primary text-white'
                  : 'text-dark-text-muted dark:text-light-text-muted hover:bg-dark-background/20 dark:hover:bg-light-background/20'
                }`}
            >
              Actividad
            </button>
            <button
              onClick={() => setActiveTab('top')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'top'
                  ? 'bg-dark-primary dark:bg-light-primary text-white'
                  : 'text-dark-text-muted dark:text-light-text-muted hover:bg-dark-background/20 dark:hover:bg-light-background/20'
                }`}
            >
              Top Contribuidores
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-dark-background/30 dark:bg-light-background/30 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : activeTab === 'actividad' ? (
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="p-4 bg-dark-background/20 dark:bg-light-background/20 rounded-lg hover:bg-dark-background/30 dark:hover:bg-light-background/30 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-dark-background/30 dark:bg-light-background/30 rounded-lg">
                    {renderActivityIcon(activity.action)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-1">
                      <span className="font-medium text-dark-text dark:text-light-text">{activity.user}</span>
                      <span className="text-sm text-dark-text-muted dark:text-light-text-muted">{activity.action}</span>
                      <span className="text-sm text-dark-text dark:text-light-text">{activity.content}</span>
                    </div>
                    <div className="flex items-center mt-1 text-xs text-dark-text-muted dark:text-light-text-muted space-x-4">
                      <span>{activity.time}</span>
                      {activity.likes > 0 && (
                        <span className="flex items-center">
                          <Heart className="w-3 h-3 mr-1" /> {activity.likes}
                        </span>
                      )}
                      {activity.comments > 0 && (
                        <span className="flex items-center">
                          <MessageSquare className="w-3 h-3 mr-1" /> {activity.comments}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="pt-2 text-center">
              <button className="text-sm text-dark-primary dark:text-light-primary hover:underline">
                Ver más actividad
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div className="bg-dark-background/20 dark:bg-light-background/20 p-3 rounded-lg">
                <div className="text-2xl font-bold text-dark-text dark:text-light-text">1,248</div>
                <div className="text-xs text-dark-text-muted dark:text-light-text-muted">Miembros</div>
              </div>
              <div className="bg-dark-background/20 dark:bg-light-background/20 p-3 rounded-lg">
                <div className="text-2xl font-bold text-dark-text dark:text-light-text">342</div>
                <div className="text-xs text-dark-text-muted dark:text-light-text-muted">En línea</div>
              </div>
              <div className="bg-dark-background/20 dark:bg-light-background/20 p-3 rounded-lg">
                <div className="text-2xl font-bold text-dark-text dark:text-light-text">24</div>
                <div className="text-xs text-dark-text-muted dark:text-light-text-muted">Nuevos hoy</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-dark-text-muted dark:text-light-text-muted">Mejores contribuidores</span>
                <div className="flex items-center text-xs text-dark-primary dark:text-light-primary">
                  <TrendingUp className="w-3.5 h-3.5 mr-1" />
                  <span>Puntos</span>
                </div>
              </div>

              {topContributors.map((user, index) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-dark-background/10 dark:bg-light-background/10 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <img
                        src={`https://i.pravatar.cc/40?u=${user.address}`}
                        alt={user.address}
                        className="w-8 h-8 rounded-full"
                      />
                      {index < 3 && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center">
                          <Star className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-dark-text dark:text-light-text">{user.address}</div>
                      <div className="text-xs text-dark-text-muted dark:text-light-text-muted">Nivel {user.level}</div>
                    </div>
                  </div>
                  <div className="flex items-center text-sm font-medium">
                    <Zap className="w-4 h-4 text-yellow-500 mr-1" />
                    {user.points.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Removed leaderboard link - rankings system eliminated */}
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialWidget;
