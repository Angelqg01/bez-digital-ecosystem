import {
    Wallet,
    Vote,
    Coins,
    Users,
    ShoppingBag,
    Trophy,
    Zap,
    Shield,
    TrendingUp,
    FileText,
    Globe,
    Newspaper
} from 'lucide-react';

/**
 * 🏢 Datos de Funciones Empresariales Web3 para BeZhas
 * Cada función representa una capacidad clave de la plataforma
 */
export const businessFunctionsData = [
    {
        id: 'treasury',
        title: 'Tesorería BEZ',
        metricSummary: '0.00 BEZ · Balance en Tiempo Real',
        fullDescription: 'Gestiona los activos digitales BEZ de tu empresa. Accede a tu billetera para mayor seguridad, realiza transacciones de tokens BEZ y monitorea el flujo de caja on-chain en tiempo real. Esta función permite la gestión completa de tus tokens nativos de la plataforma BeZhas.',
        linkPath: '/wallet',
        icon: 'Wallet',
        gradient: 'from-blue-500 to-cyan-500',
        stats: { primary: '0.00 BEZ', secondary: '0 Transacciones' }
    },
    {
        id: 'governance',
        title: 'Gobernanza DAO',
        metricSummary: '0 Propuestas Activas · Votación Abierta',
        fullDescription: 'Participa en la toma de decisiones descentralizada de BeZhas. Crea propuestas para la DAO de la plataforma, vota en decisiones importantes sobre el futuro del ecosistema, delega poder de voto y revisa el historial completo de gobernanza. Tu voz importa en la construcción del futuro de BeZhas.',
        linkPath: '/dao',
        icon: 'Vote',
        gradient: 'from-purple-500 to-pink-500',
        stats: { primary: '0 Propuestas', secondary: '0% Participación' }
    },
    {
        id: 'token-management',
        title: 'Gestión de Token BEZ',
        metricSummary: 'Token $BEZ · Precio: 0.0001 ETH',
        fullDescription: 'Administra el token nativo BEZ de BeZhas. Compra tokens BEZ, monitorea el precio en tiempo real, revisa tu historial de transacciones y gestiona tu portafolio de tokens. BEZ es el corazón del ecosistema BeZhas y te permite acceder a todas las funciones premium.',
        linkPath: '/token',
        icon: 'Coins',
        gradient: 'from-amber-500 to-orange-500',
        stats: { primary: '$BEZ', secondary: '0.0001 ETH' }
    },
    {
        id: 'marketplace',
        title: 'Marketplace NFT',
        metricSummary: '0 NFTs Listados · Mercado Activo',
        fullDescription: 'Explora el marketplace de NFTs de BeZhas. Compra, vende y subasta tokens no fungibles únicos. Conviértete en vendedor verificado pagando la tarifa en BEZ y lista tus propios NFTs. Accede a colecciones exclusivas y participa en el ecosistema de activos digitales de BeZhas.',
        linkPath: '/marketplace',
        icon: 'ShoppingBag',
        gradient: 'from-green-500 to-emerald-500',
        stats: { primary: '0 NFTs', secondary: '0 Vendedores' }
    },
    {
        id: 'vip-rewards',
        title: 'Programa VIP',
        metricSummary: 'Watch-to-Earn · Recompensas Activas',
        fullDescription: 'Accede al programa VIP exclusivo de BeZhas. Gana tokens BEZ viendo contenido, completa desafíos diarios y acumula recompensas por tu participación. El programa VIP ofrece beneficios exclusivos como acceso anticipado a nuevas funciones, descuentos en tarifas y multiplicadores de recompensas.',
        linkPath: '/be-vip',
        icon: 'Trophy',
        gradient: 'from-yellow-500 to-amber-500',
        stats: { primary: '0 BEZ Ganados', secondary: 'Nivel Básico' }
    },
    {
        id: 'staking',
        title: 'Staking y Farming',
        metricSummary: 'APY: 0% · 0 BEZ Bloqueados',
        fullDescription: 'Participa en el staking y farming de tokens BEZ. Bloquea tus tokens para ganar recompensas pasivas con APY competitivo. Contribuye a la seguridad de la red y gana intereses sobre tus holdings. Elige entre diferentes pools de liquidez con distintos niveles de riesgo y retorno.',
        linkPath: '/staking',
        icon: 'Zap',
        gradient: 'from-indigo-500 to-purple-500',
        stats: { primary: '0 BEZ', secondary: '0% APY' }
    },
    {
        id: 'profile',
        title: 'Perfil Empresarial',
        metricSummary: 'Perfil Público · Insignias Verificadas',
        fullDescription: 'Gestiona tu perfil empresarial en BeZhas. Actualiza tu información, agrega enlaces sociales, muestra tus logros y NFTs, y construye tu reputación en el ecosistema. Tu perfil es tu identidad digital en la plataforma y te permite conectar con otros usuarios y empresas.',
        linkPath: '/profile',
        icon: 'Users',
        gradient: 'from-pink-500 to-rose-500',
        stats: { primary: 'Público', secondary: '0 Seguidores' }
    },
    {
        id: 'security',
        title: 'Seguridad Wallet',
        metricSummary: 'Conexión Segura · Desconexión Rápida',
        fullDescription: 'Sistema de seguridad avanzado para tu wallet. Conecta y desconecta tu wallet de forma segura con limpieza completa de sesión. Todas las transacciones requieren confirmación en tu wallet. Tu seguridad es nuestra prioridad máxima con auditorías constantes y mejores prácticas de la industria.',
        linkPath: '/wallet',
        icon: 'Shield',
        gradient: 'from-red-500 to-pink-500',
        stats: { primary: 'Protegido', secondary: '100% Seguro' }
    },
    {
        id: 'analytics',
        title: 'Analytics y Métricas',
        metricSummary: 'Dashboard · Datos en Tiempo Real',
        fullDescription: 'Analiza el rendimiento de tus activos y actividades en BeZhas. Visualiza gráficos de tu portafolio, histórico de transacciones, patrones de uso y métricas clave. Toma decisiones informadas con datos precisos y actualizados en tiempo real sobre tu participación en el ecosistema.',
        linkPath: '/dashboard/analytics',
        icon: 'TrendingUp',
        gradient: 'from-teal-500 to-cyan-500',
        stats: { primary: '0 Métricas', secondary: 'Tiempo Real' }
    },
    {
        id: 'documentation',
        title: 'Centro de Documentación',
        metricSummary: 'Guías Completas · API Docs',
        fullDescription: 'Accede a toda la documentación de BeZhas. Guías paso a paso para cada función, documentación técnica de APIs, tutoriales en video, preguntas frecuentes y casos de uso empresariales. Todo lo que necesitas para aprovechar al máximo la plataforma está aquí.',
        linkPath: '/docs',
        icon: 'FileText',
        gradient: 'from-slate-500 to-gray-500',
        stats: { primary: '50+ Guías', secondary: 'Actualizado' }
    },
    {
        id: 'social',
        title: 'Red Social Web3',
        metricSummary: '0 Posts · Feed Personalizado',
        fullDescription: 'Conecta con la comunidad BeZhas. Publica actualizaciones, comparte tus logros NFT, sigue a otros usuarios y empresas, y participa en conversaciones sobre Web3. Construye tu red profesional en el ecosistema descentralizado con funciones de chat integradas.',
        linkPath: '/feed',
        icon: 'Newspaper',
        gradient: 'from-sky-500 to-blue-500',
        stats: { primary: '0 Posts', secondary: '0 Seguidores' }
    },
    {
        id: 'global-access',
        title: 'Acceso Global',
        metricSummary: 'Multichain · Sin Fronteras',
        fullDescription: 'BeZhas opera sin fronteras geográficas. Accede a la plataforma desde cualquier lugar del mundo, conecta wallets de múltiples blockchains, realiza transacciones internacionales sin intermediarios y participa en un ecosistema verdaderamente global y descentralizado.',
        linkPath: '/about',
        icon: 'Globe',
        gradient: 'from-violet-500 to-purple-500',
        stats: { primary: 'Global', secondary: '24/7 Disponible' }
    }
];

/**
 * 🎯 Función auxiliar para obtener el componente de icono
 */
export const getIconComponent = (iconName) => {
    const icons = {
        Wallet,
        Vote,
        Coins,
        Users,
        ShoppingBag,
        Trophy,
        Zap,
        Shield,
        TrendingUp,
        FileText,
        Globe,
        Newspaper
    };
    return icons[iconName] || Wallet;
};
