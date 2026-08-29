/**
 * lib/seo.ts
 * Centralized SEO metadata factory for all landing pages.
 * Import `generateLandingMetadata` in each page's generateMetadata export.
 */

import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bez.digital';

interface PageSEO {
    title: string;
    description: string;
    path: string;
    image?: string;
    keywords?: string[];
}

const PAGE_SEO: Record<string, PageSEO> = {
    '/': {
        title: 'BeZhas | El estandar digital entre la empresa y la cadena de bloques',
        description: 'L2 empresarial sobre Ethereum: los eventos de tu ERP se convierten en evidencia firmada, auditable e irreversible. Siete protocolos sectoriales, seguridad AEGIS fail-closed y cumplimiento MiCA, DAC8 y AEAT — sin sacar de tu casa un solo dato sensible.',
        path: '/',
        keywords: [
            'blockchain empresarial', 'trazabilidad blockchain', 'L2 Ethereum', 'ERP blockchain',
            'Edge Node', 'evidencia auditable', 'RWA', 'tokenizacion industrial', 'AEGIS',
            'MiCA', 'DAC8', 'AEAT', 'oraculo IA', 'DePIN', 'BEZ coin', 'supply chain blockchain',
        ],
    },
    '/solutions': {
        title: 'Solutions | Tokenization, DePIN & AI Oracles',
        description: 'Discover BeZhas enterprise solutions: asset tokenization, DePIN hardware mining, AI-powered logistics verification, and cross-chain bridge infrastructure.',
        path: '/solutions',
        keywords: ['asset tokenization', 'DePIN solutions', 'AI oracle', 'supply chain Web3'],
    },
    '/token': {
        title: 'BEZ-Coin | Tokenomics & Staking',
        description: 'BEZ is the native gas token of BeZhas L2. Buy, stake, and earn with 100M fixed supply, DeFi yield, and governance rights.',
        path: '/token',
        keywords: ['BEZ coin', 'crypto staking', 'tokenomics', 'L2 gas token'],
    },
    '/network': {
        title: 'Network Status | TPS, Validators & Live Stats',
        description: 'Real-time BeZhas network metrics: transactions per second, active validators, block height, and node health across the L2.',
        path: '/network',
        keywords: ['blockchain network status', 'L2 validators', 'TPS', 'node health'],
    },
    '/enterprise': {
        title: 'Enterprise | Blockchain for Real Estate & Industry',
        description: 'BeZhas enterprise: tokenize real estate, industrial assets, and supply chains. Private B2B node setup, SLA support, and Stripe-powered gas billing.',
        path: '/enterprise',
        keywords: ['enterprise blockchain', 'real estate tokenization', 'B2B Web3', 'blockchain ERP integration'],
    },
    '/commerce': {
        title: 'Commerce | Smart Supply Chain & Logistics',
        description: 'Automate manifests, verify shipments with AI, and settle freight contracts on-chain. BeZhas connects ERP systems to the blockchain in minutes.',
        path: '/commerce',
        keywords: ['supply chain blockchain', 'freight blockchain', 'logistics NFT', 'ERP blockchain'],
    },
    '/payments': {
        title: 'Payments | On-Chain B2B Payment Solutions',
        description: 'Process B2B payments with instant settlement on BeZhas L2. Accept fiat, auto-convert to BEZ, and settle cross-border invoices with smart contracts.',
        path: '/payments',
        keywords: ['blockchain payments', 'B2B settlement', 'cross-border payments blockchain', 'smart contract invoicing'],
    },
    '/financial': {
        title: 'Financial Services | DeFi for Enterprises',
        description: 'Access institutional DeFi: staking pools, supply chain financing, yield strategies, and programmable treasury management on BeZhas.',
        path: '/financial',
        keywords: ['enterprise DeFi', 'supply chain finance blockchain', 'institutional crypto', 'treasury blockchain'],
    },
    '/bridges': {
        title: 'Bridges | L1 ↔ L2 Cross-Chain Transfers',
        description: 'Bridge ETH, USDC, and BEZ between Ethereum mainnet and BeZhas L2 with guaranteed finality and transparent relay status.',
        path: '/bridges',
        keywords: ['cross-chain bridge', 'L2 bridge Ethereum', 'BEZ bridge', 'blockchain interoperability'],
    },
    '/validators': {
        title: 'Validators | Stake, Earn & Secure the Network',
        description: 'Become a BeZhas validator: stake BEZ, validate industrial transactions, earn DePIN rewards, and participate in on-chain governance.',
        path: '/validators',
        keywords: ['blockchain validator', 'DePIN node', 'staking rewards', 'L2 validator'],
    },
    '/developers': {
        title: 'Developer Portal | SDK, APIs & Smart Contracts',
        description: 'Build on BeZhas: REST & WebSocket APIs, BeZhas.js SDK, Solidity smart contract templates, and full developer documentation.',
        path: '/developers',
        keywords: ['blockchain developer', 'Web3 SDK', 'smart contract API', 'BeZhas SDK'],
    },
    '/learn': {
        title: 'Docs & Tutorials | Learn BeZhas',
        description: 'Comprehensive documentation, step-by-step tutorials, governance guides, and whitepaper for the BeZhas L2 protocol.',
        path: '/learn',
        keywords: ['blockchain documentation', 'BeZhas whitepaper', 'Web3 tutorial', 'L2 governance'],
    },
    '/docs': {
        title: 'API & SDK Reference | BeZhas Docs',
        description: 'Full API reference, SDK documentation, RPC endpoints, contract ABIs, and integration guides for developers building on BeZhas.',
        path: '/docs',
        keywords: ['REST API blockchain', 'SDK documentation', 'RPC endpoint', 'smart contract ABI'],
    },
    '/rpc': {
        title: 'RPC & Nodes | Public Endpoints & Dedicated Nodes',
        description: 'Connect to BeZhas L2 via public RPC, dedicated node clusters, or deploy your own validator node with one Docker command.',
        path: '/rpc',
        keywords: ['RPC endpoint blockchain', 'dedicated node', 'L2 RPC', 'Web3 provider'],
    },
    '/support': {
        title: 'Support | FAQ, Telegram & Contact',
        description: 'Get help with BeZhas: browse the FAQ, join the community Telegram, or open a support ticket with our enterprise team.',
        path: '/support',
        keywords: ['blockchain support', 'Web3 help', 'BeZhas FAQ', 'enterprise support'],
    },
    '/privacy': {
        title: 'Política de Privacidad | BeZhas',
        description: 'Cómo BeZhas trata tus datos: qué recogemos, con qué base legal, cuánto lo conservamos, tus derechos RGPD y los permisos de cámara/geolocalización de las SubApps.',
        path: '/privacy',
        keywords: ['política de privacidad', 'RGPD', 'GDPR', 'protección de datos blockchain'],
    },
};

/**
 * Generates Next.js Metadata for a specific landing page path.
 * Usage: export const generateMetadata = () => generateLandingMetadata('/solutions');
 */
export function generateLandingMetadata(path: string): Metadata {
    const seo = PAGE_SEO[path] ?? PAGE_SEO['/'];
    const canonical = `${BASE_URL}${seo.path}`;
    const ogImage = seo.image ?? `${BASE_URL}/og-default.png`;

    return {
        title: seo.title,
        description: seo.description,
        keywords: seo.keywords ?? [],
        alternates: { canonical },
        openGraph: {
            title: seo.title,
            description: seo.description,
            url: canonical,
            siteName: 'BeZhas Protocol',
            type: 'website',
            locale: 'es_ES',
            images: [{ url: ogImage, width: 1200, height: 630, alt: seo.title }],
        },
        twitter: {
            card: 'summary_large_image',
            title: seo.title,
            description: seo.description,
            images: [ogImage],
        },
    };
}
