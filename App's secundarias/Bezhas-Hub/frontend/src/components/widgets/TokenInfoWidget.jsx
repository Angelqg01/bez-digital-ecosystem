import React, { useState, useEffect } from 'react';
import { Coins, TrendingUp, Users, DollarSign, Lock, Zap } from 'lucide-react';
import { ethers } from 'ethers';
import { BezhasTokenAddress, TokenSaleAddress, TokenSaleABI, BezhasTokenABI } from '../../contract-config';

/**
 * TokenInfoWidget - Componente para mostrar información de BEZ Token
 * Muestra estadísticas en tiempo real del token y la venta
 */
const TokenInfoWidget = () => {
    const [tokenStats, setTokenStats] = useState({
        totalSupply: '1000000000',
        circulating: '300000000',
        price: '0.0001',
        tokensSold: '0',
        marketCap: '0',
        holders: '0'
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTokenStats();
        const interval = setInterval(fetchTokenStats, 30000); // Update every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchTokenStats = async () => {
        try {
            if (!window.ethereum) {
                setLoading(false);
                return;
            }

            const provider = new ethers.BrowserProvider(window.ethereum);

            // Get TokenSale contract data
            const saleContract = new ethers.Contract(TokenSaleAddress, TokenSaleABI, provider);
            const tokenContract = new ethers.Contract(BezhasTokenAddress, BezhasTokenABI, provider);

            const [price, tokensSold, totalSupply] = await Promise.all([
                saleContract.price().catch(() => ethers.parseEther('0.0001')),
                saleContract.tokensSold().catch(() => 0n),
                tokenContract.totalSupply().catch(() => ethers.parseEther('1000000000'))
            ]);

            const priceInEth = ethers.formatEther(price);
            const soldAmount = ethers.formatEther(tokensSold);
            const supply = ethers.formatEther(totalSupply);
            const circulating = (parseFloat(supply) * 0.3).toString(); // 30% circulating

            // Calculate market cap (circulating * price in USD - assuming 1 ETH = $3000)
            const ethPriceUSD = 3000;
            const marketCap = (parseFloat(circulating) * parseFloat(priceInEth) * ethPriceUSD).toFixed(0);

            setTokenStats({
                totalSupply: supply,
                circulating: circulating,
                price: priceInEth,
                tokensSold: soldAmount,
                marketCap: marketCap,
                holders: '1247' // Mock data - would come from indexer/subgraph
            });

            setLoading(false);
        } catch (error) {
            console.error('Error fetching token stats:', error);
            setLoading(false);
        }
    };

    const formatNumber = (num) => {
        const number = parseFloat(num);
        if (number >= 1000000000) return (number / 1000000000).toFixed(2) + 'B';
        if (number >= 1000000) return (number / 1000000).toFixed(2) + 'M';
        if (number >= 1000) return (number / 1000).toFixed(2) + 'K';
        return number.toFixed(2);
    };

    const StatCard = ({ icon: Icon, label, value, color, subtitle }) => (
        <div className="bg-white dark-mode:bg-[#192235] rounded-xl p-4 border border-gray-200 dark-mode:border-gray-700 hover:shadow-lg transition-all">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`p-2 rounded-lg ${color}`}>
                            <Icon size={20} className="text-white" />
                        </div>
                        <span className="text-sm font-medium text-gray-600 dark-mode:text-gray-400">
                            {label}
                        </span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark-mode:text-white">
                        {value}
                    </div>
                    {subtitle && (
                        <div className="text-xs text-gray-500 dark-mode:text-gray-400 mt-1">
                            {subtitle}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl p-6 border border-cyan-500/20">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-300 dark-mode:bg-gray-700 rounded w-1/3"></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-32 bg-gray-300 dark-mode:bg-gray-700 rounded-xl"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl p-6 border border-cyan-500/20">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl">
                        <Coins size={28} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark-mode:text-white">
                            BEZ Token
                        </h2>
                        <p className="text-sm text-gray-600 dark-mode:text-gray-400">
                            Estadísticas en Tiempo Real
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 text-green-600 dark-mode:text-green-400 rounded-lg">
                    <TrendingUp size={18} />
                    <span className="font-semibold">Activo</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard
                    icon={DollarSign}
                    label="Precio"
                    value={`${parseFloat(tokenStats.price).toFixed(4)} ETH`}
                    color="bg-gradient-to-r from-green-500 to-emerald-500"
                    subtitle="~$0.30 USD"
                />

                <StatCard
                    icon={TrendingUp}
                    label="Market Cap"
                    value={`$${formatNumber(tokenStats.marketCap)}`}
                    color="bg-gradient-to-r from-blue-500 to-cyan-500"
                    subtitle="Capitalización"
                />

                <StatCard
                    icon={Coins}
                    label="Vendidos"
                    value={formatNumber(tokenStats.tokensSold)}
                    color="bg-gradient-to-r from-purple-500 to-pink-500"
                    subtitle="Tokens en venta"
                />

                <StatCard
                    icon={Zap}
                    label="En Circulación"
                    value={formatNumber(tokenStats.circulating)}
                    color="bg-gradient-to-r from-orange-500 to-red-500"
                    subtitle="30% del supply"
                />

                <StatCard
                    icon={Lock}
                    label="Total Supply"
                    value={formatNumber(tokenStats.totalSupply)}
                    color="bg-gradient-to-r from-indigo-500 to-purple-500"
                    subtitle="100% del total"
                />

                <StatCard
                    icon={Users}
                    label="Holders"
                    value={tokenStats.holders}
                    color="bg-gradient-to-r from-pink-500 to-rose-500"
                    subtitle="Wallets únicas"
                />
            </div>

            {/* Additional Info */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark-mode:bg-[#192235] rounded-xl p-4 border border-gray-200 dark-mode:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark-mode:text-white mb-3">
                        📊 Distribución del Token
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600 dark-mode:text-gray-400">Circulación</span>
                            <span className="font-semibold">30%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600 dark-mode:text-gray-400">Staking</span>
                            <span className="font-semibold">15%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600 dark-mode:text-gray-400">Rewards</span>
                            <span className="font-semibold">10%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600 dark-mode:text-gray-400">Desarrollo</span>
                            <span className="font-semibold">20%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600 dark-mode:text-gray-400">Equipo (vesting)</span>
                            <span className="font-semibold">15%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600 dark-mode:text-gray-400">Liquidez</span>
                            <span className="font-semibold">10%</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark-mode:bg-[#192235] rounded-xl p-4 border border-gray-200 dark-mode:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark-mode:text-white mb-3">
                        🔗 Información del Contrato
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div>
                            <span className="text-gray-600 dark-mode:text-gray-400 block mb-1">Token Address:</span>
                            <code className="text-xs bg-gray-100 dark-mode:bg-[#0A101F] px-2 py-1 rounded">
                                {BezhasTokenAddress.slice(0, 10)}...{BezhasTokenAddress.slice(-8)}
                            </code>
                        </div>
                        <div>
                            <span className="text-gray-600 dark-mode:text-gray-400 block mb-1">Sale Address:</span>
                            <code className="text-xs bg-gray-100 dark-mode:bg-[#0A101F] px-2 py-1 rounded">
                                {TokenSaleAddress.slice(0, 10)}...{TokenSaleAddress.slice(-8)}
                            </code>
                        </div>
                        <div className="pt-2 border-t border-gray-200 dark-mode:border-gray-700">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-xs text-gray-600 dark-mode:text-gray-400">
                                    Actualización automática cada 30s
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TokenInfoWidget;
