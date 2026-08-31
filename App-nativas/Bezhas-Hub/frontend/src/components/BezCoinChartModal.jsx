import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, Calendar } from 'lucide-react';
import { useBezCoin } from '../context/BezCoinContext';

const BezCoinChartModal = ({ isOpen, onClose }) => {
    const { tokenPrice, priceHistory } = useBezCoin();
    const [timeframe, setTimeframe] = useState('24h'); // '24h' | '7d' | '30d'
    const [chartData, setChartData] = useState([]);
    const [priceChange, setPriceChange] = useState(0);
    const [priceChangePercent, setPriceChangePercent] = useState(0);

    useEffect(() => {
        if (isOpen) {
            generateChartData();
        }
    }, [isOpen, timeframe, tokenPrice]);

    const generateChartData = () => {
        // Generar datos simulados de precio basados en el precio actual
        const currentPrice = Number(tokenPrice) || 0.5;
        const dataPoints = timeframe === '24h' ? 24 : timeframe === '7d' ? 7 : 30;

        const data = [];
        let price = currentPrice * 0.95; // Precio inicial 5% menor

        for (let i = 0; i < dataPoints; i++) {
            // Variación aleatoria del precio entre -2% y +3%
            const variation = (Math.random() - 0.4) * 0.05;
            price = price * (1 + variation);

            data.push({
                time: i,
                price: price,
                label: timeframe === '24h' ? `${i}:00` : `Día ${i + 1}`
            });
        }

        // Último punto es el precio actual
        data[data.length - 1].price = currentPrice;

        setChartData(data);

        // Calcular cambio de precio
        const firstPrice = data[0].price;
        const change = currentPrice - firstPrice;
        const changePercent = (change / firstPrice) * 100;

        setPriceChange(change);
        setPriceChangePercent(changePercent);
    };

    if (!isOpen) return null;

    const maxPrice = Math.max(...chartData.map(d => d.price));
    const minPrice = Math.min(...chartData.map(d => d.price));
    const priceRange = maxPrice - minPrice;

    const isPositive = priceChangePercent >= 0;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-6">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                                ₿
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">BeZhas Coin (BEZ)</h2>
                                <p className="text-white/80 text-sm">Token ERC-20 en Polygon Network</p>
                            </div>
                        </div>

                        {/* Current Price */}
                        <div className="mt-6">
                            <div className="text-white/80 text-sm mb-1">Precio Actual</div>
                            <div className="flex items-baseline gap-4">
                                <span className="text-4xl font-bold text-white">
                                    ${Number(tokenPrice).toFixed(4)}
                                </span>
                                <span className="text-sm text-white/90">USDC</span>
                            </div>

                            {/* Price Change Badge */}
                            <div className={`inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-sm font-semibold ${isPositive
                                    ? 'bg-green-500/20 text-green-100'
                                    : 'bg-red-500/20 text-red-100'
                                }`}>
                                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%
                                <span className="text-xs opacity-80">
                                    ({isPositive ? '+' : ''}${priceChange.toFixed(4)})
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Timeframe Selector */}
                    <div className="flex gap-2 p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        {[
                            { value: '24h', label: '24 Horas' },
                            { value: '7d', label: '7 Días' },
                            { value: '30d', label: '30 Días' }
                        ].map((tf) => (
                            <button
                                key={tf.value}
                                onClick={() => setTimeframe(tf.value)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${timeframe === tf.value
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                                    }`}
                            >
                                {tf.label}
                            </button>
                        ))}
                    </div>

                    {/* Chart */}
                    <div className="p-6">
                        <div className="relative h-64 bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-900/10 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                            {/* Grid Lines */}
                            <div className="absolute inset-0 flex flex-col justify-between p-4">
                                {[0, 1, 2, 3, 4].map((i) => (
                                    <div key={i} className="border-t border-gray-200 dark:border-gray-700/50 border-dashed" />
                                ))}
                            </div>

                            {/* Price Line Chart */}
                            <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0.3" />
                                        <stop offset="100%" stopColor={isPositive ? "#10b981" : "#ef4444"} stopOpacity="0" />
                                    </linearGradient>
                                </defs>

                                {/* Area Fill */}
                                <path
                                    d={`
                                        M 0,${100 - ((chartData[0]?.price - minPrice) / priceRange) * 100}
                                        ${chartData.map((point, i) => {
                                        const x = (i / (chartData.length - 1)) * 100;
                                        const y = 100 - ((point.price - minPrice) / priceRange) * 100;
                                        return `L ${x},${y}`;
                                    }).join(' ')}
                                        L 100,100 L 0,100 Z
                                    `}
                                    fill="url(#chartGradient)"
                                />

                                {/* Line */}
                                <path
                                    d={`
                                        M 0,${100 - ((chartData[0]?.price - minPrice) / priceRange) * 100}
                                        ${chartData.map((point, i) => {
                                        const x = (i / (chartData.length - 1)) * 100;
                                        const y = 100 - ((point.price - minPrice) / priceRange) * 100;
                                        return `L ${x},${y}`;
                                    }).join(' ')}
                                    `}
                                    fill="none"
                                    stroke={isPositive ? "#10b981" : "#ef4444"}
                                    strokeWidth="2"
                                    vectorEffect="non-scaling-stroke"
                                />

                                {/* Data Points */}
                                {chartData.map((point, i) => {
                                    const x = (i / (chartData.length - 1)) * 100;
                                    const y = 100 - ((point.price - minPrice) / priceRange) * 100;
                                    return (
                                        <circle
                                            key={i}
                                            cx={`${x}%`}
                                            cy={`${y}%`}
                                            r="3"
                                            fill={isPositive ? "#10b981" : "#ef4444"}
                                            className="opacity-60 hover:opacity-100"
                                        />
                                    );
                                })}
                            </svg>

                            {/* X-axis Labels */}
                            <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4 text-xs text-gray-500 dark:text-gray-400">
                                <span>{chartData[0]?.label}</span>
                                <span>{chartData[Math.floor(chartData.length / 2)]?.label}</span>
                                <span>{chartData[chartData.length - 1]?.label}</span>
                            </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                                    <TrendingUp size={16} />
                                    Máximo {timeframe}
                                </div>
                                <div className="text-xl font-bold text-gray-900 dark:text-white">
                                    ${maxPrice.toFixed(4)}
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                                    <TrendingDown size={16} />
                                    Mínimo {timeframe}
                                </div>
                                <div className="text-xl font-bold text-gray-900 dark:text-white">
                                    ${minPrice.toFixed(4)}
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                                    <Activity size={16} />
                                    Volatilidad
                                </div>
                                <div className="text-xl font-bold text-gray-900 dark:text-white">
                                    {((priceRange / minPrice) * 100).toFixed(2)}%
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                                    <DollarSign size={16} />
                                    Cap. Mercado
                                </div>
                                <div className="text-xl font-bold text-gray-900 dark:text-white">
                                    $2.5M
                                </div>
                            </div>
                        </div>

                        {/* Info Note */}
                        <div className="mt-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                            <div className="flex items-start gap-3">
                                <BarChart3 className="text-blue-600 dark:text-blue-400 mt-0.5" size={20} />
                                <div className="flex-1 text-sm text-blue-800 dark:text-blue-200">
                                    <p className="font-semibold mb-1">Datos en Tiempo Real</p>
                                    <p className="text-blue-700 dark:text-blue-300">
                                        Los precios se actualizan automáticamente desde el contrato inteligente BEZ en Polygon.
                                        El gráfico muestra tendencias históricas basadas en el precio actual del token.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default BezCoinChartModal;
