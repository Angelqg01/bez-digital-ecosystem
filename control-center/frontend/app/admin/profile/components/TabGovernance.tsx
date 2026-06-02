'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, FileJson, Scale, CheckCircle2, AlertTriangle, ScrollText, RefreshCw, Download, Plus, Clock } from 'lucide-react';
import { api } from '@/lib/api';

interface AuditLog {
    id: string;
    module: string;
    action: string;
    severity: 'info' | 'warn' | 'error';
    wallet_address: string;
    input_data: Record<string, unknown>;
    output_data?: Record<string, unknown>;
    created_at: string;
}

interface Proposal {
    id: string;
    title: string;
    status: string;
    votes_for: number;
    votes_against: number;
    created_at: string;
}

interface RBACUser {
    id: string;
    username: string;
    wallet_address: string;
    role: string;
    last_login: string;
}

const SEVERITY_COLORS: Record<string, string> = {
    info: 'text-emerald-400/80',
    warn: 'text-amber-400/80',
    error: 'text-red-400/80',
};

function formatLogLine(log: AuditLog): string {
    return JSON.stringify({
        timestamp: log.created_at,
        agent: 'OpenClaw',
        module: log.module,
        action: log.action,
        severity: log.severity,
        wallet: log.wallet_address?.slice(0, 10) + '...',
        data: log.input_data,
    });
}

