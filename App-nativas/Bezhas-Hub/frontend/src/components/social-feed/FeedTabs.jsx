import React, { useState } from 'react';
import { Clock, Users, TrendingUp, Sparkles } from 'lucide-react';

/**
 * FeedTabs Component
 * Tabs para filtrar el feed (Recientes, Amigos, Popular)
 * 
 * @param {String} activeTab - Tab activo
 * @param {Function} onTabChange - Callback al cambiar de tab
 */
const FeedTabs = ({ activeTab = 'recents', onTabChange }) => {
    const tabs = [
        {
            id: 'recents',
            label: 'Recientes',
            icon: Clock,
            color: 'text-blue-600 dark:text-blue-400'
        },
        {
            id: 'friends',
            label: 'Amigos',
            icon: Users,
            color: 'text-purple-600 dark:text-purple-400'
        },
        {
            id: 'popular',
            label: 'Popular',
            icon: TrendingUp,
            color: 'text-pink-600 dark:text-pink-400'
        },
        {
            id: 'featured',
            label: 'Destacados',
            icon: Sparkles,
            color: 'text-yellow-600 dark:text-yellow-400'
        }
    ];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-2 border border-gray-100 dark:border-gray-700 mb-4">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange && onTabChange(tab.id)}
                            className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm
                transition-all duration-200 whitespace-nowrap flex-1 sm:flex-initial
                ${isActive
                                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }
              `}
                        >
                            <Icon size={18} className={!isActive ? tab.color : ''} />
                            <span>{tab.label}</span>

                            {/* Badge para notificaciones (ejemplo) */}
                            {tab.id === 'popular' && !isActive && (
                                <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                                    3
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
        </div>
    );
};

export default FeedTabs;
