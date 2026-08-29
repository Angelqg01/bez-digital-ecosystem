"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect, ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import ThemeToggle from '@/components/ThemeToggle';

// ── Sidebar Navigation: Grouped by logical sections ──
const sidebarSections = [
  {
    title: 'Explorar',
    items: [
      { path: '/solutions', icon: 'settings_input_component', label: 'Soluciones' },
      { path: '/network', icon: 'sensors', label: 'Estado de Red' },
      { path: '/commerce', icon: 'shopping_cart', label: 'Comercio' },
      { path: '/token', icon: 'token', label: 'BEZ-Coin' },
    ],
  },
  {
    title: 'Desarrolladores',
    items: [
      { path: '/developers', icon: 'code', label: 'Dev Portal' },
      { path: '/learn', icon: 'school', label: 'Docs & Tutoriales' },
      { path: '/docs', icon: 'description', label: 'API & SDK Docs' },
      { path: '/rpc', icon: 'lan', label: 'RPC & Nodos' },
    ],
  },
  {
    title: 'Infraestructura',
    items: [
      { path: '/validators', icon: 'security', label: 'Validadores' },
      { path: '/bridges', icon: 'alt_route', label: 'Bridges' },
    ],
  },
  {
    title: 'Servicios',
    items: [
      { path: '/enterprise', icon: 'business', label: 'Enterprise' },
      { path: '/payments', icon: 'payments', label: 'Pagos' },
      { path: '/financial', icon: 'account_balance', label: 'Financiero' },
      { path: '/support', icon: 'support_agent', label: 'Soporte' },
    ],
  },
  {
    title: 'Contacto',
    items: [
      { path: '/support', icon: 'contact_support', label: 'Centro de ayuda' },
      { path: 'mailto:info.bezcoin@bez.digital', icon: 'mail', label: 'Email' },
      { path: 'https://t.me/BeZhasBot', icon: 'send', label: 'Telegram' },
      { path: 'https://github.com/bezhas', icon: 'terminal', label: 'GitHub' },
    ],
  },
];

// ── Header Dropdown Menus ──
const headerMenus: Record<string, { label: string; href: string; icon: string; desc: string }[]> = {
  Ecosystem: [
    { label: 'Demo Read-Only', href: '/demo', icon: 'dashboard_customize', desc: 'Vista para clientes sin despliegue cloud' },
    { label: 'Soluciones', href: '/solutions', icon: 'settings_input_component', desc: 'Tokenización, DePIN, IA' },
    { label: 'Comercio', href: '/commerce', icon: 'shopping_cart', desc: 'Supply Chain & Logística' },
    { label: 'Enterprise', href: '/enterprise', icon: 'business', desc: 'Real Estate & Empresas' },
    { label: 'Pagos', href: '/payments', icon: 'payments', desc: 'Soluciones de Pago' },
    { label: 'Financiero', href: '/financial', icon: 'account_balance', desc: 'Servicios Financieros' },
    { label: 'Bridges', href: '/bridges', icon: 'alt_route', desc: 'Cross-Chain Bridges' },
    { label: 'BEZ-Coin', href: '/token', icon: 'token', desc: 'Compra, Staking & Tokenomics' },
  ],
  Developers: [
    { label: 'Developer Portal', href: '/developers', icon: 'code', desc: 'SDK, APIs, Smart Contracts' },
    { label: 'Documentación', href: '/learn', icon: 'school', desc: 'Docs, Tutoriales, Governance' },
    { label: 'RPC & Nodos', href: '/rpc', icon: 'lan', desc: 'Endpoints RPC, Nodos Dedicados' },
    { label: 'Descargar SDK', href: '/developers#sdk', icon: 'download', desc: 'BeZhas.js, Python, Rust SDK' },
    { label: 'API Reference', href: '/developers#api', icon: 'api', desc: 'REST & WebSocket APIs' },
    { label: 'API & SDK Docs', href: '/docs', icon: 'description', desc: 'Documentación completa' },
  ],
  Network: [
    { label: 'Estado de Red', href: '/network', icon: 'sensors', desc: 'TPS, Latencia, Nodos Activos' },
    { label: 'Validadores', href: '/validators', icon: 'security', desc: 'Staking, Rewards, Onboarding' },
    { label: 'RPC Público', href: '/rpc', icon: 'lan', desc: 'Endpoints & Clusters' },
    { label: 'Convertirse en Nodo', href: '/validators#onboarding', icon: 'hub', desc: 'Desplegar un Nodo Validador' },
    { label: 'Soporte', href: '/support', icon: 'support_agent', desc: 'FAQ, Telegram Bot, Contacto' },
  ],
  Contacto: [
    { label: 'Demo Clientes', href: '/demo', icon: 'dashboard_customize', desc: 'Ver plataforma sin GCP ni nodo real' },
    { label: 'Email Comercial', href: 'mailto:info.angelqg@gmail.com', icon: 'mail', desc: 'Outreach, pilotos y partnerships' },
    { label: 'Deck Enterprise', href: 'https://drive.google.com/file/d/10M3q1iUC_vbu8XaCvOGFKg6OYWuKrKQt/view', icon: 'slideshow', desc: 'Presentacion operativa BeZhas' },
    { label: 'Telegram Bot', href: 'https://t.me/BeZhasBot', icon: 'send', desc: 'Soporte 24/7 y comunidad' },
    { label: 'Política de Privacidad', href: '/privacy', icon: 'gavel', desc: 'RGPD, datos, cookies y permisos' },
  ],
};