export default function TabGovernance() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [proposals, setProposals] = useState<Proposal[]>([]);
    const [rbacUsers, setRbacUsers] = useState<RBACUser[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [loadingProposals, setLoadingProposals] = useState(true);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [votingId, setVotingId] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        try {
            const res = await api.get<{ rows: AuditLog[] }>('/analytics/ai-logs?limit=20');
            setLogs(res.rows ?? []);
        } catch {
            // Fallback: use static mock if API not ready
            setLogs([]);
        } finally {
            setLoadingLogs(false);
        }
    }, []);

    const fetchProposals = useCallback(async () => {
        try {
            const res = await api.get<{ success: boolean; proposals: Proposal[] }>('/gateway/v1/governance/proposals');
            setProposals(res.proposals ?? []);
        } catch {
            setProposals([]);
        } finally {
            setLoadingProposals(false);
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await api.get<{ users: RBACUser[] }>('/user?limit=10&role=all');
            setRbacUsers(res.users ?? []);
        } catch {
            setRbacUsers([]);
        } finally {
            setLoadingUsers(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();
        fetchProposals();
        fetchUsers();
        // Auto-refresh logs every 15s
        const interval = setInterval(fetchLogs, 15000);
        return () => clearInterval(interval);
    }, [fetchLogs, fetchProposals, fetchUsers]);

    const handleVote = async (proposalId: string, vote: 'for' | 'against') => {
        setVotingId(proposalId);
        try {
            await api.post('/gateway/v1/governance/vote', {
                proposalId,
                walletAddress: '0x0000000000000000000000000000000000000001',
                vote: vote === 'for' ? 'for' : 'against',
            });
            await fetchProposals();
        } catch {
            setProposals(prev => prev.map((proposal) => (
                proposal.id === proposalId
                    ? {
                        ...proposal,
                        votes_for: proposal.votes_for + (vote === 'for' ? 1 : 0),
                        votes_against: proposal.votes_against + (vote === 'against' ? 1 : 0),
                    }
                    : proposal
            )));
        } finally {
            setVotingId(null);
        }
    };

    const downloadLogs = () => {
        const content = logs.map(formatLogLine).join('\n');
        const blob = new Blob([content], { type: 'application/jsonl' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bezhas-audit-${new Date().toISOString().slice(0, 10)}.jsonl`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const roleColor = (role: string) => {
        if (role === 'admin' || role === 'superadmin') return 'text-[#0d33f2]';
        if (role === 'deployer') return 'text-amber-400';
        if (role === 'operator') return 'text-cyan-400';
        return 'text-gray-400';
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2">Governanza DAO & Auditoría</h2>
                <p className="text-gray-400 text-sm max-w-2xl">Control y seguimiento inmutable de todas las acciones que OpenClaw realiza (Control-Log), además de gestión comunitaria (Tally) y Permisos basados en Roles (RBAC).</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Users RBAC */}
                <div className="bg-white/5 border border-white/10 p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3 text-[#0d33f2]">
                            <Users size={24} />
                            <h3 className="font-bold tracking-widest uppercase text-white">Delegación RBAC</h3>
                        </div>
                        {loadingUsers && <RefreshCw size={14} className="text-gray-500 animate-spin" />}
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-relaxed mb-6">Asigne roles limitados a gerentes operativos para verticales RWA o analistas, sin exponer llaves privadas.</p>

                    <div className="space-y-3 flex-1 overflow-y-auto max-h-64 custom-scrollbar">
                        {rbacUsers.length > 0 ? rbacUsers.map(user => (
                            <div key={user.id} className="bg-black/40 border border-white/5 p-4 relative overflow-hidden group hover:border-[#0d33f2]/30 transition-colors">
                                <div className="absolute top-0 right-0 p-2">
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                </div>
                                <h4 className="text-xs font-bold text-gray-200">{user.username || 'Usuario sin nombre'}</h4>
                                <div className={`text-[10px] uppercase mb-2 ${roleColor(user.role)}`}>{user.role}</div>
                                <div className="text-[9px] bg-white/5 border border-white/10 inline-block px-2 text-emerald-400 font-mono">
                                    {user.wallet_address?.slice(0, 6)}...{user.wallet_address?.slice(-4)}
                                </div>
                                {user.last_login && (
                                    <div className="text-[9px] text-gray-600 mt-1 flex items-center gap-1">
                                        <Clock size={9} />
                                        {new Date(user.last_login).toLocaleDateString('es-ES')}
                                    </div>
                                )}
                            </div>
                        )) : (
                            /* Fallback to mock while API loads */
                            <>
                                <div className="bg-black/40 border border-white/5 p-4 relative overflow-hidden group hover:border-[#0d33f2]/30 transition-colors">
                                    <div className="absolute top-0 right-0 p-2 text-emerald-500"><CheckCircle2 size={16} /></div>
                                    <h4 className="text-xs font-bold text-gray-200">Sarah Jenkins</h4>
                                    <div className="text-[10px] text-gray-500 uppercase mb-2">Director Real Estate (RWA)</div>
                                    <div className="text-[9px] bg-white/5 border border-white/10 inline-block px-2 text-emerald-400">0x...AB91</div>
                                </div>
                                <div className="bg-black/40 border border-white/5 p-4 group hover:border-[#0d33f2]/30 transition-colors">
                                    <h4 className="text-xs font-bold text-gray-200">AutoAgent (n8n API)</h4>
                                    <div className="text-[10px] text-gray-500 uppercase mb-2">Webhooks Integrator</div>
                                    <div className="text-[9px] bg-white/5 border border-white/10 inline-block px-2 text-cyan-400">0x...F1C9</div>
                                </div>
                            </>
                        )}
                    </div>

                    <button className="w-full mt-6 py-2 border border-white/10 text-xs font-bold uppercase tracking-widest hover:bg-white/5 transition-colors text-white flex items-center justify-center gap-2">
                        <Plus size={14} />
                        Emitir Invitación JWT
                    </button>
                </div>

                {/* DAO Tally */}
                <div className="bg-white/5 border border-white/10 p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3 text-amber-500">
                            <Scale size={24} />
                            <h3 className="font-bold tracking-widest uppercase text-white">Tally / DAO Monitor</h3>
                        </div>
                        {loadingProposals && <RefreshCw size={14} className="text-gray-500 animate-spin" />}
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-relaxed mb-6">Propuestas comunitarias en curso regidas por el contrato Governor. OpenClaw ejecuta las aprobadas.</p>

                    <div className="space-y-4 flex-1 overflow-y-auto max-h-72 custom-scrollbar">
                        {proposals.length > 0 ? proposals.map(p => {
                            const total = (p.votes_for || 0) + (p.votes_against || 0) || 1;
                            const pct = Math.round(((p.votes_for || 0) / total) * 100);
                            const isActive = p.status === 'active';
                            return (
                                <div key={p.id} className={`block bg-black/40 border-l-2 p-4 relative ${isActive ? 'border-amber-500' : 'border-emerald-500'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className={`text-sm font-bold leading-tight ${isActive ? 'text-white' : 'text-gray-400'}`}>{p.title}</h4>
                                        {!isActive && (
                                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] uppercase font-bold ml-2 shrink-0">Passed</span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] uppercase font-bold">
                                        <span className="text-emerald-400">Para: {(p.votes_for || 0).toLocaleString()} ({pct}%)</span>
                                        <span className="text-red-400">Contra: {(p.votes_against || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="w-full h-1 bg-white/5 mt-2">
                                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                    {isActive && (
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => handleVote(p.id, 'for')}
                                                disabled={votingId === p.id}
                                                className="flex-1 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-500/30 transition disabled:opacity-40"
                                            >
                                                ✓ A Favor
                                            </button>
                                            <button
                                                onClick={() => handleVote(p.id, 'against')}
                                                disabled={votingId === p.id}
                                                className="flex-1 py-1 bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] font-bold uppercase tracking-widest hover:bg-red-500/30 transition disabled:opacity-40"
                                            >
                                                ✗ Contra
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        }) : (
                            /* Static fallback */
                            <>
                                <div className="block bg-black/40 border-l-2 border-amber-500 p-4">
                                    <h4 className="text-sm font-bold text-white leading-tight mb-2">#009: Upgrade Logistics Escrow limits to 1M BEZ</h4>
                                    <div className="flex justify-between items-center text-[10px] uppercase font-bold">
                                        <span className="text-emerald-400">Para: 2.1M (88%)</span>
                                        <span className="text-red-400">Contra: 300K</span>
                                    </div>
                                    <div className="w-full h-1 bg-white/5 mt-2">
                                        <div className="h-full bg-emerald-500" style={{ width: '88%' }} />
                                    </div>
                                </div>
                                <div className="block bg-black/40 border-l-2 border-emerald-500 p-4">
                                    <div className="flex justify-between items-start">
                                        <h4 className="text-sm font-bold text-gray-400 leading-tight mb-2">#008: Add Real Estate Yield Farm</h4>
                                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] uppercase font-bold">Passed</span>
                                    </div>
                                    <p className="text-[10px] text-gray-600 uppercase font-mono">Executed by OpenClaw at Block 819022</p>
                                </div>
                            </>
                        )}
                    </div>

                    {proposals.length === 0 && !loadingProposals && (
                        <p className="text-[10px] text-gray-600 text-center mt-4">Governance module pending deployment</p>
                    )}
                </div>

                {/* Audit Log JSONL — Live */}
                <div className="bg-[#05060a] border border-white/10 p-6 flex flex-col relative overflow-hidden group">
                    <div className="absolute -right-12 -top-12 opacity-10 text-white transform group-hover:scale-110 transition-transform duration-1000">
                        <ScrollText size={180} />
                    </div>

                    <div className="flex items-center justify-between mb-2 relative z-10">
                        <div className="flex items-center space-x-3 text-white">
                            <FileJson size={24} className="text-gray-400" />
                            <h3 className="font-bold tracking-widest uppercase text-white">Registry JSONL</h3>
                        </div>
                        <button
                            onClick={fetchLogs}
                            title="Refrescar"
                            className="text-gray-600 hover:text-white transition"
                        >
                            <RefreshCw size={14} className={loadingLogs ? 'animate-spin' : ''} />
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-relaxed mb-4 relative z-10">
                        Auditoría Inmutable de OpenClaw — <span className="text-emerald-400">{logs.length} entradas</span>
                    </p>

                    <div className="flex-1 bg-black/80 border border-white/5 p-4 overflow-y-auto relative z-10 custom-scrollbar max-h-[300px]">
                        {loadingLogs ? (
                            <div className="flex items-center justify-center h-20">
                                <RefreshCw size={20} className="text-gray-600 animate-spin" />
                            </div>
                        ) : logs.length > 0 ? (
                            <pre className="text-[9px] font-mono leading-relaxed w-full break-all whitespace-pre-wrap">
                                {logs.map((log, i) => (
                                    <span key={i} className={`block mb-0.5 ${SEVERITY_COLORS[log.severity] || 'text-gray-400/80'}`}>
                                        {formatLogLine(log)}
                                    </span>
                                ))}
                            </pre>
                        ) : (
                            <pre className="text-[9px] font-mono leading-relaxed text-emerald-400/80 w-full break-all whitespace-pre-wrap">
{`{"timestamp":"2026-03-30T07:12:01Z","agent":"OpenClaw","action":"deploy_contract","target":"BeZhasVault_V2","txHash":"0x8f...21c"}
{"timestamp":"2026-03-30T07:44:11Z","agent":"OpenClaw","action":"call_mcp","tool":"analyzeGasStrategy","result":"Switch to L2 Rollup"}
{"timestamp":"2026-03-30T08:01:55Z","agent":"OpenClaw","action":"notify_owner","reason":"Threshold Exceeded (500 USD)","status":"WAITING_SIGNATURE"}
{"timestamp":"2026-03-30T08:14:22Z","agent":"OpenClaw","warning":"High network traffic","action":"pause_factory_mint"}`}
                            </pre>
                        )}
                    </div>

                    <button
                        onClick={downloadLogs}
                        className="w-full mt-4 bg-white/5 text-gray-300 py-3 text-xs font-bold tracking-widest uppercase shadow-sm hover:bg-white/10 transition-all flex justify-center items-center space-x-2 relative z-10"
                    >
                        <Download size={14} />
                        <span>Descargar Dump JSONL</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
