'use client';

import { useTheme } from '@/lib/theme-context';

/**
 * Interruptor de tema para la cabecera publica.
 *
 * Hasta que `ready` confirma el tema real del DOM se pinta el icono neutro y
 * una etiqueta generica: si aqui se anunciara "Modo claro" antes de hidratar,
 * la mitad de las visitas leeria lo contrario de lo que van a obtener.
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
    const { theme, ready, toggleTheme } = useTheme();

    const goingToLight = theme === 'dark';
    const label = !ready
        ? 'Cambiar tema'
        : goingToLight
            ? 'Cambiar a tema claro'
            : 'Cambiar a tema oscuro';

    return (
        <button
            type="button"
            onClick={toggleTheme}
            title={label}
            aria-label={label}
            className={`flex h-9 w-9 items-center justify-center rounded-full border border-[var(--bz-chrome-line)] text-[var(--bz-chrome-text-dim)] transition-colors hover:bg-[var(--bz-chrome-hover)] hover:text-[var(--bz-chrome-text)] ${className}`}
        >
            <span className="material-symbols-outlined text-[18px]">
                {!ready ? 'contrast' : goingToLight ? 'light_mode' : 'dark_mode'}
            </span>
        </button>
    );
}