type StartProfileKey = 'business' | 'user' | 'developer';

const startProfiles: Record<StartProfileKey, {
  label: string;
  icon: string;
  actions: { label: string; href: string }[];
}> = {
  business: {
    label: 'Instituciones y Empresas',
    icon: 'business_center',
    actions: [
      { label: 'Explorar soluciones institucionales', href: '/solutions' },
      { label: 'Ver servicios financieros', href: '/financial' },
      { label: 'Operar validadores y nodos', href: '/validators' },
      { label: 'Ver soluciones enterprise', href: '/enterprise' },
      { label: 'Coordinar comercio y logística', href: '/commerce' },
      { label: 'Implementar pagos empresariales', href: '/payments' },
      { label: 'Probar la demo para clientes', href: '/demo' },
      { label: 'Hablar con soporte especializado', href: '/support' },
    ],
  },
  user: {
    label: 'Usuario',
    icon: 'person',
    actions: [
      { label: 'Entrar al panel de usuario', href: '/dashboard' },
      { label: 'Conocer BEZ-Coin', href: '/token' },
      { label: 'Usar pagos BeZhas', href: '/payments' },
      { label: 'Recibir ayuda para empezar', href: '/support' },
    ],
  },
  developer: {
    label: 'Desarrollador',
    icon: 'code',
    actions: [
      { label: 'Abrir el portal de desarrollo', href: '/developers' },
      { label: 'Aprender con guías y tutoriales', href: '/learn' },
      { label: 'Consultar API y SDK Docs', href: '/docs' },
      { label: 'Revisar RPC y nodos', href: '/rpc' },
    ],
  },
};

const startProfileOrder: StartProfileKey[] = ['business', 'user', 'developer'];

