/**
 * 🎨 Admin Theme - Tema unificado para páginas de administración
 * 
 * Provee estilos consistentes, colores y componentes base para
 * todas las páginas del panel de administración.
 */

// ============================================
// COLORES DEL TEMA
// ============================================

export const adminColors = {
    // Primarios
    primary: {
        50: '#faf5ff',
        100: '#f3e8ff',
        200: '#e9d5ff',
        300: '#d8b4fe',
        400: '#c084fc',
        500: '#a855f7', // Principal
        600: '#9333ea',
        700: '#7c3aed',
        800: '#6b21a8',
        900: '#581c87',
    },

    // Acentos
    accent: {
        blue: '#3b82f6',
        cyan: '#06b6d4',
        green: '#10b981',
        yellow: '#f59e0b',
        orange: '#f97316',
        red: '#ef4444',
        pink: '#ec4899',
    },

    // Grises (dark mode)
    gray: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        850: '#18212f',
        900: '#111827',
        950: '#0a0f1a',
    },

    // Estados
    status: {
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
    }
};

// ============================================
// CLASES CSS REUTILIZABLES
// ============================================

export const adminClasses = {
    // Contenedores
    pageContainer: 'min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white',
    contentContainer: 'max-w-7xl mx-auto p-4 sm:p-6 lg:p-8',

    // Cards
    card: 'bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-xl overflow-hidden',
    cardHeader: 'flex items-center justify-between p-4 border-b border-gray-800',
    cardBody: 'p-4',
    cardHover: 'hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300',

    // Stats Cards
    statCard: 'bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-purple-500/30 transition-all',
    statValue: 'text-2xl sm:text-3xl font-bold text-white',
    statLabel: 'text-sm text-gray-400',

    // Botones
    btnPrimary: 'px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium',
    btnSecondary: 'px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2',
    btnGhost: 'px-4 py-2 hover:bg-gray-800 text-gray-300 rounded-lg transition-colors flex items-center gap-2',
    btnDanger: 'px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors flex items-center gap-2',
    btnSuccess: 'px-4 py-2 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-lg transition-colors flex items-center gap-2',

    // Tabs
    tabsContainer: 'flex gap-1 p-1 bg-gray-800/50 rounded-lg overflow-x-auto',
    tab: 'px-4 py-2 rounded-lg transition-all whitespace-nowrap flex items-center gap-2',
    tabActive: 'bg-purple-600 text-white shadow-lg shadow-purple-500/25',
    tabInactive: 'text-gray-400 hover:text-white hover:bg-gray-700',

    // Inputs
    input: 'w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all',
    select: 'px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-purple-500 outline-none cursor-pointer',

    // Badges
    badge: 'px-2 py-0.5 rounded-full text-xs font-medium',
    badgeSuccess: 'bg-green-500/20 text-green-400',
    badgeWarning: 'bg-yellow-500/20 text-yellow-400',
    badgeError: 'bg-red-500/20 text-red-400',
    badgeInfo: 'bg-blue-500/20 text-blue-400',
    badgePurple: 'bg-purple-500/20 text-purple-400',

    // Icons containers
    iconContainer: 'p-2 rounded-lg',
    iconPrimary: 'bg-gradient-to-br from-purple-600/20 to-blue-600/20 text-purple-400',
    iconSuccess: 'bg-green-600/20 text-green-400',
    iconWarning: 'bg-yellow-600/20 text-yellow-400',
    iconError: 'bg-red-600/20 text-red-400',
    iconInfo: 'bg-blue-600/20 text-blue-400',

    // Loading
    loadingSpinner: 'animate-spin rounded-full border-2 border-gray-700 border-t-purple-500',
    loadingSkeleton: 'animate-pulse bg-gray-800 rounded',

    // Tables
    table: 'w-full',
    tableHeader: 'text-left text-xs uppercase text-gray-500 border-b border-gray-800',
    tableRow: 'border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors',
    tableCell: 'py-3 px-4',

    // Headings
    pageTitle: 'text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent',
    sectionTitle: 'text-lg font-semibold text-white',
    subtitle: 'text-sm text-gray-400',
};

// ============================================
// CONFIGURACIÓN DE GRÁFICOS (Recharts)
// ============================================

export const chartConfig = {
    // Colores para gráficos
    colors: [
        '#a855f7', // purple
        '#3b82f6', // blue
        '#10b981', // green
        '#f59e0b', // yellow
        '#ec4899', // pink
        '#06b6d4', // cyan
        '#f97316', // orange
        '#ef4444', // red
    ],

    // Estilos base para ResponsiveContainer
    containerStyle: {
        minHeight: 200, // Evita el warning de height -1
        width: '100%',
    },

    // Tooltip personalizado
    tooltipStyle: {
        backgroundColor: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '8px',
        padding: '8px 12px',
    },

    // Ejes
    axisStyle: {
        stroke: '#4b5563',
        fontSize: 12,
    },

    // Grid
    gridStyle: {
        stroke: '#374151',
        strokeDasharray: '3 3',
    },
};

// ============================================
// COMPONENTE WRAPPER PARA CHARTS
// ============================================

/**
 * Wrapper para ResponsiveContainer que evita el warning de dimensiones negativas
 */
export const SafeResponsiveContainer = ({ children, minHeight = 200, ...props }) => {
    return (
        <div style={{ width: '100%', minHeight, height: minHeight }}>
            {children}
        </div>
    );
};

// ============================================
// COMPONENTES DE UI REUTILIZABLES
// ============================================

/**
 * Loading Spinner
 */
export const LoadingSpinner = ({ size = 'md', className = '' }) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    return (
        <div className={`${adminClasses.loadingSpinner} ${sizeClasses[size]} ${className}`} />
    );
};

/**
 * Loading Overlay
 */
export const LoadingOverlay = ({ message = 'Cargando...' }) => (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-gray-400">{message}</p>
    </div>
);

/**
 * Empty State
 */
export const EmptyState = ({ icon: Icon, title, description, action }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
        {Icon && (
            <div className={`${adminClasses.iconContainer} ${adminClasses.iconPrimary} mb-4`}>
                <Icon size={32} />
            </div>
        )}
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        {description && <p className="text-gray-400 text-sm mb-4 max-w-md">{description}</p>}
        {action}
    </div>
);

/**
 * Status Badge
 */
export const StatusBadge = ({ status, children }) => {
    const statusClasses = {
        success: adminClasses.badgeSuccess,
        warning: adminClasses.badgeWarning,
        error: adminClasses.badgeError,
        info: adminClasses.badgeInfo,
        active: adminClasses.badgeSuccess,
        inactive: adminClasses.badgeError,
        pending: adminClasses.badgeWarning,
        running: adminClasses.badgeInfo,
        completed: adminClasses.badgeSuccess,
        failed: adminClasses.badgeError,
    };

    return (
        <span className={`${adminClasses.badge} ${statusClasses[status] || adminClasses.badgePurple}`}>
            {children}
        </span>
    );
};

/**
 * Trend Indicator
 */
export const TrendIndicator = ({ value, showPercentage = true }) => {
    const isPositive = value >= 0;

    return (
        <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
            {isPositive ? '↑' : '↓'}
            {showPercentage ? `${Math.abs(value)}%` : Math.abs(value)}
        </span>
    );
};

export default {
    colors: adminColors,
    classes: adminClasses,
    chartConfig,
    LoadingSpinner,
    LoadingOverlay,
    EmptyState,
    StatusBadge,
    TrendIndicator,
    SafeResponsiveContainer,
};
