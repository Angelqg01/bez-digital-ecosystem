import React, { Suspense, useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Code2, Building2, LogOut } from 'lucide-react';
import HeaderMenu from '../../_shared/HeaderMenu.jsx';
import { useSidebar, AppHeader, SidebarBackdrop } from '../../_shared/AppShell.jsx';

import { AuthProvider, useAuth, HeaderAuthButton, LockScreen, OrganizationBar, OrganizationSettingsPage } from './context/AuthProvider';
import AIWorkspaceBar from '../../_shared/ai-chat/AIWorkspaceBar.jsx';
import { useGasTank } from '@bezhas/platform-sdk/gas';

import DevHubPanel from './components/DevHubPanel';

import Dashboard from './pages/Dashboard';
import Send from './pages/Send';
import Receive from './pages/Receive';
import NFTGallery from './pages/NFTGallery';
import History from './pages/History';
import Bridge from './pages/Bridge';
import Governance from './pages/Governance';
import Validators from './pages/Validators';
import SmartWallet from './pages/SmartWallet';
import GasTank from './pages/GasTank';
import Checkout from './pages/Checkout';
import Buy from './pages/Buy';

/**
 * BeZhas Enterprise App Shell
 * ------------------------------------------------------------
 * Reparado y optimizado para una plataforma con:
 * - Wallet / Smart Wallet / Gas Tank.
 * - Blockchain validadora.
 * - Scanner empresarial e industrial.
 * - Agricultura: enfermedades, hongos, calidad, trazabilidad y certificación.
 *
 * Siguiente paso recomendado:
 * Crear las páginas reales:
 * - ./pages/Scanner
 * - ./pages/QualityControl
 * - ./pages/Traceability
 * - ./pages/AgriIntelligence
 * - ./pages/IndustrialScan
 * - ./pages/EnterpriseAudit
 */

const Scanner = React.lazy(() => import('./pages/Scanner'));
const QualityControl = React.lazy(() => import('./pages/QualityControl'));
const Traceability = React.lazy(() => import('./pages/Traceability'));
const AgriIntelligence = React.lazy(() => import('./pages/AgriIntelligence'));
const IndustrialScan = React.lazy(() => import('./pages/IndustrialScan'));
const EnterpriseAudit = React.lazy(() => import('./pages/EnterpriseAudit'));

const ROUTES = Object.freeze({
  dashboard: '/',
  smartWallet: '/smart-wallet',
  send: '/send',
  receive: '/receive',
  buy: '/buy',
  history: '/history',
  nfts: '/nfts',
  checkout: '/checkout',
  scanner: '/bez-scanner',
  quality: '/quality-control',
  traceability: '/traceability',
  agri: '/agri-intelligence',
  industrial: '/industrial-scan',
  audit: '/enterprise-audit',
  bridge: '/bridge',
  validators: '/validators',
  governance: '/governance',
  gasTank: '/gas-tank',
  organization: '/organization',
});

const NAV_GROUPS = Object.freeze([
  {
    title: 'Empresa',
    items: [
      { path: ROUTES.organization, icon: '🏢', label: 'Organización' },
    ],
  },
  {
    title: 'Wallet',
    items: [
      { path: ROUTES.dashboard, icon: '📊', label: 'Dashboard', end: true },
      { path: ROUTES.smartWallet, icon: '🛡️', label: 'Smart Wallet' },
      { path: ROUTES.send, icon: '↗️', label: 'Send' },
      { path: ROUTES.receive, icon: '↙️', label: 'Receive' },
      { path: ROUTES.buy, icon: '💳', label: 'Buy BEZ' },
      { path: ROUTES.history, icon: '📋', label: 'History' },
    ],
  },
  {
    title: 'Scan Enterprise',
    items: [
      { path: ROUTES.scanner, icon: '📷', label: 'AI Scanner' },
      { path: ROUTES.quality, icon: '🧪', label: 'Quality Control' },
      { path: ROUTES.traceability, icon: '🔗', label: 'Traceability' },
      { path: ROUTES.audit, icon: '🏢', label: 'Enterprise Audit' },
    ],
  },
  {
    title: 'Agriculture / Industry',
    items: [
      { path: ROUTES.agri, icon: '🌱', label: 'Agri Intelligence' },
      { path: ROUTES.industrial, icon: '🏭', label: 'Industrial Scan' },
      { path: ROUTES.nfts, icon: '🏷️', label: 'Certificates NFT' },
    ],
  },
  {
    title: 'Ecosystem',
    items: [
      { path: ROUTES.bridge, icon: '🌉', label: 'Bridge Transition' },
      { path: ROUTES.validators, icon: '⚖️', label: 'Validators' },
      { path: ROUTES.governance, icon: '🏛️', label: 'DAO Governance' },
      { path: ROUTES.gasTank, icon: '⛽', label: 'Gas Tank' },
    ],
  },
]);

