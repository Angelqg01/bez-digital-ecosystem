import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  BarChart,
  User,
  Info,
  Shield,
  BadgeCheck,
  PlusCircle,
  Sprout,
  MessagesSquare,
  Users,
  Store,
  Settings,
  Trophy,
  ListChecks,
  ActivitySquare,
  Home,
  Wallet,
  Bell,
  Gift,
  MessageCircle,
  UsersRound,
  Coins,
  Crown,
  Megaphone,
  MessageSquare,
  Bot,
  Vote,
  BookOpen,
  Code,
  Briefcase,
  TrendingUp,
  Building2,
  Package,
  CircleDollarSign,
  Droplets
} from 'lucide-react';

/**
 * @dev BeZhas Sidebar Navigation - Organización Profesional
 * Estructura optimizada para empresa de servicios Web3
 * 
 * Categorías:
 * 1. WORKSPACE - Espacio de trabajo principal
 * 2. WEB3 SERVICES - Servicios blockchain core
 * 3. BUSINESS TOOLS - Herramientas empresariales
 * 4. PLATFORM - Gestión de plataforma
 * 5. SUPPORT - Soporte y recursos
 */

export const sidebarNavItems = [
  // ========================================
  // 📊 WORKSPACE - ESPACIO DE TRABAJO
  // ========================================
  {
    path: '/',
    icon: <Home size={22} />,
    label: 'Dashboard',
    description: 'Panel principal y actividad reciente',
    roles: ['public', 'user', 'admin'],
    category: 'workspace'
  },
  {
    path: '/profile',
    icon: <User size={22} />,
    label: 'Mi Perfil',
    description: 'Perfil, Wallet y configuración personal',
    roles: ['user', 'admin'],
    category: 'workspace'
  },

  // ========================================
  // 🔷 WEB3 SERVICES - SERVICIOS BLOCKCHAIN
  // ========================================
  {
    path: '/marketplace',
    icon: <ShoppingCart size={22} />,
    label: 'NFT Marketplace',
    description: 'Comprar, vender y coleccionar NFTs',
    roles: ['public', 'user', 'admin'],
    category: 'web3'
  },
  {
    path: '/staking',
    icon: <Coins size={22} />,
    label: 'DeFi Hub',
    description: 'Staking, Farming y rendimientos DeFi',
    roles: ['user', 'admin'],
    category: 'web3'
  },
  {
    path: '/dao-page',
    icon: <Vote size={22} />,
    label: 'Gobernanza DAO',
    description: 'Votaciones, propuestas y tesorería comunitaria',
    roles: ['public', 'user', 'admin'],
    category: 'web3',
    badge: 'Nuevo'
  },
  {
    path: '/oracle',
    icon: <ActivitySquare size={22} />,
    label: 'Quality Oracle',
    description: 'Valida contenido y gana recompensas BEZ',
    roles: ['public', 'user', 'admin'],
    category: 'web3',
    badge: 'Nuevo'
  },
  {
    path: '/be-vip',
    icon: <Crown size={22} />,
    label: 'Membresía VIP',
    description: 'Beneficios exclusivos y recompensas',
    roles: ['public', 'user', 'admin'],
    category: 'web3'
  },
  {
    path: '/buy-tokens',
    icon: <CircleDollarSign size={22} />,
    label: 'Comprar BEZ',
    description: 'Adquirir paquetes de tokens BEZ-Coin',
    roles: ['public', 'user', 'admin'],
    category: 'web3',
    badge: '🔥'
  },
  {
    path: '/pay',
    icon: <Wallet size={22} />,
    label: 'BeZhas Pay',
    description: 'Sistema financiero y pagos',
    roles: ['public', 'user', 'admin'],
    category: 'web3',
    badge: 'v2.0'
  },
  {
    path: '/liquidity',
    icon: <Droplets size={22} />,
    label: 'Proveer Liquidez',
    description: 'Añade liquidez y gana Real Yield',
    roles: ['user', 'admin'],
    category: 'web3',
    badge: 'APY'
  },

  // ========================================
  // 💼 BUSINESS TOOLS - HERRAMIENTAS EMPRESARIALES
  // ========================================
  {
    path: '/?tab=business',
    icon: <Briefcase size={22} />,
    label: 'Business Suite',
    description: 'Panel de herramientas empresariales',
    roles: ['public', 'user', 'admin'],
    category: 'business'
  },
  {
    path: '/ad-center',
    icon: <Megaphone size={22} />,
    label: 'Publicidad',
    description: 'Campañas y gestión de anuncios',
    roles: ['public', 'user', 'admin'],
    category: 'business'
  },
  {
    path: '/create',
    icon: <PlusCircle size={22} />,
    label: 'Crear NFT',
    description: 'Mintear y gestionar colecciones',
    roles: ['user', 'admin'],
    category: 'business'
  },
  {
    path: '/logistics',
    icon: <Package size={22} />,
    label: 'Logística',
    description: 'Trazabilidad y supply chain',
    roles: ['public', 'user', 'admin'],
    category: 'business',
    badge: 'Demo'
  },
  {
    path: '/real-estate',
    icon: <Building2 size={22} />,
    label: 'Real Estate',
    description: 'Tokenización de propiedades',
    roles: ['public', 'user', 'admin'],
    category: 'business',
    badge: 'Demo'
  },

  // ========================================
  // ⚙️ PLATFORM - GESTIÓN DE PLATAFORMA
  // ========================================
  {
    path: '/developer-console',
    icon: <Code size={22} />,
    label: 'Developer API',
    description: 'Claves API y documentación SDK',
    roles: ['user', 'admin'],
    category: 'platform',
    badge: 'API'
  },
  {
    path: '/admin',
    icon: <Shield size={22} />,
    label: 'Administración',
    description: 'Panel de control administrativo',
    roles: ['admin'],
    category: 'platform'
  },

  // ========================================
  // 📚 SUPPORT - SOPORTE Y RECURSOS
  // ========================================
  {
    path: '/docs',
    icon: <BookOpen size={22} />,
    label: 'Documentación',
    description: 'Guías, tutoriales y API docs',
    roles: ['public', 'user', 'admin'],
    category: 'support'
  },
  {
    path: '/about',
    icon: <Info size={22} />,
    label: 'Acerca de BeZhas',
    description: 'Información de la plataforma',
    roles: ['public', 'user', 'admin'],
    category: 'support'
  },
];

// Función helper para agrupar items por categoría
export const getCategorizedItems = (items) => {
  const categories = {
    workspace: { label: '📊 Workspace', icon: <LayoutDashboard size={18} />, items: [] },
    web3: { label: '🔷 Web3 Services', icon: <Coins size={18} />, items: [] },
    business: { label: '💼 Business Tools', icon: <Briefcase size={18} />, items: [] },
    platform: { label: '⚙️ Platform', icon: <Settings size={18} />, items: [] },
    support: { label: '📚 Support', icon: <BookOpen size={18} />, items: [] },
  };

  items.forEach(item => {
    if (categories[item.category]) {
      categories[item.category].items.push(item);
    }
  });

  return categories;
};
