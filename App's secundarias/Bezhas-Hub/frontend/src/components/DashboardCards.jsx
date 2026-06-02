import React from 'react';
import { Wallet, Package, Building2, TrendingUp } from 'lucide-react';

export default function DashboardCards({ logisticsStats, realEstateStats }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Logística */}
            <div className="bg-gradient-to-br from-blue-900 via-blue-700 to-purple-900 p-8 rounded-3xl shadow-xl border border-blue-500/20">
                <div className="flex items-center gap-4 mb-4">
                    <Package className="w-8 h-8 text-blue-400" />
                    <h3 className="text-2xl font-bold text-white">Logística NFT</h3>
                </div>
                <p className="text-white text-4xl font-black mb-2">{logisticsStats.totalContainers}</p>
                <p className="text-blue-200">Contenedores activos</p>
                <div className="mt-6 flex gap-4">
                    <span className="bg-blue-800/50 px-4 py-2 rounded-xl text-white font-bold">{logisticsStats.inTransit} en tránsito</span>
                    <span className="bg-green-700/30 px-4 py-2 rounded-xl text-green-300 font-bold">{logisticsStats.delivered} entregados</span>
                </div>
            </div>
            {/* Real Estate */}
            <div className="bg-gradient-to-br from-amber-900 via-yellow-700 to-black p-8 rounded-3xl shadow-xl border border-amber-500/20">
                <div className="flex items-center gap-4 mb-4">
                    <Building2 className="w-8 h-8 text-amber-400" />
                    <h3 className="text-2xl font-bold text-white">Real Estate RWA</h3>
                </div>
                <p className="text-white text-4xl font-black mb-2">{realEstateStats.totalProperties}</p>
                <p className="text-amber-200">Propiedades tokenizadas</p>
                <div className="mt-6 flex gap-4">
                    <span className="bg-amber-800/50 px-4 py-2 rounded-xl text-white font-bold">{realEstateStats.totalSharesSold} acciones vendidas</span>
                    <span className="bg-green-700/30 px-4 py-2 rounded-xl text-green-300 font-bold">{realEstateStats.dividendsPending} ETH dividendos pendientes</span>
                </div>
            </div>
        </div>
    );
}
