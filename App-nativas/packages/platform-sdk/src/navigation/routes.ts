/**
 * Centralized route definitions for the entire BeZhas ecosystem.
 * Used by the AppSwitcher component and for cross-app navigation.
 */

export interface AppRoute {
  id: string;
  name: string;
  description: string;
  basePath: string;
  icon: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  category: 'core' | 'industrial' | 'ecosystem' | 'growth';
  requiredTier: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'coming-soon' | 'beta';
}

export const ROUTES: AppRoute[] = [
  {
    id: 'hub',
    name: 'BeZhas Hub',
    description: 'Dashboard central — estado del ecosistema y Dev Console',
    basePath: '/hub',
    icon: '🏠',
    priority: 'P0',
    category: 'core',
    requiredTier: 'free',
    status: 'active',
  },
  {
    id: 'wallet',
    name: 'BEZ Wallet',
    description: 'Wallet no-custodial con envío, recepción y galería NFT',
    basePath: '/dashboard/wallet',
    icon: '💰',
    priority: 'P0',
    category: 'core',
    requiredTier: 'free',
    status: 'active',
  },
  {
    id: 'gas-tank',
    name: 'Corporate Gas Tank',
    description: 'Recarga de gas con tarjeta — el equipo contable nunca compra crypto',
    basePath: '/gas-tank',
    icon: '⛽',
    priority: 'P0',
    category: 'core',
    requiredTier: 'pro',
    status: 'active',
  },
  {
    id: 'edge-node',
    name: 'Edge Node Manager',
    description: 'Configuración y monitorización de nodos DePIN',
    basePath: '/dashboard/validators',
    icon: '🖥️',
    priority: 'P0',
    category: 'core',
    requiredTier: 'enterprise',
    status: 'active',
  },
  {
    id: 'scanner',
    name: 'BEZ Vision Scan',
    description: 'Escaneo IA de activos físicos → NFT en blockchain',
    basePath: '/dashboard/qr',
    icon: '📷',
    priority: 'P0',
    category: 'industrial',
    requiredTier: 'pro',
    status: 'active',
  },
  {
    id: 'customs',
    name: 'BeZhas Customs',
    description: 'Despacho aduanero digital — SIMPLE y ASYCUDA integrados',
    basePath: '/dashboard/sectors',
    icon: '🛃',
    priority: 'P1',
    category: 'industrial',
    requiredTier: 'enterprise',
    status: 'beta',
  },
  {
    id: 'capital',
    name: 'BZ Capital Hub',
    description: 'DeFi, Trading, RWA Pools — todo tu capital en un lugar',
    basePath: '/dashboard/farming',
    icon: '📈',
    priority: 'P1',
    category: 'industrial',
    requiredTier: 'pro',
    status: 'beta',
  },
  {
    id: 'food-oracle',
    name: 'Food Oracle',
    description: 'Trazabilidad alimentaria, frescura y alérgenos con IA',
    basePath: '/dashboard/sectors',
    icon: '🍎',
    priority: 'P1',
    category: 'industrial',
    requiredTier: 'pro',
    status: 'coming-soon',
  },
  {
    id: 'authentic',
    name: 'Authentic',
    description: 'Anti-falsificación para marcas de lujo y retail',
    basePath: '/dashboard/nfts',
    icon: '🛡️',
    priority: 'P1',
    category: 'industrial',
    requiredTier: 'enterprise',
    status: 'coming-soon',
  },
  {
    id: 'bridge',
    name: 'BeZhas Bridge',
    description: 'Puente multi-cadena: BeZhas L2 ↔ Polygon ↔ Ethereum',
    basePath: '/bridge',
    icon: '🌉',
    priority: 'P2',
    category: 'ecosystem',
    requiredTier: 'free',
    status: 'coming-soon',
  },
  {
    id: 'dao',
    name: 'DAO Governance',
    description: 'Vota propuestas que definen el futuro de BeZhas',
    basePath: '/dao',
    icon: '🗳️',
    priority: 'P2',
    category: 'ecosystem',
    requiredTier: 'free',
    status: 'coming-soon',
  },
  {
    id: 'explorer',
    name: 'BeZhas Explorer',
    description: 'Explorador de bloques en lenguaje de negocio',
    basePath: '/explorer',
    icon: '🔍',
    priority: 'P2',
    category: 'ecosystem',
    requiredTier: 'free',
    status: 'coming-soon',
  },
  {
    id: 'dev-sandbox',
    name: 'Developer Sandbox',
    description: 'Playground para devs: SDK, ABI, MCP y Vision API',
    basePath: '/dev-sandbox',
    icon: '🧪',
    priority: 'P2',
    category: 'ecosystem',
    requiredTier: 'free',
    status: 'coming-soon',
  },
  {
    id: 'learn',
    name: 'Learn-to-Earn',
    description: 'Aprende sobre BeZhas y gana BEZ-Coin',
    basePath: '/learn',
    icon: '🎓',
    priority: 'P3',
    category: 'growth',
    requiredTier: 'free',
    status: 'coming-soon',
  },
];

export function getRoutesByCategory(category: AppRoute['category']): AppRoute[] {
  return ROUTES.filter(r => r.category === category);
}

export function getActiveRoutes(): AppRoute[] {
  return ROUTES.filter(r => r.status === 'active' || r.status === 'beta');
}

export function getRouteById(id: string): AppRoute | undefined {
  return ROUTES.find(r => r.id === id);
}
