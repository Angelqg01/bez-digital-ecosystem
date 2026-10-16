/**
 * AppShell — cabecera y sidebar contraíble comunes a las SubApps Vite con barra lateral
 * (Wallet, Gas Tank…).
 *
 *   const sidebar = useSidebar('bez-wallet');
 *   <div className="wallet-layout" {...sidebar.layoutProps}>
 *     <aside className="wallet-sidebar" {...sidebar.sidebarProps}>…</aside>
 *     <main>
 *       <AppHeader sidebar={sidebar} title="BEZ Wallet" section="Comprar BEZ" menu={<HeaderMenu …/>} />
 *
 * Escritorio: el botón alterna sidebar completo (260px) ↔ sólo iconos (72px) y lo recuerda.
 * Móvil (<768px): el sidebar está oculto y el botón lo abre como cajón sobre el contenido.
 *
 * El modo iconos funciona con el marcado que ya tienen las apps (.sidebar-link con un
 * .sidebar-link-icon y el texto suelto): el texto se oculta con font-size:0 y el nombre
 * queda en el title/aria-label del enlace. Lo que no sea navegación se marca con
 * .bz-sb-hide-collapsed para que desaparezca al contraer.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, Menu } from 'lucide-react';

const MOVIL = '(max-width: 768px)';

const CSS = `
[data-bz-sidebar] { transition: grid-template-columns .2s ease; }
[data-bz-sidebar="collapsed"] { grid-template-columns: 72px 1fr !important; }
[data-bz-sidebar="collapsed"] .bz-sb { padding-left: .75rem !important; padding-right: .75rem !important; overflow-x: hidden; }
[data-bz-sidebar="collapsed"] .bz-sb .sidebar-section-label,
[data-bz-sidebar="collapsed"] .bz-sb .sidebar-section,
[data-bz-sidebar="collapsed"] .bz-sb .sidebar-logo-text,
[data-bz-sidebar="collapsed"] .bz-sb .sidebar-logo-version,
[data-bz-sidebar="collapsed"] .bz-sb .sidebar-logo-sub,
[data-bz-sidebar="collapsed"] .bz-sb .bz-sb-hide-collapsed { display: none !important; }
[data-bz-sidebar="collapsed"] .bz-sb .sidebar-logo { justify-content: center; padding: .5rem 0; }
[data-bz-sidebar="collapsed"] .bz-sb .sidebar-link { font-size: 0; justify-content: center; gap: 0; padding: .65rem 0; }
[data-bz-sidebar="collapsed"] .bz-sb .sidebar-link-icon { font-size: 1.1rem; }
.bz-sb { position: sticky; top: 0; height: 100vh; overflow-y: auto; }
/* La barra del chat es fija: que no tape el final del contenido. */
[data-bz-sidebar] > main { padding-bottom: 120px !important; }
.bz-sb-backdrop { display: none; }
@media ${MOVIL} {
  [data-bz-sidebar] { grid-template-columns: 1fr !important; }
  .bz-sb { display: none !important; }
  [data-bz-sidebar="drawer"] .bz-sb { display: flex !important; position: fixed; inset: 0 auto 0 0; width: min(280px, 85vw); z-index: 1200; box-shadow: 0 0 40px rgba(0,0,0,.6); }
  [data-bz-sidebar="drawer"] .bz-sb-backdrop { display: block; position: fixed; inset: 0; z-index: 1150; background: rgba(0,0,0,.55); border: 0; }
}
.bz-hd { display: flex; align-items: center; gap: 12px; padding: 10px 14px; margin-bottom: 20px; border-radius: 14px;
  background: rgba(15,23,42,.4); border: 1px solid rgba(255,255,255,.05); backdrop-filter: blur(8px); }
.bz-hd-toggle { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; flex: none; border-radius: 9px;
  background: transparent; border: 1px solid rgba(255,255,255,.1); color: inherit; cursor: pointer; }
