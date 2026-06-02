import React, { useMemo, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  TrendingUp,
  Activity,
  Sparkles,
  Zap
} from 'lucide-react';
import SimpleFunctionCard from '../components/dashboard/SimpleFunctionCard';
import LandingHero from '../components/home/LandingHero';
import DashboardCards from '../components/DashboardCards';
import BezhasIntro from '../components/home/BezhasIntro';
import { useAuth } from '../context/AuthContext';

// 50+ Funciones Empresariales Completas
const businessFunctionsData = [
  { id: 1, title: 'DAO Governance', icon: 'Users', desc: 'Sistema de gobernanza descentralizada', path: '/dao-page', color: 'from-blue-600 to-cyan-600', status: 'active' },
  { id: 2, title: 'NFT Marketplace', icon: 'ShoppingBag', desc: 'Mercado de NFTs integrado', path: '/nft-marketplace', color: 'from-purple-600 to-pink-600', status: 'active' },
  { id: 3, title: 'Staking', icon: 'Lock', desc: 'Stake BEZ y gana recompensas', path: '/staking', color: 'from-green-600 to-emerald-600', status: 'active' },
  { id: 4, title: 'Farming', icon: 'TrendingUp', desc: 'Yield Farming optimizado', path: '/farming', color: 'from-yellow-600 to-orange-600', status: 'active' },
  { id: 5, title: 'Ad Center', icon: 'Megaphone', desc: 'Gestión de campañas publicitarias', path: '/ad-center', color: 'from-red-600 to-rose-600', status: 'active' },
  { id: 6, title: 'AI Chat', icon: 'MessageSquare', desc: 'Asistente AI multimodal', path: '/ai-chat', color: 'from-indigo-600 to-violet-600', status: 'active' },
  { id: 7, title: 'Profile', icon: 'User', desc: 'Tu perfil y configuración', path: '/profile', color: 'from-teal-600 to-cyan-600', status: 'active' },
  { id: 8, title: 'Watch to Earn', icon: 'Play', desc: 'Gana viendo contenido', path: '/watch-to-earn', color: 'from-fuchsia-600 to-purple-600', status: 'active' },
  // { id: 9, title: 'Quests', icon: 'Target', desc: 'Misiones y recompensas', path: '/quests', color: 'from-lime-600 to-green-600', status: 'active' }, // REMOVED
  { id: 10, title: 'Analytics', icon: 'BarChart2', desc: 'Métricas y estadísticas', path: '/analytics', color: 'from-blue-600 to-indigo-600', status: 'active' },
  { id: 11, title: 'Treasury', icon: 'Vault', desc: 'Gestión de tesorería DAO', path: '/dao-page?tab=treasury', color: 'from-amber-600 to-yellow-600', status: 'active' },
  { id: 12, title: 'DeFi Hub', icon: 'Coins', desc: 'Centro DeFi integrado', path: '/staking', color: 'from-emerald-600 to-teal-600', status: 'active' },
  { id: 13, title: 'Token Swap', icon: 'RefreshCw', desc: 'Intercambio de tokens', path: '/swap', color: 'from-violet-600 to-purple-600', status: 'active' },
  { id: 14, title: 'Liquidity Pools', icon: 'Droplets', desc: 'Provee liquidez', path: '/liquidity', color: 'from-cyan-600 to-blue-600', status: 'active' },
  // { id: 15, title: 'Badges System', icon: 'Award', desc: 'Insignias y logros', path: '/badges', color: 'from-orange-600 to-red-600', status: 'active' }, // REMOVED
  { id: 16, title: 'Social Feed', icon: 'Rss', desc: 'Red social Web3', path: '/social', color: 'from-pink-600 to-rose-600', status: 'active' },
  { id: 17, title: 'Document NFTs', icon: 'FileText', desc: 'Certificados blockchain', path: '/documents', color: 'from-slate-600 to-gray-600', status: 'active' },
  { id: 18, title: 'Wallet Manager', icon: 'Wallet', desc: 'Gestión de wallets', path: '/wallet', color: 'from-green-600 to-lime-600', status: 'active' },
  { id: 19, title: 'Multi-Chain Bridge', icon: 'Bridge', desc: 'Puente multi-cadena', path: '/bridge', color: 'from-blue-600 to-purple-600', status: 'beta' },
  { id: 20, title: 'Automation Engine', icon: 'Cpu', desc: 'Automatización inteligente', path: '/automation', color: 'from-indigo-600 to-blue-600', status: 'active' },
  { id: 21, title: 'API Marketplace', icon: 'Code', desc: 'Marketplace de APIs Web3', path: '/api-marketplace', color: 'from-gray-600 to-slate-600', status: 'beta' },
  { id: 22, title: 'Smart Contracts', icon: 'FileCode', desc: 'Deploy contratos', path: '/contracts', color: 'from-purple-600 to-indigo-600', status: 'active' },
  { id: 23, title: 'NFT Creator Studio', icon: 'Palette', desc: 'Crea NFTs fácilmente', path: '/nft-creator', color: 'from-pink-600 to-purple-600', status: 'active' },
  { id: 24, title: 'IPFS Storage', icon: 'Database', desc: 'Almacenamiento descentralizado', path: '/ipfs', color: 'from-teal-600 to-cyan-600', status: 'active' },
  { id: 25, title: 'Governance Forum', icon: 'MessageCircle', desc: 'Foro de discusión DAO', path: '/forum', color: 'from-blue-600 to-cyan-600', status: 'active' },
  { id: 26, title: 'Voting Power', icon: 'Vote', desc: 'Tu poder de voto', path: '/voting', color: 'from-indigo-600 to-purple-600', status: 'active' },
  { id: 27, title: 'Delegate Management', icon: 'Users2', desc: 'Gestión de delegados', path: '/delegates', color: 'from-green-600 to-emerald-600', status: 'active' },
  { id: 28, title: 'Proposal Creator', icon: 'FilePlus', desc: 'Crea propuestas DAO', path: '/create-proposal', color: 'from-yellow-600 to-orange-600', status: 'active' },
  { id: 29, title: 'Token Vesting', icon: 'Clock', desc: 'Gestión de vesting', path: '/vesting', color: 'from-red-600 to-pink-600', status: 'active' },
  { id: 30, title: 'Airdrops', icon: 'Gift', desc: 'Reclama airdrops', path: '/airdrops', color: 'from-purple-600 to-fuchsia-600', status: 'active' },
  { id: 31, title: 'Referral Program', icon: 'Share2', desc: 'Programa de referidos', path: '/referrals', color: 'from-cyan-600 to-blue-600', status: 'active' },
  { id: 32, title: 'Leaderboard', icon: 'Trophy', desc: 'Rankings y competencias', path: '/leaderboard', color: 'from-yellow-600 to-amber-600', status: 'active' },
  { id: 33, title: 'Event Calendar', icon: 'Calendar', desc: 'Eventos y fechas clave', path: '/events', color: 'from-indigo-600 to-violet-600', status: 'active' },
  { id: 34, title: 'News Feed', icon: 'Newspaper', desc: 'Noticias del ecosistema', path: '/news', color: 'from-slate-600 to-gray-600', status: 'active' },
  { id: 35, title: 'Education Hub', icon: 'GraduationCap', desc: 'Aprende sobre Web3', path: '/education', color: 'from-blue-600 to-indigo-600', status: 'active' },
  { id: 36, title: 'Support Center', icon: 'HelpCircle', desc: 'Centro de ayuda', path: '/support', color: 'from-green-600 to-teal-600', status: 'active' },
  { id: 37, title: 'Bug Bounty', icon: 'Bug', desc: 'Programa de recompensas', path: '/bounty', color: 'from-red-600 to-orange-600', status: 'active' },
  { id: 38, title: 'Developer Portal', icon: 'Terminal', desc: 'Portal para devs', path: '/developers', color: 'from-gray-600 to-slate-600', status: 'active' },
  { id: 39, title: 'Multi-Sig Wallet', icon: 'Shield', desc: 'Wallets multi-firma', path: '/multisig', color: 'from-purple-600 to-pink-600', status: 'beta' },
  { id: 40, title: 'Price Oracles', icon: 'Activity', desc: 'Oráculos de precios', path: '/oracles', color: 'from-cyan-600 to-teal-600', status: 'active' },
  { id: 41, title: 'Token Launcher', icon: 'Rocket', desc: 'Lanza tu token', path: '/launch-token', color: 'from-orange-600 to-red-600', status: 'active' },
  { id: 42, title: 'Launchpad', icon: 'Zap', desc: 'IDO y preventa', path: '/launchpad', color: 'from-yellow-600 to-amber-600', status: 'active' },
  { id: 43, title: 'Lottery System', icon: 'Dice', desc: 'Lotería descentralizada', path: '/lottery', color: 'from-pink-600 to-rose-600', status: 'active' },
  { id: 44, title: 'Prediction Market', icon: 'TrendingUp', desc: 'Mercados de predicción', path: '/predictions', color: 'from-indigo-600 to-purple-600', status: 'beta' },
  { id: 45, title: 'Insurance Hub', icon: 'ShieldCheck', desc: 'Seguros DeFi', path: '/insurance', color: 'from-green-600 to-emerald-600', status: 'beta' },
  { id: 46, title: 'Portfolio Tracker', icon: 'PieChart', desc: 'Trackea tu portfolio', path: '/portfolio', color: 'from-blue-600 to-cyan-600', status: 'active' },
  { id: 47, title: 'Tax Calculator', icon: 'Calculator', desc: 'Calcula impuestos crypto', path: '/tax', color: 'from-slate-600 to-gray-600', status: 'active' },
  { id: 48, title: 'Notifications', icon: 'Bell', desc: 'Centro de notificaciones', path: '/notifications', color: 'from-red-600 to-pink-600', status: 'active' },
  { id: 49, title: 'Settings', icon: 'Settings', desc: 'Configuración general', path: '/settings', color: 'from-gray-600 to-slate-600', status: 'active' },
  { id: 50, title: 'Roadmap', icon: 'Map', desc: 'Hoja de ruta del proyecto', path: '/roadmap', color: 'from-purple-600 to-indigo-600', status: 'active' },
];

