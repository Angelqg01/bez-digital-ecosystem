import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ⚙️ MODO MOCK: Cambiar a false cuando el backend esté funcionando
const MOCK_MODE = true;

// 📋 Datos mock de las 4 propuestas DAO
const mockProposals = [
    {
        _id: '1',
        title: 'Aumentar recompensas por contenido verificado',
        description: 'Propuesta para incrementar en un 25% las recompensas para creadores que verifican contenido mediante blockchain. Esto incentivará la creación de contenido de calidad y aumentará la participación en la plataforma.',
        category: 'treasury',
        creator: '0x1234567890abcdef1234567890abcdef12345678',
        status: 'active',
        startDate: new Date('2025-11-20'),
        endDate: new Date('2025-11-25'),
        votesFor: 1245000,
        votesAgainst: 234000,
        totalVotes: 1479000,
        voters: [],
        actions: [{ type: 'updateSettings', target: 'rewards.contentCreation', value: '1.25', data: { multiplier: 1.25 } }]
    },
    {
        _id: '2',
        title: 'Implementar sistema de moderación descentralizada',
        description: 'Crear un sistema de jurados aleatorios usando NFTs para moderar contenido reportado. Los jurados serán seleccionados de holders de NFTs especiales y recibirán recompensas por participar.',
        category: 'governance',
        creator: '0x1234567890abcdef1234567890abcdef12345678',
        status: 'active',
        startDate: new Date('2025-11-20'),
        endDate: new Date('2025-11-27'),
        votesFor: 890000,
        votesAgainst: 567000,
        totalVotes: 1457000,
        voters: [],
        actions: [{ type: 'custom', target: 'moderation.system', value: 'decentralized-jury', data: { jurySize: 5, requiredNFT: 'ModeratorBadge' } }]
    },
    {
        _id: '3',
        title: 'Financiar hackathon de desarrolladores Q1 2026',
        description: 'Asignar 50,000 USDC de la tesorería para premios del hackathon y atracción de talento. El evento se enfocará en construir dApps sobre nuestra infraestructura.',
        category: 'development',
        creator: '0x1234567890abcdef1234567890abcdef12345678',
        status: 'active',
        startDate: new Date('2025-11-20'),
        endDate: new Date('2025-11-23'),
        votesFor: 2100000,
        votesAgainst: 150000,
        totalVotes: 2250000,
        voters: [],
        actions: [{ type: 'transfer', target: '0xHackathonWallet123456789', value: '50000', data: { token: 'USDC', purpose: 'Q1 2026 Hackathon' } }]
    },
    {
        _id: '4',
        title: 'Reducir comisión de marketplace al 1.5%',
        description: 'Propuesta para reducir la comisión del marketplace NFT del 2.5% al 1.5% para aumentar volumen de transacciones y competitividad con otras plataformas.',
        category: 'protocol',
        creator: '0x1234567890abcdef1234567890abcdef12345678',
        status: 'approved',
        startDate: new Date('2025-11-10'),
        endDate: new Date('2025-11-17'),
        votesFor: 3400000,
        votesAgainst: 890000,
        totalVotes: 4290000,
        voters: [],
        actions: [{ type: 'updateSettings', target: 'marketplace.fee', value: '1.5', data: { newFee: 1.5, oldFee: 2.5 } }]
    }
];

const mockState = {
    treasury: {
        totalUSD: 1000000,
        totalBEZ: 5000000,
        ethBalance: 100,
        usdcBalance: 1000000,
        assets: [
            { token: 'USDC', amount: 1000000 },
            { token: 'BEZ', amount: 5000000 },
            { token: 'ETH', amount: 100 }
        ]
    },
    members: { total: 1250, active: 876, delegates: 2 },
    proposals: { active: 3, approved: 1, rejected: 0, total: 4 },
    settings: {
        quorumPercentage: 10,
        votingPeriodDays: 7,
        proposalThreshold: 100000,
        allowDelegation: true,
        maxDelegations: 100,
        rewardPerVote: 10
    }
};

const DAOContext = createContext();

export const useDAO = () => {
    const context = useContext(DAOContext);
    if (!context) {
        throw new Error('useDAO must be used within a DAOProvider');
    }
    return context;
};

