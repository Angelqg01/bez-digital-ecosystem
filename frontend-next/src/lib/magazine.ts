export type MagazineCategory = 'Core Updates' | 'DePIN' | 'RWA' | 'Supply Chain';

export type MagazinePost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: MagazineCategory;
  coverImage: string;
  publishedAt: string;
  authorType: 'ai' | 'human';
  readTime: string;
  body: string;
};

export const MAGAZINE_CATEGORIES: MagazineCategory[] = [
  'Core Updates',
  'DePIN',
  'RWA',
  'Supply Chain',
];

export const magazinePosts: MagazinePost[] = [
  {
    id: 'bz-core-l2-ops',
    slug: 'bz-core-l2-ops',
    title: 'BeZhas Core refuerza su capa operativa para pagos, RWA y nodos',
    excerpt:
      'La nueva arquitectura coordina wallet, pagos multi-token y verificacion de activos con una base mas estable para la expansion del ecosistema.',
    category: 'Core Updates',
    coverImage:
      'https://images.unsplash.com/photo-1639322537504-6427a16b0a28?auto=format&fit=crop&w=1400&q=80',
    publishedAt: '2026-05-08',
    authorType: 'human',
    readTime: '4 min',
    body:
      'BeZhas Core avanza hacia una capa operativa unificada donde pagos, tokenomics, RWA y herramientas de desarrollador comparten datos verificables y una experiencia comun.',
  },
  {
    id: 'depin-edge-nodes',
    slug: 'depin-edge-nodes',
    title: 'Edge Nodes prepara la red DePIN para validacion distribuida',
    excerpt:
      'Los operadores podran registrar nodos, analizar rendimiento y conectar recompensas a los flujos on-chain de BeZhas.',
    category: 'DePIN',
    coverImage:
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1400&q=80',
    publishedAt: '2026-05-07',
    authorType: 'ai',
    readTime: '5 min',
    body:
      'La estrategia DePIN de BeZhas combina observabilidad, reputacion de nodo y liquidacion automatica para que la infraestructura fisica tenga incentivos medibles.',
  },
  {
    id: 'rwa-quality-escrow',
    slug: 'rwa-quality-escrow',
    title: 'RWA con Quality Escrow: activos reales con confianza programable',
    excerpt:
      'El modulo RWA incorpora controles de calidad, custodia logica y trazabilidad para operaciones de alto valor.',
    category: 'RWA',
    coverImage:
      'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?auto=format&fit=crop&w=1400&q=80',
    publishedAt: '2026-05-06',
    authorType: 'human',
    readTime: '3 min',
    body:
      'Quality Escrow permite asociar evidencias verificables a cada activo tokenizado antes de desbloquear pagos, transferencias o recompensas.',
  },
  {
    id: 'customs-fraud-supply-chain',
    slug: 'customs-fraud-supply-chain',
    title: 'Supply Chain inmune a manipulaciones: la ruta BeZhas contra fraude aduanero',
    excerpt:
      'Los certificados, eventos logisticos y auditorias de carga se sincronizan para reducir opacidad en aduanas y transporte.',
    category: 'Supply Chain',
    coverImage:
      'https://images.unsplash.com/photo-1494412651409-8963ce7935a7?auto=format&fit=crop&w=1400&q=80',
    publishedAt: '2026-05-05',
    authorType: 'ai',
    readTime: '6 min',
    body:
      'BeZhas registra eventos logisticos criticos con firmas, evidencias y reglas de cumplimiento para que cada movimiento tenga trazabilidad verificable.',
  },
  {
    id: 'bezpay-mainnet-flow',
    slug: 'bezpay-mainnet-flow',
    title: 'BeZhas Pay consolida la compra directa de BEZ-Coin en Polygon',
    excerpt:
      'La experiencia de pago conecta Stripe, USDT, USDC y MATIC con entregas directas a la wallet del usuario.',
    category: 'Core Updates',
    coverImage:
      'https://images.unsplash.com/photo-1642104704074-907c0698cbd9?auto=format&fit=crop&w=1400&q=80',
    publishedAt: '2026-05-04',
    authorType: 'human',
    readTime: '4 min',
    body:
      'El flujo de compra de BEZ-Coin acerca la economia del ecosistema a usuarios no tecnicos sin perder custodia propia ni trazabilidad on-chain.',
  },
];

export function getLatestPosts(limit = 4) {
  return [...magazinePosts]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, limit);
}

