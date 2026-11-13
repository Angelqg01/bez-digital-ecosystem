import { useSyncExternalStore, useCallback } from 'react';

/**
 * Estado ÚNICO del sidebar del Hub.
 *
 * Antes cada layout (MainLayout, InstitutionalLanding, MasterBeZhasHub) creaba su
 * propio `useState` y se lo pasaba a <SidebarDrawer>: el estado de colapsado se
 * perdía al cambiar de layout, el menú del móvil nacía ABIERTO tapando la página
 * y la cabecera no tenía forma de volver a abrirlo tras cerrarlo.
 *
 * `open`      → sólo móvil (< 768 px): el menú es un cajón. Empieza cerrado.
 * `collapsed` → sólo escritorio: sidebar de 80 px con iconos. Se recuerda.
 */

const CLAVE = 'bezhas.sidebar.collapsed';
const MD = 768;

const leerColapsado = () => {
    try { return localStorage.getItem(CLAVE) === '1'; } catch { return false; }
};

let estado = {
    open: typeof window !== 'undefined' ? window.innerWidth >= MD : true,
    collapsed: typeof window !== 'undefined' ? leerColapsado() : false,
};
const oyentes = new Set();

function cambiar(parcial) {
    const nuevo = { ...estado, ...parcial };
    if (nuevo.open === estado.open && nuevo.collapsed === estado.collapsed) return;
    estado = nuevo;
    if (parcial.collapsed !== undefined) {
        try { localStorage.setItem(CLAVE, nuevo.collapsed ? '1' : '0'); } catch { /* sin almacenamiento */ }
    }
    oyentes.forEach((fn) => fn());
}

const suscribir = (fn) => { oyentes.add(fn); return () => oyentes.delete(fn); };
const instantanea = () => estado;

export const sidebarActions = {
    setOpen: (open) => cambiar({ open: !!open }),
    toggleOpen: () => cambiar({ open: !estado.open }),
    setCollapsed: (collapsed) => cambiar({ collapsed: !!collapsed }),
    toggleCollapsed: () => cambiar({ collapsed: !estado.collapsed }),
};

/** ¿Pantalla de escritorio? (mismo corte que `md:` de Tailwind) */
function suscribirMedia(fn) {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const mq = window.matchMedia(`(min-width: ${MD}px)`);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
}
const esEscritorio = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(`(min-width: ${MD}px)`).matches : true);

export function useSidebar() {
    const s = useSyncExternalStore(suscribir, instantanea, instantanea);
    const desktop = useSyncExternalStore(suscribirMedia, esEscritorio, () => true);
    return {
        open: s.open,
        // En móvil no hay modo colapsado: el cajón siempre va completo.
        collapsed: s.collapsed && desktop,
        desktop,
        ...sidebarActions,
    };
}

/** Sólo para tests. */
export function __resetSidebar(parcial = {}) { estado = { open: true, collapsed: false, ...parcial }; oyentes.forEach((fn) => fn()); }
