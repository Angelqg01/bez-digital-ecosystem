import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { BarChart3 } from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export default function RewardsChart({ earnings, vipTier }) {
    const chartData = useMemo(() => {
        if (!earnings.breakdown) {
            return null;
        }

        const baseDaily = earnings.breakdown.totalStandard;
        const vipDaily = earnings.breakdown.totalVIP;

        // Calcular proyecciones para cada tier
        const tiers = [
            { name: 'Estándar', multiplier: 1, color: 'rgba(156, 163, 175, 0.8)' },
            { name: 'VIP Bronze (1.5x)', multiplier: 1.5, color: 'rgba(249, 115, 22, 0.8)' },
            { name: 'VIP Silver (2x)', multiplier: 2, color: 'rgba(59, 130, 246, 0.8)' },
            { name: 'VIP Gold (2.5x)', multiplier: 2.5, color: 'rgba(234, 179, 8, 0.8)' },
            { name: 'VIP Diamond (3x)', multiplier: 3, color: 'rgba(168, 85, 247, 0.8)' }
        ];

        return {
            labels: ['Diario', 'Semanal', 'Mensual', 'Trimestral', 'Anual'],
            datasets: tiers.map((tier) => ({
                label: tier.name,
                data: [
                    baseDaily * tier.multiplier,
                    baseDaily * tier.multiplier * 7,
                    baseDaily * tier.multiplier * 30,
                    baseDaily * tier.multiplier * 90,
                    baseDaily * tier.multiplier * 365
                ],
                backgroundColor: tier.color,
                borderColor: tier.color.replace('0.8', '1'),
                borderWidth: 2,
                borderRadius: 8,
                maxBarThickness: 50
            }))
        };
    }, [earnings]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#9ca3af',
                    padding: 15,
                    font: {
                        size: 12
                    }
                }
            },
            title: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(17, 24, 39, 0.95)',
                titleColor: '#f3f4f6',
                bodyColor: '#d1d5db',
                borderColor: '#374151',
                borderWidth: 1,
                padding: 12,
                displayColors: true,
                callbacks: {
                    label: function (context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        label += new Intl.NumberFormat('es-ES', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        }).format(context.parsed.y) + ' BEZ';
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: '#9ca3af',
                    font: {
                        size: 11
                    }
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(75, 85, 99, 0.3)',
                    drawBorder: false
                },
                ticks: {
                    color: '#9ca3af',
                    font: {
                        size: 11
                    },
                    callback: function (value) {
                        return new Intl.NumberFormat('es-ES', {
                            notation: 'compact',
                            compactDisplay: 'short'
                        }).format(value) + ' BEZ';
                    }
                }
            }
        },
        interaction: {
            mode: 'index',
            intersect: false
        }
    };

    if (!chartData) {
        return (
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-700/50">
                    <BarChart3 className="w-6 h-6 text-blue-400" />
                    <div>
                        <h2 className="text-xl font-bold text-white">Comparativa de Ganancias</h2>
                        <p className="text-sm text-gray-400">Proyección por nivel VIP</p>
                    </div>
                </div>

                <div className="h-80 flex items-center justify-center">
                    <div className="text-center">
                        <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">Calcula tus recompensas para ver la comparativa</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-2xl p-6 backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-700/50">
                <BarChart3 className="w-6 h-6 text-blue-400" />
                <div>
                    <h2 className="text-xl font-bold text-white">Comparativa de Ganancias</h2>
                    <p className="text-sm text-gray-400">Proyección por nivel VIP</p>
                </div>
            </div>

            {/* Chart */}
            <div className="h-80">
                <Bar data={chartData} options={options} />
            </div>

            {/* Legend Explanation */}
            <div className="mt-6 pt-6 border-t border-gray-700/50">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                        { label: 'Diario', color: 'bg-blue-500' },
                        { label: 'Semanal', color: 'bg-green-500' },
                        { label: 'Mensual', color: 'bg-yellow-500' },
                        { label: 'Trimestral', color: 'bg-orange-500' },
                        { label: 'Anual', color: 'bg-purple-500' }
                    ].map((period, idx) => (
                        <div key={idx} className="text-center">
                            <div className={`w-full h-2 ${period.color} rounded-full mb-2`}></div>
                            <p className="text-xs text-gray-400">{period.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Info */}
            <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <p className="text-sm text-blue-300 font-semibold mb-2">
                    📊 Análisis de Comparativa
                </p>
                <p className="text-xs text-gray-400 leading-relaxed">
                    Esta gráfica muestra cómo tus ganancias aumentarían con cada nivel VIP a lo largo
                    del tiempo. Nota cómo el efecto compuesto multiplica significativamente tus recompensas
                    anuales, especialmente con VIP Diamond (3x).
                </p>
            </div>
        </div>
    );
}