function DropdownMenu({ label, items, isOpen, onToggle, onClose }: {
  label: string;
  items: typeof headerMenus[string];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-2 transition-all ${isOpen ? 'text-[#0d33f2]' : 'text-[var(--bz-chrome-text-dim)] hover:text-[var(--bz-chrome-text)]'
          }`}
      >
        {label}
        <span className={`material-symbols-outlined text-[14px] transition-transform ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-[var(--bz-chrome-panel)] backdrop-blur-xl border border-[var(--bz-chrome-line)] rounded-xl shadow-2xl shadow-blue-900/30 overflow-hidden z-50">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              target={item.href.startsWith('http') ? '_blank' : undefined}
              rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              onClick={onClose}
              className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--bz-chrome-hover)] transition-all group"
            >
              <span className="material-symbols-outlined text-[#0d33f2] text-lg mt-0.5 group-hover:scale-110 transition-transform">{item.icon}</span>
              <div>
                <span className="text-[var(--bz-chrome-text)] text-xs font-bold uppercase tracking-wider block">{item.label}</span>
                <span className="text-[var(--bz-chrome-text-mut)] text-[10px]">{item.desc}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StartModal({
  isOpen,
  activeProfile,
  onProfileChange,
  onClose,
}: {
  isOpen: boolean;
  activeProfile: StartProfileKey;
  onProfileChange: (profile: StartProfileKey) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeProfileData = startProfiles[activeProfile];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Empezar en BeZhas"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100vh-4rem)] w-full max-w-6xl overflow-y-auto rounded-lg border border-white/10 bg-[#08090f]/95 p-6 shadow-2xl shadow-[#0d33f2]/20 sm:p-8 lg:p-10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src="/bezhas-logo-unico.png"
              alt="Logo BeZhas"
              className="h-12 w-12 flex-shrink-0 object-contain sm:h-14 sm:w-14"
            />
            <h2 className="truncate text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">Empezar</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-slate-300 transition-all hover:bg-white/15 hover:text-white"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
          {startProfileOrder.map((profileKey) => {
            const profile = startProfiles[profileKey];
            const isActive = activeProfile === profileKey;
            return (
              <button
                key={profileKey}
                type="button"
                onClick={() => onProfileChange(profileKey)}
                className={`flex min-h-36 flex-col items-start justify-between rounded-lg p-5 text-left transition-all sm:min-h-40 ${isActive
                  ? 'bg-white text-black shadow-xl shadow-white/10'
                  : 'bg-[#26252b] text-slate-400 hover:bg-[#303038] hover:text-white'
                  }`}
              >
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                  {profile.icon}
                </span>
                <span className="text-2xl font-bold tracking-tight">{profile.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 divide-y divide-white/10">
          {activeProfileData.actions.map((action, index) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={onClose}
              className="group flex items-center gap-4 py-5 text-slate-400 transition-colors hover:text-white"
            >
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-slate-300">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-base font-bold sm:text-lg">{action.label}</span>
              <span className="material-symbols-outlined flex-shrink-0 text-xl transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                arrow_outward
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

const COOKIE_CONSENT_KEY = 'bezhas_cookie_consent';
const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export default function LandingLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [activeStartProfile, setActiveStartProfile] = useState<StartProfileKey>('business');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCookieBanner, setShowCookieBanner] = useState(false);

  // Compute user initials for the avatar
  const userInitials = user?.username
    ? user.username.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email
      ? user.email[0].toUpperCase()
      : 'U';

  const handleHeaderLogout = () => {
    logout();
    router.push('/');
  };

  useEffect(() => {
    const storedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
    const hasValidConsent = storedConsent === 'accepted' || storedConsent === 'necessary';
    setShowCookieBanner(!hasValidConsent);
  }, []);

  const saveCookieConsent = (consent: 'accepted' | 'necessary') => {
    localStorage.setItem(COOKIE_CONSENT_KEY, consent);
    document.cookie = `bezhas_cookie_consent=${consent}; path=/; max-age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax`;
    setShowCookieBanner(false);
    // Notify GoogleAnalytics component to update GA4 consent in real-time
    window.dispatchEvent(new Event('bezhas:consentUpdate'));
  };

  return (
    /*
      `overflow-x-clip` y no `overflow-x-hidden`: `hidden` en un eje obliga al
      otro a `auto`, lo que convierte a este div en contenedor de scroll y deja
      inservible el `position: sticky` de los paneles ancla de la Home. `clip`
      recorta igual el desbordamiento lateral sin crear contexto de scroll.
    */
    <div className="bg-[var(--bz-chrome)] font-['Space_Grotesk'] text-[var(--bz-chrome-text)] min-h-screen relative overflow-x-clip">
      {/* ── TopAppBar / Header ── */}
      <header className="bg-[var(--bz-chrome-veil)] backdrop-blur-xl fixed top-0 w-full z-50 border-b border-[var(--bz-chrome-line)] shadow-[var(--bz-chrome-glow)] flex justify-between items-center px-6 h-16 transition-all">
        <Link href="/" className="flex flex-shrink-0 items-center gap-3 text-2xl font-black italic tracking-tighter text-[var(--bz-chrome-text)] font-['Space_Grotesk'] uppercase">
          <img src="/bezhas-token-logo.png" alt="BEZ-Coin token logo" className="h-9 w-9 rounded-full object-cover shadow-[0_0_18px_rgba(245,190,60,0.32)]" />
          BEZHAS
        </Link>

        {/* Desktop Navigation Dropdowns */}
        <div className="hidden lg:flex items-center space-x-1">
          {Object.entries(headerMenus).map(([key, items]) => (
            <DropdownMenu
              key={key}
              label={key}
              items={items}
              isOpen={openMenu === key}
              onToggle={() => setOpenMenu(openMenu === key ? null : key)}
              onClose={() => setOpenMenu(null)}
            />
          ))}
        </div>

        {/* Right Actions - Commented out for security restructuring. Access restricted from core infrastructure page. */}
        <div className="flex items-center space-x-3">
          {/*
          <button
            onClick={() => setStartModalOpen(true)}
            className="hidden sm:flex h-9 items-center justify-center rounded-lg border border-[#0d33f2]/50 bg-[#0d33f2] px-4 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-[0_0_15px_rgba(13,51,242,0.3)] transition-all hover:brightness-110 md:text-xs"
          >
            <span className="material-symbols-outlined mr-2 text-[16px]">rocket_launch</span>
            Empezar
          </button>

          {!isAuthenticated ? (
            <Link
              href="/login"
              className="flex h-9 items-center gap-2 rounded-full border border-white/20 bg-gradient-to-r from-emerald-500/90 to-blue-500/90 px-5 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-emerald-500/15 transition-all hover:shadow-emerald-500/30 hover:scale-105 md:text-xs"
            >
              <span className="material-symbols-outlined text-[16px]">person</span>
              Login / Registro
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="flex h-9 items-center gap-2 rounded-full border border-[#0d33f2]/40 bg-[#0d33f2]/20 px-4 text-[10px] font-bold uppercase tracking-widest text-white transition-all hover:bg-[#0d33f2]/30 md:text-xs"
              >
                <span className="material-symbols-outlined text-[16px]">dashboard</span>
                Dashboard
              </Link>
              <button
                onClick={handleHeaderLogout}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-slate-300 transition-all hover:bg-white/20 hover:text-white"
                title="Cerrar sesión"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 text-[10px] font-black text-white shadow-md">
                {userInitials}
              </div>
            </div>
          )}
          */}

          <div className="flex items-center space-x-2 pl-2 border-l border-[var(--bz-chrome-line)]">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden"
            >
              <span className="material-symbols-outlined text-[var(--bz-chrome-text-dim)] cursor-pointer hover:text-[var(--bz-chrome-text)] transition-all text-xl">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[45] bg-[var(--bz-chrome-veil)] backdrop-blur-lg pt-20 px-6 overflow-y-auto lg:hidden">
          <nav className="space-y-6">
            {Object.entries(headerMenus).map(([section, items]) => (
              <div key={section}>
                <h3 className="text-[10px] tracking-[0.3em] text-[#0d33f2] font-bold uppercase mb-3">{section}</h3>
                <div className="space-y-1">
                  {items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      target={item.href.startsWith('http') ? '_blank' : undefined}
                      rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-[var(--bz-chrome-text-dim)] hover:text-[var(--bz-chrome-text)] hover:bg-[var(--bz-chrome-hover)] rounded-lg transition-all"
                    >
                      <span className="material-symbols-outlined text-[#0d33f2] text-lg">{item.icon}</span>
                      <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <div className="pt-4 border-t border-[var(--bz-chrome-line)] space-y-3">
              {/* Entry buttons commented out for security restructuring. Access restricted from core infrastructure page. */}
              {/*
              {!isAuthenticated ? (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-bold tracking-widest py-4 uppercase text-xs text-center rounded-lg"
                >
                  Login / Registro
                </Link>
              ) : (
                <>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full bg-[#0d33f2] text-white font-bold tracking-widest py-4 uppercase text-xs text-center rounded-lg"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => { setMobileMenuOpen(false); handleHeaderLogout(); }}
                    className="w-full text-gray-400 hover:text-white font-bold tracking-widest py-3 uppercase text-xs transition-colors"
                  >
                    Cerrar Sesión
                  </button>
                </>
              )}
              <button
                onClick={() => { setMobileMenuOpen(false); setStartModalOpen(true); }}
                className="w-full bg-white/5 border border-white/10 text-gray-400 hover:text-white font-bold tracking-widest py-4 uppercase text-xs rounded-lg"
              >
                Empezar
              </button>
              */}
            </div>
          </nav>
        </div>
      )}

      {/* ── Sidebar: Grouped Navigation ── */}
      <aside className={`fixed left-0 top-0 hidden flex-col pt-20 pb-8 z-40 h-screen border-r border-[var(--bz-chrome-line)] bg-[var(--bz-chrome-panel)] shadow-2xl shadow-blue-900/20 transition-all duration-300 lg:flex ${isSidebarOpen ? 'w-72' : 'w-20'}`}>

        {/* Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-24 w-6 h-6 bg-[#0d33f2] rounded-full flex items-center justify-center cursor-pointer text-white shadow-[0_0_10px_rgba(13,51,242,0.5)] border border-white/10 z-50 hover:scale-110 transition-transform"
        >
          <span className="material-symbols-outlined text-[14px]">
            {isSidebarOpen ? 'chevron_left' : 'chevron_right'}
          </span>
        </button>

        <div className={`px-6 mb-6 flex flex-col transition-all overflow-hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 h-0 hidden'}`}>
          <Link href="/">
            <div className="text-[var(--bz-chrome-text)] font-bold italic font-['Space_Grotesk'] text-lg hover:text-[#0d33f2] transition-colors whitespace-nowrap">BEZHAS PROTOCOL</div>
          </Link>
          <div className="text-[var(--bz-chrome-text-mut)] text-[10px] tracking-[0.3em] uppercase whitespace-nowrap">V2.0.4-BETA · Chain 2708</div>
        </div>

        {/* Collapsed Logo */}
        <div className={`mb-6 flex justify-center transition-all ${isSidebarOpen ? 'hidden' : 'opacity-100'}`}>
          <Link href="/">
            <div className="w-10 h-10 bg-[#0d33f2]/20 rounded-lg flex items-center justify-center border border-[#0d33f2]/50 hover:bg-[#0d33f2]/40 transition-colors">
              <span className="material-symbols-outlined text-[#0d33f2] text-[18px]">deployed_code</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden font-['Space_Grotesk'] text-sm tracking-widest uppercase custom-scrollbar">
          {sidebarSections.map((section) => (
            <div key={section.title} className="mb-2">
              {isSidebarOpen && (
                <div className="px-6 pt-4 pb-2 text-[9px] tracking-[0.4em] text-gray-600 font-bold uppercase">
                  {section.title}
                </div>
              )}
              {!isSidebarOpen && <div className="border-t border-white/5 my-2 mx-4" />}
              {section.items.map((item) => {
                const isActive = pathname === item.path;
                if (isActive) {
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      target={item.path.startsWith('http') ? '_blank' : undefined}
                      rel={item.path.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="block group"
                    >
                      <div className={`bg-[#0d33f2] text-white italic font-bold py-3 rounded-none clip-path-polygon flex items-center transition-all ${isSidebarOpen ? 'px-6 space-x-4' : 'px-0 justify-center'}`}>
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {item.icon}
                        </span>
                        {isSidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
                      </div>
                    </Link>
                  );
                }
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    target={item.path.startsWith('http') ? '_blank' : undefined}
                    rel={item.path.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className={`flex items-center text-[var(--bz-chrome-text-mut)] py-3 hover:text-[var(--bz-chrome-text)] hover:bg-[var(--bz-chrome-hover)] hover:translate-x-1 transition-transform group ${isSidebarOpen ? 'px-6 space-x-4' : 'px-0 justify-center'}`}
                  >
                    <span className="material-symbols-outlined group-hover:shadow-[0_0_15px_rgba(13,51,242,0.3)]">
                      {item.icon}
                    </span>
                    {isSidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={`mt-auto space-y-2 transition-all ${isSidebarOpen ? 'px-6' : 'px-4'}`}>
          <Link href="/support">
            <button className={`w-full bg-[var(--bz-chrome-hover)] border border-[var(--bz-chrome-line)] text-[var(--bz-chrome-text-dim)] hover:text-[var(--bz-chrome-text)] font-bold tracking-widest transition-all uppercase italic flex justify-center items-center ${isSidebarOpen ? 'p-3 text-[10px]' : 'p-3 text-[10px] rounded-lg'}`}>
              {isSidebarOpen ? 'SOPORTE' : <span className="material-symbols-outlined text-[var(--bz-chrome-text)] text-[18px]">support_agent</span>}
            </button>
          </Link>
          {/* Empezar button commented out for security restructuring. Access restricted from core infrastructure page. */}
          {/*
          <button
            onClick={() => setStartModalOpen(true)}
            className={`w-full bg-[#0d33f2] text-white font-bold tracking-widest hover:brightness-110 active:scale-95 transition-all uppercase italic flex justify-center items-center ${isSidebarOpen ? 'p-4 text-xs' : 'p-3 text-[10px] rounded-lg'}`}
          >
            {isSidebarOpen ? (
              <><span className="material-symbols-outlined text-[16px] mr-2">rocket_launch</span>EMPEZAR</>
            ) : (
              <span className="material-symbols-outlined text-white text-[18px]">rocket_launch</span>
            )}
          </button>
          */}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`pt-24 pb-12 px-4 sm:px-6 lg:px-8 min-h-screen hero-gradient transition-all duration-300 ${isSidebarOpen ? 'lg:ml-72' : 'lg:ml-20'}`}>
        {children}
      </main>

      <StartModal
        isOpen={startModalOpen}
        activeProfile={activeStartProfile}
        onProfileChange={setActiveStartProfile}
        onClose={() => setStartModalOpen(false)}
      />

      {/* Cookie Consent Banner (EU compliant consent for non-essential cookies) */}
      {showCookieBanner && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Aviso de cookies"
          className="fixed z-[70] bottom-4 left-4 right-4 sm:right-auto sm:left-6 sm:bottom-6 sm:max-w-xl rounded-2xl border border-[var(--bz-chrome-line)] bg-[var(--bz-chrome-panel)] backdrop-blur-xl shadow-2xl shadow-[0_0_30px_rgba(13,51,242,0.25)]"
        >
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#22d3ee] mt-0.5">cookie</span>
              <div>
                <h2 className="text-[var(--bz-chrome-text)] text-sm sm:text-base font-bold uppercase tracking-[0.15em]">Uso de Cookies</h2>
                <p className="text-[var(--bz-chrome-text-dim)] text-xs sm:text-sm leading-relaxed mt-2">
                  La plataforma BeZhas utiliza cookies tecnicas para el funcionamiento del sitio y, con su consentimiento, cookies opcionales para analitica y mejora de experiencia, conforme a la normativa de la Union Europea.
                </p>
                <p className="text-[var(--bz-chrome-text-mut)] text-[11px] sm:text-xs mt-2">
                  Puede cambiar su decision en cualquier momento desde el{' '}
                  <a href="/privacy" className="underline hover:text-[#22d3ee] transition-colors">panel de privacidad</a>.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
              <button
                onClick={() => saveCookieConsent('necessary')}
                className="h-11 px-4 rounded-lg border border-[var(--bz-chrome-line)] text-[var(--bz-chrome-text-dim)] text-[11px] sm:text-xs font-bold uppercase tracking-[0.12em] hover:bg-[var(--bz-chrome-hover)] transition-all"
              >
                Solo necesarias
              </button>
              <button
                onClick={() => saveCookieConsent('accepted')}
                className="h-11 px-4 rounded-lg bg-[#0d33f2] text-white text-[11px] sm:text-xs font-bold uppercase tracking-[0.12em] hover:brightness-110 transition-all"
              >
                Aceptar cookies
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