const HomePage = () => {
  const { isConnected } = useAccount();
  const { user } = useAuth();

  // Stats para Business Dashboard
  const businessStats = useMemo(() => [
    {
      label: 'Balance BEZ',
      value: '0.00',
      change: 'Conecta wallet',
      icon: Sparkles,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10'
    },
    {
      label: 'Funciones',
      value: `${businessFunctionsData.length}`,
      change: 'Todas',
      icon: LayoutDashboard,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      label: 'Transacciones',
      value: '0',
      change: 'Este mes',
      icon: TrendingUp,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      label: 'Actividad',
      value: 'Alta',
      change: '↑ 24%',
      icon: Activity,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    },
  ], []);

  // Si no está conectado, mostrar Landing Page
  if (!isConnected) {
    return <LandingHero />;
  }

  // Ejemplo de datos (en producción, obtén de backend o contratos)
  const logisticsStats = {
    totalContainers: 128,
    inTransit: 37,
    delivered: 91
  };
  const realEstateStats = {
    totalProperties: 12,
    totalSharesSold: 8700,
    dividendsPending: 3.25
  };

  useEffect(() => {
    // Simulación: notificación de dividendos pendientes
    if (realEstateStats.dividendsPending > 0) {
      // toast.success(`Tienes ${realEstateStats.dividendsPending} ETH en dividendos pendientes para reclamar!`, {
      //   icon: '💰',
      //   duration: 6000
      // });
    }
  }, []);

  return (
    <div className="w-full min-h-screen bg-gray-50 dark:bg-gray-900">
      <BezhasIntro />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="pb-12"
        >
          {/* Header Business */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 mb-4">
              <Zap className="w-4 h-4 text-cyan-500" />
              <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">Business Suite</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Panel de Funciones Empresariales
            </h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Accede a todas las herramientas Web3 para gestionar tu negocio en la blockchain
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {businessStats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 rounded-xl hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className={`p-2.5 ${stat.bgColor} rounded-lg`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${stat.bgColor} ${stat.color}`}>
                    {stat.change}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{stat.value}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Grid de Funciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {businessFunctionsData.map((func, index) => (
              <motion.div
                key={func.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
              >
                <SimpleFunctionCard {...func} />
              </motion.div>
            ))}
          </div>

          {/* Dashboard Cards - KPIs Logística y Real Estate */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
              KPIs Logística y Real Estate
            </h2>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, type: 'spring' }}
            >
              <DashboardCards logisticsStats={logisticsStats} realEstateStats={realEstateStats} />
            </motion.div>
          </div>

          {/* Footer CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-12 p-6 bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-600/20 rounded-xl text-center"
          >
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            <h3 className="text-xl font-bold text-white mb-2">
              ¿Necesitas ayuda con alguna función?
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Nuestro equipo está disponible 24/7 para asistirte
            </p>
            <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-purple-500/25">
              Ver Documentación
            </button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default HomePage;
