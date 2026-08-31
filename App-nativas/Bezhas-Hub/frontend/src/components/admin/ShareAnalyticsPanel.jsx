import React, { useState, useEffect } from 'react';
import {
    Share2,
    TrendingUp,
    Users,
    BarChart3,
    Facebook,
    Twitter,
    Linkedin
} from 'lucide-react';
import {
    FaWhatsapp,
    FaTelegram,
    FaReddit
} from 'react-icons/fa';

/**
 * Panel de Analytics de Compartidos Sociales
 * Para el dashboard de administración
 */
export default function ShareAnalyticsPanel() {
    const [analytics, setAnalytics] = useState({
        totalShares: 8534,
        growthRate: 23.5,
        topPlatforms: [
            { name: 'Twitter', icon: Twitter, shares: 3245, growth: 18.2, color: '#1DA1F2' },
            { name: 'WhatsApp', icon: FaWhatsapp, shares: 2156, growth: 34.5, color: '#25D366' },
            { name: 'Facebook', icon: Facebook, shares: 1823, growth: 12.8, color: '#1877F2' },
            { name: 'Telegram', icon: FaTelegram, shares: 876, growth: 45.3, color: '#0088cc' },
            { name: 'LinkedIn', icon: Linkedin, shares: 434, growth: -5.2, color: '#0A66C2' },
        ],
        topSharedContent: [
            { id: 1, title: 'NFT Marketplace Launch', shares: 1234, platform: 'Twitter' },
            { id: 2, title: 'Staking Rewards Updated', shares: 987, platform: 'WhatsApp' },
            { id: 3, title: 'Patent Validation System', shares: 856, platform: 'Facebook' },
        ],
        sharesByHour: Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            shares: Math.floor(Math.random() * 500) + 100
        })),
        viralPosts: [
            { id: 1, title: 'Web3 Revolution', viralScore: 9.5, shares: 2345 },
            { id: 2, title: 'BeZhas Token Launch', viralScore: 8.9, shares: 1876 },
            { id: 3, title: 'Community Milestone', viralScore: 8.2, shares: 1543 },
        ]
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Share2 size={28} className="text-purple-500" />
                        Análisis de Compartidos
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Estadísticas de viralidad y alcance social
                    </p>
                </div>
            </div>

            {/* Métricas Principales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <Share2 size={24} />
                        <TrendingUp size={20} />
                    </div>
                    <div className="text-3xl font-bold mb-1">
                        {analytics.totalShares.toLocaleString()}
                    </div>
                    <div className="text-sm opacity-90">Total Compartidos</div>
                    <div className="mt-3 flex items-center gap-2 text-xs">
                        <span className="bg-white/20 px-2 py-1 rounded">
                            +{analytics.growthRate}% este mes
                        </span>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <Users size={24} />
                        <BarChart3 size={20} />
                    </div>
                    <div className="text-3xl font-bold mb-1">
                        {Math.floor(analytics.totalShares / 2.3).toLocaleString()}
                    </div>
                    <div className="text-sm opacity-90">Usuarios Activos</div>
                    <div className="mt-3 flex items-center gap-2 text-xs">
                        <span className="bg-white/20 px-2 py-1 rounded">
                            Alcance: 45.2K
                        </span>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <TrendingUp size={24} />
                        <Share2 size={20} />
                    </div>
                    <div className="text-3xl font-bold mb-1">
                        {(analytics.totalShares / analytics.topSharedContent.length).toFixed(1)}
                    </div>
                    <div className="text-sm opacity-90">Promedio por Post</div>
                    <div className="mt-3 flex items-center gap-2 text-xs">
                        <span className="bg-white/20 px-2 py-1 rounded">
                            Top: {analytics.topSharedContent[0].shares}
                        </span>
                    </div>
                </div>
            </div>

            {/* Plataformas Más Usadas */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                    Plataformas Más Populares
                </h3>
                <div className="space-y-4">
                    {analytics.topPlatforms.map((platform, index) => {
                        const Icon = platform.icon;
                        const isPositive = platform.growth > 0;
                        return (
                            <div key={platform.name} className="flex items-center gap-4">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                                    style={{ backgroundColor: platform.color }}
                                >
                                    <Icon size={24} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-semibold text-gray-900 dark:text-white">
                                            {platform.name}
                                        </span>
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                                            {platform.shares.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                                className="h-2 rounded-full transition-all"
                                                style={{
                                                    width: `${(platform.shares / analytics.topPlatforms[0].shares) * 100}%`,
                                                    backgroundColor: platform.color
                                                }}
                                            />
                                        </div>
                                        <span className={`text-xs font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'
                                            }`}>
                                            {isPositive ? '+' : ''}{platform.growth}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Contenido Más Compartido */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                    <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                        Top Contenido Compartido
                    </h3>
                    <div className="space-y-3">
                        {analytics.topSharedContent.map((content, index) => (
                            <div
                                key={content.id}
                                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <div className="flex items-center justify-center w-8 h-8 bg-purple-500 text-white rounded-full font-bold text-sm">
                                    {index + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="font-semibold text-sm text-gray-900 dark:text-white">
                                        {content.title}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">
                                        {content.platform} • {content.shares} shares
                                    </div>
                                </div>
                                <Share2 size={16} className="text-gray-400" />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                    <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                        Posts Virales
                    </h3>
                    <div className="space-y-3">
                        {analytics.viralPosts.map((post, index) => (
                            <div
                                key={post.id}
                                className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
                            >
                                <div className="flex flex-col items-center">
                                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                        {post.viralScore}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">Score</div>
                                </div>
                                <div className="flex-1">
                                    <div className="font-semibold text-sm text-gray-900 dark:text-white">
                                        {post.title}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">
                                        {post.shares.toLocaleString()} shares totales
                                    </div>
                                </div>
                                <TrendingUp size={20} className="text-purple-500" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Actividad por Hora */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
                    Actividad de Compartidos (Últimas 24h)
                </h3>
                <div className="flex items-end gap-1 h-48">
                    {analytics.sharesByHour.map((data) => {
                        const height = (data.shares / 600) * 100;
                        return (
                            <div
                                key={data.hour}
                                className="flex-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-t hover:opacity-80 transition-opacity cursor-pointer relative group"
                                style={{ height: `${height}%`, minHeight: '4px' }}
                                title={`${data.hour}:00 - ${data.shares} shares`}
                            >
                                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                    {data.hour}:00<br />{data.shares} shares
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-600 dark:text-gray-400">
                    <span>00:00</span>
                    <span>06:00</span>
                    <span>12:00</span>
                    <span>18:00</span>
                    <span>23:00</span>
                </div>
            </div>
        </div>
    );
}
