import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Box,
  Briefcase,
  BookOpen,
  Code2,
  Coins,
  Crown,
  Droplets,
  Globe2,
  HelpCircle,
  Landmark,
  LayoutGrid,
  Link2,
  Network,
  Server,
  ShieldCheck,
  Ship,
  Wallet,
  Cpu,
} from 'lucide-react';

export const BEZ_POLYGON_ADDRESS = '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8';
export const BEZ_POLYGONSCAN_URL = `https://polygonscan.com/token/${BEZ_POLYGON_ADDRESS}`;
export const DEFI_TOKENOMICS_URL = import.meta.env.VITE_BEZHAS_DEFI_URL || '/defi';
const BEZHAS_BASE_URL = 'https://bez.digital';

const prodUrl = (path: string) => `${BEZHAS_BASE_URL}${path}`;

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
    name: 'Inicio del Portal',
    url: prodUrl('/'),
    port: '/',
    icon: LayoutGrid,
    accent: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/50',
    description: 'Entrada publica al ecosistema BeZhas, estado general y acceso a verticales principales.',
  },
  {
    name: 'Portal de Desarrolladores',
    url: prodUrl('/developers'),
    port: '/developers',
    icon: Code2,
    accent: 'text-slate-300 bg-slate-400/10 border-slate-400/50',
    description: 'Consola para crear integraciones, revisar SDKs y entrar en las apps nativas.',
  },
  {
    name: 'BeZhas Hub',
    url: prodUrl('/dashboard'),
    port: '/dashboard',
    icon: LayoutGrid,
    accent: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/50',
    description: 'Landing, SSO, feed social, marketplace, DAO, pagos y consola central del ecosistema.',
  },
  {
    name: 'BeZhas Wallet',
    url: prodUrl('/dashboard/wallet'),
    port: '/dashboard/wallet',
    icon: Wallet,
    accent: 'text-blue-300 bg-blue-400/10 border-blue-400/50',
    description: 'Cartera BEZ-Coin para identidad Web3, pagos P2P, saldos, staking y gobernanza.',
  },
  {
    name: 'Gas Tank Manager',
    url: prodUrl('/dashboard/gas'),
    port: '/dashboard/gas',
    icon: Activity,
    accent: 'text-orange-300 bg-orange-400/10 border-orange-400/50',
    description: 'Panel de gas abstraction, recargas, predicción Aegis ML y operación paymaster.',
  },
  {
    name: 'Edge Node Manager',
    url: prodUrl('/dashboard/validators'),
    port: '/dashboard/validators',
    icon: Server,
    accent: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/50',
    description: 'Gestión DePIN de nodos, recursos, validadores, recompensas y salud de red.',
  },
  {
    name: 'BEZ Vision Scan',
    url: prodUrl('/dashboard/qr'),
    port: '/dashboard/qr',
    icon: Box,
    accent: 'text-pink-300 bg-pink-400/10 border-pink-400/50',
    description: 'Escaneo de activos físicos con IA, fingerprint visual, trazabilidad y oracle logístico.',
  },
  {
    name: 'BZ Capital',
    url: prodUrl('/dashboard/farming'),
    port: '/dashboard/farming',
    icon: Briefcase,
    accent: 'text-purple-300 bg-purple-400/10 border-purple-400/50',
    description: 'DeFi, tokenomics, staking, yield farming y fraccionamiento de activos RWA.',
  },
  {
    name: 'BZ Prestige',
    url: prodUrl('/dashboard/nfts'),
    port: '/dashboard/nfts',
    icon: Crown,
    accent: 'text-yellow-300 bg-yellow-400/10 border-yellow-400/50',
    description: 'Luxury retail DPP, autenticación NFT, trazabilidad de producto y royalties EIP-2981.',
  },
  {
    name: 'BZ CargoLink',
    url: prodUrl('/dashboard/sectors'),
    port: '/dashboard/sectors',
    icon: Ship,
    accent: 'text-sky-300 bg-sky-400/10 border-sky-400/50',
    description: 'Logística, contenedores, manifiestos digitales y seguimiento multimodal de carga.',
  },
  {
    name: 'BEZ Energy',
    url: prodUrl('/enterprise'),
    port: '/enterprise',
    icon: Droplets,
    accent: 'text-teal-300 bg-teal-400/10 border-teal-400/50',
    description: 'Energía tokenizada, medición industrial, eficiencia operativa y reporting de consumo.',
  },
  {
    name: 'BZ PureScan',
    url: prodUrl('/dashboard/qr'),
    port: '/dashboard/qr',
    icon: ShieldCheck,
    accent: 'text-lime-300 bg-lime-400/10 border-lime-400/50',
    description: 'Verificación de pureza, cumplimiento, certificados y auditoría de activos sensibles.',
  },
  {
    name: 'BZ Sphere',
    url: prodUrl('/solutions'),
    port: '/solutions',
    icon: Globe2,
    accent: 'text-indigo-300 bg-indigo-400/10 border-indigo-400/50',
    description: 'Vista global del ecosistema, relaciones entre módulos, operaciones y datos estratégicos.',
  },
  {
    name: 'BZ Genesis',
    url: prodUrl('/dashboard'),
    port: '/dashboard',
    icon: Cpu,
    accent: 'text-fuchsia-300 bg-fuchsia-400/10 border-fuchsia-400/50',
    description: 'Onboarding inicial, creación de activos, génesis de proyectos y configuración base.',
  },
  {
    name: 'BeZhas Pay Manager',
    url: prodUrl('/payments'),
    port: '/payments',
    icon: Coins,
    accent: 'text-amber-300 bg-amber-400/10 border-amber-400/50',
    description: 'Gestión de cobros, pagos, links comerciales y flujos de monetización del ecosistema.',
  },
  {
    name: 'Learn-to-Earn',
    url: prodUrl('/learn'),
    port: '/learn',
    icon: BookOpen,
    accent: 'text-green-300 bg-green-400/10 border-green-400/50',
    description: 'Academia y documentación educativa para completar módulos y avanzar en el ecosistema.',
  },
  {
    name: 'API & SDK Reference',
    url: prodUrl('/docs'),
    port: '/docs',
    icon: Code2,
    accent: 'text-violet-300 bg-violet-400/10 border-violet-400/50',
    description: 'Referencia técnica para APIs, SDK, webhooks y contratos integrables.',
  },
  {
    name: 'RPC & Nodos',
    url: prodUrl('/rpc'),
    port: '/rpc',
    icon: Network,
    accent: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/50',
    description: 'Endpoints RPC, nodos y conectividad de red para integraciones blockchain.',
  },
  {
    name: 'Bridges Multi-cadena',
    url: prodUrl('/bridges'),
    port: '/bridges',
    icon: Link2,
    accent: 'text-blue-300 bg-blue-400/10 border-blue-400/50',
    description: 'Puentes multichain para mover activos y datos entre redes compatibles.',
  },
  {
    name: 'Comercio Supply Chain',
    url: prodUrl('/commerce'),
    port: '/commerce',
    icon: Ship,
    accent: 'text-orange-300 bg-orange-400/10 border-orange-400/50',
    description: 'Flujos comerciales y supply chain para operaciones industriales tokenizadas.',
  },
  {
    name: 'BEZ-Coin Tokenomics',
    url: prodUrl('/token'),
    port: '/token',
    icon: Coins,
    accent: 'text-yellow-300 bg-yellow-400/10 border-yellow-400/50',
    description: 'Economía del token, emisión, utilidad, liquidez y métricas de BEZ-Coin.',
  },
  {
    name: 'Estado de Red',
    url: prodUrl('/network'),
    port: '/network',
    icon: Activity,
    accent: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/50',
    description: 'Estado operativo, salud de red y métricas principales de infraestructura.',
  },
  {
    name: 'Servicios Financieros',
    url: prodUrl('/financial'),
    port: '/financial',
    icon: Landmark,
    accent: 'text-purple-300 bg-purple-400/10 border-purple-400/50',
    description: 'Servicios financieros, liquidez, productos corporativos y vertical DeFi.',
  },
  {
    name: 'Soporte Técnico',
    url: prodUrl('/support'),
    port: '/support',
    icon: HelpCircle,
    accent: 'text-rose-300 bg-rose-400/10 border-rose-400/50',
    description: 'Centro de ayuda y soporte técnico para usuarios, empresas y desarrolladores.',
  },
];