const FULLSCREEN_ROUTES = new Set([ROUTES.checkout]);

function numberOrZero(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatUsd(value) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numberOrZero(value));
}

function LoadingScreen() {
  return (
    <div style={{ padding: '2rem', color: '#9aa4b2', fontSize: 13 }}>
      Loading enterprise module...
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ margin: 0 }}>404</h1>
      <p style={{ color: '#9aa4b2' }}>Esta ruta no existe dentro de BeZhas Enterprise.</p>
      <NavLink to={ROUTES.dashboard} className="sidebar-link" style={{ display: 'inline-flex', width: 'auto' }}>
        ← Volver al Dashboard
      </NavLink>
    </div>
  );
}

function SidebarLink({ item }) {
  return (
    <NavLink
      to={item.path}
      end={item.end}
      title={item.label}
      aria-label={item.label}
      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
    >
      <span className="sidebar-link-icon">{item.icon}</span>
      {item.label}
    </NavLink>
  );
}

function GasMeter() {
  const { balance_usd: gasUsd, estimated_txs_remaining: gasTxs, isLoading, error } = useGasTank();

  const gasBalance = numberOrZero(gasUsd);
  const fillPercent = Math.max(0, Math.min(100, gasBalance));
  const txsRemaining = numberOrZero(gasTxs).toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="gas-meter bz-sb-hide-collapsed">
      <div className="gas-meter-header">
        <span>⛽ Gas Tank Balance</span>
        <span className="gas-meter-value">{isLoading ? '...' : formatUsd(gasBalance)}</span>
      </div>

      <div className="gas-meter-bar" aria-label="Gas tank balance">
        <div className="gas-meter-fill" style={{ width: `${fillPercent}%` }} />
      </div>

      <div style={{ color: '#9aa4b2', fontSize: 10, marginTop: 6 }}>
        {error ? 'Gas data unavailable' : isLoading ? 'Estimating transactions...' : `~${txsRemaining} txs restantes`}
      </div>
    </div>
  );
}

function Sidebar({ sidebar }) {
  return (
    <aside className="wallet-sidebar bz-sb" {...sidebar.sidebarProps}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">B</div>
        <div>
          <div className="sidebar-logo-text">BEZ Wallet</div>
          <div className="sidebar-logo-version">BeZhas Enterprise · Polygon</div>
        </div>
      </div>

      {NAV_GROUPS.map((group) => (
        <React.Fragment key={group.title}>
          <div className="sidebar-section-label">{group.title}</div>
          {group.items.map((item) => (
            <SidebarLink key={item.path} item={item} />
          ))}
        </React.Fragment>
      ))}

      <GasMeter />
    </aside>
  );
}

