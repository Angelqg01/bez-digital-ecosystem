import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, Calculator } from 'lucide-react';

const DividendCalculator = ({ pricePerShare, annualROI = 12 }) => {
    const [shares, setShares] = useState(100);
    const [projections, setProjections] = useState({ monthly: 0, annual: 0, totalInvested: 0 });

    useEffect(() => {
        const totalInvested = shares * pricePerShare;
        const annual = totalInvested * (annualROI / 100);
        const monthly = annual / 12;
        setProjections({ monthly, annual, totalInvested });
    }, [shares, pricePerShare, annualROI]);

    return (
        <div className="bg-gradient-to-br from-slate-900 to-black p-8 rounded-3xl border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.1)]">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-amber-500/10 rounded-xl">
                    <Calculator className="text-amber-500" />
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">Simulador de Inversión BeZhas</h3>
            </div>
            <div className="space-y-6">
                <div>
                    <div className="flex justify-between text-slate-400 mb-4">
                        <label>Cantidad de Acciones (Tokens)</label>
                        <span className="text-white font-bold text-xl">{shares.toLocaleString()}</span>
                    </div>
                    <input
                        type="range" min="1" max="10000" step="10"
                        value={shares}
                        onChange={(e) => setShares(e.target.value)}
                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <p className="text-slate-400 text-sm mb-1">Inversión Total</p>
                        <p className="text-xl font-bold text-white uppercase">{projections.totalInvested.toFixed(3)} ETH</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <p className="text-slate-400 text-sm mb-1">Renta Mensual Est.</p>
                        <p className="text-xl font-bold text-green-400 uppercase">{projections.monthly.toFixed(4)} ETH</p>
                    </div>
                    <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20">
                        <p className="text-amber-500 text-sm mb-1">Retorno Anual ({annualROI}%)</p>
                        <p className="text-xl font-bold text-amber-500 uppercase">{projections.annual.toFixed(3)} ETH</p>
                    </div>
                </div>
                <button className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-black font-black rounded-xl transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20">
                    <Wallet className="w-5 h-5" /> COMPRAR TOKENS AHORA
                </button>
                <p className="text-center text-[10px] text-slate-500 italic">
                    * Los rendimientos son estimados basados en el historial de rentas on-chain.
                </p>
            </div>
        </div>
    );
};

export default DividendCalculator;
