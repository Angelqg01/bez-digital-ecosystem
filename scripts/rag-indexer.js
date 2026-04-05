/**
 * ============================================================================
 * BEZHAS RAG INDEXER — Seeds ChromaDB with Platform Knowledge & Payment Data
 * ============================================================================
 *
 * Run: node scripts/rag-indexer.js
 *
 * Indexes:
 * 1. Platform knowledge base (FAQs, tokenomics, guides)
 * 2. Sample payment metadata (for testing RAG retrieval)
 * 3. Blockchain event summaries
 *
 * Prerequisites:
 *   - ChromaDB running on http://localhost:8000 (or CHROMA_URL)
 *   - npm install chromadb (backend/package.json)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const ragService = require('../backend/services/rag.service');

const PLATFORM_KNOWLEDGE = [
    {
        id: 'faq_001', title: '¿Qué es BeZhas?',
        content: 'BeZhas es una plataforma Web3 de redes sociales y marketplace construida en Polygon. Integra pagos crypto, NFTs, staking, DAO governance, y un sistema de recompensas innovador.',
        category: 'faq',
    },
    {
        id: 'faq_002', title: '¿Cómo comprar BEZ Token?',
        content: 'Puedes comprar BEZ Token de 3 formas: 1) Con tarjeta vía Stripe (USD/EUR → BEZ), 2) Con criptomonedas (USDT, USDC, MATIC → BEZ), 3) Vía MoonPay para compras con fiat. El contrato oficial es 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8 en Polygon Mainnet.',
        category: 'faq',
    },
    {
        id: 'faq_003', title: '¿Cómo hacer staking de BEZ?',
        content: 'Navega a la página de Staking, conecta tu wallet, aprueba tokens BEZ para el contrato StakingPool, y deposita la cantidad deseada. El APY actual es variable según la participación total. Las recompensas se acumulan automáticamente.',
        category: 'guide',
    },
    {
        id: 'tok_001', title: 'Tokenomics BEZ',
        content: 'BEZ Token: Supply total 1,000,000,000. Distribución: 30% venta pública, 20% ecosistema, 15% equipo (vesting 4 años), 15% reserva, 10% partners, 10% liquidez. Mecanismo de burn: 2% de cada transacción se quema. Precio inicial: $0.10 USD.',
        category: 'tokenomics',
    },
    {
        id: 'tok_002', title: 'Tarifas de Gas y Comisiones',
        content: 'BeZhas opera en Polygon (Layer 2), con gas típico de 30-100 Gwei ($0.001-$0.01 por TX). La plataforma cobra 1% de comisión en marketplace, 0.5% en swaps, y las transferencias P2P son gratuitas. El relayer puede pagar gas por transacciones IoT.',
        category: 'tokenomics',
    },
    {
        id: 'sec_001', title: 'Seguridad de la Plataforma',
        content: 'BeZhas implementa: WebAuthn/Passkeys, 2FA con TOTP, verificación de firma de wallet (nonce-based), rate limiting avanzado, encriptación AES-256, y account abstraction para gasless transactions. Los contratos fueron auditados.',
        category: 'security',
    },
    {
        id: 'gui_001', title: 'Guía de Wallet',
        content: 'Conecta tu wallet usando WalletConnect, MetaMask o cualquier wallet compatible. La plataforma soporta Polygon Mainnet (chainId: 137). BeZhas también ofrece passkeys para login sin wallet y account abstraction para transacciones sin gas.',
        category: 'guide',
    },
    {
        id: 'gui_002', title: 'Sistema VIP y Suscripciones',
        content: 'BeZhas ofrece 4 tiers VIP: Free (acceso básico), Pro ($9.99/mes, AI avanzado + analytics), Business ($29.99/mes, marketplace premium + SDK), Enterprise ($99.99/mes, API ilimitada + soporte dedicado). Cada tier otorga BEZ tokens de bonificación.',
        category: 'guide',
    },
    {
        id: 'gui_003', title: 'DAO Governance',
        content: 'La DAO de BeZhas permite a los holders de BEZ votar propuestas de governance: cambios de parámetros, distribución de treasury, nuevas features. Se requiere un mínimo de 1000 BEZ para crear propuestas y 100 BEZ para votar.',
        category: 'guide',
    },
    {
        id: 'gui_004', title: 'Marketplace NFT',
        content: 'El marketplace de BeZhas soporta: listado de NFTs (ERC-721/ERC-1155), ofertas, subastas, NFT rental (alquiler temporal), fractional NFTs, y lazy minting. Las comisiones son del 1% para el vendedor. Soporta IPFS/Pinata para almacenamiento.',
        category: 'guide',
    },
    {
        id: 'gui_005', title: 'Quality Oracle System',
        content: 'El Quality Oracle es un sistema de verificación de calidad para productos y servicios en el marketplace. Los validadores verifican la calidad, se puntúa en blockchain, y los fondos se liberan del escrow solo cuando la calidad es aprobada.',
        category: 'guide',
    },
    {
        id: 'gui_006', title: 'Sistema de Pagos',
        content: 'BeZhas acepta: Stripe (tarjeta), criptomonedas (USDT, USDC, MATIC), MoonPay, y transferencia bancaria (fiat gateway). Los pagos crypto se procesan directamente en Polygon. Los pagos fiat convierten a BEZ automáticamente al completarse.',
        category: 'guide',
    },
    {
        id: 'rwa_001', title: 'Real World Assets (RWA)',
        content: 'BeZhas soporta tokenización de activos reales: propiedades inmobiliarias (PropertyNFT), activos industriales, y bienes de logística (CargoManifestNFT). Cada RWA se fraccionaliza como NFT en Polygon y puede negociarse en el marketplace.',
        category: 'guide',
    },
    {
        id: 'bridge_001', title: 'Bridge Cross-Chain',
        content: 'BeZhas Universal Bridge permite transferir BEZ entre Polygon, Arbitrum y zkSync. También integra puentes a plataformas externas (Vinted, eBay) a través del Universal Bridge Adapter system. Comisión del bridge: 0.1%.',
        category: 'guide',
    },
];

const SAMPLE_PAYMENTS = [
    {
        id: 'sample_pay_001', type: 'stripe', amount: 50, currency: 'USD', tokenAmount: 500,
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E3B1', status: 'completed',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
        id: 'sample_pay_002', type: 'crypto', amount: 100, currency: 'USDT', tokenAmount: 1000,
        walletAddress: '0x8ba1f109551bD432803012645Ac136ddd64DBA72', status: 'completed',
        txHash: '0xabc123def456789012345678901234567890abcdef1234567890abcdef123456',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
    },
    {
        id: 'sample_pay_003', type: 'crypto', amount: 10, currency: 'MATIC', tokenAmount: 80,
        walletAddress: '0xdD2FD4581271e230360230F9337D5c0430Bf44C0', status: 'completed',
        txHash: '0x987654321fedcba098765432100abcdef1234567890abcdef1234567890abcd',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
    },
];

const SAMPLE_EVENTS = [
    {
        id: 'sample_evt_001', eventName: 'Transfer', contractName: 'BEZToken',
        contractAddress: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
        args: { from: '0x0000...0000', to: '0x742d...E3B1', value: '500000000000000000000' },
        txHash: '0xevent1234567890', blockNumber: 52000001,
    },
    {
        id: 'sample_evt_002', eventName: 'Staked', contractName: 'StakingPool',
        contractAddress: '0xf3fcfC9E19a7Cddf37c14bb74a7510D5005ce271',
        args: { user: '0x742d...E3B1', amount: '1000000000000000000000', duration: 30 },
        txHash: '0xevent2345678901', blockNumber: 52000050,
    },
    {
        id: 'sample_evt_003', eventName: 'ProposalCreated', contractName: 'Governance',
        contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
        args: { proposalId: 5, title: 'Increase staking rewards by 5%', creator: '0x8ba1...BA72' },
        txHash: '0xevent3456789012', blockNumber: 52000100,
    },
];

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('🔧 BeZhas RAG Indexer — Seeding ChromaDB...\n');

    await ragService.initialize();

    if (!ragService.initialized) {
        console.error('❌ ChromaDB not available. Make sure it is running on', process.env.CHROMA_URL || 'http://localhost:8000');
        console.log('\nTo start ChromaDB locally:\n  docker run -p 8000:8000 chromadb/chroma\n');
        process.exit(1);
    }

    // 1. Index platform knowledge
    console.log(`📚 Indexing ${PLATFORM_KNOWLEDGE.length} platform knowledge documents...`);
    for (const doc of PLATFORM_KNOWLEDGE) {
        await ragService.indexPlatformKnowledge(doc);
    }
    console.log('✅ Platform knowledge indexed.');

    // 2. Index sample payments
    console.log(`💳 Indexing ${SAMPLE_PAYMENTS.length} sample payment records...`);
    for (const payment of SAMPLE_PAYMENTS) {
        await ragService.indexPayment(payment);
    }
    console.log('✅ Payment records indexed.');

    // 3. Index sample blockchain events
    console.log(`⛓️  Indexing ${SAMPLE_EVENTS.length} sample blockchain events...`);
    for (const event of SAMPLE_EVENTS) {
        await ragService.indexBlockchainEvent(event);
    }
    console.log('✅ Blockchain events indexed.');

    // 4. Print stats
    const stats = await ragService.getStats();
    console.log('\n📊 Collection Stats:');
    for (const [name, data] of Object.entries(stats.collections)) {
        console.log(`   ${name}: ${data.count || 0} documents`);
    }

    console.log('\n🎉 RAG indexing complete! The chatbot now has real-time context.');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
