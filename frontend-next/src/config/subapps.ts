export type SubappKey =
  | 'wallet'
  | 'gas'
  | 'nodes'
  | 'vision'
  | 'capital'
  | 'pay'
  | 'cargo'
  | 'prestige'
  | 'sphere';

export type SubappConfig = {
  key: SubappKey;
  name: string;
  url: string;
  owns: string[];
};

const env = process.env;

export const SUBAPPS: Record<SubappKey, SubappConfig> = {
  wallet: {
    key: 'wallet',
    name: 'BeZhas Wallet',
    url: env.NEXT_PUBLIC_BEZHAS_WALLET_URL || 'http://localhost:3010',
    owns: ['Wallet', 'Bridge', 'DAO', 'Governance', 'Validators'],
  },
  gas: {
    key: 'gas',
    name: 'Gas Tank Manager',
    url: env.NEXT_PUBLIC_BEZHAS_GAS_URL || 'http://localhost:3011',
    owns: ['Gas', 'Paymaster', 'Corporate refills'],
  },
  nodes: {
    key: 'nodes',
    name: 'Edge Node Manager',
    url: env.NEXT_PUBLIC_BEZHAS_NODES_URL || 'http://localhost:3012',
    owns: ['Edge nodes', 'DePIN rewards', 'Node health'],
  },
  vision: {
    key: 'vision',
    name: 'BeZhas Vision Scan',
    url: env.NEXT_PUBLIC_BEZHAS_VISION_URL || 'http://localhost:3013',
    owns: ['Vision scan', 'Quality oracle', 'Physical validation'],
  },
  capital: {
    key: 'capital',
    name: 'BZ Capital',
    url: env.NEXT_PUBLIC_BEZHAS_CAPITAL_URL || 'http://localhost:3014',
    owns: ['DeFi', 'Staking', 'Farming', 'Tokenomics', 'RWA', 'Treasury'],
  },
  pay: {
    key: 'pay',
    name: 'BeZhas Pay Manager',
    url: env.NEXT_PUBLIC_BEZHAS_PAY_URL || 'http://localhost:3019',
    owns: ['Payments operations', 'Checkout', 'Payment reconciliation'],
  },
  cargo: {
    key: 'cargo',
    name: 'BZ CargoLink',
    url: env.NEXT_PUBLIC_BEZHAS_CARGO_URL || 'http://localhost:3016',
    owns: ['Logistics', 'Cargo fingerprints', 'Customs sync'],
  },
  prestige: {
    key: 'prestige',
    name: 'BZ Prestige',
    url: env.NEXT_PUBLIC_BEZHAS_PRESTIGE_URL || 'http://localhost:3015',
    owns: ['Luxury DPP', 'Resale market', 'Brand royalties'],
  },
  sphere: {
    key: 'sphere',
    name: 'BZ Sphere',
    url: env.NEXT_PUBLIC_BEZHAS_SPHERE_URL || 'http://localhost:3017',
    owns: ['Community', 'Social graph', 'Ecosystem feed'],
  },
};

export function subappUrl(key: SubappKey, path = '') {
  const base = SUBAPPS[key].url.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix === '/' ? '' : suffix}`;
}
