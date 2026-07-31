'use client';

import { useState } from 'react';
import Link from 'next/link';

// Component Imports (To be created)
import TabIdentity from './components/TabIdentity';
import TabTreasury from './components/TabTreasury';
import TabEcosystem from './components/TabEcosystem';
import TabIntelligence from './components/TabIntelligence';
import TabGovernance from './components/TabGovernance';
import TabSkills from './components/TabSkills';
import TabObsidian from './components/TabObsidian';
import TabBrainLive from './components/TabBrainLive';
import TabWatchdog from './components/TabWatchdog';

import { Shield, Landmark, Box, BrainCircuit, Scale, LogOut, Activity, BookOpen, Map, Radar, HeartPulse } from 'lucide-react';

const TABS = [
    { id: 'identity',    label: 'Identity & Security', icon: Shield,       desc: 'DID & Secrets' },
    { id: 'treasury',    label: 'Treasury & Web3',     icon: Landmark,     desc: 'Hot Wallets & MPC' },
    { id: 'ecosystem',   label: 'Ecosystem & RWA',     icon: Box,          desc: 'Factory & Oracle' },
    { id: 'intelligence',label: 'MCP Intelligence',    icon: BrainCircuit, desc: 'OpenClaw Brain' },
    { id: 'obsidian',     label: 'Obsidian Map',       icon: Map,          desc: 'Vault & Feedback' },
    { id: 'brainlive',   label: 'Brain Live',         icon: Radar,        desc: 'API Nodes & Usage' },
    { id: 'watchdog',    label: 'Watchdog',            icon: HeartPulse,   desc: 'SubApps & Sync ABI' },
    { id: 'governance',  label: 'DAO Governance',      icon: Scale,        desc: 'Audit & RBAC' },
    { id: 'skills',      label: 'SKILL Memory',        icon: BookOpen,     desc: 'Agent Interactions' },
];

export default function HybridControlCenter() {
    const [activeTab, setActiveTab] = useState('identity');

    return (
        <div className="min-h-screen bg-[#080911] font-['Space_Grotesk'] text-[#f5f6f8]">
            {/* Top Navigation Bar */}
            <header className="fixed top-0 w-full h-16 bg-[#0c0d17]/80 backdrop-blur-md border-b border-white/5 z-50 flex items-center justify-between px-6">
                <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-[#0d33f2] rotate-45 flex items-center justify-center shadow-[0_0_15px_rgba(13,51,242,0.4)]">
                        <span className="text-white font-black text-sm -rotate-45 italic">B</span>
                    </div>
                    <div>
                        <h1 className="font-bold tracking-widest uppercase italic text-sm">HYBRID CONTROL CENTER</h1>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            OpenClaw Synchronized
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2 text-xs text-gray-400 bg-white/5 px-3 py-1 rounded border border-white/5">
                        <Activity size={14} className="text-[#0d33f2]" />
                        <span>Heartbeat: 12ms</span>
                    </div>
                    <Link href="/admin/login" className="flex items-center space-x-2 text-gray-400 hover:text-red-400 transition-colors text-xs font-bold uppercase tracking-widest">
                        <LogOut size={16} />
                        <span>Disconnect</span>
                    </Link>
                </div>
            </header>

            <div className="pt-24 pb-12 px-8 max-w-[1600px] mx-auto grid grid-cols-12 gap-8">
                {/* Sidebar Navigation */}
                <aside className="col-span-12 lg:col-span-3 space-y-2">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center space-x-4 p-4 text-left transition-all border-l-2 ${
                                    isActive 
                                    ? 'bg-white/5 border-[#0d33f2] text-white shadow-[inset_4px_0_15px_rgba(13,51,242,0.1)]' 
                                    : 'border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300'
                                }`}
                            >
                                <Icon size={20} className={isActive ? 'text-[#0d33f2]' : 'text-gray-600'} />
                                <div>
                                    <div className="font-bold text-sm tracking-widest uppercase">{tab.label}</div>
                                    <div className="text-[10px] opacity-70 tracking-widest uppercase mt-0.5">{tab.desc}</div>
                                </div>
                            </button>
                        );
                    })}
                    
                    <div className="mt-12 p-4 border border-white/5 bg-black/20 text-xs text-gray-500 font-mono">
                        <div className="mb-2 text-[#0d33f2] font-bold">SYSTEM STATUS</div>
                        <div>Role: SUPERADMIN</div>
                        <div>Nodes: 3 Active</div>
                        <div>Last Sync: Just now</div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="col-span-12 lg:col-span-9 min-h-[700px] relative">
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#0d33f2]/5 to-transparent pointer-events-none rounded-xl" />
                    <div className="bg-[#05060a] border border-white/5 shadow-2xl p-8 h-full relative z-10">
                        {activeTab === 'identity'     && <TabIdentity />}
                        {activeTab === 'treasury'     && <TabTreasury />}
                        {activeTab === 'ecosystem'    && <TabEcosystem />}
                        {activeTab === 'intelligence' && <TabIntelligence />}
                        {activeTab === 'obsidian'     && <TabObsidian />}
                        {activeTab === 'brainlive'    && <TabBrainLive />}
                        {activeTab === 'watchdog'     && <TabWatchdog />}
                        {activeTab === 'governance'   && <TabGovernance />}
                        {activeTab === 'skills'       && <TabSkills />}
                    </div>
                </main>
            </div>
        </div>
    );
}
