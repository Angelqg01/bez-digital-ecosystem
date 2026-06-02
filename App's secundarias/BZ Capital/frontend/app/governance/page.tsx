'use client';

import { useState } from 'react';
import { Vote, Clock, CheckCircle, XCircle, Plus, Loader2 } from 'lucide-react';
import { useGovernanceProposals, voteOnProposal, type Proposal } from '@/lib/hooks';
import {
    createProposalOnChain,
    executeProposalOnChain,
    queueProposalOnChain,
    voteProposalOnChain,
    type ProposalTxInput,
} from '@/lib/contracts';

function statusBadge(status: string) {
    const map: Record<string, { color: string; icon: typeof Clock; text: string }> = {
        active: { color: 'bg-blue-500/20 text-blue-400', icon: Clock, text: 'Active' },
        passed: { color: 'bg-green-500/20 text-green-400', icon: CheckCircle, text: 'Passed' },
        rejected: { color: 'bg-red-500/20 text-red-400', icon: XCircle, text: 'Rejected' },
        pending: { color: 'bg-yellow-500/20 text-yellow-400', icon: Clock, text: 'Pending' },
    };
    const s = map[status] || map.pending;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>
            <s.icon size={12} /> {s.text}
        </span>
    );
}

function voteBar(votesFor: number, votesAgainst: number) {
    const total = votesFor + votesAgainst;
    const pct = total > 0 ? (votesFor / total) * 100 : 50;
    return (
        <div className="w-full">
            <div className="flex justify-between text-xs mb-1">
                <span className="text-green-400">{(votesFor / 1000).toFixed(0)}K For</span>
                <span className="text-red-400">{(votesAgainst / 1000).toFixed(0)}K Against</span>
            </div>
            <div className="h-2 bg-red-500/30 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

export default function GovernancePage() {
    const [filter, setFilter] = useState<string>('all');
    const [voting, setVoting] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState<'propose' | 'queue' | 'execute' | null>(null);
    const [showProposalForm, setShowProposalForm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [txStatus, setTxStatus] = useState<string | null>(null);
    const [proposalForm, setProposalForm] = useState<ProposalTxInput>({
        target: '',
        value: '0',
        calldata: '0x',
        description: '',
    });

    const { data, isLoading, mutate } = useGovernanceProposals();
    const proposals: Proposal[] = data?.proposals ?? [];
    const filtered = filter === 'all' ? proposals : proposals.filter((p) => p.status === filter);
    const address = typeof window !== 'undefined' ? localStorage.getItem('bez_wallet') : null;

    const handleVote = async (proposalId: string, vote: 'for' | 'against') => {
        if (!address) { setError('Connect wallet first'); return; }
        setVoting(proposalId); setError(null);
        try {
            if (/^\d+$/.test(proposalId)) {
                await voteProposalOnChain(proposalId, vote);
            } else {
                await voteOnProposal(proposalId, address, vote);
            }
            mutate();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Vote failed');
        } finally { setVoting(null); }
    };

    const updateProposalForm = (field: keyof ProposalTxInput, value: string) => {
        setProposalForm((current) => ({ ...current, [field]: value }));
    };

    const submitProposalAction = async (action: 'propose' | 'queue' | 'execute') => {
        if (!proposalForm.target || !proposalForm.description) {
            setError('Target and description are required');
            return;
        }
        setSubmitting(action); setError(null); setTxStatus(null);
        try {
            if (action === 'propose') await createProposalOnChain(proposalForm);
            if (action === 'queue') await queueProposalOnChain(proposalForm);
            if (action === 'execute') await executeProposalOnChain(proposalForm);
            setTxStatus(`${action} transaction confirmed on-chain`);
            mutate();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : `${action} failed`);
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Governance</h1>
                    <p className="text-slate-400 mt-1">Vote on proposals and shape the protocol</p>
                </div>
                <button onClick={() => setShowProposalForm((value) => !value)} className="btn-primary flex items-center gap-2">
                    <Plus size={16} /> New Proposal
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card"><span className="text-sm text-slate-400">Total Proposals</span><p className="text-xl font-bold text-white mt-1">{isLoading ? '—' : proposals.length}</p></div>
                <div className="card"><span className="text-sm text-slate-400">Active Proposals</span><p className="text-xl font-bold text-white mt-1">{isLoading ? '—' : proposals.filter(p => p.status === 'active').length}</p></div>
                <div className="card"><span className="text-sm text-slate-400">Your Voting Power</span><p className="text-xl font-bold text-white mt-1">{address ? '—' : 'Connect wallet'}</p></div>
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>}
            {txStatus && <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm">{txStatus}</div>}

            {showProposalForm && (
                <div className="card space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="space-y-2">
                            <span className="text-sm text-slate-400">Target contract</span>
                            <input
                                value={proposalForm.target}
                                onChange={(e) => updateProposalForm('target', e.target.value)}
                                className="input w-full"
                                placeholder="0x..."
                            />
                        </label>
                        <label className="space-y-2">
                            <span className="text-sm text-slate-400">ETH value</span>
                            <input
                                value={proposalForm.value}
                                onChange={(e) => updateProposalForm('value', e.target.value)}
                                className="input w-full"
                                placeholder="0"
                            />
                        </label>
                    </div>
                    <label className="space-y-2 block">
                        <span className="text-sm text-slate-400">Calldata</span>
                        <input
                            value={proposalForm.calldata}
                            onChange={(e) => updateProposalForm('calldata', e.target.value)}
                            className="input w-full font-mono text-sm"
                            placeholder="0x"
                        />
                    </label>
                    <label className="space-y-2 block">
                        <span className="text-sm text-slate-400">Description</span>
                        <textarea
                            value={proposalForm.description}
                            onChange={(e) => updateProposalForm('description', e.target.value)}
                            className="input w-full min-h-24"
                            placeholder="Proposal description"
                        />
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => submitProposalAction('propose')} disabled={submitting !== null}
                            className="btn-primary disabled:opacity-50">
                            {submitting === 'propose' ? <Loader2 className="animate-spin inline" size={14} /> : 'Submit Proposal'}
                        </button>
                        <button onClick={() => submitProposalAction('queue')} disabled={submitting !== null}
                            className="btn-secondary disabled:opacity-50">
                            {submitting === 'queue' ? <Loader2 className="animate-spin inline" size={14} /> : 'Queue'}
                        </button>
                        <button onClick={() => submitProposalAction('execute')} disabled={submitting !== null}
                            className="btn-secondary disabled:opacity-50">
                            {submitting === 'execute' ? <Loader2 className="animate-spin inline" size={14} /> : 'Execute'}
                        </button>
                    </div>
                </div>
            )}

            {/* Filter */}
            <div className="flex gap-2">
                {['all', 'active', 'passed', 'rejected'].map((f) => (
                    <button key={f} onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${filter === f ? 'bg-bez-primary text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                        {f}
                    </button>
                ))}
            </div>

            {/* Proposals */}
            {isLoading ? (
                <div className="card flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
            ) : (
                <div className="space-y-4">
                    {filtered.length === 0 && <div className="card text-center text-slate-500 py-8">No proposals found</div>}
                    {filtered.map((p) => (
                        <div key={p.id} className="card">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-xs text-slate-500">#{p.id}</span>
                                        {statusBadge(p.status)}
                                    </div>
                                    <h3 className="text-white font-semibold text-lg">{p.title}</h3>
                                    <p className="text-slate-400 text-sm mt-1">{p.description}</p>
                                    <p className="text-xs text-slate-500 mt-2">by {p.proposer} · ends {p.endDate}</p>
                                </div>
                                <div className="w-full md:w-64 space-y-3">
                                    {voteBar(p.votesFor, p.votesAgainst)}
                                    {p.status === 'active' && (
                                        <div className="flex gap-2">
                                            <button onClick={() => handleVote(p.id, 'for')} disabled={voting === p.id}
                                                className="btn-primary flex-1 text-sm disabled:opacity-50">
                                                {voting === p.id ? <Loader2 className="animate-spin inline" size={14} /> : 'Vote For'}
                                            </button>
                                            <button onClick={() => handleVote(p.id, 'against')} disabled={voting === p.id}
                                                className="btn-secondary flex-1 text-sm disabled:opacity-50">Vote Against</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
