/**
 * Punto de entrada ESM de @bezhas/sdk.
 *
 * El campo "module" del package.json apuntaba a este fichero desde la v3.0.0 pero
 * el fichero no existía: cualquier bundler que prefiera "module" sobre "main"
 * (webpack, rollup, y Vite en build) resolvía a un fichero fantasma.
 *
 * El SDK es CommonJS, así que aquí no se duplica lógica: se carga index.js con
 * createRequire y se reexporta con nombre, que es lo que los bundlers necesitan
 * para hacer tree-shaking sin romper la única fuente de verdad.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sdk = require('./index.js');

export const {
    BeZhas,
    BeZhasUniversal,

    // Tokenomics y puentes
    TokenomicsEngine,
    BridgeManager,

    // Validación (ValidatorRegistry + EdgeNodeRewards)
    ValidatorClient,

    // Gobernanza DAO
    GovernanceClient,
    PROPOSAL_STATES,
    VOTE_FOR,
    VOTE_AGAINST,
    VOTE_ABSTAIN,

    // Servicios de plataforma
    VIPSubscriptionManager,
    StakingManager,
    PaymentsManager,
    stripePaymentLinks,
    STRIPE_PAYMENT_LINKS,
    getStripePaymentLink,
    bankTransferDetails,
    BANK_TRANSFER_DETAILS,
    buildBankTransferInstructions,
    RWAManager,
    LogisticsManager,
    MCPClient,
    IntegrationAssistant,
    CommercialAPIClient,

    // Módulos sectoriales (Tier 1, 2 y 3)
    modules,

    // Contratos: ABIs y direcciones
    contracts,
    addresses,
    getContract,
    getAddresses,
    getABI,
    listContracts,
    isDeployed,
} = sdk;

export default sdk;
