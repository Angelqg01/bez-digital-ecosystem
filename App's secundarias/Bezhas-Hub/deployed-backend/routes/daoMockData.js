// Mock data para desarrollo cuando MongoDB no está disponible
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
        actions: [
            {
                type: 'updateSettings',
                target: 'rewards.contentCreation',
                value: '1.25',
                data: { multiplier: 1.25 }
            }
        ],
        createdAt: new Date('2025-11-20'),
        updatedAt: new Date('2025-11-20')
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
        actions: [
            {
                type: 'custom',
                target: 'moderation.system',
                value: 'decentralized-jury',
                data: { jurySize: 5, requiredNFT: 'ModeratorBadge' }
            }
        ],
        createdAt: new Date('2025-11-20'),
        updatedAt: new Date('2025-11-20')
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
        actions: [
            {
                type: 'transfer',
                target: '0xHackathonWallet123456789',
                value: '50000',
                data: { token: 'USDC', purpose: 'Q1 2026 Hackathon' }
            }
        ],
        createdAt: new Date('2025-11-20'),
        updatedAt: new Date('2025-11-20')
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
        actions: [
            {
                type: 'updateSettings',
                target: 'marketplace.fee',
                value: '1.5',
                data: { newFee: 1.5, oldFee: 2.5 }
            }
        ],
        createdAt: new Date('2025-11-10'),
        updatedAt: new Date('2025-11-17')
    }
];

const mockSettings = {
    quorumPercentage: 10,
    votingPeriodDays: 7,
    proposalThreshold: 100000,
    allowDelegation: true,
    maxDelegations: 100,
    rewardPerVote: 10
};

const mockTreasuryTransactions = [
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
];

const mockDelegates = [
    {
        _id: 'd1',
        delegate: '0xabcdef1234567890abcdef1234567890abcdef12',
        delegator: '0x1111111111111111111111111111111111111111',
        votingPower: 150000,
        createdAt: new Date('2025-11-15')
    },
    {
        _id: 'd2',
        delegate: '0xabcdef1234567890abcdef1234567890abcdef12',
        delegator: '0x2222222222222222222222222222222222222222',
        votingPower: 200000,
        createdAt: new Date('2025-11-16')
    }
];

module.exports = {
    mockProposals,
    mockSettings,
    mockTreasuryTransactions,
    mockDelegates
};
