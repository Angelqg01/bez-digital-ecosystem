// Configuración de contratos inteligentes

// BeZhas Rewards Calculator (Be-VIP dApp)
export const REWARDS_CONTRACT = {
    // TODO: Actualizar con la dirección del contrato desplegado
    address: '0x0000000000000000000000000000000000000000',
    // Cambiar a la dirección real después del deployment
    // Ejemplo: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'

    chainId: 137, // Polygon Mainnet
    // Para testnet usar: 80002 (Polygon Amoy)
};

// Content Validator Contract (Content Certification System)
export const CONTENT_VALIDATOR_CONTRACT = {
    address: '0x0000000000000000000000000000000000000000',
    // Actualizar después de deployment
    chainId: 137, // Polygon Mainnet
};

// Human Resources Plugin (DAO Talent Dashboard)
export const HR_PLUGIN_CONTRACT = {
    address: '0x0000000000000000000000000000000000000000', // TODO: Update with deployed address
    chainId: 137
};

export const SUPPORTED_CHAINS = {
    polygon: {
        id: 137,
        name: 'Polygon',
        rpcUrl: 'https://polygon-bor-rpc.publicnode.com',
        blockExplorer: 'https://polygonscan.com'
    },
    polygonAmoy: {
        id: 80002,
        name: 'Polygon Amoy Testnet',
        rpcUrl: 'https://rpc-amoy.polygon.technology',
        blockExplorer: 'https://www.oklink.com/amoy'
    }
};

// Constantes del contrato (para referencia frontend)
export const TOKEN_VALUES = {
    POST: 10,
    COMMENT: 3,
    LIKE: 1,
    SHARE: 5,
    PREMIUM_INTERACTION: 15,
    REFERRAL: 50
};

export const DAILY_LIMITS = {
    POSTS: 10,
    COMMENTS: 50,
    LIKES: 100,
    SHARES: 20,
    PREMIUM_INTERACTIONS: 5,
    REFERRALS: 3
};

export const VIP_MULTIPLIERS = {
    0: 1.0,   // Sin VIP
    1: 1.5,   // VIP 1 mes
    3: 2.0,   // VIP 3 meses
    6: 2.5,   // VIP 6 meses
    9: 3.0    // VIP 9 meses
};