/** Título de la sección actual para la cabecera. */
function seccionActual(pathname) {
  for (const g of NAV_GROUPS) {
    for (const i of g.items) {
      if (i.end ? pathname === i.path : pathname.startsWith(i.path)) return i.label;
    }
  }
  return null;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path={ROUTES.dashboard} element={<Dashboard />} />
        <Route path={ROUTES.send} element={<Send />} />
        <Route path={ROUTES.receive} element={<Receive />} />
        <Route path={ROUTES.buy} element={<Buy />} />
        <Route path={ROUTES.history} element={<History />} />
        <Route path={ROUTES.nfts} element={<NFTGallery />} />
        <Route path={ROUTES.checkout} element={<Checkout />} />
        <Route path={ROUTES.smartWallet} element={<SmartWallet />} />

        <Route path={ROUTES.scanner} element={<Scanner />} />
        <Route path={ROUTES.quality} element={<QualityControl />} />
        <Route path={ROUTES.traceability} element={<Traceability />} />
        <Route path={ROUTES.agri} element={<AgriIntelligence />} />
        <Route path={ROUTES.industrial} element={<IndustrialScan />} />
        <Route path={ROUTES.audit} element={<EnterpriseAudit />} />

        <Route path={ROUTES.bridge} element={<Bridge />} />
        <Route path={ROUTES.governance} element={<Governance />} />
        <Route path={ROUTES.validators} element={<Validators />} />
        <Route path={ROUTES.gasTank} element={<GasTank />} />
        <Route path={ROUTES.organization} element={<OrganizationSettingsPage />} />

        <Route path="/bez-scaner" element={<Navigate to={ROUTES.scanner} replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [devOpen, setDevOpen] = useState(false);
  const { token, user, logout } = useAuth();
  const sidebar = useSidebar('bez-wallet');

  const isFullscreen = useMemo(
    () => FULLSCREEN_ROUTES.has(location.pathname),
    [location.pathname]
  );

  const isDashboard = location.pathname === '/';
  const showLock = !token && !isDashboard && !isFullscreen;

  return (
    <div className="wallet-layout" {...(isFullscreen ? {} : sidebar.layoutProps)} style={{ gridTemplateColumns: isFullscreen ? '1fr' : undefined }}>
      {!isFullscreen && <Sidebar sidebar={sidebar} />}
      {!isFullscreen && <SidebarBackdrop sidebar={sidebar} />}

      <main className="wallet-main" style={{ padding: isFullscreen ? '1rem' : undefined }}>
        {!isFullscreen && (
          <AppHeader
            sidebar={sidebar}
            title="BEZ Wallet"
            section={seccionActual(location.pathname)}
            chip="Polygon"
            menu={(
              <>
                {!token && <HeaderAuthButton compact />}
                <HeaderMenu
                  onNavigate={navigate}
                  label={token ? (user?.username || 'Cuenta') : 'Menú'}
                  title="Cuenta y configuración"
                  auth={token ? <HeaderAuthButton compact /> : null}
                  items={[
                    { key: 'org', label: 'Organización', hint: 'KYB, blockchain, facturación', icon: Building2, to: ROUTES.organization, hidden: !token },
                    { key: 'api', label: 'API Hub', hint: 'Endpoints y SDK de esta app', icon: Code2, onClick: () => setDevOpen(true) },
                    { key: 'out', label: 'Cerrar sesión', icon: LogOut, onClick: logout, hidden: !token },
                  ]}
                >
                  {token ? <OrganizationBar /> : null}
                </HeaderMenu>
              </>
            )}
          />
        )}

        {showLock ? (
          <LockScreen title="Módulo Wallet Restringido" />
        ) : (
          <AppRoutes />
        )}
      </main>

      {devOpen && <DevHubPanel sector="enterprise-validator-scan" onClose={() => setDevOpen(false)} />}
      {/* Chat de la plataforma (el mismo de www.bezhas.com); leftOffset = ancho del sidebar */}
      <AIWorkspaceBar hideAppId="app_wallet" bottomOffset={12} leftOffset={isFullscreen ? 0 : (sidebar.collapsed ? 72 : 260)} />
    </div>
  );
}

export default function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
