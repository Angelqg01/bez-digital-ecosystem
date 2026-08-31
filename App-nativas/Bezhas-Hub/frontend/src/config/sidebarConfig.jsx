import React from 'react';
import {
  Home,
  LayoutDashboard,
  Building2,
  Network,
  Boxes,
  Ship,
  Landmark,
  Bolt,
  Eye,
  ScanLine,
  BadgeCheck,
  Wallet,
  Fuel,
  Cpu,
  Globe2,
  CreditCard,
  CircleDollarSign,
  Crown,
  Code,
  BookOpen,
  ActivitySquare,
  ShieldCheck,
  User,
  Settings,
  Info,
  Newspaper,
  GitBranch,
  FileText,
} from 'lucide-react';
import { subappUrl } from './subappUrls';

/**
 * @dev BeZhas-Hub Sidebar — Plano de Control B2B.
 *
 * El Hub es la consola de control para Instituciones · Holdings · Empresas
 * multi-sede. La navegación se organiza en torno a: controlar la organización,
 * operar cada vertical (SubApp real), pagar/suscribir, e integrar vía
 * API · SDK · Plugin WordPress.
 *
 * TODOS los enlaces son REALES:
 *   - http(s) → deep-link a la SubApp en producción (config/subappUrls.js)
 *   - /ruta   → ruta interna real del Hub (ver App.jsx router)
 *
 * Categorías:
 *   control      → Panel de control de la organización y sus sedes
 *   verticales   → Servicios operativos (SubApps) por sector
 *   finanzas     → Pagos, token y planes de suscripción
 *   integracion  → API · SDK · Plugin WordPress · Oracle · Compliance
 *   cuenta       → Perfil y configuración
 *   support      → Recursos y soporte
 */

