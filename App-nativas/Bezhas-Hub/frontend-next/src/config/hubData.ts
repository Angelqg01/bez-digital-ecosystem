// Datos reales de BeZhas que muestra el Hub. Fuente de verdad en el repo:
//   · apps y enlaces  → control-center/frontend/app/(landing)/page.tsx (secondaryApps)
//   · planes y pagos  → api/config/plans.js y api/config/stripe-payment-links.js
//   · contratos       → CLAUDE.md (sección «Contratos deployados»)
// Si cambia un precio, un Payment Link o un dominio, cambiarlo allí y aquí. No se inventan cifras:
// lo que no es un dato fijo (estado de cada app) se consulta en vivo en el servidor.

export const SITE = 'https://www.bezhas.com';

export type AppInfo = {
  key: string;
  name: string;
  tag: string;
  desc: string;
  /** URL pública; sin ella la app aún no está publicada. */
  href?: string;
  icon: string;
};

/** Apps nativas publicadas detrás del balanceador (*.bezhas.com). */
export const LIVE_APPS: AppInfo[] = [
  {
    key: 'capital',
    name: 'BZ Capital',
    tag: 'Finanzas Web3',
    desc: 'Suite financiera descentralizada: staking, farming, bridge, wallet, DAO y liquidez conectadas al token BEZ.',
    href: 'https://capital.bezhas.com/defi',
    icon: 'landmark',
  },
  {
    key: 'wallet',
    name: 'BEZ Wallet',
    tag: 'Billetera no custodial',
    desc: 'Cuentas inteligentes: las claves son del usuario, el gas lo patrocina la empresa y los guardianes recuperan el acceso.',
    href: 'https://wallet.bezhas.com',
    icon: 'wallet',
  },
  {
    key: 'pay',
    name: 'BeZhas Pay',
    tag: 'Cobros y checkout',
    desc: 'Páginas de pago alojadas, reembolsos y plugin para WordPress, con liquidación en BEZ-Coin sobre Polygon.',
    href: 'https://pay.bezhas.com',
    icon: 'credit-card',
  },
  {
    key: 'cargolink',
    name: 'BZ CargoLink',
    tag: 'Logística y aduanas',
    desc: 'Tracking de cargas, NFTs de envío, escrow de entrega y despacho aduanero verificable on-chain.',
    href: 'https://cargolink.bezhas.com',
    icon: 'truck',
  },
  {
    key: 'energy',
    name: 'BEZ Energy',
    tag: 'Energía y RWA verde',
    desc: 'Certificados de ahorro energético (CAE), créditos de carbono, oráculos ESG y mercado P2P de energía.',
    href: 'https://energy.bezhas.com',
    icon: 'zap',
  },
  {
    key: 'purescan',
    name: 'BZ PureScan',
    tag: 'IA, visión y trazabilidad',
    desc: 'Verificación con visión artificial: escaneo, Food Oracle y gemelos digitales de activos RWA.',
    href: 'https://purescan.bezhas.com',
    icon: 'scan-line',
  },
];

/** Prototipos sin datos reales todavía: se listan como «en desarrollo» y no llevan enlace. */
export const UPCOMING_APPS: AppInfo[] = [
  { key: 'gas', name: 'Gas Tank Manager', tag: 'Gas y paymaster', desc: 'Recarga y patrocinio de gas para operaciones corporativas.', icon: 'fuel' },
  { key: 'edge', name: 'Edge Node Manager', tag: 'Nodos DePIN', desc: 'Gestión de nodos y recompensas.', icon: 'server' },
  { key: 'vision', name: 'Vision Scan', tag: 'Visión artificial', desc: 'Validación física con IA y blockchain.', icon: 'eye' },
  { key: 'prestige', name: 'BZ Prestige', tag: 'Club B2B', desc: 'Autenticidad de activos de alto valor.', icon: 'gem' },
  { key: 'sphere', name: 'BZ Sphere', tag: 'Comunidad', desc: 'Colaboración entre nodos y votaciones.', icon: 'users' },
  { key: 'genesis', name: 'BZ Genesis', tag: 'Identidad y agentes', desc: 'Identidad y agentes especializados.', icon: 'sparkles' },
];

