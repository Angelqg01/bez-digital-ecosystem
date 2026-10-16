"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth, HeaderAuthButton, LockScreen } from './SSOProvider';
import { Sidebar, navItems, isActive } from './Sidebar';
// Copia JS del chat de la plataforma (ver la cabecera del archivo); sin tipos propios.
import AIWorkspaceBarJs from './ai-chat/AIWorkspaceBar.jsx';

const AIWorkspaceBar = AIWorkspaceBarJs as unknown as React.ComponentType<{
  hideAppId?: string; bottomOffset?: number; leftOffset?: number; suggestions?: string[];
}>;

const STORAGE_KEY = 'bz-sidebar-collapsed:defi';

/** Sidebar contraíble + cabecera + chat. Sustituye al antiguo <Sidebar/> + cabecera fija con ml-64. */
export function DefiLayoutContent({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(STORAGE_KEY) === '1'); } catch { /* almacenamiento bloqueado */ }
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [mobileOpen]);

  const toggle = useCallback(() => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      setMobileOpen((o) => !o);
      return;
    }
    setCollapsed((c) => {
      try { localStorage.setItem(STORAGE_KEY, c ? '0' : '1'); } catch { /* almacenamiento bloqueado */ }
      return !c;
    });
  }, []);

  const isDashboard = pathname === '/';
  const showLock = !token && !isDashboard;
  const section = navItems.find((n) => isActive(pathname, n.href))?.label;

  return (
    <>
      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className={`flex-1 min-w-0 p-4 md:p-8 pb-32 flex flex-col min-h-screen transition-[margin] duration-200 ${collapsed ? 'md:ml-[72px]' : 'md:ml-64'}`}>
        <header className="flex items-center gap-3 px-3 py-2.5 mb-6 rounded-2xl bg-slate-900/40 border border-white/5 backdrop-blur">
          <button
            type="button"
            onClick={toggle}
            aria-controls="defi-sidebar"
            aria-expanded={mobileOpen || !collapsed}
            aria-label={collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            title={collapsed ? 'Expandir menú' : 'Contraer menú'}
            className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:text-bez-primary hover:border-bez-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-bez-primary"
          >
            <Menu size={18} className="md:hidden" aria-hidden="true" />
            {collapsed
              ? <PanelLeftOpen size={18} className="hidden md:block" aria-hidden="true" />
              : <PanelLeftClose size={18} className="hidden md:block" aria-hidden="true" />}
          </button>
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-bold text-bez-primary truncate">BeZhas DeFi</p>
            {section && <p className="text-xs text-slate-500 truncate">{section}</p>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:inline rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-slate-400">
              Polygon
            </span>
            <HeaderAuthButton />
          </div>
        </header>

        {showLock ? (
          <LockScreen title="Módulo DeFi Restringido" />
        ) : (
          <div className="flex-1">
            {children}
          </div>
        )}
      </div>

      {/* Chat de la plataforma (el mismo de www.bezhas.com), con la sesión del panel */}
      <AIWorkspaceBar hideAppId="app_defi" bottomOffset={12} leftOffset={collapsed ? 72 : 256} suggestions={['¿Cómo compro BEZ?', '¿Qué es el staking de BEZ?', '¿Qué planes ofrece BeZhas?']} />
    </>
  );
}
