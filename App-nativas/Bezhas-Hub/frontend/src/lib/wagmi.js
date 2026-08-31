import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia, polygon, optimism, arbitrum, base } from 'wagmi/chains';

// Configuración de Polygon Amoy Testnet personalizada
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
    default: {
      http: ['https://rpc-amoy.polygon.technology'],
    },
    public: {
      http: ['https://rpc-amoy.polygon.technology'],
    },
  },
  blockExplorers: {
    default: {
      name: 'PolygonScan',
      url: 'https://amoy.polygonscan.com',
    },
  },
  testnet: true,
};

export const config = getDefaultConfig({
  appName: 'BeZhas Web3',
  projectId: '4adede0a9355f0a3652c2811dbe89ee2', // WalletConnect Project ID
  chains: [
    mainnet,
    sepolia,
    polygon,
    polygonAmoy, // Amoy Testnet agregado
    optimism,
    arbitrum,
    base
  ],
  ssr: false, // Estás en una app del lado del cliente (Vite)
});
