// frontend/src/components/AdStatsPanel.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

const AdStatsPanel = ({ stats: propStats, userId, campaignId }) => {
    const [stats, setStats] = useState(propStats || {
        impressions: 0,
        clicks: 0,
        rewards: 0,
        remaining: 0
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Si se proporcionan stats como prop, usarlas
        if (propStats) {
            setStats(propStats);
            return;
        }

        // Si no, intentar cargarlas desde el backend
        const fetchStats = async () => {
            if (!userId && !campaignId) return;

            setLoading(true);
            try {
                // TODO: Implementar llamada al backend
                // const response = await fetch(`/api/ads/stats?userId=${userId}&campaignId=${campaignId}`);
                // const data = await response.json();
                // setStats(data);

                // Simulación temporal
                setStats({
                    impressions: Math.floor(Math.random() * 1000),
                    clicks: Math.floor(Math.random() * 100),
                    rewards: Math.floor(Math.random() * 500),
                    remaining: Math.floor(Math.random() * 2000)
                });
            } catch (error) {
                console.error('Error fetching stats:', error);
                toast.error('Error al cargar estadísticas');
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [propStats, userId, campaignId]);

    if (loading) {
        return (
            <div className="bg-gray-50 rounded-xl p-4 shadow mb-4">
                <h3 className="font-bold text-lg mb-2">Estadísticas</h3>
                <div className="text-center py-4 text-gray-500">
                    Cargando estadísticas...
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 shadow-lg mb-4 border border-blue-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-xl text-gray-800">📊 Estadísticas de Campañas</h3>
                <button
                    onClick={() => toast.info('Actualizando estadísticas...')}
                    className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                >
                    🔄 Actualizar
                </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-gray-500 text-sm block mb-1">👁️ Impresiones</span>
                    <div className="text-3xl font-bold text-blue-600">{stats.impressions.toLocaleString()}</div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-gray-500 text-sm block mb-1">🖱️ Clics</span>
                    <div className="text-3xl font-bold text-green-600">{stats.clicks.toLocaleString()}</div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-gray-500 text-sm block mb-1">💰 Recompensas</span>
                    <div className="text-2xl font-bold text-purple-600">{stats.rewards.toLocaleString()} BEZ</div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-gray-500 text-sm block mb-1">💵 Presupuesto</span>
                    <div className="text-2xl font-bold text-orange-600">{stats.remaining.toLocaleString()} BEZ</div>
                </div>
            </div>

            {/* Métricas adicionales */}
            <div className="mt-4 pt-4 border-t border-blue-200">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">CTR (Click-Through Rate):</span>
                    <span className="font-bold text-blue-600">
                        {stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : 0}%
                    </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-gray-600">Costo por Clic (CPC):</span>
                    <span className="font-bold text-purple-600">
                        {stats.clicks > 0 ? (stats.rewards / stats.clicks).toFixed(2) : 0} BEZ
                    </span>
                </div>
            </div>
        </div>
    );
};

export default AdStatsPanel;
