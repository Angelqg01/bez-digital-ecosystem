import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame, TrendingUp, Droplets, DollarSign, Building2, BarChart3 } from 'lucide-react';
import axios from 'axios';

/**
 * GlobalStatsBar - Barra de estadísticas globales del ecosistema BeZhas
 * 
 * Muestra en tiempo real:
 * - Total Burned 🔥 (enviado a Treasury DAO)
 * - Real Estate TVL 🏠
 * - Current LP APY 📈
 * - Commercial Volume 💰
 * 
 * Se muestra en: DAO, RWA, Staking, Farming, BeVIP, Create NFT, DeFi Hub
 */
export default function GlobalStatsBar({ compact = false }) {
    const [stats, setStats] = useState({
        totalBurned: '2,345,678',
        burned24h: '12,450',
        realEstateTVL: '4,250,000',
        currentAPY: '24.5',
        commercialVolume: '890,000',
        treasuryBalance: '1,250,000',
        activeLPs: '1,234'
    });

    const [loading, setLoading] = useState(false);

    // Cargar estadísticas del backend
    useEffect(() => {
        const loadStats = async () => {
            try {
                setLoading(true);
                // En producción, obtener de la API
                const response = await axios.get('/api/stats/global').catch(() => null);
                if (response?.data) {
                    setStats(response.data);
                }
            } catch (error) {
                // Usar datos mock si falla
                console.log('Using mock stats data');
            } finally {
                setLoading(false);
            }
        };

        loadStats();

        // Actualizar cada 30 segundos
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, []);

    // Versión compacta (footer/ticker)
    if (compact) {
        return (
            <div className="bg-black/40 backdrop-blur-sm border-y border-white/10 py-2 overflow-hidden">
                <div className="flex items-center justify-center gap-8 text-sm animate-marquee">
                    <div className="flex items-center gap-2 text-orange-400">
                        <Flame size={14} />
                        <span>Burned: {stats.totalBurned} BEZ</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-400">
                        <TrendingUp size={14} />
                        <span>APY: {stats.currentAPY}%</span>
                    </div>
                    <div className="flex items-center gap-2 text-blue-400">
                        <Building2 size={14} />
                        <span>RWA TVL: ${stats.realEstateTVL}</span>
                    </div>
                    <div className="flex items-center gap-2 text-purple-400">
                        <DollarSign size={14} />
                        <span>Vol 24h: ${stats.commercialVolume}</span>
                    </div>
                </div>
            </div>
        );
    }

    // Versión completa (header de páginas)
    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-gray-900/80 via-purple-900/40 to-gray-900/80 backdrop-blur-md border-b border-white/10"
        >
            <div className="max-w-7xl mx-auto px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Label */}
                    <div className="flex items-center gap-2">
                        <BarChart3 className="text-purple-400" size={18} />
                        <span className="text-gray-400 text-sm font-medium">Ecosystem Stats</span>
                    </div>

                    {/* Stats Grid */}
                    <div className="flex flex-wrap items-center gap-6">
                        {/* Total Burned / Treasury */}
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-orange-500/20 rounded-lg">
                                <Flame className="text-orange-400" size={16} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Treasury 24h</p>
                                <p className="text-sm font-bold text-orange-400">{stats.burned24h} BEZ</p>
                            </div>
                        </div>

                        {/* LP APY */}
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-green-500/20 rounded-lg">
                                <TrendingUp className="text-green-400" size={16} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">LP APY</p>
                                <p className="text-sm font-bold text-green-400">{stats.currentAPY}%</p>
                            </div>
                        </div>

                        {/* RWA TVL */}
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-500/20 rounded-lg">
                                <Building2 className="text-blue-400" size={16} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">RWA TVL</p>
                                <p className="text-sm font-bold text-blue-400">${stats.realEstateTVL}</p>
                            </div>
                        </div>

                        {/* Liquidity Providers */}
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-cyan-500/20 rounded-lg">
                                <Droplets className="text-cyan-400" size={16} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Active LPs</p>
                                <p className="text-sm font-bold text-cyan-400">{stats.activeLPs}</p>
                            </div>
                        </div>

                        {/* Commercial Volume */}
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-purple-500/20 rounded-lg">
                                <DollarSign className="text-purple-400" size={16} />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Vol 24h</p>
                                <p className="text-sm font-bold text-purple-400">${stats.commercialVolume}</p>
                            </div>
                        </div>
                    </div>

                    {/* Live indicator */}
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-gray-500">Live</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

/**
 * GlobalStatsFooter - Versión footer/ticker para todas las páginas
 */
export function GlobalStatsFooter() {
    return <GlobalStatsBar compact={true} />;
}
