import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Box,
  Briefcase,
  Coins,
  Crown,
  Droplets,
  Globe2,
  LayoutGrid,
  Server,
  ShieldCheck,
  Ship,
  Wallet,
  Cpu,
} from 'lucide-react';

export const BEZ_POLYGON_ADDRESS = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
export const BEZ_POLYGONSCAN_URL = `https://polygonscan.com/token/${BEZ_POLYGON_ADDRESS}`;
export const DEFI_TOKENOMICS_URL = import.meta.env.VITE_BEZHAS_DEFI_URL || '/defi';

export type EcosystemApp = {
  name: string;
  url: string;
  port: string;
  icon: LucideIcon;
  accent: string;
  description: string;
};

export const ECOSYSTEM_APPS: EcosystemApp[] = [
  {
    name: 'BeZhas Hub',
    url: 'http://localhost:5173',
    port: '5173',
    icon: LayoutGrid,
    accent: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/50',
    description: 'Landing, SSO, feed social, marketplace, DAO, pagos y consola central del ecosistema.',
  },
  {
    name: 'BeZhas Wallet',
    url: 'http://localhost:3010',
    port: '3010',
    icon: Wallet,
    accent: 'text-blue-300 bg-blue-400/10 border-blue-400/50',
    description: 'Cartera BEZ-Coin para identidad Web3, pagos P2P, saldos, staking y gobernanza.',
  },
  {
    name: 'Gas Tank Manager',
    url: 'http://localhost:3011',
    port: '3011',
    icon: Activity,
    accent: 'text-orange-300 bg-orange-400/10 border-orange-400/50',
    description: 'Panel de gas abstraction, recargas, predicción Aegis ML y operación paymaster.',
  },
  {
    name: 'Edge Node Manager',
    url: 'http://localhost:3012',
    port: '3012',
    icon: Server,
    accent: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/50',
    description: 'Gestión DePIN de nodos, recursos, validadores, recompensas y salud de red.',
  },
  {
    name: 'Vision Scan',
    url: 'http://localhost:3013',
    port: '3013',
    icon: Box,
    accent: 'text-pink-300 bg-pink-400/10 border-pink-400/50',
    description: 'Escaneo de activos físicos con IA, fingerprint visual, trazabilidad y oracle logístico.',
  },
  {
    name: 'BZ Capital',
    url: 'http://localhost:3014',
    port: '3014',
    icon: Briefcase,
    accent: 'text-purple-300 bg-purple-400/10 border-purple-400/50',
    description: 'DeFi, tokenomics, staking, yield farming y fraccionamiento de activos RWA.',
  },
  {
    name: 'BZ Prestige',
    url: 'http://localhost:3015',
    port: '3015',
    icon: Crown,
    accent: 'text-yellow-300 bg-yellow-400/10 border-yellow-400/50',
    description: 'Luxury retail DPP, autenticación NFT, trazabilidad de producto y royalties EIP-2981.',
  },
  {
    name: 'BZ CargoLink',
    url: 'http://localhost:3019',
    port: '3019',
    icon: Ship,
    accent: 'text-sky-300 bg-sky-400/10 border-sky-400/50',
    description: 'Logística, contenedores, manifiestos digitales y seguimiento multimodal de carga.',
  },
  {
    name: 'BEZ Energy',
    url: 'http://localhost:3017',
    port: '3017',
    icon: Droplets,
    accent: 'text-teal-300 bg-teal-400/10 border-teal-400/50',
    description: 'Energía tokenizada, medición industrial, eficiencia operativa y reporting de consumo.',
  },
  {
    name: 'BZ PureScan',
    url: 'http://localhost:3018',
    port: '3018',
    icon: ShieldCheck,
    accent: 'text-lime-300 bg-lime-400/10 border-lime-400/50',
    description: 'Verificación de pureza, cumplimiento, certificados y auditoría de activos sensibles.',
  },
  {
    name: 'BZ Sphere',
    url: 'http://localhost:3020',
    port: '3020',
    icon: Globe2,
    accent: 'text-indigo-300 bg-indigo-400/10 border-indigo-400/50',
    description: 'Vista global del ecosistema, relaciones entre módulos, operaciones y datos estratégicos.',
  },
  {
    name: 'BZ Genesis',
    url: 'http://localhost:3004',
    port: '3004',
    icon: Cpu,
    accent: 'text-fuchsia-300 bg-fuchsia-400/10 border-fuchsia-400/50',
    description: 'Onboarding inicial, creación de activos, génesis de proyectos y configuración base.',
  },
  {
    name: 'BeZhas Pay Manager',
    url: 'http://localhost:5173',
    port: 'Vite',
    icon: Coins,
    accent: 'text-amber-300 bg-amber-400/10 border-amber-400/50',
    description: 'Gestión de cobros, pagos, links comerciales y flujos de monetización del ecosistema.',
  },
];