.bz-hd-toggle:hover { border-color: var(--bz-hd-accent, #00f0ff); color: var(--bz-hd-accent, #00f0ff); }
.bz-hd-toggle:focus-visible { outline: 2px solid var(--bz-hd-accent, #00f0ff); outline-offset: 2px; }
.bz-hd-title { min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
.bz-hd-title b { font-size: 14px; color: var(--bz-hd-accent, #00f0ff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bz-hd-title span { font-size: 11px; color: #8b98a5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bz-hd-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.bz-hd-chip { font-size: 10px; font-weight: 800; letter-spacing: .04em; padding: 3px 8px; border-radius: 999px;
  color: #8b98a5; border: 1px solid rgba(255,255,255,.1); white-space: nowrap; }
@media (max-width: 560px) { .bz-hd-chip { display: none; } }
`;

let cssInyectado = false;
function inyectarCss() {
  if (cssInyectado || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.setAttribute('data-bz-appshell', '');
  s.textContent = CSS;
  document.head.appendChild(s);
  cssInyectado = true;
}

function leer(key) {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

export function useSidebar(appKey) {
  inyectarCss();
  const storageKey = `bz-sidebar-collapsed:${appKey}`;
  const [collapsed, setCollapsed] = useState(() => leer(storageKey));
  const [drawer, setDrawer] = useState(false);
  const [movil, setMovil] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(MOVIL).matches);

  useEffect(() => {
    const mq = window.matchMedia?.(MOVIL);
    if (!mq) return undefined;
    const on = () => { setMovil(mq.matches); if (!mq.matches) setDrawer(false); };
    // `change` no siempre llega (p. ej. con emulación de dispositivo); resize lo cubre.
    mq.addEventListener('change', on);
    window.addEventListener('resize', on);
    return () => { mq.removeEventListener('change', on); window.removeEventListener('resize', on); };
  }, []);

  useEffect(() => {
    if (!drawer) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setDrawer(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [drawer]);

  const toggle = useCallback(() => {
    if (movil) { setDrawer((d) => !d); return; }
    setCollapsed((c) => {
      try { localStorage.setItem(storageKey, c ? '0' : '1'); } catch { /* almacenamiento bloqueado */ }
      return !c;
    });
  }, [movil, storageKey]);

  const closeDrawer = useCallback(() => setDrawer(false), []);
  const estado = movil ? (drawer ? 'drawer' : 'closed') : (collapsed ? 'collapsed' : 'expanded');

  return {
    collapsed: !movil && collapsed,
    movil,
    drawer,
    toggle,
    closeDrawer,
    layoutProps: { 'data-bz-sidebar': estado },
    // Al navegar desde el cajón, se cierra.
    sidebarProps: { id: `${appKey}-sidebar`, onClick: (e) => { if (movil && e.target.closest('a')) setDrawer(false); } },
  };
}

/** Velo para cerrar el cajón en móvil. Ponerlo junto al <aside>. */
export function SidebarBackdrop({ sidebar }) {
  if (!sidebar.drawer) return null;
  return <button type="button" className="bz-sb-backdrop" aria-label="Cerrar menú" onClick={sidebar.closeDrawer} />;
}

export function AppHeader({ sidebar, title, section, chip, menu, accent = '#00f0ff' }) {
  inyectarCss();
  const abierto = sidebar.movil ? sidebar.drawer : !sidebar.collapsed;
  const Icono = sidebar.movil ? Menu : (sidebar.collapsed ? PanelLeftOpen : PanelLeftClose);
  return (
    <header className="bz-hd" style={{ '--bz-hd-accent': accent }}>
      <button
        type="button"
        className="bz-hd-toggle"
        onClick={sidebar.toggle}
        aria-controls={sidebar.sidebarProps.id}
        aria-expanded={abierto}
        aria-label={abierto ? 'Contraer menú lateral' : 'Expandir menú lateral'}
        title={abierto ? 'Contraer menú' : 'Expandir menú'}
      >
        <Icono size={18} aria-hidden="true" />
      </button>
      <div className="bz-hd-title">
        <b>{title}</b>
        {section && <span>{section}</span>}
      </div>
      <div className="bz-hd-right">
        {chip && <span className="bz-hd-chip">{chip}</span>}
        {menu}
      </div>
    </header>
  );
}