export const DAOProvider = ({ children }) => {
    const { address, isConnected } = useAccount();

    // Estado de la DAO
    const [daoState, setDaoState] = useState({
        treasury: {
            totalUSD: 0,
            totalBEZ: 0,
            ethBalance: 0,
            usdcBalance: 0,
            assets: [],
        },
        members: {
            total: 0,
            active: 0,
            delegates: 0,
        },
        proposals: {
            active: 0,
            approved: 0,
            rejected: 0,
            total: 0,
        },
        settings: {
            quorumPercentage: 10,
            votingPeriodDays: 7,
            proposalThreshold: 100000,
            allowDelegation: true,
        },
    });

    // Estado del usuario
    const [userState, setUserState] = useState({
        votingPower: 0,
        delegatedTo: null,
        delegations: [],
        rewards: 0,
        votingHistory: [],
        proposalsCreated: [],
    });

    // Propuestas
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(false);

    // Delegados
    const [delegates, setDelegates] = useState([]);

    // Transacciones de tesorería
    const [treasuryTransactions, setTreasuryTransactions] = useState([]);

    // 🔄 Cargar datos de la DAO
    const fetchDAOData = useCallback(async () => {
        try {
            setLoading(true);

            if (MOCK_MODE) {
                // Usar datos mock
                setDaoState(mockState);
                setLoading(false);
                return;
            }

            const response = await axios.get(`${API_URL}/api/dao/state`);
            setDaoState(response.data);
        } catch (error) {
            console.error('Error fetching DAO data:', error);
            toast.error('Error al cargar datos de la DAO');
        } finally {
            setLoading(false);
        }
    }, []);

    // 📋 Cargar propuestas
    const fetchProposals = useCallback(async (filter = 'all') => {
        try {
            if (MOCK_MODE) {
                // Filtrar propuestas mock
                if (filter === 'all') {
                    setProposals(mockProposals);
                } else {
                    setProposals(mockProposals.filter(p => p.status === filter));
                }
                return;
            }

            const response = await axios.get(`${API_URL}/api/dao/proposals`, {
                params: { filter }
            });
            setProposals(response.data);
        } catch (error) {
            console.error('Error fetching proposals:', error);
            toast.error('Error al cargar propuestas');
        }
    }, []);

    // 👥 Cargar delegados
    const fetchDelegates = useCallback(async () => {
        try {
            if (MOCK_MODE) {
                // Usar delegados mock
                setDelegates([
                    {
                        address: '0xabcdef1234567890abcdef1234567890abcdef12',
                        username: 'MegaVoter',
                        avatar: null,
                        delegators: ['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222'],
                        totalVotingPower: 350000,
                        votesCount: 45,
                        participationRate: 0.95
                    },
                    {
                        address: '0x9876543210fedcba9876543210fedcba98765432',
                        username: 'DAOLeader',
                        avatar: null,
                        delegators: ['0x3333333333333333333333333333333333333333'],
                        totalVotingPower: 280000,
                        votesCount: 38,
                        participationRate: 0.88
                    }
                ]);
                return;
            }

            const response = await axios.get(`${API_URL}/api/dao/delegates`);
            setDelegates(response.data);
        } catch (error) {
            console.error('Error fetching delegates:', error);
        }
    }, []);

    // 💰 Cargar transacciones de tesorería
    const fetchTreasuryTransactions = useCallback(async () => {
        try {
            if (MOCK_MODE) {
                // Usar transacciones mock
                setTreasuryTransactions([
                    {
                        _id: 't1',
                        type: 'deposit',
                        token: 'USDC',
                        amount: 1000000,
                        description: 'Fondos iniciales de la tesorería',
                        status: 'completed',
                        createdAt: new Date('2025-11-20')
                    },
                    {
                        _id: 't2',
                        type: 'deposit',
                        token: 'BEZ',
                        amount: 5000000,
                        description: 'Asignación de tokens BEZ',
                        status: 'completed',
                        createdAt: new Date('2025-11-20')
                    },
                    {
                        _id: 't3',
                        type: 'deposit',
                        token: 'ETH',
                        amount: 100,
                        description: 'Reserva de ETH',
                        status: 'completed',
                        createdAt: new Date('2025-11-20')
                    }
                ]);
                return;
            }
            const response = await axios.get(`${API_URL}/api/dao/treasury/transactions`);
            setTreasuryTransactions(response.data);
        } catch (error) {
            console.error('Error fetching treasury transactions:', error);
        }
    }, []);

    // 👤 Cargar datos del usuario
    const fetchUserData = useCallback(async () => {
        if (!isConnected || !address) return;

        try {
            const response = await axios.get(`${API_URL}/dao/user/${address}`);
            setUserState(response.data);
        } catch (error) {
            // Silenciar error 500 del backend si el endpoint no existe
            if (error?.response?.status === 500 && import.meta.env.DEV) {
                console.warn('⚠️ DAO endpoint not available, using fallback data');
            } else if (import.meta.env.DEV) {
                console.error('Error fetching user data:', error);
            }
            // Fallback data
            setUserState({ votingPower: 0, proposalsCreated: 0, votescast: 0 });
        }
    }, [address, isConnected]);

    // 🗳️ Votar en una propuesta
    const voteOnProposal = useCallback(async (proposalId, support) => {
        if (!isConnected || !address) {
            toast.error('Conecta tu wallet para votar');
            return false;
        }

        try {
            const response = await axios.post(`${API_URL}/api/dao/proposals/${proposalId}/vote`, {
                voter: address,
                support,
            });

            toast.success(`Voto ${support ? 'a favor' : 'en contra'} registrado`);

            // Actualizar propuestas
            await fetchProposals();
            await fetchUserData();

            return true;
        } catch (error) {
            console.error('Error voting:', error);
            toast.error(error.response?.data?.error || 'Error al votar');
            return false;
        }
    }, [address, isConnected, fetchProposals, fetchUserData]);

    // ✍️ Crear propuesta
    const createProposal = useCallback(async (proposalData) => {
        if (!isConnected || !address) {
            toast.error('Conecta tu wallet para crear propuestas');
            return false;
        }

        try {
            const response = await axios.post(`${API_URL}/api/dao/proposals`, {
                ...proposalData,
                creator: address,
            });

            toast.success('Propuesta creada exitosamente');
            await fetchProposals();

            return response.data;
        } catch (error) {
            console.error('Error creating proposal:', error);
            toast.error(error.response?.data?.error || 'Error al crear propuesta');
            return false;
        }
    }, [address, isConnected, fetchProposals]);

    // 🔄 Delegar votos
    const delegateVotes = useCallback(async (delegateAddress) => {
        if (!isConnected || !address) {
            toast.error('Conecta tu wallet para delegar');
            return false;
        }

        try {
            await axios.post(`${API_URL}/api/dao/delegate`, {
                delegator: address,
                delegate: delegateAddress,
            });

            toast.success('Votos delegados exitosamente');
            await fetchUserData();
            await fetchDelegates();

            return true;
        } catch (error) {
            console.error('Error delegating:', error);
            toast.error(error.response?.data?.error || 'Error al delegar votos');
            return false;
        }
    }, [address, isConnected, fetchUserData, fetchDelegates]);

    // 🎁 Reclamar recompensas
    const claimRewards = useCallback(async () => {
        if (!isConnected || !address) {
            toast.error('Conecta tu wallet para reclamar');
            return false;
        }

        try {
            const response = await axios.post(`${API_URL}/api/dao/rewards/claim`, {
                address,
            });

            toast.success(`${response.data.amount} BEZ reclamados`);
            await fetchUserData();

            return true;
        } catch (error) {
            console.error('Error claiming rewards:', error);
            toast.error(error.response?.data?.error || 'Error al reclamar recompensas');
            return false;
        }
    }, [address, isConnected, fetchUserData]);

    // ⚙️ Actualizar configuración de la DAO (solo admin)
    const updateDAOSettings = useCallback(async (settings) => {
        if (!isConnected || !address) {
            toast.error('Conecta tu wallet');
            return false;
        }

        try {
            await axios.put(`${API_URL}/api/dao/settings`, {
                ...settings,
                updatedBy: address,
            });

            toast.success('Configuración actualizada');
            await fetchDAOData();

            return true;
        } catch (error) {
            console.error('Error updating settings:', error);
            toast.error(error.response?.data?.error || 'Error al actualizar configuración');
            return false;
        }
    }, [address, isConnected, fetchDAOData]);

    // 🚀 Ejecutar propuesta aprobada (solo admin)
    const executeProposal = useCallback(async (proposalId) => {
        if (!isConnected || !address) {
            toast.error('Conecta tu wallet');
            return false;
        }

        try {
            await axios.post(`${API_URL}/api/dao/proposals/${proposalId}/execute`, {
                executor: address,
            });

            toast.success('Propuesta ejecutada exitosamente');
            await fetchProposals();

            return true;
        } catch (error) {
            console.error('Error executing proposal:', error);
            toast.error(error.response?.data?.error || 'Error al ejecutar propuesta');
            return false;
        }
    }, [address, isConnected, fetchProposals]);

    // 📊 Obtener estadísticas
    const getStatistics = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/api/dao/statistics`);
            return response.data;
        } catch (error) {
            console.error('Error fetching statistics:', error);
            return null;
        }
    }, []);

    // Cargar datos iniciales
    useEffect(() => {
        fetchDAOData();
        fetchProposals();
        fetchDelegates();
        fetchTreasuryTransactions();
    }, [fetchDAOData, fetchProposals, fetchDelegates, fetchTreasuryTransactions]);

    // Cargar datos del usuario cuando conecta
    useEffect(() => {
        if (isConnected && address) {
            fetchUserData();
        } else {
            setUserState({
                votingPower: 0,
                delegatedTo: null,
                delegations: [],
                rewards: 0,
                votingHistory: [],
                proposalsCreated: [],
            });
        }
    }, [isConnected, address, fetchUserData]);

    const value = {
        // Estado
        daoState,
        userState,
        proposals,
        delegates,
        treasuryTransactions,
        loading,

        // Acciones
        voteOnProposal,
        createProposal,
        delegateVotes,
        claimRewards,
        updateDAOSettings,
        executeProposal,

        // Refetch
        fetchDAOData,
        fetchProposals,
        fetchDelegates,
        fetchUserData,
        fetchTreasuryTransactions,
        getStatistics,
    };

    return <DAOContext.Provider value={value}>{children}</DAOContext.Provider>;
};

export default DAOContext;