export const sidebarNavItems = [
  // ========================================
  // 🛰️ CONTROL — ORGANIZACIÓN Y SEDES
  // ========================================
  {
    path: '/',
    icon: <Home size={22} />,
    label: 'Dashboard',
    description: 'Panel central del ecosistema y estado de servicios',
    roles: ['public', 'user', 'admin'],
    category: 'control',
  },
  {
    path: '/business-dashboard',
    icon: <Building2 size={22} />,
    label: 'Organización & Sedes',
    description: 'Holding/empresa: control de sedes, departamentos y flotas',
    roles: ['user', 'admin'],
    category: 'control',
    badge: 'B2B',
  },
  {
    path: '/metrics',
    icon: <ActivitySquare size={22} />,
    label: 'Estado de Red',
    description: 'Salud, throughput y métricas de la infraestructura',
    roles: ['user', 'admin'],
    category: 'control',
  },

  // ========================================
  // 🧩 VERTICALES — SERVICIOS (SubApps reales)
  // ========================================
  {
    path: subappUrl('cargolink'),
    icon: <Ship size={22} />,
    label: 'CargoLink · Logística',
    description: 'Flota, contenedores, aduanas y trazabilidad de extremo a extremo',
    roles: ['user', 'admin'],
    category: 'verticales',
  },
  {
    path: subappUrl('energy'),
    icon: <Bolt size={22} />,
    label: 'Energy · VPP',
    description: 'Control de activos electro-energéticos y mercado OMIE',
    roles: ['user', 'admin'],
    category: 'verticales',
  },
  {
    path: '/rwa',
    icon: <Building2 size={22} />,
    label: 'Inmobiliaria · RWA',
    description: 'Tokenización de inmuebles para renta o venta',
    roles: ['user', 'admin'],
    category: 'verticales',
  },
  {
    path: subappUrl('vision'),
    icon: <Eye size={22} />,
    label: 'Vision Scan',
    description: 'Trazabilidad de activos por visión artificial + IA',
    roles: ['user', 'admin'],
    category: 'verticales',
  },
  {
    path: subappUrl('purescan'),
    icon: <ScanLine size={22} />,
    label: 'PureScan · Compliance',
    description: 'Auditoría, certificados y verificación de socios',
    roles: ['user', 'admin'],
    category: 'verticales',
  },
  {
    path: subappUrl('prestige'),
    icon: <BadgeCheck size={22} />,
    label: 'Prestige · Club B2B',
    description: 'Networking y directorio de socios verificados',
    roles: ['user', 'admin'],
    category: 'verticales',
  },
  {
    path: subappUrl('genesis'),
    icon: <Network size={22} />,
    label: 'Genesis · ERP',
    description: 'Gestión empresarial integral y onboarding de unidades',
    roles: ['user', 'admin'],
    category: 'verticales',
  },
  {
    path: subappUrl('capital'),
    icon: <Landmark size={22} />,
    label: 'Capital · DeFi',
    description: 'Tesorería: staking, farming y liquidez',
    roles: ['user', 'admin'],
    category: 'verticales',
  },

  // ========================================
  // 💳 FINANZAS — PAGOS · TOKEN · PLANES
  // ========================================
  {
    path: '/pay',
    icon: <CreditCard size={22} />,
    label: 'BeZhas Pay',
    description: 'Cobros y pagos fiat/cripto con liquidación real',
    roles: ['public', 'user', 'admin'],
    category: 'finanzas',
    badge: 'v2.0',
  },
  {
    path: subappUrl('wallet'),
    icon: <Wallet size={22} />,
    label: 'Wallet & Gobernanza',
    description: 'Custodia BEZ, bridge, validadores y votaciones',
    roles: ['user', 'admin'],
    category: 'finanzas',
  },
  {
    path: subappUrl('gas'),
    icon: <Fuel size={22} />,
    label: 'Gas Tank',
    description: 'Gas abstraction y patrocinio de transacciones',
    roles: ['user', 'admin'],
    category: 'finanzas',
  },
  {
    path: '/buy-tokens',
    icon: <CircleDollarSign size={22} />,
    label: 'Comprar BEZ',
    description: 'Adquirir BEZ-Coin (combustible del ecosistema)',
    roles: ['public', 'user', 'admin'],
    category: 'finanzas',
    badge: '🔥',
  },
  {
    path: '/be-vip',
    icon: <Crown size={22} />,
    label: 'Planes & Suscripción',
    description: 'Planes para usuarios y empresas + activación de SubApps',
    roles: ['public', 'user', 'admin'],
    category: 'finanzas',
  },

  // ========================================
  // 🔌 INTEGRACIÓN — API · SDK · PLUGIN
  // ========================================
  {
    path: '/developer-console',
    icon: <Code size={22} />,
    label: 'API · SDK · Plugin',
    description: 'Claves API, SDK y plugin WordPress para tus sistemas',
    roles: ['user', 'admin'],
    category: 'integracion',
    badge: 'API',
  },
  {
    path: '/oracle',
    icon: <GitBranch size={22} />,
    label: 'Data Oracle & Workflows',
    description: 'Validación de procesos y datos on-chain',
    roles: ['user', 'admin'],
    category: 'integracion',
  },
  {
    path: '/compliance',
    icon: <ShieldCheck size={22} />,
    label: 'Compliance',
    description: 'MiCA · AEAT · DAC8 y reporting regulatorio',
    roles: ['user', 'admin'],
    category: 'integracion',
  },
  {
    path: '/docs',
    icon: <BookOpen size={22} />,
    label: 'Documentación',
    description: 'Guías, referencia de API, SDK y webhooks',
    roles: ['public', 'user', 'admin'],
    category: 'integracion',
  },

  // ========================================
  // 👤 CUENTA — PERFIL Y CONFIGURACIÓN
  // ========================================
  {
    path: '/profile',
    icon: <User size={22} />,
    label: 'Mi Perfil',
    description: 'Perfil, wallet y datos de la organización',
    roles: ['user', 'admin'],
    category: 'cuenta',
  },
  {
    path: '/settings',
    icon: <Settings size={22} />,
    label: 'Configuración',
    description: 'Red, claves, webhooks y preferencias',
    roles: ['user', 'admin'],
    category: 'cuenta',
  },

  // ========================================
  // 📚 SOPORTE — RECURSOS
  // ========================================
  {
    path: '/client-guides',
    icon: <FileText size={22} />,
    label: 'Guías de Integración',
    description: 'API, SDK y Plugin WordPress: paso a paso para integrar BeZhas',
    roles: ['public', 'user', 'admin'],
    category: 'integracion',
    badge: 'Nuevo',
  },
  {
    path: '/master',
    icon: <BookOpen size={22} />,
    label: 'Cómo dominar BeZhas Hub',
    description: 'Guía educativa: estructura, roles, servicios, configuración y rentabilidades',
    roles: ['public', 'user', 'admin'],
    category: 'support',
    badge: '📖',
  },
  {
    path: '/magazine',
    icon: <Newspaper size={22} />,
    label: 'Magazine',
    description: 'Noticias y actualizaciones del ecosistema',
    roles: ['public', 'user', 'admin'],
    category: 'support',
  },
  {
    path: '/about',
    icon: <Info size={22} />,
    label: 'Acerca de BeZhas',
    description: 'Información de la plataforma',
    roles: ['public', 'user', 'admin'],
    category: 'support',
  },
];

// Función helper para agrupar items por categoría
export const getCategorizedItems = (items) => {
  const categories = {
    control: { label: '🛰️ Control', icon: <LayoutDashboard size={18} />, items: [] },
    verticales: { label: '🧩 Servicios', icon: <Boxes size={18} />, items: [] },
    finanzas: { label: '💳 Finanzas & Planes', icon: <CreditCard size={18} />, items: [] },
    integracion: { label: '🔌 API · SDK · Plugin', icon: <Code size={18} />, items: [] },
    cuenta: { label: '👤 Cuenta', icon: <User size={18} />, items: [] },
    support: { label: '📚 Soporte', icon: <BookOpen size={18} />, items: [] },
  };

  items.forEach((item) => {
    if (categories[item.category]) {
      categories[item.category].items.push(item);
    }
  });

  return categories;
};
