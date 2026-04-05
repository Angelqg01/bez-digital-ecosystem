import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletConnect } from '../hooks/useWalletConnect';
import { useBezCoin } from '../context/BezCoinContext';
import { useConnect, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import ConnectWalletButton from '../components/common/ConnectWalletButton';
// BuyBezCoinModal -> useBezPay().openBuyBez()
import GlobalStatsBar from '../components/GlobalStatsBar';
import toast from 'react-hot-toast';
import {
    Wallet, Users, Vote, TrendingUp, Clock, CheckCircle,
    XCircle, DollarSign, Award, ArrowRight, Filter, Search,
    BarChart3, Activity, Eye, ThumbsUp, ThumbsDown, Plus,
    MessageSquare, Loader, ArrowUpRight, ArrowDownRight, ShoppingBag, Flame,
    Building2, Truck, HeartPulse, Factory, Zap, GraduationCap, Lightbulb,
    Cpu, Globe, Timer, ChevronDown, ChevronUp, AlertTriangle, CreditCard, Euro, ExternalLink, Landmark
} from 'lucide-react';

// 💰 CONFIGURACIÓN DE PRECIOS Y VOTACIÓN
// Precio simulado del token desde la Pool BEZ/USDC (En producción usar Oracle/API)
const BEZ_PRICE_EUR = 0.50; // 1 BEZ = 0.50 EUR
const BEZ_PRICE_USD = 0.55; // 1 BEZ = 0.55 USD
const MIN_VOTE_EUR = 150; // Mínimo 150€ para votar
const MIN_BEZ_REQUIRED = Math.ceil(MIN_VOTE_EUR / BEZ_PRICE_EUR); // 300 BEZ

// 📊 Mock Data Optimizado (sin contexto pesado)
const MOCK_PROPOSALS = [
    {
        _id: '1',
        title: 'Aumentar recompensas por contenido verificado',
        description: 'Propuesta para incrementar en un 25% las recompensas para creadores que verifican contenido mediante blockchain.',
        category: 'treasury',
        creator: '0x1234...5678',
        status: 'active',
        startDate: new Date('2025-11-20'),
        endDate: new Date('2025-11-25'),
        votesFor: 1245000,
        votesAgainst: 234000,
        totalVotes: 1479000,
    },
    {
        _id: '2',
        title: 'Implementar sistema de moderación descentralizada',
        description: 'Crear un sistema de jurados aleatorios usando NFTs para moderar contenido reportado.',
        category: 'governance',
        creator: '0x1234...5678',
        status: 'active',
        startDate: new Date('2025-11-20'),
        endDate: new Date('2025-11-27'),
        votesFor: 890000,
        votesAgainst: 567000,
        totalVotes: 1457000,
    },
    {
        _id: '3',
        title: 'Financiar hackathon de desarrolladores Q1 2026',
        description: 'Asignar 50,000 USDC de la tesorería para premios del hackathon y atracción de talento.',
        category: 'development',
        creator: '0x1234...5678',
        status: 'active',
        startDate: new Date('2025-11-21'),
        endDate: new Date('2025-11-28'),
        votesFor: 1567000,
        votesAgainst: 345000,
        totalVotes: 1912000,
    }
];

const MOCK_DAO_STATE = {
    totalSupply: '3000000000',
    totalVotingPower: '2450000000',
    activeProposals: 3,
    totalProposals: 12,
    treasuryBalance: '850000',
    participationRate: 81.67,
    settings: {
        proposalThreshold: 100000,
        votingPeriod: 5,
        quorumPercentage: 4
    },
    treasury: {
        totalUSD: 2450000,
        usdcBalance: 850000,
        totalBEZ: 125000000,
        ethBalance: 245.50
    },
    members: {
        total: 12450,
        active: 8234,
        delegates: 156
    },
    proposals: {
        active: 3,
        total: 12,
        approved: 8
    }
};

const MOCK_TREASURY_TRANSACTIONS = [
    { type: 'deposit', amount: '50000', token: 'USDC', description: 'Depósito inicial Q4', createdAt: new Date('2025-10-15') },
    { type: 'withdrawal', amount: '12500', token: 'BEZ', description: 'Pago recompensas creadores', createdAt: new Date('2025-11-01') },
    { type: 'deposit', amount: '2.5', token: 'ETH', description: 'Donation from NFT sale', createdAt: new Date('2025-11-10') },
    { type: 'withdrawal', amount: '5000', token: 'USDC', description: 'Hackathon prizes', createdAt: new Date('2025-11-15') },
    { type: 'deposit', amount: '75000', token: 'BEZ', description: 'Staking rewards redistribution', createdAt: new Date('2025-11-18') }
];

const MOCK_DELEGATES = [
    { address: '0x1234...5678', username: 'CryptoVoter', votingPower: '245000', delegatedFrom: 23, votesParticipated: 45, proposalsCreated: 3 },
    { address: '0x2345...6789', username: 'BlockchainBoss', votingPower: '189000', delegatedFrom: 18, votesParticipated: 38, proposalsCreated: 5 },
    { address: '0x3456...7890', username: 'DeFiDave', votingPower: '156000', delegatedFrom: 15, votesParticipated: 32, proposalsCreated: 2 },
    { address: '0x4567...8901', username: 'TokenTina', votingPower: '134000', delegatedFrom: 12, votesParticipated: 28, proposalsCreated: 4 },
    { address: '0x5678...9012', username: 'DAODan', votingPower: '98000', delegatedFrom: 10, votesParticipated: 25, proposalsCreated: 1 }
];

const MOCK_USER_STATE = {
    votingPower: '50000',
    delegatedVotes: '0',
    proposalsCreated: 0,
    votesParticipated: 0,
    rewardsEarned: '0',
    unclaimedRewards: '0'
};

// 🚀 Iniciativas Estratégicas por Sector
const STRATEGIC_INITIATIVES = [
    {
        id: 'banking-fintech',
        sector: 'Banca y Fintech',
        icon: Building2,
        color: 'from-blue-600 to-cyan-600',
        borderColor: 'border-blue-500/30',
        bgColor: 'from-blue-900/20 to-cyan-900/10',
        developmentType: 'Tokenización de activos (RWAs), bonos y crédito privado; Smart Contracts (ERC-3643).',
        scalability: 'Uso de L2 y ZK-rollups para >10,000 TPS; arquitecturas modulares.',
        estimatedCost: '$100,000 - $3,000,000+',
        developmentTime: '3 - 9 meses (MVP a Enterprise)',
        rdFocus: 'IA para scoring de riesgo y oráculos de precios en tiempo real.',
        detailsLink: '/dao/banca-fintech', // Link to detailed fund page
        status: 'active',
        votesFor: 2340000,
        votesAgainst: 560000,
        totalVoters: 1245,
        endDate: new Date('2026-02-15'),
        priority: 'high'
    },
    {
        id: 'logistics-supply-chain',
        sector: 'Logística y Supply Chain',
        icon: Truck,
        color: 'from-orange-600 to-amber-600',
        borderColor: 'border-orange-500/30',
        bgColor: 'from-orange-900/20 to-amber-900/10',
        developmentType: 'Tokenización de facturas e inventario; automatización de pagos y cumplimiento.',
        scalability: 'Sharding y DAGs para reducir latencia hasta un 85%.',
        estimatedCost: '$15,000 - $50,000 (Base) + integración',
        developmentTime: '2 - 5 meses (rastreo básico)',
        rdFocus: 'Integración masiva de sensores (RFID/GPS) y Edge Computing.',
        detailsLink: '/dao/logistica-supply-chain', // Link to detailed fund page
        status: 'active',
        votesFor: 1890000,
        votesAgainst: 420000,
        totalVoters: 987,
        endDate: new Date('2026-02-20'),
        priority: 'high'
    },
    {
        id: 'health-biotech',
        sector: 'Salud y Biotecnología',
        icon: HeartPulse,
        color: 'from-red-600 to-pink-600',
        borderColor: 'border-red-500/30',
        bgColor: 'from-red-900/20 to-pink-900/10',
        developmentType: 'Tokenización de registros médicos (EHR); vinculación de datos (RWD) para ensayos clínicos.',
        scalability: 'Desidentificación de datos a escala; almacenamiento descentralizado.',
        estimatedCost: '$50,000 - $200,000+',
        developmentTime: '1 - 3 meses (prototipos)',
        rdFocus: 'Identidad Digital Verificable y sensores biométricos.',
        detailsLink: '/dao/salud-biotecnologia', // Link to detailed fund page
        status: 'active',
        votesFor: 1567000,
        votesAgainst: 345000,
        totalVoters: 756,
        endDate: new Date('2026-02-25'),
        priority: 'medium'
    },
    {
        id: 'industry-4-0',
        sector: 'Industria 4.0',
        icon: Factory,
        color: 'from-purple-600 to-indigo-600',
        borderColor: 'border-purple-500/30',
        bgColor: 'from-purple-900/20 to-indigo-900/10',
        developmentType: 'Gemelos Digitales (Digital Twins); Mantenimiento Predictivo; Smart Factories.',
        scalability: 'Arquitectura híbrida Edge-Cloud; decisiones en milisegundos.',
        estimatedCost: '$30,000 - $300,000',
        developmentTime: '1 - 4 meses (pilotos)',
        rdFocus: 'Agentes de IA autónomos; visión computacional 5G.',
        detailsLink: '/dao/industria-4-0', // Link to detailed fund page
        status: 'active',
        votesFor: 2100000,
        votesAgainst: 780000,
        totalVoters: 1123,
        endDate: new Date('2026-03-01'),
        priority: 'high'
    },
    {
        id: 'energy-smart-cities',
        sector: 'Energía y Smart Cities',
        icon: Zap,
        color: 'from-green-600 to-emerald-600',
        borderColor: 'border-green-500/30',
        bgColor: 'from-green-900/20 to-emerald-900/10',
        developmentType: 'Trading de energía P2P; gestión de activos de infraestructura.',
        scalability: 'Smart Grids escalables; ZK-blockchains resistentes a cuántica.',
        estimatedCost: '>$500,000 (proyectos de gran escala)',
        developmentTime: '6 - 12+ meses',
        rdFocus: 'Monitoreo de recursos con IoT; IA para optimización de carga.',
        detailsLink: '/dao/energia-smart-cities', // Link to detailed fund page
        status: 'active',
        votesFor: 3200000,
        votesAgainst: 450000,
        totalVoters: 1567,
        endDate: new Date('2026-03-10'),
        priority: 'critical'
    },
    {
        id: 'education-credentials',
        sector: 'Educación y Credenciales',
        icon: GraduationCap,
        color: 'from-yellow-600 to-orange-600',
        borderColor: 'border-yellow-500/30',
        bgColor: 'from-yellow-900/20 to-orange-900/10',
        developmentType: 'Micro-credenciales (NFTs); insignias digitales; DAOs académicas.',
        scalability: 'Arquitecturas modulares e interoperables (LMS Gen-Next).',
        estimatedCost: '$30,000 - $150,000',
        developmentTime: '1 - 3 meses',
        rdFocus: 'IA para personalización de rutas y validación de competencias.',
        detailsLink: '/dao/educacion-credenciales', // Link to detailed fund page
        status: 'active',
        votesFor: 1456000,
        votesAgainst: 234000,
        totalVoters: 645,
        endDate: new Date('2026-02-28'),
        priority: 'medium'
    },
    {
        id: 'government-governance',
        sector: 'Gobierno y Gobernanza',
        icon: Landmark,
        color: 'from-slate-600 to-zinc-600',
        borderColor: 'border-slate-500/30',
        bgColor: 'from-slate-900/20 to-zinc-900/10',
        developmentType: 'Identidad Digital Soberana (SSI); Voto Electrónico Verificable; DAOs para presupuestos participativos.',
        scalability: 'ZK-Rollups para validación masiva sin revelar datos privados.',
        estimatedCost: '$200,000 - $3,000,000+',
        developmentTime: '6 - 24 meses',
        rdFocus: 'IA Soberana Nacional y criptografía ZKP para privacidad ciudadana.',
        detailsLink: '/dao/gobierno-gobernanza',
        status: 'active',
        votesFor: 2890000,
        votesAgainst: 320000,
        totalVoters: 1890,
        endDate: new Date('2026-03-15'),
        priority: 'critical'
    }
];

const DAOPage = () => {
    const { isConnected, shortAddress } = useWalletConnect();
    const { address } = useAccount();
    const { connect, connectors } = useConnect();
    const { balance, showBuyModal, setShowBuyModal } = useBezCoin();

    // ── Wagmi on-chain vote transfer ────────────────────────────────────────────
    const BEZ_TOKEN = '0x89c23890c742d710265dd61be789c71dc8999b12';
    const TREASURY_DAO = '0x89c23890c742d710265dd61be789c71dc8999b12';
    const ERC20_TRANSFER_ABI = [
        {
            name: 'transfer',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
            outputs: [{ name: '', type: 'bool' }]
        }
    ];

    const { writeContract: sendVoteTx, data: voteTxHash, isPending: isVotePending } = useWriteContract();
    const { isLoading: isVoteConfirming, isSuccess: isVoteSuccess } = useWaitForTransactionReceipt({
        hash: voteTxHash,
        chainId: 137,
    });

    // Tracking vote context for feedback after tx confirms
    const [pendingVote, setPendingVote] = useState(null);

    // Apply state update after tx confirms
    useEffect(() => {
        if (isVoteSuccess && pendingVote) {
            const { type, id, support, amount } = pendingVote;

            if (type === 'proposal') {
                setProposals(prev => prev.map(p => {
                    if (p._id === id) {
                        return {
                            ...p,
                            votesFor: support ? p.votesFor + amount : p.votesFor,
                            votesAgainst: !support ? p.votesAgainst + amount : p.votesAgainst,
                            totalVotes: p.totalVotes + amount
                        };
                    }
                    return p;
                }));
            } else if (type === 'initiative') {
                setStrategicInitiatives(prev => prev.map(init => {
                    if (init.id === id) {
                        return {
                            ...init,
                            votesFor: support ? init.votesFor + amount : init.votesFor,
                            votesAgainst: !support ? init.votesAgainst + amount : init.votesAgainst,
                            totalVoters: init.totalVoters + 1
                        };
                    }
                    return init;
                }));
            }

            setUserBezBalance(prev => prev - amount);
            setUserState(prev => ({ ...prev, votesParticipated: prev.votesParticipated + 1 }));
            setContributionAmounts(prev => ({ ...prev, [id]: MIN_BEZ_REQUIRED }));

            toast.success(`✅ Voto on-chain confirmado! ${amount} BEZ enviados a la Tesoreria DAO.`, {
                icon: support ? '👍' : '👎',
                duration: 5000
            });
            setPendingVote(null);
        }
    }, [isVoteSuccess, pendingVote]);

    // Realtime feedback for pending tx
    useEffect(() => {
        if (isVotePending) toast.loading('Esperando confirmación en MetaMask...', { id: 'vote-tx' });
        if (isVoteConfirming) toast.loading('Confirmando en Polygon...', { id: 'vote-tx' });
        if (isVoteSuccess) toast.dismiss('vote-tx');
    }, [isVotePending, isVoteConfirming, isVoteSuccess]);


    // Estado local optimizado (sin contexto pesado)
    const [proposals, setProposals] = useState(MOCK_PROPOSALS);
    const [daoState] = useState(MOCK_DAO_STATE);
    const [userState, setUserState] = useState(MOCK_USER_STATE);
    const [treasuryTransactions] = useState(MOCK_TREASURY_TRANSACTIONS);
    const [delegates] = useState(MOCK_DELEGATES);
    const [strategicInitiatives, setStrategicInitiatives] = useState(STRATEGIC_INITIATIVES);
    const [loading] = useState(false);
    const [expandedInitiative, setExpandedInitiative] = useState(null);

    // 💰 Estado para contribuciones de votación (Pay-to-Vote)
    const [contributionAmounts, setContributionAmounts] = useState({});
    const [userBezBalance, setUserBezBalance] = useState(parseFloat(balance || '150')); // Saldo actual del usuario

    const [activeTab, setActiveTab] = useState('resumen');
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // DeFi Integration State (opcional)
    const [poolsStatus, setPoolsStatus] = useState(null);
    const [defiAnalytics, setDefiAnalytics] = useState(null);
    const [defiProposals, setDefiProposals] = useState([]);
    const [loadingDefi, setLoadingDefi] = useState(false);

    // Auto-connect wallet
    useEffect(() => {
        if (!isConnected && connectors.length > 0) {
            const injectedConnector = connectors.find(c => c.id === 'injected' || c.name === 'MetaMask');
            if (injectedConnector) {
                const connectPromise = connect({ connector: injectedConnector });
                if (connectPromise && typeof connectPromise.catch === 'function') {
                    connectPromise.catch(() => {
                        // Auto-connect skipped silently
                    });
                }
            }
        }
    }, [isConnected, connect, connectors]);

    // Fetch DeFi data
    useEffect(() => {
        if (activeTab === 'defi') {
            fetchDeFiData();
        }
    }, [activeTab]);

    const fetchDeFiData = async () => {
        setLoadingDefi(true);
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        try {
            const responses = await Promise.allSettled([
                fetch(`${API_URL}/api/defi/pools-status`, {
                    signal: AbortSignal.timeout(5000)
                }),
                fetch(`${API_URL}/api/defi/analytics`, {
                    signal: AbortSignal.timeout(5000)
                }),
                fetch(`${API_URL}/api/defi/proposals`, {
                    signal: AbortSignal.timeout(5000)
                }),
            ]);

            // Process pools status
            if (responses[0].status === 'fulfilled' && responses[0].value.ok) {
                const poolsData = await responses[0].value.json();
                if (poolsData.success) setPoolsStatus(poolsData.data);
            }

            // Process analytics
            if (responses[1].status === 'fulfilled' && responses[1].value.ok) {
                const analyticsData = await responses[1].value.json();
                if (analyticsData.success) setDefiAnalytics(analyticsData.analytics);
            }

            // Process proposals
            if (responses[2].status === 'fulfilled' && responses[2].value.ok) {
                const proposalsData = await responses[2].value.json();
                if (proposalsData.success) setDefiProposals(proposalsData.proposals);
            }

            // Check if all requests failed
            const allFailed = responses.every(r => r.status === 'rejected');
            if (allFailed) {
                toast.error('Backend DeFi no disponible');
            }
        } catch (error) {
            // Silent fail - DeFi features optional
            toast.error('Error de conexión con servicios DeFi', { duration: 2000 });
        } finally {
            setLoadingDefi(false);
        }
    };

    // Filter proposals with useMemo for performance
    const filteredProposals = useMemo(() => {
        return proposals.filter((proposal) => {
            const matchesFilter = filter === 'all' || proposal.status === filter;
            const matchesSearch = proposal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                proposal.description.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesFilter && matchesSearch;
        });
    }, [proposals, filter, searchTerm]);

    // Utilities optimizadas
    const getVotePercentage = (votes, total) => {
        return total > 0 ? ((votes / total) * 100).toFixed(1) : 0;
    };

    const getStatusBadge = (status) => {
        const badges = {
            active: { label: 'Activa', icon: Clock, color: 'bg-blue-500' },
            approved: { label: 'Aprobada', icon: CheckCircle, color: 'bg-green-500' },
            rejected: { label: 'Rechazada', icon: XCircle, color: 'bg-red-500' },
            executed: { label: 'Ejecutada', icon: CheckCircle, color: 'bg-purple-500' },
            expired: { label: 'Expirada', icon: Clock, color: 'bg-gray-500' },
        };
        return badges[status] || badges.active;
    };

    // 💰 Handler para cambiar cantidad de contribución
    const handleContributionChange = (id, value) => {
        const numValue = parseFloat(value) || 0;
        setContributionAmounts(prev => ({
            ...prev,
            [id]: numValue
        }));
    };

    // 💰 Handler para comprar tokens faltantes (On-Ramp integrado)
    const handleBuyTokens = (amountNeeded, returnToVote = null) => {
        const costInEur = (amountNeeded * BEZ_PRICE_EUR).toFixed(2);
        const costInUsd = (amountNeeded * BEZ_PRICE_USD).toFixed(2);

        toast((t) => (
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-cyan-400" />
                    <span className="font-bold text-white">Compra Directa de Tokens</span>
                </div>
                <div className="text-sm text-gray-300 space-y-1">
                    <p>Cantidad: <span className="text-cyan-400 font-bold">{amountNeeded.toFixed(0)} BEZ</span></p>
                    <p>Precio Pool: <span className="text-green-400">€{BEZ_PRICE_EUR}/BEZ</span></p>
                    <p>Total: <span className="text-yellow-400 font-bold">€{costInEur}</span> (~${costInUsd})</p>
                </div>
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={() => {
                            // Simular compra exitosa
                            setUserBezBalance(prev => prev + amountNeeded);
                            toast.dismiss(t.id);
                            toast.success(`✅ Has comprado ${amountNeeded.toFixed(0)} BEZ exitosamente`, { duration: 3000 });
                        }}
                        className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white py-2 px-4 rounded-lg font-medium text-sm"
                    >
                        Confirmar Compra
                    </button>
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        ), {
            duration: 15000,
            style: {
                background: '#1e293b',
                border: '1px solid #334155',
                padding: '16px',
                maxWidth: '400px'
            }
        });
    };

    // 💰 Handlers optimizados con sistema Pay-to-Vote ON-CHAIN
    const handleVote = useCallback(async (proposalId, support) => {
        if (!isConnected || !address) {
            toast.error('Conecta tu wallet para votar');
            return;
        }

        const amountToPay = contributionAmounts[proposalId] || MIN_BEZ_REQUIRED;

        if (amountToPay < MIN_BEZ_REQUIRED) {
            toast.error(`La contribución mínima es de €${MIN_VOTE_EUR} (${MIN_BEZ_REQUIRED} BEZ)`);
            return;
        }

        if (userBezBalance < amountToPay) {
            toast.error(`Saldo insuficiente. Te faltan ${(amountToPay - userBezBalance).toFixed(0)} BEZ`);
            return;
        }

        try {
            setPendingVote({ type: 'proposal', id: proposalId, support, amount: amountToPay });
            sendVoteTx({
                address: BEZ_TOKEN,
                abi: ERC20_TRANSFER_ABI,
                functionName: 'transfer',
                args: [TREASURY_DAO, parseUnits(amountToPay.toString(), 18)],
                chainId: 137,
            });
        } catch (err) {
            console.error('Vote error:', err);
            toast.error('Error al emitir el voto. Comprueba tu wallet.');
            setPendingVote(null);
        }
    }, [isConnected, address, contributionAmounts, userBezBalance, sendVoteTx]);


    const handleClaimRewards = async () => {
        if (!isConnected) {
            toast.error('Conecta tu wallet para reclamar recompensas');
            return;
        }
        // Mock claim (optimizado sin blockchain)
        toast.success('Recompensas reclamadas (mock)', { duration: 2000 });
    };

    const handleCreateProposal = () => {
        if (!isConnected) {
            toast.error('Conecta tu wallet para crear propuestas');
            return;
        }

        const threshold = daoState?.settings?.proposalThreshold || 100000;
        const currentBalance = parseFloat(balance || '0');

        if (currentBalance < threshold) {
            toast.error(`Balance insuficiente. Necesitas ${(threshold - currentBalance).toLocaleString()} BEZ más`);
            openBuyBez();
            return;
        }

        toast.info('Función en desarrollo', { duration: 2000 });
    };

    // 💰 Handler para votar en iniciativas estratégicas (Pay-to-Vote ON-CHAIN)
    const handleInitiativeVote = useCallback((initiativeId, support) => {
        if (!isConnected || !address) {
            toast.error('Conecta tu wallet para votar');
            return;
        }

        const amountToPay = contributionAmounts[initiativeId] || MIN_BEZ_REQUIRED;
        if (amountToPay < MIN_BEZ_REQUIRED) {
            toast.error(`La contribución mínima es de €${MIN_VOTE_EUR} (${MIN_BEZ_REQUIRED} BEZ)`);
            return;
        }
        if (userBezBalance < amountToPay) {
            toast.error(`Saldo insuficiente. Te faltan ${(amountToPay - userBezBalance).toFixed(0)} BEZ`);
            return;
        }

        try {
            setPendingVote({ type: 'initiative', id: initiativeId, support, amount: amountToPay });
            sendVoteTx({
                address: BEZ_TOKEN,
                abi: ERC20_TRANSFER_ABI,
                functionName: 'transfer',
                args: [TREASURY_DAO, parseUnits(amountToPay.toString(), 18)],
                chainId: 137,
            });
        } catch (err) {
            console.error('Initiative vote error:', err);
            toast.error('Error al emitir el voto. Comprueba tu wallet.');
            setPendingVote(null);
        }
    }, [isConnected, address, contributionAmounts, userBezBalance, sendVoteTx]);


    // Toggle expanded initiative details
    const toggleInitiativeDetails = (initiativeId) => {
        setExpandedInitiative(expandedInitiative === initiativeId ? null : initiativeId);
    };

    // Get priority badge color
    const getPriorityBadge = (priority) => {
        const badges = {
            critical: { label: 'Crítica', color: 'bg-red-500' },
            high: { label: 'Alta', color: 'bg-orange-500' },
            medium: { label: 'Media', color: 'bg-yellow-500' },
            low: { label: 'Baja', color: 'bg-blue-500' }
        };
        return badges[priority] || badges.medium;
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* GLOBAL STATS BAR */}
            <GlobalStatsBar />

            {/* HEADER */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 bg-clip-text text-transparent">
                                BeZhas DAO
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-2">
                                Gobernanza descentralizada y gestión DeFi unificada
                            </p>
                        </div>

                        {/* Stats Principales */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                                <div className="flex items-center gap-2 mb-2">
                                    <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Tesorería</p>
                                </div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    ${((daoState?.treasury?.totalUSD || 0) / 1000000).toFixed(2)}M
                                </p>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                                <div className="flex items-center gap-2 mb-2">
                                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Miembros</p>
                                </div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {(daoState?.members?.total || 0).toLocaleString()}
                                </p>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                                <div className="flex items-center gap-2 mb-2">
                                    <Vote className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Activas</p>
                                </div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {daoState?.proposals?.active || 0}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* SIDEBAR */}
                    <aside className="lg:col-span-1">
                        <div className="sticky top-6 space-y-4">
                            {!isConnected ? (
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <div className="text-center">
                                        <Wallet className="w-12 h-12 mx-auto mb-4 text-purple-600 dark:text-purple-400" />
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Conecta tu Wallet</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                            Para votar y participar en la gobernanza
                                        </p>
                                        <ConnectWalletButton variant="primary" size="md" className="w-full" />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-md">
                                                <Wallet className="w-6 h-6 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Conectado</p>
                                                <p className="font-mono text-sm font-bold text-gray-900 dark:text-white">{shortAddress}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {/* 💰 Saldo BEZ disponible para votar */}
                                            <div className="bg-gradient-to-r from-cyan-900/20 to-blue-900/20 rounded-lg p-3 border border-cyan-500/30">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs text-cyan-400">Saldo BEZ Disponible</span>
                                                    <Wallet className="w-4 h-4 text-cyan-400" />
                                                </div>
                                                <p className="text-xl font-bold text-white">
                                                    {userBezBalance.toLocaleString()} BEZ
                                                </p>
                                                <p className="text-xs text-gray-400 mt-1">
                                                    ~€{(userBezBalance * BEZ_PRICE_EUR).toFixed(2)} | ${(userBezBalance * BEZ_PRICE_USD).toFixed(2)}
                                                </p>
                                            </div>

                                            {/* Info del precio de pool */}
                                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-100 dark:border-gray-600">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">Precio Pool BEZ/USDC</span>
                                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                                </div>
                                                <p className="text-lg font-bold text-gray-900 dark:text-white">
                                                    €{BEZ_PRICE_EUR} <span className="text-xs text-gray-500">/ BEZ</span>
                                                </p>
                                            </div>

                                            {/* Mínimo para votar */}
                                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-500/30">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Euro className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                    <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Mínimo para Votar</span>
                                                </div>
                                                <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                                                    €{MIN_VOTE_EUR} <span className="text-xs font-normal">({MIN_BEZ_REQUIRED} BEZ)</span>
                                                </p>
                                            </div>

                                            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-100 dark:border-gray-600">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">Votos Emitidos</span>
                                                    <Vote className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                                </div>
                                                <p className="text-xl font-bold text-gray-900 dark:text-white">
                                                    {userState?.votesParticipated || 0}
                                                </p>
                                            </div>

                                            {userBezBalance < MIN_BEZ_REQUIRED && (
                                                <button
                                                    onClick={() => handleBuyTokens(MIN_BEZ_REQUIRED - userBezBalance)}
                                                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                                >
                                                    <CreditCard className="w-5 h-5" />
                                                    Comprar {(MIN_BEZ_REQUIRED - userBezBalance).toFixed(0)} BEZ
                                                </button>
                                            )}

                                            {userState?.rewards > 0 && (
                                                <button
                                                    onClick={handleClaimRewards}
                                                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-md hover:shadow-lg"
                                                >
                                                    Reclamar Recompensas
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Acciones Rápidas</h4>
                                        <div className="space-y-2">
                                            <button
                                                onClick={handleCreateProposal}
                                                className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm text-gray-600 dark:text-gray-300"
                                            >
                                                <Plus className="w-4 h-4" />
                                                <span>Crear Propuesta</span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </aside>

                    {/* MAIN CONTENT */}
                    <main className="lg:col-span-3">
                        {/* Tabs */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-2 border border-gray-200 dark:border-gray-700 mb-6 shadow-sm">
                            <div className="flex gap-2 overflow-x-auto">
                                {[
                                    { id: 'resumen', label: 'Resumen', icon: BarChart3 },
                                    { id: 'propuestas', label: 'Propuestas', icon: Vote },
                                    { id: 'iniciativas', label: 'Iniciativas Estratégicas', icon: Lightbulb },
                                    { id: 'defi', label: 'DeFi Governance', icon: TrendingUp },
                                    { id: 'tesoreria', label: 'Tesorería', icon: DollarSign },
                                    { id: 'delegados', label: 'Delegados', icon: Users },
                                ].map((tab) => {
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            <Icon className="w-5 h-5" />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Content */}
                        {(loading || (activeTab === 'defi' && loadingDefi)) ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
                            </div>
                        ) : (
                            <>
                                {/* RESUMEN TAB */}
                                {activeTab === 'resumen' && (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-2" />
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{daoState?.proposals?.total || 0}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Propuestas Total</p>
                                            </div>
                                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mb-2" />
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{daoState?.proposals?.approved || 0}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Aprobadas</p>
                                            </div>
                                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                <Users className="w-6 h-6 text-purple-600 dark:text-purple-400 mb-2" />
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{daoState?.members?.active || 0}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Miembros Activos</p>
                                            </div>
                                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                <TrendingUp className="w-6 h-6 text-cyan-600 dark:text-cyan-400 mb-2" />
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{daoState?.members?.delegates || 0}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Delegados</p>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Propuestas Activas</h3>
                                            {proposals.filter(p => p.status === 'active').slice(0, 3).map((proposal) => (
                                                <div key={proposal._id} className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-600 last:mb-0">
                                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">{proposal.title}</h4>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{proposal.description.substring(0, 120)}...</p>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-500">
                                                            {new Date(proposal.endDate).toLocaleDateString()}
                                                        </span>
                                                        <button
                                                            onClick={() => setActiveTab('propuestas')}
                                                            className="text-purple-600 dark:text-purple-400 text-sm hover:text-purple-700 dark:hover:text-purple-300"
                                                        >
                                                            Ver más →
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* PROPUESTAS TAB */}
                                {activeTab === 'propuestas' && (
                                    <div className="space-y-4">
                                        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                                            <div className="flex flex-col md:flex-row gap-4">
                                                <div className="flex-1 relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                        placeholder="Buscar propuestas..."
                                                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg pl-10 pr-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    />
                                                </div>
                                                <select
                                                    value={filter}
                                                    onChange={(e) => setFilter(e.target.value)}
                                                    className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                >
                                                    <option value="all">Todas</option>
                                                    <option value="active">Activas</option>
                                                    <option value="approved">Aprobadas</option>
                                                    <option value="rejected">Rechazadas</option>
                                                    <option value="executed">Ejecutadas</option>
                                                </select>
                                            </div>
                                        </div>

                                        {filteredProposals.length === 0 ? (
                                            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                                                No hay propuestas disponibles
                                            </div>
                                        ) : (
                                            filteredProposals.map((proposal) => {
                                                const badge = getStatusBadge(proposal.status);
                                                const BadgeIcon = badge.icon;
                                                const totalVotes = (proposal.votesFor || 0) + (proposal.votesAgainst || 0);
                                                const votesForPercentage = getVotePercentage(proposal.votesFor, totalVotes);
                                                const votesAgainstPercentage = getVotePercentage(proposal.votesAgainst, totalVotes);

                                                return (
                                                    <div
                                                        key={proposal._id}
                                                        className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-500/50 transition-all shadow-sm"
                                                    >
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{proposal.title}</h3>
                                                                    <span className={`${badge.color} text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1`}>
                                                                        <BadgeIcon className="w-3 h-3" />
                                                                        {badge.label}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{proposal.description}</p>
                                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                                    <span className="flex items-center gap-1">
                                                                        <Clock className="w-3 h-3" />
                                                                        {new Date(proposal.endDate).toLocaleDateString()}
                                                                    </span>
                                                                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                                                                        {proposal.category || 'general'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {proposal.status === 'active' || totalVotes > 0 ? (
                                                            <div className="space-y-3 mb-4">
                                                                <div>
                                                                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                                        <span className="flex items-center gap-1">
                                                                            <ThumbsUp className="w-3 h-3 text-green-500" />
                                                                            A favor
                                                                        </span>
                                                                        <span className="text-gray-900 dark:text-white font-semibold">
                                                                            {(proposal.votesFor || 0).toLocaleString()} ({votesForPercentage}%)
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                                        <div
                                                                            className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all"
                                                                            style={{ width: `${votesForPercentage}%` }}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div>
                                                                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                                        <span className="flex items-center gap-1">
                                                                            <ThumbsDown className="w-3 h-3 text-red-500" />
                                                                            En contra
                                                                        </span>
                                                                        <span className="text-gray-900 dark:text-white font-semibold">
                                                                            {(proposal.votesAgainst || 0).toLocaleString()} ({votesAgainstPercentage}%)
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                                        <div
                                                                            className="bg-gradient-to-r from-red-500 to-pink-500 h-2 rounded-full transition-all"
                                                                            style={{ width: `${votesAgainstPercentage}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : null}

                                                        {proposal.status === 'active' && isConnected ? (
                                                            <div className="space-y-4">
                                                                {/* 💰 Input de Contribución Pay-to-Vote */}
                                                                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                                                                    <div className="flex items-center justify-between mb-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <Euro className="w-4 h-4 text-purple-500" />
                                                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tu Contribución para Votar</span>
                                                                        </div>
                                                                        <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-full">
                                                                            Mín: €{MIN_VOTE_EUR} ({MIN_BEZ_REQUIRED} BEZ)
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex gap-3 items-center">
                                                                        <div className="flex-1 relative">
                                                                            <input
                                                                                type="number"
                                                                                min={MIN_BEZ_REQUIRED}
                                                                                step="10"
                                                                                value={contributionAmounts[proposal._id] || MIN_BEZ_REQUIRED}
                                                                                onChange={(e) => handleContributionChange(proposal._id, e.target.value)}
                                                                                className={`w-full border rounded-lg px-4 py-3 text-lg font-bold outline-none transition-all ${userBezBalance < (contributionAmounts[proposal._id] || MIN_BEZ_REQUIRED)
                                                                                    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400'
                                                                                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:border-purple-500'
                                                                                    }`}
                                                                            />
                                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-bold">BEZ</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center justify-between mt-2">
                                                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                                                            ~€{((contributionAmounts[proposal._id] || MIN_BEZ_REQUIRED) * BEZ_PRICE_EUR).toFixed(2)}
                                                                        </span>
                                                                        <span className="text-xs text-gray-400">
                                                                            Tu saldo: <span className={userBezBalance >= (contributionAmounts[proposal._id] || MIN_BEZ_REQUIRED) ? 'text-green-500' : 'text-red-500'}>{userBezBalance.toLocaleString()} BEZ</span>
                                                                        </span>
                                                                    </div>

                                                                    {/* Alerta de saldo insuficiente + Compra rápida */}
                                                                    {userBezBalance < (contributionAmounts[proposal._id] || MIN_BEZ_REQUIRED) && (
                                                                        <div className="mt-3 flex items-center justify-between bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-500/30">
                                                                            <div className="flex items-center gap-2">
                                                                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                                                                <span className="text-sm text-red-600 dark:text-red-400">
                                                                                    Te faltan {((contributionAmounts[proposal._id] || MIN_BEZ_REQUIRED) - userBezBalance).toFixed(0)} BEZ
                                                                                </span>
                                                                            </div>
                                                                            <button
                                                                                onClick={() => handleBuyTokens((contributionAmounts[proposal._id] || MIN_BEZ_REQUIRED) - userBezBalance)}
                                                                                className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
                                                                            >
                                                                                <CreditCard className="w-4 h-4" />
                                                                                Comprar Tokens
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Botones de Voto */}
                                                                <div className="flex gap-3">
                                                                    <button
                                                                        onClick={() => handleVote(proposal._id, true)}
                                                                        disabled={userBezBalance < (contributionAmounts[proposal._id] || MIN_BEZ_REQUIRED)}
                                                                        className={`flex-1 font-medium py-3 rounded-lg transition-all border flex items-center justify-center gap-2 ${userBezBalance >= (contributionAmounts[proposal._id] || MIN_BEZ_REQUIRED)
                                                                            ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/30'
                                                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                                                                            }`}
                                                                    >
                                                                        <ThumbsUp className="w-4 h-4" />
                                                                        Votar a Favor
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleVote(proposal._id, false)}
                                                                        disabled={userBezBalance < (contributionAmounts[proposal._id] || MIN_BEZ_REQUIRED)}
                                                                        className={`flex-1 font-medium py-3 rounded-lg transition-all border flex items-center justify-center gap-2 ${userBezBalance >= (contributionAmounts[proposal._id] || MIN_BEZ_REQUIRED)
                                                                            ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30'
                                                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                                                                            }`}
                                                                    >
                                                                        <ThumbsDown className="w-4 h-4" />
                                                                        Votar en Contra
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : proposal.status === 'active' && !isConnected ? (
                                                            <div className="text-center py-3 text-gray-500 dark:text-gray-400 text-sm">
                                                                Conecta tu wallet para votar
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}

                                {/* INICIATIVAS ESTRATÉGICAS TAB */}
                                {activeTab === 'iniciativas' && (
                                    <div className="space-y-6">
                                        {/* Header */}
                                        <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-2xl p-6 border border-purple-500/20">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
                                                    <Lightbulb className="w-7 h-7 text-white" />
                                                </div>
                                                <div>
                                                    <h2 className="text-2xl font-bold text-white">Iniciativas Estratégicas de Desarrollo</h2>
                                                    <p className="text-gray-400">Vota para definir las prioridades de desarrollo Web3 + IA + IoT por sector</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                                                    <p className="text-xs text-gray-400">Sectores Activos</p>
                                                    <p className="text-xl font-bold text-white">{strategicInitiatives.length}</p>
                                                </div>
                                                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                                                    <p className="text-xs text-gray-400">Votos Totales</p>
                                                    <p className="text-xl font-bold text-white">
                                                        {strategicInitiatives.reduce((acc, i) => acc + i.votesFor + i.votesAgainst, 0).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                                                    <p className="text-xs text-gray-400">Participantes</p>
                                                    <p className="text-xl font-bold text-white">
                                                        {strategicInitiatives.reduce((acc, i) => acc + i.totalVoters, 0).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                                                    <p className="text-xs text-gray-400">Prioridad Crítica</p>
                                                    <p className="text-xl font-bold text-red-400">
                                                        {strategicInitiatives.filter(i => i.priority === 'critical').length}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Initiatives List */}
                                        {strategicInitiatives.map((initiative, index) => {
                                            const Icon = initiative.icon;
                                            const totalVotes = initiative.votesFor + initiative.votesAgainst;
                                            const forPercentage = totalVotes > 0 ? ((initiative.votesFor / totalVotes) * 100).toFixed(1) : 0;
                                            const againstPercentage = totalVotes > 0 ? ((initiative.votesAgainst / totalVotes) * 100).toFixed(1) : 0;
                                            const priorityBadge = getPriorityBadge(initiative.priority);
                                            const isExpanded = expandedInitiative === initiative.id;

                                            return (
                                                <motion.div
                                                    key={initiative.id}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.1 }}
                                                    className={`bg-gradient-to-br ${initiative.bgColor} rounded-2xl border ${initiative.borderColor} overflow-hidden`}
                                                >
                                                    {/* Initiative Header */}
                                                    <div className="p-6">
                                                        <div className="flex items-start justify-between mb-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${initiative.color} flex items-center justify-center shadow-lg`}>
                                                                    <Icon className="w-7 h-7 text-white" />
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <h3 className="text-xl font-bold text-white">{initiative.sector}</h3>
                                                                        <span className={`${priorityBadge.color} text-white text-xs font-medium px-2 py-0.5 rounded-full`}>
                                                                            {priorityBadge.label}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-sm text-gray-400">{initiative.developmentType}</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => toggleInitiativeDetails(initiative.id)}
                                                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                            >
                                                                {isExpanded ? (
                                                                    <ChevronUp className="w-5 h-5 text-gray-400" />
                                                                ) : (
                                                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                                                )}
                                                            </button>
                                                        </div>

                                                        {/* Quick Stats */}
                                                        <div className="grid grid-cols-3 gap-3 mb-4">
                                                            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <DollarSign className="w-4 h-4 text-green-400" />
                                                                    <span className="text-xs text-gray-400">Costo Estimado</span>
                                                                </div>
                                                                <p className="text-sm font-semibold text-white">{initiative.estimatedCost}</p>
                                                            </div>
                                                            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <Timer className="w-4 h-4 text-blue-400" />
                                                                    <span className="text-xs text-gray-400">Tiempo</span>
                                                                </div>
                                                                <p className="text-sm font-semibold text-white">{initiative.developmentTime}</p>
                                                            </div>
                                                            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <Users className="w-4 h-4 text-purple-400" />
                                                                    <span className="text-xs text-gray-400">Votantes</span>
                                                                </div>
                                                                <p className="text-sm font-semibold text-white">{initiative.totalVoters.toLocaleString()}</p>
                                                            </div>
                                                        </div>

                                                        {/* Expanded Details */}
                                                        <AnimatePresence>
                                                            {isExpanded && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, height: 0 }}
                                                                    animate={{ opacity: 1, height: 'auto' }}
                                                                    exit={{ opacity: 0, height: 0 }}
                                                                    className="mb-4 space-y-3"
                                                                >
                                                                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <Globe className="w-4 h-4 text-cyan-400" />
                                                                            <span className="text-sm font-medium text-white">Escalabilidad</span>
                                                                        </div>
                                                                        <p className="text-sm text-gray-300">{initiative.scalability}</p>
                                                                    </div>
                                                                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <Cpu className="w-4 h-4 text-pink-400" />
                                                                            <span className="text-sm font-medium text-white">Enfoque I+D e IoT</span>
                                                                        </div>
                                                                        <p className="text-sm text-gray-300">{initiative.rdFocus}</p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                                                        <Clock className="w-3 h-3" />
                                                                        <span>Votación termina: {new Date(initiative.endDate).toLocaleDateString('es-ES', {
                                                                            weekday: 'long',
                                                                            year: 'numeric',
                                                                            month: 'long',
                                                                            day: 'numeric'
                                                                        })}</span>
                                                                    </div>
                                                                    {/* Link to detailed fund page if available */}
                                                                    {initiative.detailsLink && (
                                                                        <Link
                                                                            to={initiative.detailsLink}
                                                                            className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 rounded-lg text-purple-300 hover:text-white hover:bg-purple-500/30 transition-all text-sm font-medium group"
                                                                        >
                                                                            <ExternalLink className="w-4 h-4" />
                                                                            Ver detalles completos del fondo
                                                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                                                        </Link>
                                                                    )}
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>

                                                        {/* Voting Progress */}
                                                        <div className="space-y-3 mb-4">
                                                            <div>
                                                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                                    <span className="flex items-center gap-1">
                                                                        <ThumbsUp className="w-3 h-3 text-green-400" />
                                                                        A favor del desarrollo
                                                                    </span>
                                                                    <span className="text-white font-semibold">
                                                                        {initiative.votesFor.toLocaleString()} BEZ ({forPercentage}%)
                                                                    </span>
                                                                </div>
                                                                <div className="w-full bg-gray-700/50 rounded-full h-3">
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${forPercentage}%` }}
                                                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                                                        className="bg-gradient-to-r from-green-500 to-emerald-400 h-3 rounded-full"
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                                    <span className="flex items-center gap-1">
                                                                        <ThumbsDown className="w-3 h-3 text-red-400" />
                                                                        En contra
                                                                    </span>
                                                                    <span className="text-white font-semibold">
                                                                        {initiative.votesAgainst.toLocaleString()} BEZ ({againstPercentage}%)
                                                                    </span>
                                                                </div>
                                                                <div className="w-full bg-gray-700/50 rounded-full h-3">
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: `${againstPercentage}%` }}
                                                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                                                        className="bg-gradient-to-r from-red-500 to-pink-400 h-3 rounded-full"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* 💰 Input de Contribución Pay-to-Vote para Iniciativas */}
                                                        {initiative.status === 'active' && isConnected && (
                                                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-4">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <Euro className="w-4 h-4 text-cyan-400" />
                                                                        <span className="text-sm font-medium text-white">Tu Aporte de Prioridad</span>
                                                                    </div>
                                                                    <span className="text-xs bg-cyan-900/50 text-cyan-400 px-2 py-1 rounded-full border border-cyan-500/30">
                                                                        Mín: €{MIN_VOTE_EUR}
                                                                    </span>
                                                                </div>

                                                                <div className="flex gap-3 items-center">
                                                                    <div className="flex-1 relative">
                                                                        <input
                                                                            type="number"
                                                                            min={MIN_BEZ_REQUIRED}
                                                                            step="50"
                                                                            value={contributionAmounts[initiative.id] || MIN_BEZ_REQUIRED}
                                                                            onChange={(e) => handleContributionChange(initiative.id, e.target.value)}
                                                                            className={`w-full rounded-lg px-4 py-3 text-lg font-bold outline-none transition-all border ${userBezBalance < (contributionAmounts[initiative.id] || MIN_BEZ_REQUIRED)
                                                                                ? 'bg-red-900/20 border-red-500/50 text-red-400'
                                                                                : 'bg-gray-900/50 border-gray-600 text-white focus:border-cyan-500'
                                                                                }`}
                                                                        />
                                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">BEZ</span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center justify-between mt-2">
                                                                    <span className="text-sm text-gray-400">
                                                                        ~€{((contributionAmounts[initiative.id] || MIN_BEZ_REQUIRED) * BEZ_PRICE_EUR).toFixed(2)}
                                                                    </span>
                                                                    <span className="text-xs text-gray-500">
                                                                        Saldo: <span className={userBezBalance >= (contributionAmounts[initiative.id] || MIN_BEZ_REQUIRED) ? 'text-green-400' : 'text-red-400'}>{userBezBalance.toLocaleString()} BEZ</span>
                                                                    </span>
                                                                </div>

                                                                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                                                    <Lightbulb className="w-3 h-3" />
                                                                    A mayor contribución, mayor peso tendrá tu voto en la priorización del desarrollo.
                                                                </p>

                                                                {/* Alerta de saldo insuficiente + Compra rápida */}
                                                                {userBezBalance < (contributionAmounts[initiative.id] || MIN_BEZ_REQUIRED) && (
                                                                    <div className="mt-3 flex items-center justify-between bg-red-900/20 p-3 rounded-lg border border-red-500/30">
                                                                        <div className="flex items-center gap-2">
                                                                            <AlertTriangle className="w-4 h-4 text-red-400" />
                                                                            <span className="text-sm text-red-400">
                                                                                Te faltan {((contributionAmounts[initiative.id] || MIN_BEZ_REQUIRED) - userBezBalance).toFixed(0)} BEZ
                                                                            </span>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleBuyTokens((contributionAmounts[initiative.id] || MIN_BEZ_REQUIRED) - userBezBalance)}
                                                                            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
                                                                        >
                                                                            <CreditCard className="w-4 h-4" />
                                                                            Comprar Tokens
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Voting Buttons */}
                                                        {initiative.status === 'active' && isConnected ? (
                                                            <div className="flex gap-3">
                                                                <button
                                                                    onClick={() => handleInitiativeVote(initiative.id, true)}
                                                                    disabled={userBezBalance < (contributionAmounts[initiative.id] || MIN_BEZ_REQUIRED)}
                                                                    className={`flex-1 font-semibold py-3 rounded-xl transition-all border flex items-center justify-center gap-2 ${userBezBalance >= (contributionAmounts[initiative.id] || MIN_BEZ_REQUIRED)
                                                                        ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/30'
                                                                        : 'bg-gray-800/50 text-gray-500 border-gray-700 cursor-not-allowed'
                                                                        }`}
                                                                >
                                                                    <ThumbsUp className="w-5 h-5" />
                                                                    Apoyar Desarrollo
                                                                </button>
                                                                <button
                                                                    onClick={() => handleInitiativeVote(initiative.id, false)}
                                                                    disabled={userBezBalance < (contributionAmounts[initiative.id] || MIN_BEZ_REQUIRED)}
                                                                    className={`flex-1 font-semibold py-3 rounded-xl transition-all border flex items-center justify-center gap-2 ${userBezBalance >= (contributionAmounts[initiative.id] || MIN_BEZ_REQUIRED)
                                                                        ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30'
                                                                        : 'bg-gray-800/50 text-gray-500 border-gray-700 cursor-not-allowed'
                                                                        }`}
                                                                >
                                                                    <ThumbsDown className="w-5 h-5" />
                                                                    No Priorizar
                                                                </button>
                                                            </div>
                                                        ) : initiative.status === 'active' && !isConnected ? (
                                                            <div className="text-center py-3 bg-white/5 rounded-xl border border-white/10">
                                                                <p className="text-gray-400 text-sm">Conecta tu wallet para votar en esta iniciativa</p>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}

                                        {/* Summary Card */}
                                        <div className="bg-gradient-to-r from-cyan-900/20 to-blue-900/20 rounded-2xl p-6 border border-cyan-500/20">
                                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                                <BarChart3 className="w-5 h-5 text-cyan-400" />
                                                Resumen de Consenso
                                            </h3>
                                            <div className="space-y-3">
                                                {[...strategicInitiatives]
                                                    .sort((a, b) => (b.votesFor - b.votesAgainst) - (a.votesFor - a.votesAgainst))
                                                    .map((initiative, index) => {
                                                        const Icon = initiative.icon;
                                                        const netVotes = initiative.votesFor - initiative.votesAgainst;
                                                        return (
                                                            <div key={initiative.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                                                                <div className="flex items-center gap-3">
                                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-500 text-black' :
                                                                        index === 1 ? 'bg-gray-400 text-black' :
                                                                            index === 2 ? 'bg-amber-700 text-white' :
                                                                                'bg-gray-600 text-white'
                                                                        }`}>
                                                                        {index + 1}
                                                                    </span>
                                                                    <Icon className={`w-5 h-5 bg-gradient-to-br ${initiative.color} bg-clip-text`} style={{ color: 'transparent', background: `linear-gradient(to bottom right, var(--tw-gradient-stops))`, backgroundClip: 'text', WebkitBackgroundClip: 'text' }} />
                                                                    <span className="text-white font-medium">{initiative.sector}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-sm font-bold ${netVotes >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {netVotes >= 0 ? '+' : ''}{netVotes.toLocaleString()} BEZ
                                                                    </span>
                                                                    {netVotes >= 0 ? (
                                                                        <ArrowUpRight className="w-4 h-4 text-green-400" />
                                                                    ) : (
                                                                        <ArrowDownRight className="w-4 h-4 text-red-400" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* DEFI TAB */}
                                {activeTab === 'defi' && (
                                    <div className="space-y-6">
                                        {/* DeFi Analytics */}
                                        {defiAnalytics && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 border border-blue-500/20 rounded-xl p-6"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                                            <BarChart3 className="w-5 h-5 text-blue-400" />
                                                        </div>
                                                        <span className="text-xs text-blue-400 font-medium">Total</span>
                                                    </div>
                                                    <div className="text-3xl font-bold text-white mb-1">
                                                        {defiAnalytics.totalProposals}
                                                    </div>
                                                    <div className="text-sm text-gray-400">Propuestas DeFi</div>
                                                </motion.div>

                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.1 }}
                                                    className="bg-gradient-to-br from-green-900/20 to-green-800/10 border border-green-500/20 rounded-xl p-6"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                                            <Activity className="w-5 h-5 text-green-400" />
                                                        </div>
                                                        <span className="text-xs text-green-400 font-medium">Active</span>
                                                    </div>
                                                    <div className="text-3xl font-bold text-white mb-1">
                                                        {defiAnalytics.activeProposals}
                                                    </div>
                                                    <div className="text-sm text-gray-400">En votación</div>
                                                </motion.div>

                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.2 }}
                                                    className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-500/20 rounded-xl p-6"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                                            <DollarSign className="w-5 h-5 text-purple-400" />
                                                        </div>
                                                        <span className="text-xs text-purple-400 font-medium">Asignado</span>
                                                    </div>
                                                    <div className="text-3xl font-bold text-white mb-1">
                                                        {defiAnalytics.treasuryImpact?.totalAllocated?.toLocaleString() || 0}
                                                    </div>
                                                    <div className="text-sm text-gray-400">BEZ Tokens</div>
                                                </motion.div>

                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.3 }}
                                                    className="bg-gradient-to-br from-orange-900/20 to-orange-800/10 border border-orange-500/20 rounded-xl p-6"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                                            <TrendingUp className="w-5 h-5 text-orange-400" />
                                                        </div>
                                                        <div className="flex items-center gap-1 text-xs text-green-400 font-medium">
                                                            <ArrowUpRight className="w-3 h-3" />
                                                            +15%
                                                        </div>
                                                    </div>
                                                    <div className="text-3xl font-bold text-white mb-1">
                                                        {defiAnalytics.poolsImpact?.totalTVLIncrease || '+0'}
                                                    </div>
                                                    <div className="text-sm text-gray-400">TVL Impact</div>
                                                </motion.div>
                                            </div>
                                        )}

                                        {/* Treasury & Pools */}
                                        {poolsStatus && (
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Balance Tesorería</h3>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                            <span className="text-gray-600 dark:text-gray-400">BEZ</span>
                                                            <span className="text-xl font-bold text-gray-900 dark:text-white">
                                                                {poolsStatus.treasury?.BEZ?.toLocaleString() || 0}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                            <span className="text-gray-600 dark:text-gray-400">USDC</span>
                                                            <span className="text-xl font-bold text-gray-900 dark:text-white">
                                                                ${poolsStatus.treasury?.USDC?.toLocaleString() || 0}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                            <span className="text-gray-600 dark:text-gray-400">ETH</span>
                                                            <span className="text-xl font-bold text-gray-900 dark:text-white">
                                                                {poolsStatus.treasury?.ETH || 0}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pools Activos</h3>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {poolsStatus.staking?.map((pool, index) => (
                                                            <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-sm text-gray-600 dark:text-gray-400">{pool.poolId}</span>
                                                                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                                                                        {pool.apy}% APY
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    TVL: {pool.totalStaked?.toLocaleString() || 0} BEZ
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {poolsStatus.farming?.slice(0, 2).map((pool, index) => (
                                                            <div key={`farm-${index}`} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                                        {pool.type === 'LP' ? `${pool.token0}/${pool.token1}` : pool.poolId}
                                                                    </span>
                                                                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                                                        Farming
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    Rewards: {pool.dailyRewards?.toFixed(2) || 0} {pool.token}/día
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* DeFi Analytics Simple */}
                                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Analytics DeFi</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">Próximamente: Dashboard completo de integraciones DeFi</p>
                                        </div>
                                    </div>
                                )}

                                {/* TESORERIA TAB */}
                                {activeTab === 'tesoreria' && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">USDC</p>
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                    ${(daoState?.treasury?.usdcBalance || 0).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">BEZ</p>
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                    {(daoState?.treasury?.totalBEZ || 0).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">ETH</p>
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                    {(daoState?.treasury?.ethBalance || 0).toFixed(2)}
                                                </p>
                                            </div>
                                            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total USD</p>
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                    ${((daoState?.treasury?.totalUSD || 0) / 1000000).toFixed(2)}M
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Transacciones Recientes</h3>
                                            {treasuryTransactions.slice(0, 10).map((tx, index) => (
                                                <div key={index} className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                                    <div>
                                                        <p className="text-gray-900 dark:text-white font-medium">{tx.description || tx.type}</p>
                                                        <p className="text-xs text-gray-500">
                                                            {new Date(tx.createdAt).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`font-semibold ${tx.type === 'deposit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                            {tx.type === 'deposit' ? '+' : '-'}{tx.amount} {tx.token}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* DELEGADOS TAB */}
                                {activeTab === 'delegados' && (
                                    <div className="space-y-4">
                                        {delegates.slice(0, 20).map((delegate, index) => (
                                            <div
                                                key={delegate.address}
                                                className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-500/50 transition-all shadow-sm"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
                                                            #{index + 1}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-gray-900 dark:text-white">{delegate.username || 'Unknown'}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                                {delegate.address.slice(0, 6)}...{delegate.address.slice(-4)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                                                            {(delegate.totalVotingPower || 0).toLocaleString()} BEZ
                                                        </p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            {delegate.delegators?.length || 0} delegadores
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </main>
                </div>
            </div>

            {/* MODAL OPTIMIZADO */}
            <BuyBezCoinModal isOpen={showBuyModal} onClose={() => {}} />
        </div>
    );
};

export default DAOPage;
