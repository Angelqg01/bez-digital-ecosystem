import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

const throughputData = [
    { time: '00:00', val: 120 }, { time: '04:00', val: 450 }, { time: '08:00', val: 890 },
    { time: '12:00', val: 1420 }, { time: '16:00', val: 1100 }, { time: '20:00', val: 1550 },
    { time: '24:00', val: 1800 }
];

const efficiencyData = [
    { name: 'Ethereum L1', cost: 85 },
    { name: 'Polygon L2', cost: 0.05 }, // Updated based on text
    { name: 'BeZhas Sidechain', cost: 0.001 }
];

const BEZ_PRICE = 0.105; // Updated based on text (POL price reference)
const demoShipmentFiat = 1200;
const demoShipmentBez = (1200 * 0.8) / BEZ_PRICE; // Rebate de 20%

const costComparisonData = [
    { name: 'Traditional Fiat', cost: demoShipmentFiat, color: '#475569' },
    { name: 'BeZhas Platform', cost: 960, color: '#eab308' } // 960 es el equivalente en USD
];

export const LogisticsDashboard = () => {
    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Executive Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'POL Token Ref.', value: `$${BEZ_PRICE}`, delta: 'Stable', color: 'purple' },
                    { label: 'Global Validations', value: '1.2M+', delta: '99.9% Success', color: 'emerald' },
                    { label: 'Avg. L2 Gas Fee', value: '$0.02', delta: '-99% vs L1', color: 'blue' },
                    { label: 'Strategic Nodes', value: '14,802', delta: 'Global Coverage', color: 'yellow' }
                ].map((stat, i) => (
                    <div key={i} className="bg-slate-900/40 p-8 rounded-[3rem] border border-slate-800/50 backdrop-blur-xl shadow-xl hover:scale-[1.02] transition-all">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-4">{stat.label}</p>
                        <p className="text-3xl font-mono font-black italic mb-3">{stat.value}</p>
                        <span className={`text-[10px] font-black uppercase text-${stat.color}-400 px-3 py-1 bg-${stat.color}-500/10 rounded-full border border-${stat.color}-500/20`}>{stat.delta}</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Network Chart */}
                <div className="lg:col-span-2 bg-slate-900/40 p-10 rounded-[4rem] border border-slate-800/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8">
                        <span className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Global Supply Pulse
                        </span>
                    </div>
                    <h3 className="text-2xl font-black italic mb-2">Throughput Analytics</h3>
                    <p className="text-xs text-slate-500 mb-10">Real-time smart contract executions across BeZhas Sidechain infrastructure.</p>

                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={throughputData}>
                                <defs>
                                    <linearGradient id="pulse" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="time" stroke="#475569" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', fontSize: '10px' }} />
                                <Area type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={5} fill="url(#pulse)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Financial Pulse Chart */}
                <div className="bg-slate-900/40 p-10 rounded-[4rem] border border-slate-800/50 flex flex-col">
                    <h3 className="text-2xl font-black italic mb-2">Financial Pulse</h3>
                    <p className="text-xs text-slate-500 mb-10">Comparative cost analysis: Standard Freight vs. BEZ Ecosystem settlement.</p>

                    <div className="flex-1 min-h-[250px] flex flex-col justify-center items-center">
                        <ResponsiveContainer width="100%" height="200">
                            <BarChart data={costComparisonData}>
                                <XAxis dataKey="name" stroke="#475569" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }} />
                                <Bar dataKey="cost" radius={[15, 15, 0, 0]} barSize={60}>
                                    {costComparisonData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>

                        <div className="mt-8 w-full space-y-4">
                            <div className="p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-[2rem] text-center">
                                <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Effective BEZ Tokens Required</span>
                                <p className="text-2xl font-mono font-black text-yellow-500 italic">{demoShipmentBez.toLocaleString(undefined, { maximumFractionDigits: 0 })} BEZ</p>
                                <p className="text-[9px] text-slate-600 font-bold mt-2 uppercase tracking-tighter">Value derived from $0.105 reference price</p>
                            </div>
                            <div className="flex justify-between items-center px-4">
                                <span className="text-[10px] font-black text-slate-500 uppercase italic">Net Savings</span>
                                <span className="text-lg font-black text-emerald-500 italic">$240.00 / Unit</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Network Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-slate-900/40 p-10 rounded-[4rem] border border-slate-800/50 flex flex-col">
                    <h3 className="text-2xl font-black italic mb-2">Cost Efficiency</h3>
                    <p className="text-xs text-slate-500 mb-10">Network gas fee comparison per 100k data updates.</p>
                    <div className="flex-1 h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={efficiencyData} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} fontWeight="900" width={100} axisLine={false} tickLine={false} />
                                <Bar dataKey="cost" fill="#3b82f6" radius={[0, 20, 20, 0]} barSize={15} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-slate-900/40 p-10 rounded-[4rem] border border-slate-800/50">
                    <h3 className="text-2xl font-black italic mb-10">Live Freight Updates</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] text-slate-600 font-black uppercase tracking-widest border-b border-slate-800">
                                    <th className="pb-4 pl-4">Manifest ID</th>
                                    <th className="pb-4">Status</th>
                                    <th className="pb-4">Validation</th>
                                    <th className="pb-4 text-right pr-4">Node</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {[
                                    { id: 'BZ-90123', s: 'IN_TRANSIT', v: 'BEZ_ECO', n: 'Port of Shanghai' },
                                    { id: 'BZ-44102', s: 'MANIFESTED', v: 'POL_GAS', n: 'Tanger Med Hub' },
                                    { id: 'BZ-11883', s: 'DELIVERED', v: 'BEZ_ECO', n: 'Rotterdam Terminal' },
                                    { id: 'BZ-29304', s: 'CUSTOMS', v: 'POL_GAS', n: 'Balboa Panama' },
                                    { id: 'BZ-55102', s: 'RAIL_TRANSIT', v: 'BEZ_ECO', n: 'Khorgos Dry Port' },
                                    { id: 'BZ-66201', s: 'REGISTERED', v: 'POL_GAS', n: 'Baku Port' },
                                ].map((tx, i) => (
                                    <tr key={i} className="group hover:bg-slate-800/20 transition-colors">
                                        <td className="py-4 pl-4 font-mono text-[11px] text-blue-400 font-bold">{tx.id}</td>
                                        <td className="py-4 font-black text-[9px] text-slate-300 uppercase italic">{tx.s}</td>
                                        <td className="py-4 font-mono text-[10px] text-yellow-500 font-bold">{tx.v}</td>
                                        <td className="py-4 text-right pr-4 font-black text-[10px] text-slate-500 uppercase">{tx.n}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
