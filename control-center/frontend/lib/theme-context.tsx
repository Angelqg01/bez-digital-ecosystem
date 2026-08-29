'use client';

/**
 * Tema claro / oscuro de la capa publica de BeZhas.
 *
 * El tema vive en `data-bz-theme` sobre <html>, no en una clase de React: asi
 * el script anti-flash de `app/layout.tsx` puede fijarlo antes del primer pintado
 * y el CSS (globals.css + home.module.css) resuelve sus variables sin esperar a
 * que hidrate nada.
 *
 * Sin dependencias nuevas: `next-themes` haria lo mismo, pero el unico consumidor
 * es la landing y el contrato que necesitamos cabe en este fichero.
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

export type BzTheme = 'light' | 'dark';

const STORAGE_KEY = 'bezhas_theme';
const ATTR = 'data-bz-theme';

type ThemeContextValue = {
    theme: BzTheme;
    /** false hasta que el efecto de montaje confirma el tema real del DOM. */
    ready: boolean;
    setTheme: (next: BzTheme) => void;
    toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Lee el tema ya aplicado por el script anti-flash; cae a `dark` en SSR. */
function readAppliedTheme(): BzTheme {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.getAttribute(ATTR) === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    // Arranca en 'dark' para que SSR y el primer render del cliente coincidan.
    // El valor real se adopta en el efecto de montaje, ya sin riesgo de mismatch.
    const [theme, setThemeState] = useState<BzTheme>('dark');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        setThemeState(readAppliedTheme());
        setReady(true);
    }, []);

    const setTheme = useCallback((next: BzTheme) => {
        setThemeState(next);
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute(ATTR, next);
        }
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            /* Safari en privado tira al escribir: el tema sigue valiendo esta sesion. */
        }
    }, []);

    const toggleTheme = useCallback(() => {
        setTheme(readAppliedTheme() === 'light' ? 'dark' : 'light');
    }, [setTheme]);

    // Seguir la preferencia del sistema mientras el usuario no elija explicitamente.
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;

        let userHasChosen = false;
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            userHasChosen = stored === 'light' || stored === 'dark';
        } catch {
            /* Sin storage no hay eleccion previa que respetar. */
        }
        if (userHasChosen) return;

        const mq = window.matchMedia('(prefers-color-scheme: light)');
        const onChange = (event: MediaQueryListEvent) => {
            const next: BzTheme = event.matches ? 'light' : 'dark';
            setThemeState(next);
            document.documentElement.setAttribute(ATTR, next);
        };

        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const value = useMemo(
        () => ({ theme, ready, setTheme, toggleTheme }),
        [theme, ready, setTheme, toggleTheme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
    }
    return ctx;
}
