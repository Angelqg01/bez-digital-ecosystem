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

