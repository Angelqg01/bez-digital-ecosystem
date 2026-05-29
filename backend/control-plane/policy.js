const { BEZ_COIN_UTILITY_VALIDATOR_TOKEN } = require('../config/bez-token.config');

const CONTROL_PLANE_VERSION = '1.0.0';

const HUB_OWNED_CAPABILITIES = [
    'auth_sso',
    'permissions_rbac',
    'developer_console',
    'billing_subscription',
    'global_notifications',
    'observability_dashboard',
    'app_switcher',
    'admin_settings',
    'ai_gateway',
    'automation_control'
];

const SUBAPP_DEFINITIONS = {
    wallet: {
        key: 'wallet',
        name: 'BeZhas Wallet',
        env: 'BEZHAS_WALLET_URL',
        defaultUrl: 'http://localhost:3010',
        owns: ['wallet_operations', 'bridge_operations', 'governance_operations', 'validators_operations', 'bezcoin_operations']
    },
    gas: {
        key: 'gas',
        name: 'Gas Tank Manager',
        env: 'BEZHAS_GAS_URL',
        defaultUrl: 'http://localhost:3011',
        owns: ['gas_operations']
    },
    nodes: {
        key: 'nodes',
        name: 'Edge Node Manager',
        env: 'BEZHAS_NODES_URL',
        defaultUrl: 'http://localhost:3012',
        owns: ['edge_node_operations']
    },
    vision: {
        key: 'vision',
        name: 'Vision Scan',
        env: 'BEZHAS_VISION_URL',
        defaultUrl: 'http://localhost:3013',
        owns: ['vision_operations', 'quality_oracle_operations']
    },
    capital: {
        key: 'capital',
        name: 'BZ Capital',
        env: 'BEZHAS_CAPITAL_URL',
        defaultUrl: 'http://localhost:3014',
        owns: ['defi_vertical_operations', 'staking_operations', 'farming_operations', 'rwa_operations', 'marketplace_operations']
    },
    cargo: {
        key: 'cargo',
        name: 'BZ CargoLink',
        env: 'BEZHAS_CARGO_URL',
        defaultUrl: 'http://localhost:3016',
        owns: ['logistics_operations']
    },
    pay: {
        key: 'pay',
        name: 'BeZhas Pay Manager',
        env: 'BEZHAS_PAY_URL',
        defaultUrl: 'http://localhost:3019',
        owns: ['payments_operations', 'fiat_gateway_operations', 'moonpay_operations', 'crypto_checkout_operations']
    }
};

const MIGRATED_CAPABILITIES = {
    wallet_operations: { app: 'wallet', path: '/wallet', legacyApiPrefixes: ['/api/wallet'] },
    bridge_operations: { app: 'wallet', path: '/bridge', legacyApiPrefixes: ['/api/v1/bridge', '/api/v2/bridge', '/api/v1/crosschain'] },
    governance_operations: { app: 'wallet', path: '/dao', legacyApiPrefixes: ['/api/dao', '/api/governance'] },
    validators_operations: { app: 'wallet', path: '/validators', legacyApiPrefixes: [] },
    bezcoin_operations: { app: 'wallet', path: '/wallet', legacyApiPrefixes: ['/api/bezcoin'] },

    gas_operations: { app: 'gas', path: '/', legacyApiPrefixes: ['/api/gas'] },
    edge_node_operations: { app: 'nodes', path: '/', legacyApiPrefixes: ['/api/nodes', '/api/edge'] },

    vision_operations: { app: 'vision', path: '/', legacyApiPrefixes: ['/api/oracle'] },
    quality_oracle_operations: { app: 'vision', path: '/quality', legacyApiPrefixes: ['/api/quality-escrow'] },

    defi_vertical_operations: { app: 'capital', path: '/', legacyApiPrefixes: ['/api/defi'] },
    staking_operations: { app: 'capital', path: '/staking', legacyApiPrefixes: ['/api/staking'] },
    farming_operations: { app: 'capital', path: '/farming', legacyApiPrefixes: ['/api/farming'] },
    rwa_operations: { app: 'capital', path: '/rwa', legacyApiPrefixes: ['/api/rwa', '/api/realestate'] },
    marketplace_operations: { app: 'capital', path: '/marketplace', legacyApiPrefixes: ['/api/marketplace'] },

    logistics_operations: { app: 'cargo', path: '/', legacyApiPrefixes: ['/api/logistics'] },

    payments_operations: { app: 'pay', path: '/', legacyApiPrefixes: ['/api/payment', '/api/payments'] },
    fiat_gateway_operations: { app: 'pay', path: '/fiat', legacyApiPrefixes: ['/api/fiat'] },
    moonpay_operations: { app: 'pay', path: '/moonpay', legacyApiPrefixes: ['/api/moonpay'] },
    crypto_checkout_operations: { app: 'pay', path: '/crypto', legacyApiPrefixes: ['/api/crypto'] }
};

