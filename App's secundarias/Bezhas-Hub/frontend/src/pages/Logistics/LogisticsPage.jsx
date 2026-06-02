import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogisticsDashboard } from '../../components/logistics/LogisticsDashboard';
import { LogisticsHub } from '../../components/logistics/LogisticsHub';
import { LogisticsStandards } from '../../components/logistics/LogisticsStandards';
import BeZhasLogisticsSimulator from '../../components/logistics/BeZhasLogisticsSimulator';
import { FaTruck, FaCode } from 'react-icons/fa';

const LogisticsPage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('simulator');

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6">
            <div className="max-w-7xl mx-auto pb-32">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row gap-8 items-end mb-12">
                    <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-blue-500/10 text-blue-500 text-[9px] font-black uppercase rounded-full border border-blue-500/20 tracking-widest shadow-lg shadow-blue-500/5">
                                Infinite Logistics Unit
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Blockchain Verified Network</span>
                        </div>
                        <h2 className="text-6xl font-black tracking-tighter text-white italic">
                            BeZhas <span className="text-blue-500">LogiChain</span>
                        </h2>
                        <p className="text-slate-400 max-w-2xl text-base leading-relaxed font-medium">
                            Enterprise-grade supply chain automation. Secure cargo tokenization, multi-modal transshipment tracking, and real-time fleet analytics powered by <span className="text-white font-bold italic">BEZ-Coin</span>.
                        </p>
                    </div>

                    {/* Action Buttons Group */}
                    <div className="flex flex-col gap-3">
                        {/* CTA Button - Crear Contrato */}
                        <button
                            onClick={() => navigate('/create?tab=logistics')}
                            className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-300 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 rounded-2xl hover:from-blue-500 hover:via-blue-600 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 shadow-2xl hover:shadow-blue-500/50 hover:scale-105 active:scale-95"
                        >
                            <span className="absolute inset-0 w-full h-full -mt-1 rounded-2xl opacity-30 bg-gradient-to-b from-white/20 via-transparent to-black/20"></span>
                            <span className="relative flex items-center gap-3 uppercase tracking-wider text-sm">
                                <FaTruck className="w-5 h-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                                Crear Contrato Logístico
                            </span>
                        </button>

                        {/* SDK Button - Developer Console */}
                        <button
                            onClick={() => navigate('/developer-console')}
                            className="group relative inline-flex items-center justify-center px-8 py-3 font-bold text-white transition-all duration-300 bg-gradient-to-r from-purple-600 via-violet-500 to-purple-600 rounded-2xl hover:from-purple-500 hover:via-violet-600 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-600 shadow-xl hover:shadow-purple-500/50 hover:scale-105 active:scale-95"
                        >
                            <span className="absolute inset-0 w-full h-full -mt-1 rounded-2xl opacity-30 bg-gradient-to-b from-white/20 via-transparent to-black/20"></span>
                            <span className="relative flex items-center gap-3 uppercase tracking-wider text-xs">
                                <FaCode className="w-4 h-4 transition-transform group-hover:rotate-12" />
                                SDK Developer Console
                            </span>
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2 p-2 bg-slate-900/60 rounded-[2rem] border border-slate-800/50 backdrop-blur-xl shadow-2xl">
                        {[
                            { id: 'simulator', label: 'SDK Simulator', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                            { id: 'dashboard', label: 'Monitor', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                            { id: 'operations', label: 'Operations', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
                            { id: 'standards', label: 'Compliance', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-xl'
                                    : 'text-slate-500 hover:text-white hover:bg-slate-800/50'
                                    }`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={tab.icon} />
                                </svg>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="min-h-[600px]">
                    {activeTab === 'simulator' && <BeZhasLogisticsSimulator />}
                    {activeTab === 'dashboard' && <LogisticsDashboard />}
                    {activeTab === 'operations' && <LogisticsHub />}
                    {activeTab === 'standards' && <LogisticsStandards />}
                </div>
            </div>
        </div>
    );
};

export default LogisticsPage;
