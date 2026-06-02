import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
    Settings, DollarSign, Users, Vote, CheckCircle, XCircle,
    Play, Trash2, Edit, Plus, Save, Clock, TrendingUp, Activity
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DAOAdminPanel = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(false);

    // Estado
    const [daoState, setDaoState] = useState(null);
    const [proposals, setProposals] = useState([]);
    const [settings, setSettings] = useState({
        quorumPercentage: 10,
        votingPeriodDays: 7,
        proposalThreshold: 100000,
        allowDelegation: true,
    });

    // Cargar datos
    useEffect(() => {
        fetchDAOState();
        fetchProposals();
    }, []);

    const fetchDAOState = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/dao/state`);
            setDaoState(response.data);
            setSettings(response.data.settings);
        } catch (error) {
            console.error('Error fetching DAO state:', error);
        }
    };

    const fetchProposals = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/dao/proposals?limit=100`);
            setProposals(response.data);
        } catch (error) {
            console.error('Error fetching proposals:', error);
        }
    };

    // Ejecutar propuesta aprobada
    const executeProposal = async (proposalId) => {
        if (!confirm('¿Seguro que deseas ejecutar esta propuesta?')) return;

        try {
            setLoading(true);
            await axios.post(`${API_URL}/api/dao/proposals/${proposalId}/execute`);
            toast.success('Propuesta ejecutada exitosamente');
            fetchProposals();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Error al ejecutar propuesta');
        } finally {
            setLoading(false);
        }
    };

    // Actualizar configuración
    const updateSettings = async () => {
        try {
            setLoading(true);
            await axios.put(`${API_URL}/api/dao/settings`, settings);
            toast.success('Configuración actualizada');
            fetchDAOState();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Error al actualizar configuración');
        } finally {
            setLoading(false);
        }
    };

    // Añadir fondos a tesorería (simulado)
    const addTreasuryFunds = async (token, amount) => {
        try {
            setLoading(true);
            await axios.post(`${API_URL}/api/dao/treasury/deposit`, {
                token,
                amount: parseFloat(amount),
                description: 'Depósito manual desde panel admin',
            });
            toast.success(`${amount} ${token} añadidos a la tesorería`);
            fetchDAOState();
        } catch (error) {
            toast.error('Error al añadir fondos');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Panel de Administración DAO</h1>
                    <p className="text-gray-400">Gestiona la gobernanza, propuestas y tesorería</p>
                </div>
                <button
                    onClick={() => {
                        fetchDAOState();
                        fetchProposals();
                    }}
                    className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                    🔄 Actualizar
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-700">
                {[
                    { id: 'overview', label: 'Resumen', icon: Activity },
                    { id: 'proposals', label: 'Propuestas', icon: Vote },
                    { id: 'treasury', label: 'Tesorería', icon: DollarSign },
                    { id: 'settings', label: 'Configuración', icon: Settings },
                ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all ${activeTab === tab.id
                                    ? 'text-purple-400 border-b-2 border-purple-400'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <Icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content */}
            {activeTab === 'overview' && daoState && (
                <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <div className="flex items-center gap-3 mb-2">
                                <DollarSign className="w-8 h-8 text-green-400" />
                                <div>
                                    <p className="text-xs text-gray-400">Tesorería</p>
                                    <p className="text-2xl font-bold text-white">
                                        ${((daoState.treasury?.totalUSD || 0) / 1000000).toFixed(2)}M
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <div className="flex items-center gap-3 mb-2">
                                <Users className="w-8 h-8 text-blue-400" />
                                <div>
                                    <p className="text-xs text-gray-400">Miembros</p>
                                    <p className="text-2xl font-bold text-white">
                                        {daoState.members?.total.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <div className="flex items-center gap-3 mb-2">
                                <Vote className="w-8 h-8 text-purple-400" />
                                <div>
                                    <p className="text-xs text-gray-400">Propuestas Activas</p>
                                    <p className="text-2xl font-bold text-white">
                                        {daoState.proposals?.active}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <div className="flex items-center gap-3 mb-2">
                                <TrendingUp className="w-8 h-8 text-cyan-400" />
                                <div>
                                    <p className="text-xs text-gray-400">Aprobadas</p>
                                    <p className="text-2xl font-bold text-white">
                                        {daoState.proposals?.approved}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h3 className="text-xl font-bold text-white mb-4">Actividad Reciente</h3>
                        <div className="space-y-3">
                            {proposals.slice(0, 5).map((proposal) => (
                                <div key={proposal._id} className="flex justify-between items-center p-3 bg-gray-700/50 rounded">
                                    <div>
                                        <p className="text-white font-medium">{proposal.title}</p>
                                        <p className="text-xs text-gray-400">{new Date(proposal.createdAt).toLocaleString()}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${proposal.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                                            proposal.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                                proposal.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-gray-500/20 text-gray-400'
                                        }`}>
                                        {proposal.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'proposals' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">Gestión de Propuestas</h2>
                    </div>

                    {proposals.map((proposal) => (
                        <div key={proposal._id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-white mb-2">{proposal.title}</h3>
                                    <p className="text-sm text-gray-400 mb-3">{proposal.description}</p>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span>Creada: {new Date(proposal.createdAt).toLocaleDateString()}</span>
                                        <span>Finaliza: {new Date(proposal.endDate).toLocaleDateString()}</span>
                                        <span className={`px-2 py-1 rounded ${proposal.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                                                proposal.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                                    proposal.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                                        proposal.status === 'executed' ? 'bg-purple-500/20 text-purple-400' :
                                                            'bg-gray-500/20 text-gray-400'
                                            }`}>
                                            {proposal.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Voting Stats */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-gray-700/50 rounded p-3">
                                    <p className="text-xs text-gray-400 mb-1">Votos a Favor</p>
                                    <p className="text-xl font-bold text-green-400">
                                        {(proposal.votesFor || 0).toLocaleString()}
                                    </p>
                                </div>
                                <div className="bg-gray-700/50 rounded p-3">
                                    <p className="text-xs text-gray-400 mb-1">Votos en Contra</p>
                                    <p className="text-xl font-bold text-red-400">
                                        {(proposal.votesAgainst || 0).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            {proposal.status === 'approved' && (
                                <button
                                    onClick={() => executeProposal(proposal._id)}
                                    disabled={loading}
                                    className="w-full bg-purple-500 hover:bg-purple-600 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <Play className="w-4 h-4" />
                                    Ejecutar Propuesta
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'treasury' && daoState && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 rounded-lg p-6 border border-green-500/30">
                            <p className="text-sm text-gray-300 mb-2">USDC Balance</p>
                            <p className="text-3xl font-bold text-white">
                                ${(daoState.treasury?.usdcBalance || 0).toLocaleString()}
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-lg p-6 border border-purple-500/30">
                            <p className="text-sm text-gray-300 mb-2">BEZ Balance</p>
                            <p className="text-3xl font-bold text-white">
                                {(daoState.treasury?.totalBEZ || 0).toLocaleString()}
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 rounded-lg p-6 border border-blue-500/30">
                            <p className="text-sm text-gray-300 mb-2">ETH Balance</p>
                            <p className="text-3xl font-bold text-white">
                                {(daoState.treasury?.ethBalance || 0).toFixed(4)}
                            </p>
                        </div>
                    </div>

                    {/* Add Funds Form (for testing) */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h3 className="text-xl font-bold text-white mb-4">Añadir Fondos (Testing)</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <button
                                onClick={() => addTreasuryFunds('USDC', 10000)}
                                className="bg-green-500/20 hover:bg-green-500/30 text-green-400 font-medium py-3 rounded-lg transition-colors border border-green-500/30"
                            >
                                +10,000 USDC
                            </button>
                            <button
                                onClick={() => addTreasuryFunds('BEZ', 100000)}
                                className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-medium py-3 rounded-lg transition-colors border border-purple-500/30"
                            >
                                +100,000 BEZ
                            </button>
                            <button
                                onClick={() => addTreasuryFunds('ETH', 5)}
                                className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-medium py-3 rounded-lg transition-colors border border-blue-500/30"
                            >
                                +5 ETH
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="space-y-6">
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h3 className="text-xl font-bold text-white mb-6">Configuración de la DAO</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Quorum Requerido (%)
                                </label>
                                <input
                                    type="number"
                                    value={settings.quorumPercentage}
                                    onChange={(e) => setSettings({ ...settings, quorumPercentage: parseInt(e.target.value) })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
                                    min="1"
                                    max="100"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Porcentaje de tokens que deben votar para que una propuesta sea válida
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Período de Votación (días)
                                </label>
                                <input
                                    type="number"
                                    value={settings.votingPeriodDays}
                                    onChange={(e) => setSettings({ ...settings, votingPeriodDays: parseInt(e.target.value) })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
                                    min="1"
                                    max="30"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Duración del período de votación para nuevas propuestas
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Umbral para Crear Propuestas (BEZ)
                                </label>
                                <input
                                    type="number"
                                    value={settings.proposalThreshold}
                                    onChange={(e) => setSettings({ ...settings, proposalThreshold: parseInt(e.target.value) })}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white"
                                    min="0"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Cantidad mínima de tokens BEZ requeridos para crear una propuesta
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={settings.allowDelegation}
                                    onChange={(e) => setSettings({ ...settings, allowDelegation: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
                                />
                                <label className="text-sm font-medium text-gray-300">
                                    Permitir Delegación de Votos
                                </label>
                            </div>

                            <button
                                onClick={updateSettings}
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
                            >
                                <Save className="w-5 h-5" />
                                Guardar Configuración
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DAOAdminPanel;