const POLICY_FLAGS = Object.freeze({
    hubExecutesWalletTransactions: false,
    hubExecutesTokenPurchases: false,
    hubExecutesBridgeTransfers: false,
    hubExecutesDefiRuntime: false,
    hubExecutesGasRuntime: false,
    hubExecutesQualityOracleRuntime: false,
    hubActsAsControlPlane: true
});

function normalizePath(path) {
    if (!path || path === '/') {
        return '';
    }
    return path.startsWith('/') ? path : `/${path}`;
}

function getSubappBaseUrl(appKey) {
    const subapp = SUBAPP_DEFINITIONS[appKey];
    if (!subapp) {
        return null;
    }
    return process.env[subapp.env] || subapp.defaultUrl;
}

function getSubappRegistry() {
    return Object.values(SUBAPP_DEFINITIONS).map((subapp) => ({
        key: subapp.key,
        name: subapp.name,
        baseUrl: getSubappBaseUrl(subapp.key),
        owns: [...subapp.owns]
    }));
}

function getCapabilityTarget(capability) {
    const migration = MIGRATED_CAPABILITIES[capability];
    if (!migration) {
        return null;
    }

    const subapp = SUBAPP_DEFINITIONS[migration.app];
    const baseUrl = getSubappBaseUrl(migration.app);
    const path = normalizePath(migration.path);

    return {
        capability,
        appKey: subapp.key,
        appName: subapp.name,
        targetUrl: `${baseUrl}${path}`,
        legacyApiPrefixes: [...migration.legacyApiPrefixes],
        hubRole: 'control-plane-only'
    };
}

function buildManifest() {
    const migratedCapabilities = Object.keys(MIGRATED_CAPABILITIES).reduce((acc, capability) => {
        acc[capability] = getCapabilityTarget(capability);
        return acc;
    }, {});

    return {
        version: CONTROL_PLANE_VERSION,
        hubRole: 'control-plane',
        ownedCapabilities: [...HUB_OWNED_CAPABILITIES],
        migratedCapabilities,
        subapps: getSubappRegistry(),
        utilityValidatorToken: { ...BEZ_COIN_UTILITY_VALIDATOR_TOKEN },
        policyFlags: { ...POLICY_FLAGS }
    };
}

function createDeprecatedSubappRoute(capability, fallback = {}) {
    return (req, res) => {
        const target = getCapabilityTarget(capability) || {
            capability,
            appName: fallback.appName || fallback.name || 'SubApp',
            targetUrl: fallback.url || fallback.targetUrl || null,
            hubRole: 'control-plane-only',
            legacyApiPrefixes: []
        };

        if (target.targetUrl) {
            res.set('Location', target.targetUrl);
        }

        res
            .status(410)
            .set('X-BeZhas-Hub-Role', 'control-plane')
            .set('X-BeZhas-Migrated-To', target.appName)
            .json({
                error: 'Gone',
                code: 'CAPABILITY_MIGRATED_TO_SUBAPP',
                capability: target.capability,
                migratedTo: target.appName,
                targetUrl: target.targetUrl,
                hubRole: target.hubRole,
                method: req.method,
                path: req.originalUrl || req.url,
                message: `Esta funcionalidad fue migrada a ${target.appName}. El Hub solo coordina permisos, visibilidad y enlaces.`
            });
    };
}

module.exports = {
    CONTROL_PLANE_VERSION,
    HUB_OWNED_CAPABILITIES,
    SUBAPP_DEFINITIONS,
    MIGRATED_CAPABILITIES,
    POLICY_FLAGS,
    buildManifest,
    createDeprecatedSubappRoute,
    getCapabilityTarget,
    getSubappBaseUrl,
    getSubappRegistry
};
