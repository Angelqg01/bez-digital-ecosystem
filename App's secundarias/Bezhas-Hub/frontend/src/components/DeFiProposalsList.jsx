import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp,
    DollarSign,
    Target,
    Zap,
    CheckCircle,
    Clock,
    XCircle,
    ArrowRight,
    ThumbsUp,
    ThumbsDown,
    Eye
} from 'lucide-react';
import toast from 'react-hot-toast';

const DeFiProposalsList = ({ onViewDetails }) => {
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');

    useEffect(() => {
        fetchProposals();
    }, [filter, typeFilter]);

    const fetchProposals = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter !== 'all') params.append('status', filter);
            if (typeFilter !== 'all') params.append('proposalType', typeFilter);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(
                `http://localhost:3001/api/defi/proposals?${params}`,
                { signal: controller.signal }
            );

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('Proposals fetch failed');

            const data = await response.json();
            if (data.success) {
                setProposals(data.proposals);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                toast.error('Error cargando propuestas DeFi', { duration: 2000 });
            }
            // Set empty array on error
            setProposals([]);
        } finally {
            setLoading(false);
        }
    };

    const getProposalIcon = (type) => {
        switch (type) {
            case 'ADJUST_STAKING_APY': return TrendingUp;
            case 'FUND_FARMING_POOL': return DollarSign;
            case 'UPDATE_REWARD_RATE': return Target;
            case 'CREATE_LP_POOL': return Zap;
            default: return Target;
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            active: { color: 'blue', icon: Clock, text: 'Active' },
            approved: { color: 'green', icon: CheckCircle, text: 'Approved' },
            rejected: { color: 'red', icon: XCircle, text: 'Rejected' },
            executed: { color: 'purple', icon: CheckCircle, text: 'Executed' },
            pending: { color: 'yellow', icon: Clock, text: 'Pending' },
        };

        const badge = badges[status] || badges.pending;
        const Icon = badge.icon;

        return (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-${badge.color}-500/10 text-${badge.color}-400 border border-${badge.color}-500/20`}>
                <Icon className="w-3 h-3" />
                {badge.text}
            </span>
        );
    };

    const formatProposalType = (type) => {
        return type.split('_').map(word =>
            word.charAt(0) + word.slice(1).toLowerCase()
        ).join(' ');
    };

    const calculateTimeRemaining = (endDate) => {
        const now = new Date();
        const end = new Date(endDate);
        const diff = end - now;

        if (diff <= 0) return 'Ended';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) return `${days}d ${hours}h left`;
        return `${hours}h left`;
    };

    const calculateVotePercentage = (votesFor, votesAgainst) => {
        const total = votesFor + votesAgainst;
        if (total === 0) return 0;
        return Math.round((votesFor / total) * 100);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('active')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'active'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                    >
                        Active
                    </button>
                    <button
                        onClick={() => setFilter('approved')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'approved'
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                    >
                        Approved
                    </button>
                </div>

                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                >
                    <option value="all">All Types</option>
                    <option value="ADJUST_STAKING_APY">Staking APY</option>
                    <option value="FUND_FARMING_POOL">Farming Pool</option>
                    <option value="UPDATE_REWARD_RATE">Reward Rate</option>
                    <option value="CREATE_LP_POOL">LP Pool</option>
                </select>
            </div>

            {/* Proposals Grid */}
            <div className="grid gap-4">
                {proposals.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        No proposals found
                    </div>
                ) : (
                    proposals.map((proposal) => {
                        const Icon = getProposalIcon(proposal.proposalType);
                        const votePercentage = calculateVotePercentage(
                            proposal.votesFor || 0,
                            proposal.votesAgainst || 0
                        );

                        return (
                            <motion.div
                                key={proposal._id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6 hover:border-blue-500/50 transition-all cursor-pointer"
                                onClick={() => onViewDetails?.(proposal)}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                            <Icon className="w-6 h-6 text-blue-400" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-semibold text-white truncate">
                                                    {proposal.title}
                                                </h3>
                                                {getStatusBadge(proposal.status)}
                                            </div>

                                            <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                                                {proposal.description}
                                            </p>

                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                <span className="px-2 py-1 bg-gray-800 rounded">
                                                    {formatProposalType(proposal.proposalType)}
                                                </span>
                                                {proposal.votingEndsAt && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {calculateTimeRemaining(proposal.votingEndsAt)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onViewDetails?.(proposal);
                                        }}
                                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                                    >
                                        <Eye className="w-5 h-5 text-gray-400" />
                                    </button>
                                </div>

                                {/* Voting Stats */}
                                {(proposal.votesFor > 0 || proposal.votesAgainst > 0) && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2 text-green-400">
                                                <ThumbsUp className="w-4 h-4" />
                                                <span className="font-semibold">
                                                    {proposal.votesFor?.toLocaleString() || 0}
                                                </span>
                                            </div>
                                            <div className="text-gray-400 font-medium">
                                                {votePercentage}% For
                                            </div>
                                            <div className="flex items-center gap-2 text-red-400">
                                                <ThumbsDown className="w-4 h-4" />
                                                <span className="font-semibold">
                                                    {proposal.votesAgainst?.toLocaleString() || 0}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${votePercentage}%` }}
                                                className="h-full bg-gradient-to-r from-green-500 to-blue-500"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Parameters Preview */}
                                {proposal.parameters && (
                                    <div className="mt-4 pt-4 border-t border-gray-700">
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {proposal.proposalType === 'ADJUST_STAKING_APY' && (
                                                <>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Pool</div>
                                                        <div className="text-sm font-medium text-white">
                                                            {proposal.parameters.targetPool}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Current APY</div>
                                                        <div className="text-sm font-medium text-white">
                                                            {proposal.parameters.currentAPY}%
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Proposed APY</div>
                                                        <div className="text-sm font-medium text-green-400">
                                                            {proposal.parameters.proposedAPY}%
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {proposal.proposalType === 'FUND_FARMING_POOL' && (
                                                <>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Amount</div>
                                                        <div className="text-sm font-medium text-white">
                                                            {proposal.parameters.fundingAmount?.toLocaleString()} {proposal.parameters.fundingToken}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Duration</div>
                                                        <div className="text-sm font-medium text-white">
                                                            {proposal.parameters.duration} days
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {proposal.proposalType === 'CREATE_LP_POOL' && (
                                                <>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Pair</div>
                                                        <div className="text-sm font-medium text-white">
                                                            {proposal.parameters.token0}/{proposal.parameters.token1}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-gray-500">Initial TVL</div>
                                                        <div className="text-sm font-medium text-white">
                                                            ${((proposal.parameters.initialLiquidity0 || 0) +
                                                                (proposal.parameters.initialLiquidity1 || 0)).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default DeFiProposalsList;
