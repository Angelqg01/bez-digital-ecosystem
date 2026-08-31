/**
 * LIGHT MODE COLOR MAPPINGS
 * Conversión de colores Dark Mode (cyan/blue) a Light Mode (lavanda/pastel)
 * 
 * Usar estos reemplazos en todas las páginas:
 */

export const COLOR_MAPPINGS = {
    // === BACKGROUNDS === //
    'bg-dark-surface': 'bg-white dark:bg-gray-900',
    'bg-dark-background': 'bg-primary-50 dark:bg-gray-950',
    'bg-light-surface': 'bg-white',
    'bg-light-background': 'bg-light-bg',

    // Transparencias
    'bg-dark-surface/20': 'bg-white/90 dark:bg-gray-800/90',
    'bg-dark-surface/10': 'bg-white/80 dark:bg-gray-800/80',
    'bg-dark-surface/50': 'bg-white/95 dark:bg-gray-800/95',
    'bg-dark-surface/80': 'bg-white/98 dark:bg-gray-900/95',
    'bg-dark-background/50': 'bg-primary-50/50 dark:bg-gray-900/50',
    'bg-dark-background/30': 'bg-primary-100/30 dark:bg-gray-800/30',

    'bg-light-surface/10': 'bg-white/90',
    'bg-light-surface/5': 'bg-white/95',
    'bg-light-surface/80': 'bg-white/98',
    'bg-light-background/50': 'bg-light-bg/50',

    // === BORDERS === //
    'border-cyan-500/10': 'border-primary-200 dark:border-gray-700',
    'border-cyan-500/30': 'border-primary-300 dark:border-gray-600',
    'border-cyan-500': 'border-primary-600 dark:border-primary-400',
    'border-dark-surface': 'border-primary-200 dark:border-gray-800',

    // === TEXT === //
    'text-cyan-500': 'text-primary-600 dark:text-primary-400',
    'text-cyan-400': 'text-primary-500 dark:text-primary-300',
    'text-blue-500': 'text-primary-600 dark:text-primary-400',
    'text-blue-400': 'text-primary-500 dark:text-primary-300',
    'text-white/90': 'text-text-primary dark:text-white',
    'text-gray-500': 'text-text-secondary dark:text-gray-400',

    // === GRADIENTS === //
    'from-cyan-500': 'from-primary-500',
    'to-blue-600': 'to-primary-600',
    'from-cyan-500/10': 'from-primary-100',
    'to-blue-600/10': 'to-primary-200',

    // === BORDERS ROUNDED === //
    'rounded-2xl': 'rounded-2xl',  // Mantener
    'rounded-xl': 'rounded-xl',    // Mantener
    'rounded-lg': 'rounded-xl',    // Más redondeado

    // === HOVER EFFECTS === //
    'hover:bg-dark-background/30': 'hover:bg-primary-50 dark:hover:bg-gray-800',
    'hover:bg-dark-background/50': 'hover:bg-primary-100 dark:hover:bg-gray-700',
    'hover:border-cyan-500/30': 'hover:border-primary-400 dark:hover:border-primary-500',
    'hover:border-cyan-500/50': 'hover:border-primary-500 dark:hover:border-primary-400',

    // === SHADOWS === //
    'shadow-cyan-500/20': 'shadow-soft',
    'shadow-lg': 'shadow-card-hover',

    // === PLACEHOLDER === //
    'placeholder-gray-500': 'placeholder:text-text-muted dark:placeholder:text-gray-500',
};

/**
 * Convierte clases dark mode a light mode
 */
export function convertToLightMode(className) {
    let result = className;

    for (const [oldClass, newClass] of Object.entries(COLOR_MAPPINGS)) {
        result = result.replace(new RegExp(oldClass, 'g'), newClass);
    }

    return result;
}

/**
 * PATRÓN DE REEMPLAZO PARA COMPONENTES:
 * 
 * 1. Backgrounds de secciones/cards:
 *    bg-dark-surface/20 → bg-white/90 dark:bg-gray-800/90
 *    border border-cyan-500/10 → border border-primary-200 dark:border-gray-700
 *    rounded-2xl (mantener)
 * 
 * 2. Inputs y TextAreas:
 *    bg-dark-background/50 → bg-primary-50/50 dark:bg-gray-900/50
 *    border-cyan-500/10 → border-primary-200 dark:border-gray-700
 *    focus:border-cyan-500/30 → focus:border-primary-400 dark:focus:border-primary-500
 * 
 * 3. Botones primarios:
 *    bg-gradient-to-r from-cyan-500 to-blue-600 → bg-gradient-to-r from-primary-500 to-primary-600
 *    hover:shadow-cyan-500/20 → hover:shadow-soft
 * 
 * 4. Botones secundarios:
 *    bg-yellow-500/20 → bg-accent-100 dark:bg-accent-900/30
 *    border-yellow-500/30 → border-accent-300 dark:border-accent-700
 *    text-yellow-400 → text-accent-600 dark:text-accent-400
 * 
 * 5. Hover states:
 *    hover:bg-dark-background/30 → hover:bg-primary-50 dark:hover:bg-gray-800
 * 
 * 6. Sidebar derecho:
 *    bg-dark-surface/80 → bg-white/98 dark:bg-gray-900/95
 *    border-l border-cyan-500/10 → border-l border-primary-200 dark:border-gray-700
 */
