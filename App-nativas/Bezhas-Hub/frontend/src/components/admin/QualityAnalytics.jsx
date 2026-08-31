import React, { useState, useEffect } from 'react';
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    Activity,
    Shield,
    Users,
    Clock,
    DollarSign,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Calendar,
    Download,
    RefreshCw
} from 'lucide-react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    AreaChart
} from 'recharts';
import axios from 'axios';
import '../../styles/QualityAnalytics.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Quality Oracle Analytics Dashboard
 * Comprehensive metrics and visualization for quality services
 */
export default function QualityAnalytics() {
    const [stats, setStats] = useState(null);
    const [timeRange, setTimeRange] = useState('7d');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Chart colors
    const COLORS = {
        primary: '#3b82f6',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        purple: '#8b5cf6',
        cyan: '#06b6d4'
    };

    /**
     * Fetch analytics data
     */
    const fetchAnalytics = async () => {
        try {
            setRefreshing(true);
            const response = await axios.get(`${API_URL}/api/quality-escrow/analytics`, {
                params: { timeRange }
            });
            setStats(response.data.analytics || generateMockData());
        } catch (error) {
            console.error('Error fetching analytics:', error);
            setStats(generateMockData());
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [timeRange]);

    /**
     * Generate mock data for development
     */
    const generateMockData = () => {
        return {
            overview: {
                totalServices: 156,
                activeServices: 23,
                completedServices: 128,
                disputedServices: 5,
                averageQuality: 87.5,
                totalCollateral: 15600,
                totalPenalties: 890,
                successRate: 95.8
            },
            timeline: [
                { date: '2026-12-28', services: 12, quality: 88, penalties: 45 },
                { date: '2026-12-29', services: 15, quality: 86, penalties: 67 },
                { date: '2026-12-30', services: 18, quality: 89, penalties: 32 },
                { date: '2026-12-31', services: 22, quality: 87, penalties: 54 },
                { date: '2027-01-01', services: 25, quality: 90, penalties: 28 },
                { date: '2027-01-02', services: 20, quality: 85, penalties: 76 },
                { date: '2027-01-03', services: 23, quality: 88, penalties: 45 }
            ],
            qualityDistribution: [
                { range: '95-100%', count: 45, percentage: 35 },
                { range: '85-94%', count: 58, percentage: 45 },
                { range: '70-84%', count: 20, percentage: 16 },
                { range: '<70%', count: 5, percentage: 4 }
            ],
            statusDistribution: [
                { name: 'Completed', value: 128, color: COLORS.success },
                { name: 'Active', value: 23, color: COLORS.primary },
                { name: 'Disputed', value: 5, color: COLORS.danger }
            ],
            topProviders: [
                { address: '0x1234...5678', services: 45, avgQuality: 92, totalEarned: 4500, penalties: 120 },
                { address: '0x2345...6789', services: 38, avgQuality: 89, totalEarned: 3800, penalties: 180 },
                { address: '0x3456...7890', services: 32, avgQuality: 91, totalEarned: 3200, penalties: 95 },
                { address: '0x4567...8901', services: 28, avgQuality: 87, totalEarned: 2800, penalties: 210 },
                { address: '0x5678...9012', services: 25, avgQuality: 90, totalEarned: 2500, penalties: 150 }
            ],
            collateralFlow: [
                { date: '2026-12-28', locked: 2300, released: 2100, penalties: 45 },
                { date: '2026-12-29', locked: 2500, released: 2200, penalties: 67 },
                { date: '2026-12-30', locked: 2800, released: 2400, penalties: 32 },
                { date: '2026-12-31', locked: 3100, released: 2700, penalties: 54 },
                { date: '2027-01-01', locked: 3400, released: 3000, penalties: 28 },
                { date: '2027-01-02', locked: 3200, released: 2900, penalties: 76 },
                { date: '2027-01-03', locked: 3500, released: 3100, penalties: 45 }
            ],
            hourlyActivity: Array.from({ length: 24 }, (_, i) => ({
                hour: `${i}:00`,
                services: Math.floor(Math.random() * 10) + 1
            }))
        };
    };

    /**
     * Export data
     */
    const exportData = (format) => {
        if (!stats) return;

        const dataStr = format === 'json'
            ? JSON.stringify(stats, null, 2)
            : convertToCSV(stats);

        const blob = new Blob([dataStr], { type: format === 'json' ? 'application/json' : 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `quality-analytics-${timeRange}.${format}`;
        link.click();
        URL.revokeObjectURL(url);
    };

    /**
     * Convert data to CSV
     */
    const convertToCSV = (data) => {
        // Simple CSV conversion for timeline data
        const rows = [
            ['Date', 'Services', 'Avg Quality', 'Penalties'],
            ...data.timeline.map(row => [
                row.date,
                row.services,
                row.quality,
                row.penalties
            ])
        ];
        return rows.map(row => row.join(',')).join('\n');
    };

    /**
     * Format currency
     */
    const formatCurrency = (value) => {
        return `${value.toLocaleString()} BEZ`;
    };

    /**
     * Format percentage
     */
    const formatPercentage = (value) => {
        return `${value.toFixed(1)}%`;
    };

    if (loading) {
        return (
            <div className="quality-analytics-loading">
                <Activity className="animate-spin" size={48} />
                <p>Loading analytics...</p>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="quality-analytics-error">
                <AlertTriangle size={48} />
                <p>Failed to load analytics</p>
                <button onClick={fetchAnalytics}>Retry</button>
            </div>
        );
    }

    return (
        <div className="quality-analytics">
            {/* Header */}
            <div className="analytics-header">
                <div>
                    <h2>Quality Oracle Analytics</h2>
                    <p className="analytics-subtitle">Comprehensive quality metrics and insights</p>
                </div>

                <div className="analytics-controls">
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        className="time-range-select"
                    >
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                    </select>

                    <button
                        onClick={fetchAnalytics}
                        className="refresh-btn"
                        disabled={refreshing}
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>

                    <button onClick={() => exportData('json')} className="export-btn">
                        <Download size={16} />
                        JSON
                    </button>

                    <button onClick={() => exportData('csv')} className="export-btn">
                        <Download size={16} />
                        CSV
                    </button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="metrics-grid">
                <div className="metric-card">
                    <div className="metric-icon" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
                        <Shield style={{ color: COLORS.primary }} size={24} />
                    </div>
                    <div className="metric-content">
                        <span className="metric-label">Total Services</span>
                        <h3 className="metric-value">{stats.overview.totalServices}</h3>
                        <span className="metric-trend positive">
                            <TrendingUp size={14} />
                            +12.5%
                        </span>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                        <CheckCircle style={{ color: COLORS.success }} size={24} />
                    </div>
                    <div className="metric-content">
                        <span className="metric-label">Avg Quality</span>
                        <h3 className="metric-value">{formatPercentage(stats.overview.averageQuality)}</h3>
                        <span className="metric-trend positive">
                            <TrendingUp size={14} />
                            +2.1%
                        </span>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                        <DollarSign style={{ color: COLORS.warning }} size={24} />
                    </div>
                    <div className="metric-content">
                        <span className="metric-label">Total Collateral</span>
                        <h3 className="metric-value">{formatCurrency(stats.overview.totalCollateral)}</h3>
                        <span className="metric-trend positive">
                            <TrendingUp size={14} />
                            +8.3%
                        </span>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                        <XCircle style={{ color: COLORS.danger }} size={24} />
                    </div>
                    <div className="metric-content">
                        <span className="metric-label">Disputes</span>
                        <h3 className="metric-value">{stats.overview.disputedServices}</h3>
                        <span className="metric-trend negative">
                            <TrendingDown size={14} />
                            -15.2%
                        </span>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="charts-grid">
                {/* Services Timeline */}
                <div className="chart-card large">
                    <h3 className="chart-title">
                        <Activity size={18} />
                        Services Over Time
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={stats.timeline}>
                            <defs>
                                <linearGradient id="colorServices" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
                            <YAxis stroke="rgba(255,255,255,0.5)" />
                            <Tooltip
                                contentStyle={{
                                    background: 'rgba(30, 41, 59, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px'
                                }}
                            />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="services"
                                stroke={COLORS.primary}
                                fill="url(#colorServices)"
                                name="Services"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Quality Distribution */}
                <div className="chart-card">
                    <h3 className="chart-title">
                        <BarChart3 size={18} />
                        Quality Distribution
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.qualityDistribution}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="range" stroke="rgba(255,255,255,0.5)" />
                            <YAxis stroke="rgba(255,255,255,0.5)" />
                            <Tooltip
                                contentStyle={{
                                    background: 'rgba(30, 41, 59, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px'
                                }}
                            />
                            <Bar dataKey="count" fill={COLORS.success} radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Status Distribution */}
                <div className="chart-card">
                    <h3 className="chart-title">
                        <Activity size={18} />
                        Status Distribution
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={stats.statusDistribution}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {stats.statusDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Collateral Flow */}
                <div className="chart-card large">
                    <h3 className="chart-title">
                        <DollarSign size={18} />
                        Collateral Flow
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={stats.collateralFlow}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
                            <YAxis stroke="rgba(255,255,255,0.5)" />
                            <Tooltip
                                contentStyle={{
                                    background: 'rgba(30, 41, 59, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px'
                                }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="locked" stroke={COLORS.warning} strokeWidth={2} name="Locked" />
                            <Line type="monotone" dataKey="released" stroke={COLORS.success} strokeWidth={2} name="Released" />
                            <Line type="monotone" dataKey="penalties" stroke={COLORS.danger} strokeWidth={2} name="Penalties" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Hourly Activity */}
                <div className="chart-card">
                    <h3 className="chart-title">
                        <Clock size={18} />
                        Hourly Activity
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stats.hourlyActivity}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis dataKey="hour" stroke="rgba(255,255,255,0.5)" />
                            <YAxis stroke="rgba(255,255,255,0.5)" />
                            <Tooltip
                                contentStyle={{
                                    background: 'rgba(30, 41, 59, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px'
                                }}
                            />
                            <Bar dataKey="services" fill={COLORS.cyan} radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Providers Table */}
            <div className="providers-table-card">
                <h3 className="chart-title">
                    <Users size={18} />
                    Top Providers
                </h3>
                <div className="providers-table-wrapper">
                    <table className="providers-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Address</th>
                                <th>Services</th>
                                <th>Avg Quality</th>
                                <th>Total Earned</th>
                                <th>Penalties</th>
                                <th>Success Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.topProviders.map((provider, index) => (
                                <tr key={provider.address}>
                                    <td>
                                        <span className={`rank-badge ${index < 3 ? 'top-three' : ''}`}>
                                            #{index + 1}
                                        </span>
                                    </td>
                                    <td>
                                        <code className="address-cell">{provider.address}</code>
                                    </td>
                                    <td>{provider.services}</td>
                                    <td>
                                        <span className={`quality-badge ${getQualityClass(provider.avgQuality)}`}>
                                            {formatPercentage(provider.avgQuality)}
                                        </span>
                                    </td>
                                    <td className="currency-cell">{formatCurrency(provider.totalEarned)}</td>
                                    <td className="penalties-cell">{formatCurrency(provider.penalties)}</td>
                                    <td>
                                        <span className="success-rate">
                                            {formatPercentage(((provider.totalEarned / (provider.totalEarned + provider.penalties)) * 100))}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

/**
 * Get quality badge class
 */
function getQualityClass(quality) {
    if (quality >= 90) return 'excellent';
    if (quality >= 85) return 'good';
    if (quality >= 70) return 'fair';
    return 'poor';
}
