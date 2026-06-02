// wagmi 3.x configuration
import { http, createConfig, createStorage, fallback } from 'wagmi';
import { mainnet, sepolia, polygon } from 'wagmi/chains';
import { walletConnect, injected, coinbaseWallet } from 'wagmi/connectors';

// WalletConnect Project ID
export const projectId = '4adede0a9355f0a3652c2811dbe89ee2';

if (!projectId) {
  throw new Error('Project ID is not defined');
}

// Polygon Amoy Testnet personalizado
const polygonAmoy = {
  id: 80002,
  name: 'Polygon Amoy Testnet',
  network: 'polygon-amoy',
  nativeCurrency: {
    decimals: 18,
    name: 'MATIC',
    symbol: 'MATIC',
  },
  rpcUrls: {
    default: { http: ['https://rpc-amoy.polygon.technology'] },
    public: { http: ['https://rpc-amoy.polygon.technology'] }
  },
  blockExplorers: {
    default: {
      name: 'PolygonScan',
      url: 'https://amoy.polygonscan.com',
    },
  },
  testnet: true,
};

// Hardhat Local personalizado
const hardhatLocal = {
  id: 31337,
  name: 'Hardhat Local',
  network: 'hardhat',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
    public: { http: ['http://127.0.0.1:8545'] }
  },
  testnet: true,
};

// 2. Define chains
export const chains = [
  sepolia,        // Ethereum Sepolia testnet (default)
  mainnet,        // Ethereum mainnet
  polygon,        // Polygon mainnet
  polygonAmoy,    // Polygon Amoy testnet
  hardhatLocal,   // Hardhat local
];

// 3. Create wagmi config (wagmi 3.x style) - Sin auto-reconexión
export const config = createConfig({
  chains: [mainnet, sepolia, polygon, polygonAmoy, hardhatLocal],
  connectors: [
    walletConnect({ projectId, showQrModal: false }),
    injected({ target: 'metaMask' }),
    coinbaseWallet({ appName: 'BeZhas' }),
  ],
  transports: {
    // Usar RPCs públicos específicos para evitar CORS issues
    [mainnet.id]: http('https://ethereum-rpc.publicnode.com', {
      timeout: 15_000,
      retryCount: 2,
      retryDelay: 1000,
    }),
    [sepolia.id]: http('https://ethereum-sepolia-rpc.publicnode.com', {
      timeout: 15_000,
      retryCount: 2,
      retryDelay: 1000,
    }),
    [polygon.id]: fallback([
      http('https://polygon-bor-rpc.publicnode.com', { timeout: 15_000 }),
      http('https://rpc.ankr.com/polygon', { timeout: 15_000 }),
      http('https://polygon-rpc.com', { timeout: 15_000 })
    ]),
    [polygonAmoy.id]: http('https://rpc-amoy.polygon.technology', {
      timeout: 10_000,
      retryCount: 1,
      retryDelay: 1000,
    }),
    [hardhatLocal.id]: http('http://127.0.0.1:8545', {
      timeout: 5_000,
      retryCount: 0,
    }),
  },
  storage: createStorage({
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    key: 'bezhas-wallet',
  }),
  ssr: false,
  // CRÍTICO: Deshabilitar reconexión automática
  multiInjectedProviderDiscovery: false,
});

// 4. Inicializar Web3Modal INMEDIATAMENTE en el navegador
// Esto debe ejecutarse ANTES de que cualquier componente use useWeb3Modal()
import { createWeb3Modal } from '@web3modal/wagmi/react';

if (typeof window !== 'undefined') {
  createWeb3Modal({
    wagmiConfig: config,
    projectId,
    chains,
    themeMode: 'dark',
    enableAnalytics: false,
    enableOnramp: false,
    // Deshabilitar telemetría completamente
    telemetry: false,
    featuredWalletIds: [],
    includeWalletIds: [],
  });

  console.log('✅ Web3Modal initialized globally');
}
