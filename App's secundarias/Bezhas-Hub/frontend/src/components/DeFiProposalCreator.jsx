import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp,
    DollarSign,
    Target,
    AlertCircle,
    CheckCircle,
    Clock,
    Zap,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';

const DeFiProposalCreator = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [proposalType, setProposalType] = useState('');
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        parameters: {},
    });
    const [treasuryBalance, setTreasuryBalance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    useEffect(() => {
        fetchTreasuryBalance();
    }, []);

    const fetchTreasuryBalance = async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch('http://localhost:3001/api/defi/treasury-balance', {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('Treasury fetch failed');

            const data = await response.json();
            if (data.success) {
                setTreasuryBalance(data.balance);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('Treasury fetch timeout');
            }
            // Set default values if fetch fails
            setTreasuryBalance({ BEZ: 1000000, USDC: 500000, ETH: 100 });
        }
    };

    const proposalTypes = [
        {
            id: 'ADJUST_STAKING_APY',
            name: 'Adjust Staking APY',
            description: 'Modify APY rates for staking pools',
            icon: TrendingUp,
            color: 'blue',
        },
        {
            id: 'FUND_FARMING_POOL',
            name: 'Fund Farming Pool',
            description: 'Allocate treasury funds to farming rewards',
            icon: DollarSign,
            color: 'green',
        },
        {
            id: 'UPDATE_REWARD_RATE',
            name: 'Update Reward Rate',
            description: 'Change reward distribution rates',
            icon: Target,
            color: 'purple',
        },
        {
            id: 'CREATE_LP_POOL',
            name: 'Create LP Pool',
            description: 'Launch new liquidity pool',
            icon: Zap,
            color: 'orange',
        },
    ];

    const handleTypeSelect = (type) => {
        setProposalType(type);
        setStep(2);
    };

    const handleInputChange = (field, value) => {
        if (field.startsWith('param_')) {
            const paramName = field.replace('param_', '');
            setFormData(prev => ({
                ...prev,
                parameters: {
                    ...prev.parameters,
                    [paramName]: value,
                },
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [field]: value,
            }));
        }
    };

    const validateForm = () => {
        if (!formData.title || !formData.description) {
            toast.error('Title and description are required');
            return false;
        }

        switch (proposalType) {
            case 'ADJUST_STAKING_APY':
                if (!formData.parameters.targetPool || !formData.parameters.proposedAPY) {
                    toast.error('Please fill all required fields');
                    return false;
                }
                break;
            case 'FUND_FARMING_POOL':
                if (!formData.parameters.poolAddress || !formData.parameters.fundingAmount) {
                    toast.error('Please fill all required fields');
                    return false;
                }
                if (formData.parameters.fundingAmount > treasuryBalance?.BEZ) {
                    toast.error('Insufficient treasury balance');
                    return false;
                }
                break;
        }

        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            const response = await fetch('http://localhost:3001/api/defi/proposals/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: formData.title,
                    description: formData.description,
                    proposalType,
                    parameters: formData.parameters,
                    creator: '0x1234567890123456789012345678901234567890', // Mock address
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success('DeFi Proposal created successfully!');
                onSuccess?.(data.proposal);
                onClose();
            } else {
                toast.error(data.error || 'Failed to create proposal');
            }
        } catch (error) {
            console.error('Error creating proposal:', error);
            toast.error('Failed to create proposal');
        } finally {
            setLoading(false);
        }
    };

    const renderStepOne = () => (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-6">Select Proposal Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {proposalTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                        <motion.button
                            key={type.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleTypeSelect(type.id)}
                            className={`p-6 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-${type.color}-500/20 hover:border-${type.color}-500/50 transition-all text-left`}
                        >
                            <div className={`w-12 h-12 rounded-lg bg-${type.color}-500/10 flex items-center justify-center mb-4`}>
                                <Icon className={`w-6 h-6 text-${type.color}-400`} />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">{type.name}</h3>
                            <p className="text-sm text-gray-400">{type.description}</p>
                        </motion.button>
                    );
                })}
            </div>

            {/* Treasury Balance Preview */}
            {treasuryBalance && (
                <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">Available Treasury Funds</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <div className="text-2xl font-bold text-green-400">{treasuryBalance.BEZ.toLocaleString()}</div>
                            <div className="text-xs text-gray-400">BEZ</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-blue-400">{treasuryBalance.USDC.toLocaleString()}</div>
                            <div className="text-xs text-gray-400">USDC</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-purple-400">{treasuryBalance.ETH}</div>
                            <div className="text-xs text-gray-400">ETH</div>
                        </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-400">
                        Total Value: ${treasuryBalance.totalValueUSD.toLocaleString()}
                    </div>
                </div>
            )}
        </div>
    );

    const renderStepTwo = () => {
        const selectedType = proposalTypes.find(t => t.id === proposalType);

        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                    <button
                        onClick={() => setStep(1)}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <ChevronDown className="w-5 h-5 text-gray-400 rotate-90" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-white">{selectedType?.name}</h2>
                        <p className="text-sm text-gray-400">{selectedType?.description}</p>
                    </div>
                </div>

                {/* Basic Information */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Proposal Title *
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => handleInputChange('title', e.target.value)}
                            placeholder="e.g., Increase BEZ Staking APY to 25%"
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Description *
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            placeholder="Explain the rationale behind this proposal..."
                            rows={4}
                            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors resize-none"
                        />
                    </div>
                </div>

                {/* Type-specific Parameters */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Parameters</h3>
                    {renderParameterInputs()}
                </div>

                {/* Advanced Options */}
                <div className="border-t border-gray-700 pt-4">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        Advanced Options
                    </button>
                    {showAdvanced && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-4 space-y-4"
                        >
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Expected ROI (%)
                                </label>
                                <input
                                    type="number"
                                    value={formData.parameters.expectedROI || ''}
                                    onChange={(e) => handleInputChange('param_expectedROI', parseFloat(e.target.value))}
                                    placeholder="18"
                                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Risk Assessment
                                </label>
                                <select
                                    value={formData.parameters.riskAssessment || ''}
                                    onChange={(e) => handleInputChange('param_riskAssessment', e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                >
                                    <option value="">Select risk level</option>
                                    <option value="low">Low Risk</option>
                                    <option value="medium">Medium Risk</option>
                                    <option value="high">High Risk</option>
                                </select>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                    >
                        {loading ? 'Creating...' : 'Create Proposal'}
                    </button>
                </div>
            </div>
        );
    };

    const renderParameterInputs = () => {
        switch (proposalType) {
            case 'ADJUST_STAKING_APY':
                return (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Target Pool *
                            </label>
                            <select
                                value={formData.parameters.targetPool || ''}
                                onChange={(e) => handleInputChange('param_targetPool', e.target.value)}
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                            >
                                <option value="">Select pool</option>
                                <option value="BEZ-MAIN">BEZ Main Pool</option>
                                <option value="BEZ-USDC">BEZ-USDC LP Pool</option>
                                <option value="BEZ-ETH">BEZ-ETH LP Pool</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Current APY (%)
                                </label>
                                <input
                                    type="number"
                                    value={formData.parameters.currentAPY || ''}
                                    onChange={(e) => handleInputChange('param_currentAPY', parseFloat(e.target.value))}
                                    placeholder="15"
                                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Proposed APY (%) *
                                </label>
                                <input
                                    type="number"
                                    value={formData.parameters.proposedAPY || ''}
                                    onChange={(e) => handleInputChange('param_proposedAPY', parseFloat(e.target.value))}
                                    placeholder="25"
                                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                />
                            </div>
                        </div>
                    </>
                );

            case 'FUND_FARMING_POOL':
                return (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Pool Address *
                            </label>
                            <input
                                type="text"
                                value={formData.parameters.poolAddress || ''}
                                onChange={(e) => handleInputChange('param_poolAddress', e.target.value)}
                                placeholder="0x..."
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Funding Amount *
                                </label>
                                <input
                                    type="number"
                                    value={formData.parameters.fundingAmount || ''}
                                    onChange={(e) => handleInputChange('param_fundingAmount', parseFloat(e.target.value))}
                                    placeholder="100000"
                                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                />
                                {treasuryBalance && (
                                    <div className="mt-1 text-xs text-gray-400">
                                        Available: {treasuryBalance.BEZ.toLocaleString()} BEZ
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Duration (days) *
                                </label>
                                <input
                                    type="number"
                                    value={formData.parameters.duration || ''}
                                    onChange={(e) => handleInputChange('param_duration', parseInt(e.target.value))}
                                    placeholder="90"
                                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Funding Token
                            </label>
                            <select
                                value={formData.parameters.fundingToken || 'BEZ'}
                                onChange={(e) => handleInputChange('param_fundingToken', e.target.value)}
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                            >
                                <option value="BEZ">BEZ</option>
                                <option value="USDC">USDC</option>
                                <option value="ETH">ETH</option>
                            </select>
                        </div>
                    </>
                );

            case 'UPDATE_REWARD_RATE':
                return (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Reward Token *
                            </label>
                            <select
                                value={formData.parameters.rewardToken || ''}
                                onChange={(e) => handleInputChange('param_rewardToken', e.target.value)}
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                            >
                                <option value="">Select token</option>
                                <option value="BEZ">BEZ</option>
                                <option value="USDC">USDC</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Current Rate
                                </label>
                                <input
                                    type="number"
                                    value={formData.parameters.currentRate || ''}
                                    onChange={(e) => handleInputChange('param_currentRate', parseFloat(e.target.value))}
                                    placeholder="1.0"
                                    step="0.1"
                                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Proposed Rate *
                                </label>
                                <input
                                    type="number"
                                    value={formData.parameters.proposedRate || ''}
                                    onChange={(e) => handleInputChange('param_proposedRate', parseFloat(e.target.value))}
                                    placeholder="1.5"
                                    step="0.1"
                                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                />
                            </div>
                        </div>
                    </>
                );

            case 'CREATE_LP_POOL':
                return (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Token 0 *
                                </label>
                                <input
                                    type="text"
                                    value={formData.parameters.token0 || ''}
                                    onChange={(e) => handleInputChange('param_token0', e.target.value)}
                                    placeholder="BEZ"
                                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Token 1 *
                                </label>
                                <input
                                    type="text"
                                    value={formData.parameters.token1 || ''}
                                    onChange={(e) => handleInputChange('param_token1', e.target.value)}
                                    placeholder="ETH"
                                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Initial Liquidity Token 0 *
                                </label>
                                <input
                                    type="number"
                                    value={formData.parameters.initialLiquidity0 || ''}
                                    onChange={(e) => handleInputChange('param_initialLiquidity0', parseFloat(e.target.value))}
                                    placeholder="500000"
                                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Initial Liquidity Token 1 *
                                </label>
                                <input
                                    type="number"
                                    value={formData.parameters.initialLiquidity1 || ''}
                                    onChange={(e) => handleInputChange('param_initialLiquidity1', parseFloat(e.target.value))}
                                    placeholder="25"
                                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                />
                            </div>
                        </div>
                    </>
                );

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl shadow-2xl"
            >
                <div className="p-8">
                    {step === 1 ? renderStepOne() : renderStepTwo()}
                </div>
            </motion.div>
        </div>
    );
};

export default DeFiProposalCreator;
