const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DAOProposal = require('../models/DAOProposal');
const DAOSettings = require('../models/DAOSettings');
const TreasuryTransaction = require('../models/TreasuryTransaction');

// Conectar a MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bezhasDB';

async function seedDAO() {
    try {
        console.log('🔌 Conectando a MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Conectado a MongoDB');

        // 1. Crear configuración de DAO si no existe
        let settings = await DAOSettings.findOne();
        if (!settings) {
            settings = await DAOSettings.create({
                quorumPercentage: 10,
                votingPeriodDays: 7,
                proposalThreshold: 100000,
                allowDelegation: true,
                maxDelegations: 100,
                rewardPerVote: 10,
            });
            console.log('✅ Configuración de DAO creada');
        } else {
            console.log('ℹ️  Configuración de DAO ya existe');
        }

        // Dirección genérica del creador (founder wallet)
        const founderWallet = '0x1234567890abcdef1234567890abcdef12345678';

        // 2. Añadir fondos iniciales a la tesorería
        const existingTransactions = await TreasuryTransaction.countDocuments();
        if (existingTransactions === 0) {
            await TreasuryTransaction.insertMany([
                {
                    type: 'deposit',
                    token: 'USDC',
                    amount: 1000000,
                    description: 'Fondos iniciales de la tesorería',
                    status: 'completed',
                },
                {
                    type: 'deposit',
                    token: 'BEZ',
                    amount: 5000000,
                    description: 'Asignación de tokens BEZ',
                    status: 'completed',
                },
                {
                    type: 'deposit',
                    token: 'ETH',
                    amount: 100,
                    description: 'Reserva de ETH',
                    status: 'completed',
                },
            ]);
            console.log('✅ Transacciones de tesorería creadas');
        } else {
            console.log('ℹ️  Transacciones de tesorería ya existen');
        }

        // 3. Crear propuestas de ejemplo si no existen
        const existingProposals = await DAOProposal.countDocuments();
        if (existingProposals === 0) {
            const proposals = [
                {
                    title: 'Aumentar recompensas por contenido verificado',
                    description: 'Propuesta para incrementar en un 25% las recompensas para creadores que verifican contenido mediante blockchain. Esto incentivará la creación de contenido de calidad y aumentará la participación en la plataforma.',
                    category: 'treasury',
                    creator: founderWallet,
                    status: 'active',
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 días
                    votesFor: 1245000,
                    votesAgainst: 234000,
                    actions: [
                        {
                            type: 'updateSettings',
                            target: 'rewards.contentCreation',
                            value: '1.25',
                            data: { multiplier: 1.25 },
                        },
                    ],
                },
                {
                    title: 'Implementar sistema de moderación descentralizada',
                    description: 'Crear un sistema de jurados aleatorios usando NFTs para moderar contenido reportado. Los jurados serán seleccionados de holders de NFTs especiales y recibirán recompensas por participar.',
                    category: 'governance',
                    creator: founderWallet,
                    status: 'active',
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
                    votesFor: 890000,
                    votesAgainst: 567000,
                    actions: [
                        {
                            type: 'custom',
                            target: 'moderation.system',
                            value: 'decentralized-jury',
                            data: { jurySize: 5, requiredNFT: 'ModeratorBadge' },
                        },
                    ],
                },
                {
                    title: 'Financiar hackathon de desarrolladores Q1 2026',
                    description: 'Asignar 50,000 USDC de la tesorería para premios del hackathon y atracción de talento. El evento se enfocará en construir dApps sobre nuestra infraestructura.',
                    category: 'development',
                    creator: founderWallet,
                    status: 'active',
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 días
                    votesFor: 2100000,
                    votesAgainst: 150000,
                    actions: [
                        {
                            type: 'transfer',
                            target: '0xHackathonWallet123456789',
                            value: '50000',
                            data: { token: 'USDC', purpose: 'Q1 2026 Hackathon' },
                        },
                    ],
                },
                {
                    title: 'Reducir comisión de marketplace al 1.5%',
                    description: 'Propuesta para reducir la comisión del marketplace NFT del 2.5% al 1.5% para aumentar volumen de transacciones y competitividad con otras plataformas.',
                    category: 'protocol',
                    creator: founderWallet,
                    status: 'approved',
                    startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Hace 10 días
                    endDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Hace 3 días
                    votesFor: 3400000,
                    votesAgainst: 890000,
                    actions: [
                        {
                            type: 'updateSettings',
                            target: 'marketplace.fee',
                            value: '1.5',
                            data: { newFee: 1.5, oldFee: 2.5 },
                        },
                    ],
                },
            ];

            await DAOProposal.insertMany(proposals);
            console.log(`✅ ${proposals.length} propuestas creadas`);
        } else {
            console.log(`ℹ️  Ya existen ${existingProposals} propuestas`);
        }

        console.log('\n🎉 ¡Seed completado exitosamente!');
        console.log('\n📊 Resumen:');
        console.log(`   - Configuración: OK`);
        console.log(`   - Tesorería: ${await TreasuryTransaction.countDocuments()} transacciones`);
        console.log(`   - Propuestas: ${await DAOProposal.countDocuments()} propuestas`);

        await mongoose.connection.close();
        console.log('\n✅ Conexión cerrada');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error en seed:', error);
        await mongoose.connection.close();
        process.exit(1);
    }
}

// Ejecutar seed
seedDAO();
