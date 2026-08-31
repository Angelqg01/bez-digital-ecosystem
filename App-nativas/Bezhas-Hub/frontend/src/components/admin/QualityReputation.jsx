import React, { useState, useEffect } from 'react';
import {
    Trophy,
    Star,
    TrendingUp,
    Award,
    Target,
    Activity,
    Calendar,
    Shield,
    Crown,
    Sparkles
} from 'lucide-react';
import axios from 'axios';
import '../styles/QualityReputation.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Quality Reputation Display Component
 * Shows provider reputation, tier, achievements, and history
 */
export default function QualityReputation({ provider }) {
    const [reputation, setReputation] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('profile'); // 'profile' or 'leaderboard'

    useEffect(() => {
        if (provider && view === 'profile') {
            fetchReputation();
        } else if (view === 'leaderboard') {
            fetchLeaderboard();
        }
    }, [provider, view]);

    const fetchReputation = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/api/quality-escrow/reputation/${provider}`);
            setReputation(response.data.reputation || null);
        } catch (error) {
            console.error('Error fetching reputation:', error);
            setReputation(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchLeaderboard = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/api/quality-escrow/leaderboard?limit=50`);
            setLeaderboard(response.data.leaderboard || []);
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            setLeaderboard([]);
        } finally {
            setLoading(false);
        }
    };

    const getTierIcon = (tierName) => {
        const icons = {
            LEGENDARY: <Crown size={24} />,
            MASTER: <Star size={24} />,
            EXPERT: <Sparkles size={24} />,
            PROFESSIONAL: <Trophy size={24} />,
            INTERMEDIATE: <Target size={24} />,
            BEGINNER: <Activity size={24} />
        };
        return icons[tierName] || <Shield size={24} />;
    };

    const getProgressToNextTier = (score) => {
        const tiers = [
            { name: 'LEGENDARY', min: 950 },
            { name: 'MASTER', min: 900 },
            { name: 'EXPERT', min: 850 },
            { name: 'PROFESSIONAL', min: 800 },
            { name: 'INTERMEDIATE', min: 700 },
            { name: 'BEGINNER', min: 0 }
        ];

        for (let i = tiers.length - 1; i >= 0; i--) {
            if (score >= tiers[i].min) {
                if (i === 0) return { progress: 100, nextTier: null };

                const currentMin = tiers[i].min;
                const nextMin = tiers[i - 1].min;
                const progress = ((score - currentMin) / (nextMin - currentMin)) * 100;

                return {
                    progress: Math.min(100, progress),
                    nextTier: tiers[i - 1].name,
                    pointsNeeded: nextMin - score
                };
            }
        }

        return { progress: 0, nextTier: 'INTERMEDIATE', pointsNeeded: 700 };
    };

    if (loading) {
        return (
            <div className="reputation-loading">
                <Activity className="animate-spin" size={48} />
                <p>Loading reputation...</p>
            </div>
        );
    }

    return (
        <div className="reputation-container">
            {/* View Switcher */}
            <div className="reputation-tabs">
                <button
                    className={`reputation-tab ${view === 'profile' ? 'active' : ''}`}
                    onClick={() => setView('profile')}
                >
                    <Shield size={16} />
                    My Reputation
                </button>
                <button
                    className={`reputation-tab ${view === 'leaderboard' ? 'active' : ''}`}
                    onClick={() => setView('leaderboard')}
                >
                    <Trophy size={16} />
                    Leaderboard
                </button>
            </div>

            {view === 'profile' && reputation && (
                <div className="reputation-profile">
                    {/* Tier Badge */}
                    <div className="tier-badge-large" style={{ borderColor: reputation.tier.color }}>
                        <div className="tier-icon" style={{ color: reputation.tier.color }}>
                            {getTierIcon(reputation.tier.name)}
                        </div>
                        <div className="tier-info">
                            <h2 className="tier-name" style={{ color: reputation.tier.color }}>
                                {reputation.tier.badge} {reputation.tier.name}
                            </h2>
                            <p className="reputation-score">
                                {reputation.score} / 1000 points
                            </p>
                        </div>
                    </div>

                    {/* Progress to Next Tier */}
                    {(() => {
                        const progress = getProgressToNextTier(reputation.score);
                        if (progress.nextTier) {
                            return (
                                <div className="tier-progress">
                                    <div className="progress-header">
                                        <span>Progress to {progress.nextTier}</span>
                                        <span className="points-needed">
                                            {progress.pointsNeeded} points needed
                                        </span>
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{
                                                width: `${progress.progress}%`,
                                                background: reputation.tier.color
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div className="max-tier-achieved">
                                🎉 Maximum tier achieved!
                            </div>
                        );
                    })()}

                    {/* Stats Grid */}
                    <div className="stats-grid">
                        <div className="stat-card">
                            <Target className="stat-icon" />
                            <div className="stat-content">
                                <span className="stat-label">Total Services</span>
                                <h3 className="stat-value">{reputation.stats.totalServices}</h3>
                            </div>
                        </div>

                        <div className="stat-card">
                            <Star className="stat-icon" />
                            <div className="stat-content">
                                <span className="stat-label">Avg Quality</span>
                                <h3 className="stat-value">{reputation.stats.avgQuality.toFixed(1)}%</h3>
                            </div>
                        </div>

                        <div className="stat-card">
                            <TrendingUp className="stat-icon" />
                            <div className="stat-content">
                                <span className="stat-label">Completion Rate</span>
                                <h3 className="stat-value">
                                    {((reputation.stats.completedServices / reputation.stats.totalServices) * 100).toFixed(0)}%
                                </h3>
                            </div>
                        </div>

                        <div className="stat-card">
                            <Award className="stat-icon" />
                            <div className="stat-content">
                                <span className="stat-label">Achievements</span>
                                <h3 className="stat-value">{reputation.achievements.length}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Achievements */}
                    {reputation.achievements.length > 0 && (
                        <div className="achievements-section">
                            <h3 className="section-title">
                                <Award size={18} />
                                Achievements
                            </h3>
                            <div className="achievements-grid">
                                {reputation.achievements.map((achievement) => (
                                    <div key={achievement.name} className="achievement-card">
                                        <span className="achievement-icon">{achievement.icon}</span>
                                        <div className="achievement-info">
                                            <h4>{achievement.name}</h4>
                                            <p>{achievement.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent History */}
                    {reputation.recentHistory && reputation.recentHistory.length > 0 && (
                        <div className="history-section">
                            <h3 className="section-title">
                                <Calendar size={18} />
                                Recent History
                            </h3>
                            <div className="history-list">
                                {reputation.recentHistory.reverse().map((entry, index) => (
                                    <div key={index} className="history-item">
                                        <div className="history-icon">
                                            {entry.action === 'service_completed' ? '✅' : '⚡'}
                                        </div>
                                        <div className="history-content">
                                            <p className="history-action">
                                                {entry.action === 'service_completed'
                                                    ? `Completed service #${entry.serviceId}`
                                                    : `Dispute ${entry.action.split('_')[1]}`}
                                            </p>
                                            <span className="history-time">
                                                {new Date(entry.timestamp).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className={`score-delta ${entry.scoreDelta >= 0 ? 'positive' : 'negative'}`}>
                                            {entry.scoreDelta >= 0 ? '+' : ''}{entry.scoreDelta}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {view === 'leaderboard' && (
                <div className="leaderboard-view">
                    <h3 className="section-title">
                        <Trophy size={18} />
                        Top Providers
                    </h3>
                    <div className="leaderboard-list">
                        {leaderboard.map((entry) => (
                            <div key={entry.provider} className={`leaderboard-item ${entry.rank <= 3 ? 'top-three' : ''}`}>
                                <div className="leaderboard-rank">
                                    {entry.rank <= 3 ? (
                                        <span className="medal">
                                            {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                                        </span>
                                    ) : (
                                        <span className="rank-number">#{entry.rank}</span>
                                    )}
                                </div>
                                <div className="leaderboard-provider">
                                    <code>{entry.provider.slice(0, 10)}...{entry.provider.slice(-8)}</code>
                                </div>
                                <div className="leaderboard-stats">
                                    <span className="stat-item">
                                        <Shield size={14} />
                                        {entry.tier}
                                    </span>
                                    <span className="stat-item">
                                        <Trophy size={14} />
                                        {entry.score}
                                    </span>
                                    <span className="stat-item">
                                        <Target size={14} />
                                        {entry.totalServices}
                                    </span>
                                    <span className="stat-item">
                                        <Star size={14} />
                                        {entry.avgQuality.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!reputation && view === 'profile' && (
                <div className="no-reputation">
                    <Shield size={64} opacity={0.3} />
                    <h3>No Reputation Yet</h3>
                    <p>Complete your first service to start building reputation</p>
                </div>
            )}
        </div>
    );
}
