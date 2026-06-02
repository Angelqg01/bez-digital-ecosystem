import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import {
    Coins, Users, FileText, TrendingUp, Vote,
    Wallet, ArrowUpRight, Clock, CheckCircle,
    XCircle, AlertCircle, DollarSign, Settings,
    UserPlus, MessageSquare, Eye, Shield, Lock,
    Zap, Activity, BarChart3, PieChart, Download
} from 'lucide-react';

const DAOAdmin = () => {
    const [activeTab, setActiveTab] = useState('dashboard');

    // Conexión automática con la wallet del usuario/admin
    const { address, isConnected } = useAccount();
    const [userRole, setUserRole] = useState('visitor');
    const [userTokens, setUserTokens] = useState(0);

    // Detectar automáticamente el rol cuando se conecta la wallet
    useEffect(() => {
        if (isConnected && address) {
            // TODO: Verificar el rol real desde el smart contract
            // Por ahora asumimos que es guardian si está en el panel admin
            setUserRole('guardian');
            setUserTokens(250000);
            console.log('✅ Wallet conectada automáticamente:', address);
        } else {
            setUserRole('visitor');
            setUserTokens(0);
        }
    }, [isConnected, address]);

    // Mock data - En producción vendrá del smart contract
    const daoStats = {
        treasuryUSD: 2847650,
        treasuryTokens: 5694300,
        activeMembers: 12847,
        activeProposals: 7,
        totalProposals: 156,
        votingPower: 250000,
        pendingExecutions: 3,
        totalVotes: 45230000,
        avgParticipation: 68
    };

    const proposals = [
        {
            id: 1,
            title: 'Aumentar recompensas por contenido verificado',
            description: 'Propuesta para incrementar en un 25% las recompensas en tokens para creadores que validan contenido mediante blockchain.',
            author: '0x742d...3a2f',
            status: 'active',
            votesFor: 4521000,
            votesAgainst: 1230000,
            quorum: 5000000,
            endDate: '2025-11-25T18:00:00',
            category: 'Economía',
            canExecute: false
        },
        {
            id: 2,
            title: 'Integración con Layer 2 (Polygon)',
            description: 'Migrar el 60% de las transacciones a Polygon para reducir comisiones de gas en un 95%.',
            author: '0x9a3c...7b1e',
            status: 'approved',
            votesFor: 6890000,
            votesAgainst: 450000,
            quorum: 5000000,
            endDate: '2025-11-23T12:00:00',
            category: 'Tecnología',
            canExecute: true
        },
        {
            id: 3,
            title: 'Programa de grants para desarrolladores',
            description: 'Asignar $500,000 USD en tokens para financiar 10 proyectos comunitarios en el Q1 2026.',
            author: '0x1f2e...9c4d',
            status: 'pending',
            votesFor: 3200000,
            votesAgainst: 890000,
            quorum: 5000000,
            endDate: '2025-11-27T20:00:00',
            category: 'Desarrollo',
            canExecute: false
        },
        {
            id: 4,
            title: 'Actualización del tokenomics v2.0',
            description: 'Implementar nuevo modelo deflacionario con burn del 0.5% por transacción.',
            author: '0x5e8a...2f6b',
            status: 'approved',
            votesFor: 8500000,
            votesAgainst: 320000,
            quorum: 5000000,
            endDate: '2025-11-18T15:00:00',
            category: 'Economía',
            canExecute: true
        },
        {
            id: 5,
            title: 'Spam: Free crypto giveaway',
            description: 'Click here to get free tokens...',
            author: '0xspam...1234',
            status: 'flagged',
            votesFor: 100,
            votesAgainst: 5000,
            quorum: 5000000,
            endDate: '2025-11-22T10:00:00',
            category: 'Spam',
            canExecute: false
        }
    ];

    const delegates = [
        {
            address: '0x742d...3a2f',
            name: 'CryptoVisionaryDAO',
            votingPower: 1250000,
            delegators: 342,
            participation: 94,
            avatar: '👑',
            verified: true
        },
        {
            address: '0x9a3c...7b1e',
            name: 'Web3Builder',
            votingPower: 980000,
            delegators: 287,
            participation: 89,
            avatar: '🔨',
            verified: true
        },
        {
            address: '0x1f2e...9c4d',
            name: 'DeFiWhale',
            votingPower: 850000,
            delegators: 201,
            participation: 97,
            avatar: '🐋',
            verified: false
        }
    ];

    const treasuryAssets = [
        { name: 'USDC', amount: 1200000, percentage: 42, color: 'bg-blue-500' },
        { name: 'ETH', amount: 850000, percentage: 30, color: 'bg-purple-500' },
        { name: 'BZH Token', amount: 650000, percentage: 23, color: 'bg-green-500' },
        { name: 'DAI', amount: 147650, percentage: 5, color: 'bg-yellow-500' }
    ];

    const recentTransactions = [
        { type: 'out', amount: 50000, desc: 'Grant Program Q4', date: '2025-11-18', hash: '0xabc...123', status: 'completed' },
        { type: 'in', amount: 125000, desc: 'Staking Rewards', date: '2025-11-17', hash: '0xdef...456', status: 'completed' },
        { type: 'out', amount: 30000, desc: 'Marketing Campaign', date: '2025-11-15', hash: '0xghi...789', status: 'completed' },
        { type: 'out', amount: 75000, desc: 'Development Grant', date: '2025-11-14', hash: '0xjkl...012', status: 'pending' }
    ];

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'approved': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'rejected': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            case 'pending': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'flagged': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
            default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'active': return <Vote className="w-4 h-4" />;
            case 'approved': return <CheckCircle className="w-4 h-4" />;
            case 'rejected': return <XCircle className="w-4 h-4" />;
            case 'pending': return <Clock className="w-4 h-4" />;
            case 'flagged': return <AlertCircle className="w-4 h-4" />;
            default: return <AlertCircle className="w-4 h-4" />;
        }
    };

    const calculateTimeLeft = (endDate) => {
        const difference = new Date(endDate) - new Date();
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        return `${days}d ${hours}h`;
    };

    const handleExecuteProposal = (proposalId) => {
        console.log(`Ejecutando propuesta ${proposalId} en blockchain...`);
        alert(`Propuesta #${proposalId} ejecutada exitosamente en la blockchain`);
    };

    const handleVetoProposal = (proposalId) => {
        if (confirm('¿Estás seguro de vetar esta propuesta? Esta acción es irreversible.')) {
            console.log(`Vetando propuesta ${proposalId}...`);
            alert(`Propuesta #${proposalId} vetada`);
        }
    };

    const handleVerifyDelegate = (address) => {
        console.log(`Verificando delegado ${address}...`);
        alert(`Delegado ${address} verificado`);
    };

    return (
        <div className="space-y-6">
            {/* Admin Header con Estadísticas Críticas */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-900 dark:to-blue-900 text-white rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                            <Shield className="w-8 h-8" />
                            Panel de Administración DAO
                        </h1>
                        <div className="flex items-center gap-3">
                            <p className="text-purple-100">Control Total de Gobernanza</p>
                            {isConnected && address && (
                                <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1 rounded-full border border-green-400/30">
                                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                    <span className="text-xs text-green-100 font-medium">
                                        {address.slice(0, 6)}...{address.slice(-4)}
                                    </span>
                                </div>
                            )}
                            {!isConnected && (
                                <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-1 rounded-full border border-yellow-400/30">
                                    <AlertCircle className="w-3 h-3 text-yellow-400" />
                                    <span className="text-xs text-yellow-100 font-medium">Wallet no conectada</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg backdrop-blur-sm transition-all">
                            <Download className="w-4 h-4" />
                            Exportar Datos
                        </button>
                        <button className="flex items-center gap-2 bg-red-500/80 hover:bg-red-600 px-4 py-2 rounded-lg backdrop-blur-sm transition-all">
                            <Lock className="w-4 h-4" />
                            Emergencia
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Coins className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-purple-100">Tesorería Total</p>
                                <p className="text-2xl font-bold">${(daoStats.treasuryUSD / 1000000).toFixed(2)}M</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-purple-100">Miembros Activos</p>
                                <p className="text-2xl font-bold">{daoStats.activeMembers.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Zap className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-purple-100">Pendientes Ejecución</p>
                                <p className="text-2xl font-bold text-yellow-300">{daoStats.pendingExecutions}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Activity className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-purple-100">Participación Avg</p>
                                <p className="text-2xl font-bold">{daoStats.avgParticipation}%</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs de Navegación */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    {['dashboard', 'proposals', 'treasury', 'delegates', 'settings'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 px-6 py-4 text-sm font-medium transition-all ${activeTab === tab
                                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-b-2 border-purple-600'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                        >
                            {tab === 'dashboard' && '📊 Dashboard'}
                            {tab === 'proposals' && '📋 Propuestas'}
                            {tab === 'treasury' && '💰 Tesorería'}
                            {tab === 'delegates' && '👥 Delegados'}
                            {tab === 'settings' && '⚙️ Configuración'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Propuestas Pendientes de Ejecución */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Zap className="w-5 h-5 text-yellow-500" />
                                Requieren Ejecución
                            </h3>
                            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold rounded-full">
                                {proposals.filter(p => p.canExecute).length} pendientes
                            </span>
                        </div>
                        <div className="space-y-3">
                            {proposals.filter(p => p.canExecute).map(proposal => (
                                <div key={proposal.id} className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{proposal.title}</h4>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">Aprobada hace {Math.abs(Math.floor((new Date(proposal.endDate) - new Date()) / (1000 * 60 * 60 * 24)))}d</p>
                                        </div>
                                        {isConnected ? (
                                            <button
                                                onClick={() => handleExecuteProposal(proposal.id)}
                                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-medium transition-colors flex items-center gap-1"
                                            >
                                                <Zap className="w-3 h-3" />
                                                Ejecutar
                                            </button>
                                        ) : (
                                            <button
                                                disabled
                                                className="px-3 py-1.5 bg-gray-400 cursor-not-allowed text-white text-xs rounded-lg font-medium flex items-center gap-1"
                                                title="Conecta tu wallet"
                                            >
                                                <Zap className="w-3 h-3" />
                                                Ejecutar
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-green-600">✓ {(proposal.votesFor / 1000000).toFixed(1)}M</span>
                                        <span className="text-gray-400">vs</span>
                                        <span className="text-red-600">✗ {(proposal.votesAgainst / 1000000).toFixed(1)}M</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Actividad Reciente */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-500" />
                            Actividad en Tiempo Real
                        </h3>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3 text-sm p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                                <Vote className="w-4 h-4 text-blue-500" />
                                <span className="text-gray-600 dark:text-gray-400">342 nuevos votos en Propuesta #2</span>
                                <span className="text-xs text-gray-500 ml-auto">2m</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span className="text-gray-600 dark:text-gray-400">Propuesta #154 alcanzó quórum</span>
                                <span className="text-xs text-gray-500 ml-auto">15m</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg">
                                <UserPlus className="w-4 h-4 text-purple-500" />
                                <span className="text-gray-600 dark:text-gray-400">28 nuevos miembros conectados</span>
                                <span className="text-xs text-gray-500 ml-auto">1h</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg">
                                <AlertCircle className="w-4 h-4 text-orange-500" />
                                <span className="text-gray-600 dark:text-gray-400">Propuesta spam detectada y flagged</span>
                                <span className="text-xs text-gray-500 ml-auto">3h</span>
                            </div>
                        </div>
                    </div>

                    {/* Métricas de Participación */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-purple-500" />
                            Métricas de Participación
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-600 dark:text-gray-400">Tasa de Votación</span>
                                    <span className="font-bold text-gray-900 dark:text-white">68%</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '68%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-600 dark:text-gray-400">Delegación Activa</span>
                                    <span className="font-bold text-gray-900 dark:text-white">42%</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '42%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="text-gray-600 dark:text-gray-400">Nuevas Propuestas/Mes</span>
                                    <span className="font-bold text-gray-900 dark:text-white">12</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Alertas del Sistema */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            Alertas del Sistema
                        </h3>
                        <div className="space-y-3">
                            <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-red-900 dark:text-red-400">Gas fees elevadas detectadas</p>
                                        <p className="text-xs text-red-700 dark:text-red-500 mt-1">Considerar pausar ejecuciones hasta que bajen</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-yellow-900 dark:text-yellow-400">Propuesta #5 marcada como spam</p>
                                        <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1">Revisar y considerar veto</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Proposals Tab - Control Total */}
            {activeTab === 'proposals' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex gap-2">
                            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm">Todas</button>
                            <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Activas</button>
                            <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Aprobadas</button>
                            <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Spam</button>
                        </div>
                    </div>

                    {proposals.map((proposal) => (
                        <div key={proposal.id} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(proposal.status)}`}>
                                            {getStatusIcon(proposal.status)}
                                            {proposal.status.toUpperCase()}
                                        </span>
                                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400">
                                            {proposal.category}
                                        </span>
                                        {proposal.canExecute && (
                                            <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full font-bold">
                                                LISTO PARA EJECUTAR
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">#{proposal.id} - {proposal.title}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{proposal.description}</p>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Eye className="w-3 h-3" />
                                            Por {proposal.author}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {proposal.status === 'active' ? `Termina en ${calculateTimeLeft(proposal.endDate)}` : 'Finalizada'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-green-600 dark:text-green-400">✓ {(proposal.votesFor / 1000000).toFixed(2)}M votos</span>
                                    <span className="text-red-600 dark:text-red-400">✗ {(proposal.votesAgainst / 1000000).toFixed(2)}M votos</span>
                                </div>
                                <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                    <div
                                        className="absolute top-0 left-0 bg-green-500 h-3"
                                        style={{ width: `${(proposal.votesFor / (proposal.votesFor + proposal.votesAgainst)) * 100}%` }}
                                    ></div>
                                    <div
                                        className="absolute top-0 right-0 bg-red-500 h-3"
                                        style={{ width: `${(proposal.votesAgainst / (proposal.votesFor + proposal.votesAgainst)) * 100}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Acciones de Admin */}
                            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                {proposal.canExecute && isConnected && (
                                    <button
                                        onClick={() => handleExecuteProposal(proposal.id)}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                    >
                                        <Zap className="w-4 h-4" />
                                        Ejecutar en Blockchain
                                    </button>
                                )}
                                {proposal.canExecute && !isConnected && (
                                    <button
                                        disabled
                                        className="px-4 py-2 bg-gray-400 cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2"
                                        title="Conecta tu wallet para ejecutar"
                                    >
                                        <Zap className="w-4 h-4" />
                                        Ejecutar en Blockchain
                                    </button>
                                )}
                                {proposal.status === 'flagged' && isConnected && (
                                    <button
                                        onClick={() => handleVetoProposal(proposal.id)}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Vetar Propuesta
                                    </button>
                                )}
                                {proposal.status === 'flagged' && !isConnected && (
                                    <button
                                        disabled
                                        className="px-4 py-2 bg-gray-400 cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2"
                                        title="Conecta tu wallet para vetar"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Vetar Propuesta
                                    </button>
                                )}
                                <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" />
                                    Ver Discusión
                                </button>
                                <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2">
                                    <Eye className="w-4 h-4" />
                                    Detalles On-Chain
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Treasury Tab */}
            {activeTab === 'treasury' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-purple-500" />
                            Composición de Activos
                        </h3>
                        <div className="space-y-4">
                            {treasuryAssets.map((asset, index) => (
                                <div key={index}>
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${asset.color}`}></div>
                                            <span className="font-medium text-gray-900 dark:text-white">{asset.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gray-900 dark:text-white">${asset.amount.toLocaleString()}</p>
                                            <p className="text-xs text-gray-500">{asset.percentage}%</p>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div className={`h-2 rounded-full ${asset.color}`} style={{ width: `${asset.percentage}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Transacciones Recientes</h3>
                        <div className="space-y-3">
                            {recentTransactions.map((tx, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'in' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                                            }`}>
                                            <ArrowUpRight className={`w-5 h-5 ${tx.type === 'in' ? 'text-green-600 rotate-180' : 'text-red-600'
                                                }`} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900 dark:text-white text-sm">{tx.desc}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-xs text-gray-500">{tx.date}</p>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${tx.status === 'completed'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    }`}>
                                                    {tx.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1 font-mono">{tx.hash}</p>
                                        </div>
                                    </div>
                                    <p className={`font-bold ${tx.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                                        {tx.type === 'in' ? '+' : '-'}${tx.amount.toLocaleString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Delegates Tab - Con Verificación */}
            {activeTab === 'delegates' && (
                <div className="space-y-4">
                    {delegates.map((delegate, index) => (
                        <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4 flex-1">
                                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-2xl">
                                        {delegate.avatar}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-gray-900 dark:text-white">{delegate.name}</h4>
                                            {delegate.verified && (
                                                <CheckCircle className="w-4 h-4 text-blue-500" title="Verificado por Admin" />
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mb-3">{delegate.address}</p>

                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-xs text-gray-500">Poder de Voto</p>
                                                <p className="font-bold text-gray-900 dark:text-white">{(delegate.votingPower / 1000000).toFixed(1)}M</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">Delegadores</p>
                                                <p className="font-bold text-gray-900 dark:text-white">{delegate.delegators}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">Participación</p>
                                                <p className="font-bold text-green-600">{delegate.participation}%</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {!delegate.verified && isConnected && (
                                        <button
                                            onClick={() => handleVerifyDelegate(delegate.address)}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            Verificar
                                        </button>
                                    )}
                                    {!delegate.verified && !isConnected && (
                                        <button
                                            disabled
                                            className="px-4 py-2 bg-gray-400 cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2"
                                            title="Conecta tu wallet para verificar"
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                            Verificar
                                        </button>
                                    )}
                                    <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                        Ver Historial
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Parámetros del Protocolo</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">Quórum Mínimo</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Votos necesarios para validar propuesta</p>
                                </div>
                                <input
                                    type="number"
                                    defaultValue="5000000"
                                    className="w-32 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">Duración de Votación</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Días que dura cada propuesta</p>
                                </div>
                                <input
                                    type="number"
                                    defaultValue="7"
                                    className="w-32 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white">Tokens para Proponer</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Stake mínimo para crear propuestas</p>
                                </div>
                                <input
                                    type="number"
                                    defaultValue="100000"
                                    className="w-32 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            {isConnected ? (
                                <button className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                                    Guardar Cambios
                                </button>
                            ) : (
                                <button disabled className="px-6 py-2 bg-gray-400 cursor-not-allowed text-white rounded-lg font-medium" title="Conecta tu wallet">
                                    Guardar Cambios
                                </button>
                            )}
                            <button className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                Cancelar
                            </button>
                        </div>
                    </div>

                    <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-6 border border-red-200 dark:border-red-800">
                        <h3 className="text-lg font-bold mb-4 text-red-900 dark:text-red-400 flex items-center gap-2">
                            <Lock className="w-5 h-5" />
                            Zona de Peligro
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-red-900 dark:text-red-400">Pausar Todas las Votaciones</p>
                                    <p className="text-sm text-red-700 dark:text-red-500">Activar en caso de emergencia</p>
                                </div>
                                {isConnected ? (
                                    <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
                                        Pausar DAO
                                    </button>
                                ) : (
                                    <button disabled className="px-4 py-2 bg-gray-400 cursor-not-allowed text-white rounded-lg text-sm font-medium" title="Conecta tu wallet">
                                        Pausar DAO
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-red-900 dark:text-red-400">Actualizar Smart Contract</p>
                                    <p className="text-sm text-red-700 dark:text-red-500">Requiere multisig</p>
                                </div>
                                {isConnected ? (
                                    <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
                                        Iniciar Upgrade
                                    </button>
                                ) : (
                                    <button disabled className="px-4 py-2 bg-gray-400 cursor-not-allowed text-white rounded-lg text-sm font-medium" title="Conecta tu wallet">
                                        Iniciar Upgrade
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DAOAdmin;