export type Plan = {
  id: string;
  name: string;
  profile: string;
  price: string;
  priceNote: string;
  annual?: string;
  features: string[];
  monthlyUrl?: string;
  annualUrl?: string;
  highlight?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    profile: 'Autónomos y startups',
    price: '0 €',
    priceNote: '15 días gratis, después pago por uso',
    features: [
      'Hub y Wallet incluidos',
      '150 acciones de IA para empezar',
      'API y SDK con consumo real',
      'OPERANT: Ventas y Soporte en modo borrador',
    ],
  },
  {
    id: 'creator_pro',
    name: 'Creator Pro',
    profile: 'Pymes y creadores',
    price: '99 €',
    priceNote: '/mes + IVA',
    annual: '990 €/año (2 meses gratis)',
    features: [
      '1.500 acciones de IA al mes',
      '25 % de gas subvencionado',
      'Hub, Wallet y apps nativas activables',
      'OPERANT opcional: 4 departamentos (+39 €/mes)',
    ],
    monthlyUrl: 'https://buy.stripe.com/8x2aEXgqY2q29bEeqTew807',
    annualUrl: 'https://buy.stripe.com/6oU9ATa2A6Gi0F83Mfew80a',
  },
  {
    id: 'business',
    name: 'Business',
    profile: 'Empresas en crecimiento',
    price: '499 €',
    priceNote: '/mes + IVA',
    annual: '4.990 €/año (2 meses gratis)',
    features: [
      '15.000 acciones de IA al mes',
      '50 % de gas subvencionado',
      'Conectores ERP: SAP, Dynamics, NetSuite, Odoo',
      'OPERANT opcional: 8 departamentos autónomos (+249 €/mes)',
    ],
    monthlyUrl: 'https://buy.stripe.com/00w3cv7UsggSfA22Ibew80f',
    annualUrl: 'https://buy.stripe.com/8x228r8YwfcO87A4Qjew80b',
    highlight: true,
  },
  {
    id: 'enterprise_vip',
    name: 'Enterprise VIP',
    profile: 'Holdings e instituciones',
    price: '2.499 €',
    priceNote: '/mes + IVA',
    annual: '24.990 €/año (2 meses gratis)',
    features: [
      'Acciones de IA sin límite',
      '100 % de gas subvencionado',
      'Despliegue y conectores ERP a medida',
      'OPERANT opcional: 10 departamentos (+1.199 €/mes)',
    ],
    monthlyUrl: 'https://buy.stripe.com/aFa4gzb6E4ya1Jc4Qjew809',
    annualUrl: 'https://buy.stripe.com/fZufZhgqY8Oq73w2Ibew80c',
  },
];

export const PLUGIN = {
  version: '2.0.2',
  php: '8.2',
  file: 'bezhas-hub-2.0.2.zip',
  url: `${SITE}/downloads/bezhas-hub-2.0.2.zip`,
  sha256Url: `${SITE}/downloads/bezhas-hub-2.0.2.zip.sha256`,
  sha256: '3b9bf504f2f437f61a782b4db8402116f59d9995d6f5e47eee014d43a4f8dcb4',
};

export const CONTRACTS = [
  { label: 'BEZ-Coin (Polygon)', address: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8' },
  { label: 'Treasury DAO', address: '0x89c23890c742d710265dD61be789C71dC8999b12' },
  { label: 'QualityEscrow', address: '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3' },
];

export const POLYGONSCAN = 'https://polygonscan.com/address/';

export const LINKS = {
  precios: `${SITE}/precios`,
  token: `${SITE}/token`,
  buyBez: `${SITE}/token/buy`,
  developers: `${SITE}/developers`,
  mcp: `${SITE}/mcp`,
  docs: `${SITE}/docs`,
  learn: `${SITE}/learn`,
  network: `${SITE}/network`,
  rpc: `${SITE}/rpc`,
  support: `${SITE}/support`,
  solutions: `${SITE}/solutions`,
  enterprise: `${SITE}/enterprise`,
  privacy: `${SITE}/privacy`,
  telegram: 'https://t.me/BeZhasBot',
  github: 'https://github.com/bezhas',
  sales: 'mailto:ventas@bezhas.com',
  mcpEndpoint: 'https://mcp.bezhas.com/mcp',
  api: 'https://api.bezhas.com',
};

/** Lo que hace el Hub, según su ficha pública. */
export const HUB_PILLARS = [
  {
    title: 'Organización y sedes',
    body: 'Cada empresa tiene su organización, sus sedes y sus miembros, con los roles de cada persona.',
    icon: 'building-2',
  },
  {
    title: 'Claves de API con permisos',
    body: 'Crea claves con permisos acotados y consulta el consumo de tu plan sin salir del Hub.',
    icon: 'key-round',
  },
  {
    title: 'ID único compartido',
    body: 'Las entidades se identifican con su BeZhas ID, el mismo en todas las apps nativas.',
    icon: 'fingerprint',
  },
  {
    title: 'Simulador logístico 360°',
    body: 'Prueba flujos de origen a destino antes de operar con datos reales.',
    icon: 'route',
  },
];
