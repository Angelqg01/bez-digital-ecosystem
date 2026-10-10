/** Conocimiento público de plataforma (global, PUBLIC). Idempotente. */
const DOCS = [
    ['faq_001', 'Qué es BeZhas', 'BeZhas es una plataforma Web3 de redes sociales y marketplace construida en Polygon. Integra pagos crypto, NFTs, staking, gobernanza DAO y un sistema de recompensas.'],
    ['faq_002', 'Cómo comprar BEZ Token', 'Puedes comprar BEZ con tarjeta vía Stripe, con criptomonedas (USDT, USDC, MATIC) o con MoonPay para compras con fiat. El contrato oficial está en Polygon Mainnet.'],
    ['faq_003', 'Cómo hacer staking de BEZ', 'Abre la página de Staking, conecta tu wallet, aprueba BEZ para el contrato StakingPool y deposita la cantidad deseada. El APY es variable según la participación total y las recompensas se acumulan automáticamente.'],
    ['tok_002', 'Tarifas de gas y comisiones', 'BeZhas opera en Polygon (L2) con gas típico de céntimos. Comisión del 1% en marketplace, 0.5% en swaps y transferencias P2P gratuitas.'],
    ['sec_001', 'Seguridad de la plataforma', 'BeZhas implementa passkeys WebAuthn, 2FA TOTP, verificación de firma de wallet con nonce, rate limiting avanzado y cifrado AES-256. Nunca compartas tu clave privada ni tu frase semilla con nadie, incluido este asistente.'],
    ['gui_002', 'Planes y suscripciones', 'BeZhas ofrece los planes Starter, Creator, Business y Enterprise. Cada plan desbloquea más IA, analítica, SDK/API y soporte. Consulta la página de planes para precios vigentes.'],
    ['gui_003', 'Gobernanza DAO', 'Los holders de BEZ votan propuestas de gobernanza: parámetros, tesorería y nuevas funciones. Hay umbrales mínimos de BEZ para votar y para crear propuestas.'],
    ['gui_006', 'Sistema de pagos', 'BeZhas acepta Stripe (tarjeta), criptomonedas (USDT, USDC, MATIC), MoonPay y transferencia bancaria. Los pagos fiat se convierten a BEZ al completarse.'],
    ['rwa_001', 'Tokenización de activos reales (RWA)', 'BeZhas permite tokenizar activos reales como inmuebles o bienes de logística. Cada activo se representa como NFT en Polygon. La tokenización requiere simulación, aprobación y firma segura antes de ejecutarse.'],
    ['bridge_001', 'Bridge cross-chain', 'El Universal Bridge permite mover BEZ entre Polygon, Arbitrum y zkSync con una comisión baja.'],
];

async function seedPublicKnowledge(service) {
    const admin = { userId: 'system', tenantId: 'system', roles: ['ADMIN', 'USER'], plan: 'enterprise' };
    let added = 0;
    for (const [id, title, content] of DOCS) {
        if (service.store.getDoc(id)) continue;
        await service.ingest(admin, { id, title, content, classification: 'PUBLIC', global: true, source: 'platform_docs' });
        added++;
    }
    return added;
}

module.exports = { seedPublicKnowledge };
