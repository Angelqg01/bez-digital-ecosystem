/** @type {import('next').NextConfig} */
const nextConfig = {
    // Transpile ESM-only packages (wagmi, viem, etc.)
    transpilePackages: ['@web3modal/wagmi', '@wagmi/connectors'],

    // Webpack: handle CommonJS/ESM conflicts & missing peer deps
    webpack: (config) => {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            net: false,
            tls: false,
        };
        // Stub phantom peer dependencies from @wagmi/connectors
        config.resolve.alias = {
            ...config.resolve.alias,
            '@metamask/connect-evm': false,
            'porto/internal': false,
            'porto': false,
            // Optional x402 packages of @coinbase/cdp-sdk, reached via
            // @wagmi/connectors/baseAccount -> @base-org/account. The app never
            // uses the x402 payment flow and the packages are not installed, so
            // webpack cannot resolve them during `next build`. These non-exact
            // aliases also cover their subpaths (e.g. @x402/evm/exact/client).
            '@x402/core': false,
            '@x402/evm': false,
            '@x402/svm': false,
            // @wagmi/core's tempo/Connectors.js imports a bare 'accounts'
            // specifier that resolves to nothing. The repo pins wagmi to v2,
            // but @wagmi/connectors (pulled by @web3modal/base) still drags in
            // a @wagmi/core v3 whose build carries it. Exact-match alias so
            // only this specifier is stubbed.
            'accounts$': false,
        };
        // Ignore optional MetaMask SDK modules
        config.externals = [
            ...(Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : []),
        ];
        return config;
    },

    // Security headers
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Frame-Options',           value: 'DENY' },
                    { key: 'X-Content-Type-Options',     value: 'nosniff' },
                    { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
                ],
            },
        ];
    },

    // Allow images from external domains (PolygonScan, IPFS)
    images: {
        domains: ['polygonscan.com', 'ipfs.io', 'gateway.pinata.cloud', 'bezhas.com'],
    },
};

export default nextConfig;

