import React, { useState, useEffect } from 'react';
import {
    Wallet, TrendingUp, TrendingDown, DollarSign,
    Activity, ArrowUpRight, ArrowDownRight, Eye, EyeOff,
    ExternalLink, RefreshCw, Shield, Info, Edit2, Save,
    X, Plus, Check, AlertCircle, Coins, Building, CreditCard,
    Users, Lock, Unlock, FileText, Download, Clock, LayoutDashboard,
    Settings
} from 'lucide-react';
import { ethers } from 'ethers';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TreasuryManagement = ({ bezhasToken, userAddress }) => {
    const [activeSection, setActiveSection] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Treasury data
    const [treasuryStats, setTreasuryStats] = useState(null);
    const [treasuryConfig, setTreasuryConfig] = useState(null);
    const [withdrawals, setWithdrawals] = useState([]);
    const [auditLog, setAuditLog] = useState([]);

    // Edit states
    const [editing, setEditing] = useState(false);
    const [showBankInfo, setShowBankInfo] = useState(false);
    const [editedConfig, setEditedConfig] = useState(null);

    // Withdrawal modal
    const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
    const [withdrawalForm, setWithdrawalForm] = useState({
        amount: '',
        currency: 'ETH',
        destinationType: 'wallet',
        destinationAddress: '',
        reason: ''
    });

    useEffect(() => {
        loadAllData();
    }, [bezhasToken]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                loadTreasuryStats(),
                loadTreasuryConfig(),
                loadWithdrawals(),
                loadAuditLog()
            ]);
        } catch (error) {
            console.error('Error loading treasury data:', error);
            toast.error('Error al cargar datos de tesorería');
        } finally {
            setLoading(false);
        }
    };

    const loadTreasuryStats = async () => {
        try {
            // Load from blockchain
            if (bezhasToken) {
                const stats = await bezhasToken.getTreasuryStats();
                setTreasuryStats({
                    currentEthBalance: parseFloat(ethers.formatEther(stats.currentEthBalance)),
                    totalReceived: parseFloat(ethers.formatEther(stats.totalReceived)),
                    totalWithdrawn: parseFloat(ethers.formatEther(stats.totalWithdrawn)),
                    availableBalance: parseFloat(ethers.formatEther(stats.availableBalance)),
                    fees: parseFloat(ethers.formatEther(stats.fees))
                });
            } else {
                // Load from backend
                const response = await axios.get(`${API_URL}/treasury/stats`);
                setTreasuryStats(response.data);
            }
        } catch (error) {
            console.error('Error loading treasury stats:', error);
        }
    };

    const loadTreasuryConfig = async () => {
        try {
            const response = await axios.get(`${API_URL}/treasury/config`);
            setTreasuryConfig(response.data);
            setEditedConfig(response.data);
        } catch (error) {
            console.error('Error loading treasury config:', error);
        }
    };

    const loadWithdrawals = async () => {
        try {
            const response = await axios.get(`${API_URL}/treasury/withdrawals`);
            setWithdrawals(response.data.withdrawals || []);
        } catch (error) {
            console.error('Error loading withdrawals:', error);
        }
    };

    const loadAuditLog = async () => {
        try {
            const response = await axios.get(`${API_URL}/treasury/audit-log`);
            setAuditLog(response.data.logs || []);
        } catch (error) {
            console.error('Error loading audit log:', error);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadAllData();
        setRefreshing(false);
        toast.success('Datos actualizados');
    };

    const handleSaveConfig = async () => {
        try {
            await axios.put(`${API_URL}/treasury/config`, editedConfig);
            setTreasuryConfig(editedConfig);
            setEditing(false);
            toast.success('Configuración guardada exitosamente');
            loadAuditLog();
        } catch (error) {
            console.error('Error saving config:', error);
            toast.error('Error al guardar configuración');
        }
    };

    const handleCreateWithdrawal = async () => {
        try {
            if (!withdrawalForm.amount || !withdrawalForm.reason) {
                toast.error('Complete todos los campos requeridos');
                return;
            }

            await axios.post(`${API_URL}/treasury/withdrawals`, {
                amount: parseFloat(withdrawalForm.amount),
                currency: withdrawalForm.currency,
                destination: {
                    type: withdrawalForm.destinationType,
                    address: withdrawalForm.destinationAddress
                },
                reason: withdrawalForm.reason
            });

            toast.success('Solicitud de retiro creada');
            setShowWithdrawalModal(false);
            setWithdrawalForm({
                amount: '',
                currency: 'ETH',
                destinationType: 'wallet',
                destinationAddress: '',
                reason: ''
            });
            loadWithdrawals();
            loadAuditLog();
        } catch (error) {
            console.error('Error creating withdrawal:', error);
            toast.error(error.response?.data?.error || 'Error al crear retiro');
        }
    };

    const formatEth = (value) => value ? value.toFixed(4) : '0.0000';
    const formatUsd = (ethValue) => {
        const ETH_PRICE = treasuryStats?.ethPrice || 2000;
        return (ethValue * ETH_PRICE).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <RefreshCw className="animate-spin text-cyan-400" size={48} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-cyan-900/50 to-blue-900/50 rounded-2xl p-6 border border-cyan-700/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-cyan-600 p-3 rounded-xl">
                            <Wallet className="text-white" size={32} />
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-white">Administración de Tesorería</h2>
                            <p className="text-cyan-200 mt-1">Control total de fondos y configuración</p>
                        </div>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-2 flex gap-2">
                {[
                    { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
                    { id: 'config', label: 'Configuración', icon: Settings },
                    { id: 'withdrawals', label: 'Retiros', icon: ArrowUpRight },
                    { id: 'audit', label: 'Auditoría', icon: FileText }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSection(tab.id)}
                        className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${activeSection === tab.id
                                ? 'bg-cyan-600 text-white'
                                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                            }`}
                    >
                        <tab.icon size={20} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Overview Section */}
            {activeSection === 'overview' && (
                <div className="space-y-6">
                    {/* Main Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            title="Balance Total"
                            value={`${formatEth(treasuryStats?.currentEthBalance)} ETH`}
                            subtitle={formatUsd(treasuryStats?.currentEthBalance)}
                            icon={Wallet}
                            color="green"
                        />
                        <StatCard
                            title="Total Recibido"
                            value={`${formatEth(treasuryStats?.totalReceived)} ETH`}
                            subtitle="Histórico de ingresos"
                            icon={ArrowDownRight}
                            color="blue"
                        />
                        <StatCard
                            title="Total Retirado"
                            value={`${formatEth(treasuryStats?.totalWithdrawn)} ETH`}
                            subtitle="Usado para operaciones"
                            icon={ArrowUpRight}
                            color="purple"
                        />
                        <StatCard
                            title="Comisiones"
                            value={`${formatEth(treasuryStats?.fees)} ETH`}
                            subtitle={formatUsd(treasuryStats?.fees)}
                            icon={Coins}
                            color="yellow"
                        />
                    </div>

                    {/* Distribution Chart */}
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Activity className="text-purple-400" />
                            Distribución Planeada de Fondos
                        </h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Desarrollo', percent: 30, color: 'bg-blue-600' },
                                { label: 'Liquidez & Market Making', percent: 25, color: 'bg-green-600' },
                                { label: 'Marketing & Growth', percent: 20, color: 'bg-purple-600' },
                                { label: 'Recompensas Comunidad', percent: 15, color: 'bg-yellow-600' },
                                { label: 'Reserva & Emergencias', percent: 10, color: 'bg-red-600' }
                            ].map((item) => (
                                <div key={item.label}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-400">{item.label}</span>
                                        <span className="text-white font-semibold">{item.percent}%</span>
                                    </div>
                                    <div className="w-full bg-slate-700 rounded-full h-2">
                                        <div
                                            className={`${item.color} h-2 rounded-full transition-all`}
                                            style={{ width: `${item.percent}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => {
                                setShowWithdrawalModal(true);
                                setWithdrawalForm({ ...withdrawalForm, destinationType: 'wallet' });
                            }}
                            className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all text-left"
                        >
                            <Wallet className="text-white mb-3" size={32} />
                            <h4 className="text-white font-bold text-lg mb-1">Retirar a Wallet</h4>
                            <p className="text-cyan-100 text-sm">Enviar ETH a dirección blockchain</p>
                        </button>

                        <button
                            onClick={() => {
                                setShowWithdrawalModal(true);
                                setWithdrawalForm({ ...withdrawalForm, destinationType: 'bank' });
                            }}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 rounded-xl hover:shadow-lg hover:shadow-green-500/30 transition-all text-left"
                        >
                            <Building className="text-white mb-3" size={32} />
                            <h4 className="text-white font-bold text-lg mb-1">Retirar a Banco</h4>
                            <p className="text-green-100 text-sm">Convertir a fiat y transferir</p>
                        </button>

                        <a
                            href={`https://etherscan.io/address/${treasuryConfig?.treasuryWalletAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 rounded-xl hover:shadow-lg hover:shadow-purple-500/30 transition-all text-left flex flex-col"
                        >
                            <ExternalLink className="text-white mb-3" size={32} />
                            <h4 className="text-white font-bold text-lg mb-1">Ver en Etherscan</h4>
                            <p className="text-purple-100 text-sm">Auditoría pública blockchain</p>
                        </a>
                    </div>
                </div>
            )}

            {/* Configuration Section */}
            {activeSection === 'config' && (
                <div className="space-y-6">
                    {/* Wallet Configuration */}
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Wallet className="text-cyan-400" />
                                Configuración de Wallet
                            </h3>
                            {!editing ? (
                                <button
                                    onClick={() => setEditing(true)}
                                    className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Edit2 size={16} />
                                    Editar
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setEditing(false);
                                            setEditedConfig(treasuryConfig);
                                        }}
                                        className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <X size={16} />
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveConfig}
                                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <Save size={16} />
                                        Guardar
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Dirección de Wallet de Tesorería
                                </label>
                                <input
                                    type="text"
                                    value={editing ? editedConfig?.treasuryWalletAddress : treasuryConfig?.treasuryWalletAddress}
                                    onChange={(e) => setEditedConfig({ ...editedConfig, treasuryWalletAddress: e.target.value })}
                                    disabled={!editing}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                                    placeholder="0x..."
                                />
                                <p className="text-xs text-slate-400 mt-1">
                                    Esta es la dirección donde se reciben los fondos de las compras de tokens
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bank Configuration */}
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Building className="text-green-400" />
                                Configuración de Cuenta Bancaria
                            </h3>
                            <button
                                onClick={() => setShowBankInfo(!showBankInfo)}
                                className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                            >
                                {showBankInfo ? <EyeOff size={16} /> : <Eye size={16} />}
                                {showBankInfo ? 'Ocultar' : 'Mostrar'}
                            </button>
                        </div>

                        {showBankInfo && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Nombre de la Cuenta
                                        </label>
                                        <input
                                            type="text"
                                            value={editing ? editedConfig?.bankAccount?.accountName : treasuryConfig?.bankAccount?.accountName}
                                            onChange={(e) => setEditedConfig({
                                                ...editedConfig,
                                                bankAccount: { ...editedConfig.bankAccount, accountName: e.target.value }
                                            })}
                                            disabled={!editing}
                                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white disabled:opacity-50"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Número de Cuenta
                                        </label>
                                        <input
                                            type="text"
                                            value={editing ? editedConfig?.bankAccount?.accountNumber : treasuryConfig?.bankAccount?.accountNumber}
                                            onChange={(e) => setEditedConfig({
                                                ...editedConfig,
                                                bankAccount: { ...editedConfig.bankAccount, accountNumber: e.target.value }
                                            })}
                                            disabled={!editing}
                                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white disabled:opacity-50"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Banco
                                        </label>
                                        <input
                                            type="text"
                                            value={editing ? editedConfig?.bankAccount?.bankName : treasuryConfig?.bankAccount?.bankName}
                                            onChange={(e) => setEditedConfig({
                                                ...editedConfig,
                                                bankAccount: { ...editedConfig.bankAccount, bankName: e.target.value }
                                            })}
                                            disabled={!editing}
                                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white disabled:opacity-50"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            País
                                        </label>
                                        <input
                                            type="text"
                                            value={editing ? editedConfig?.bankAccount?.country : treasuryConfig?.bankAccount?.country}
                                            onChange={(e) => setEditedConfig({
                                                ...editedConfig,
                                                bankAccount: { ...editedConfig.bankAccount, country: e.target.value }
                                            })}
                                            disabled={!editing}
                                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white disabled:opacity-50"
                                        />
                                    </div>
                                </div>

                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
                                    <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
                                    <div>
                                        <p className="text-yellow-400 font-semibold text-sm">Información Sensible</p>
                                        <p className="text-slate-300 text-sm mt-1">
                                            Los datos bancarios están encriptados y solo visibles para administradores autorizados.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Security Settings */}
                    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
                            <Shield className="text-purple-400" />
                            Configuración de Seguridad
                        </h3>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Límite Diario (ETH)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={editing ? editedConfig?.limits?.dailyEthLimit : treasuryConfig?.limits?.dailyEthLimit}
                                        onChange={(e) => setEditedConfig({
                                            ...editedConfig,
                                            limits: { ...editedConfig.limits, dailyEthLimit: parseFloat(e.target.value) }
                                        })}
                                        disabled={!editing}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white disabled:opacity-50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Firmas Requeridas
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={editing ? editedConfig?.limits?.minSignatures : treasuryConfig?.limits?.minSignatures}
                                        onChange={(e) => setEditedConfig({
                                            ...editedConfig,
                                            limits: { ...editedConfig.limits, minSignatures: parseInt(e.target.value) }
                                        })}
                                        disabled={!editing}
                                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="multiSig"
                                    checked={editing ? editedConfig?.limits?.requireMultiSig : treasuryConfig?.limits?.requireMultiSig}
                                    onChange={(e) => setEditedConfig({
                                        ...editedConfig,
                                        limits: { ...editedConfig.limits, requireMultiSig: e.target.checked }
                                    })}
                                    disabled={!editing}
                                    className="w-5 h-5 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500"
                                />
                                <label htmlFor="multiSig" className="text-slate-300">
                                    Requerir múltiples firmas para retiros
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Withdrawals Section */}
            {activeSection === 'withdrawals' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-bold text-white">Solicitudes de Retiro</h3>
                        <button
                            onClick={() => setShowWithdrawalModal(true)}
                            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Plus size={20} />
                            Nueva Solicitud
                        </button>
                    </div>

                    <div className="space-y-4">
                        {withdrawals.length === 0 ? (
                            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
                                <ArrowUpRight className="mx-auto text-slate-600 mb-4" size={48} />
                                <p className="text-slate-400">No hay solicitudes de retiro</p>
                            </div>
                        ) : (
                            withdrawals.map((withdrawal) => (
                                <div key={withdrawal._id} className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h4 className="text-lg font-bold text-white">
                                                    {withdrawal.amount} {withdrawal.currency}
                                                </h4>
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${withdrawal.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                                        withdrawal.status === 'approved' ? 'bg-blue-500/20 text-blue-400' :
                                                            withdrawal.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                'bg-red-500/20 text-red-400'
                                                    }`}>
                                                    {withdrawal.status}
                                                </span>
                                            </div>
                                            <p className="text-slate-400 text-sm mb-2">{withdrawal.reason}</p>
                                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                                <span>Por: {withdrawal.requestedBy?.slice(0, 10)}...</span>
                                                <span>{new Date(withdrawal.createdAt).toLocaleDateString()}</span>
                                                <span>Firmas: {withdrawal.signatures?.length || 0}/{withdrawal.requiredSignatures}</span>
                                            </div>
                                        </div>
                                        {withdrawal.txHash && (
                                            <a
                                                href={`https://etherscan.io/tx/${withdrawal.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-cyan-400 hover:text-cyan-300"
                                            >
                                                <ExternalLink size={20} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Audit Log Section */}
            {activeSection === 'audit' && (
                <div className="space-y-6">
                    <h3 className="text-2xl font-bold text-white">Registro de Auditoría</h3>

                    <div className="space-y-2">
                        {auditLog.length === 0 ? (
                            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-12 text-center">
                                <FileText className="mx-auto text-slate-600 mb-4" size={48} />
                                <p className="text-slate-400">No hay registros de auditoría</p>
                            </div>
                        ) : (
                            auditLog.map((log, index) => (
                                <div key={index} className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 flex items-start gap-4">
                                    <div className="bg-cyan-500/20 p-2 rounded-lg">
                                        <Activity className="text-cyan-400" size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className="font-semibold text-white">{log.action?.replace(/_/g, ' ')}</h4>
                                            <span className="text-xs text-slate-500">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-400">
                                            Por: {log.performedBy?.slice(0, 10)}...
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Withdrawal Modal */}
            {showWithdrawalModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-lg mx-4 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold text-white">Nueva Solicitud de Retiro</h3>
                            <button
                                onClick={() => setShowWithdrawalModal(false)}
                                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X className="text-slate-400" size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Cantidad
                                </label>
                                <input
                                    type="number"
                                    step="0.001"
                                    value={withdrawalForm.amount}
                                    onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white"
                                    placeholder="0.0"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Moneda
                                </label>
                                <select
                                    value={withdrawalForm.currency}
                                    onChange={(e) => setWithdrawalForm({ ...withdrawalForm, currency: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white"
                                >
                                    <option value="ETH">ETH</option>
                                    <option value="BEZ">BEZ</option>
                                    <option value="USD">USD</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Tipo de Destino
                                </label>
                                <select
                                    value={withdrawalForm.destinationType}
                                    onChange={(e) => setWithdrawalForm({ ...withdrawalForm, destinationType: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white"
                                >
                                    <option value="wallet">Wallet (Blockchain)</option>
                                    <option value="bank">Cuenta Bancaria</option>
                                </select>
                            </div>

                            {withdrawalForm.destinationType === 'wallet' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Dirección de Wallet
                                    </label>
                                    <input
                                        type="text"
                                        value={withdrawalForm.destinationAddress}
                                        onChange={(e) => setWithdrawalForm({ ...withdrawalForm, destinationAddress: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white"
                                        placeholder="0x..."
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Razón / Descripción
                                </label>
                                <textarea
                                    value={withdrawalForm.reason}
                                    onChange={(e) => setWithdrawalForm({ ...withdrawalForm, reason: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white resize-none"
                                    rows={3}
                                    placeholder="Describe el motivo del retiro..."
                                />
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
                                <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
                                <p className="text-yellow-400 text-sm">
                                    Esta solicitud requerirá {treasuryConfig?.limits?.minSignatures || 2} firmas para ser aprobada.
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowWithdrawalModal(false)}
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreateWithdrawal}
                                    className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
                                >
                                    Crear Solicitud
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// StatCard Component
const StatCard = ({ title, value, subtitle, icon: Icon, color }) => {
    const colorClasses = {
        green: 'from-green-600 to-green-700',
        blue: 'from-blue-600 to-blue-700',
        purple: 'from-purple-600 to-purple-700',
        yellow: 'from-yellow-600 to-yellow-700'
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-6 shadow-xl`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">{title}</h3>
                <Icon className="text-white/80" size={24} />
            </div>
            <p className="text-4xl font-bold text-white mb-2">{value}</p>
            <p className="text-white/70 text-sm">{subtitle}</p>
        </div>
    );
};

export default TreasuryManagement;
