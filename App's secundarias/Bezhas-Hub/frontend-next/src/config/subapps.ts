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
    url: env.NEXT_PUBLIC_BEZHAS_WALLET_URL || 'https://bez.digital/dashboard/wallet',
    owns: ['Wallet', 'Bridge', 'DAO', 'Governance', 'Validators'],
  },
  gas: {
    key: 'gas',
    name: 'Gas Tank Manager',
    url: env.NEXT_PUBLIC_BEZHAS_GAS_URL || 'https://bez.digital/dashboard/gas',
    owns: ['Gas', 'Paymaster', 'Corporate refills'],
  },
  nodes: {
    key: 'nodes',
    name: 'Edge Node Manager',
    url: env.NEXT_PUBLIC_BEZHAS_NODES_URL || 'https://bez.digital/dashboard/validators',
    owns: ['Edge nodes', 'DePIN rewards', 'Node health'],
  },
  vision: {
    key: 'vision',
    name: 'BeZhas Vision Scan',
    url: env.NEXT_PUBLIC_BEZHAS_VISION_URL || 'https://bez.digital/dashboard/qr',
    owns: ['Vision scan', 'Quality oracle', 'Physical validation'],
  },
  capital: {
    key: 'capital',
    name: 'BZ Capital',
    url: env.NEXT_PUBLIC_BEZHAS_CAPITAL_URL || 'https://bez.digital/dashboard/farming',
    owns: ['DeFi', 'Staking', 'Farming', 'Tokenomics', 'RWA', 'Treasury'],
  },
  pay: {
    key: 'pay',
    name: 'BeZhas Pay Manager',
    url: env.NEXT_PUBLIC_BEZHAS_PAY_URL || 'https://bez.digital/payments',
    owns: ['Payments operations', 'Checkout', 'Payment reconciliation'],
  },
  cargo: {
    key: 'cargo',
    name: 'BZ CargoLink',
    url: env.NEXT_PUBLIC_BEZHAS_CARGO_URL || 'https://bez.digital/dashboard/sectors',
    owns: ['Logistics', 'Cargo fingerprints', 'Customs sync'],
  },
  prestige: {
    key: 'prestige',
    name: 'BZ Prestige',
    url: env.NEXT_PUBLIC_BEZHAS_PRESTIGE_URL || 'https://bez.digital/dashboard/nfts',
    owns: ['Luxury DPP', 'Resale market', 'Brand royalties'],
  },
  sphere: {
    key: 'sphere',
    name: 'BZ Sphere',
    url: env.NEXT_PUBLIC_BEZHAS_SPHERE_URL || 'https://bez.digital/solutions',
    owns: ['Community', 'Social graph', 'Ecosystem feed'],
  },
};

export function subappUrl(key: SubappKey, path = '') {
  const base = SUBAPPS[key].url.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix === '/' ? '' : suffix}`;
}
