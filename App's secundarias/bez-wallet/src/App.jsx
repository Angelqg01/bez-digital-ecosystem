import React, { Suspense, useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Code2 } from 'lucide-react';

import { AuthProvider, useAuth, HeaderAuthButton, LockScreen } from './context/AuthProvider';
import { useGasTank } from '@bezhas/platform-sdk/gas';

import EcosystemBar from './components/EcosystemBar';
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
});

const NAV_GROUPS = Object.freeze([
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
    <div className="gas-meter">
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

function ApiHubButton({ onClick }) {
  return (
    <div style={{ padding: '0 1rem' }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          width: '100%',
          padding: '0.6rem',
          background: 'rgba(0,240,255,0.06)',
          color: '#00f0ff',
          border: '1px solid rgba(0,240,255,0.2)',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 800,
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Code2 size={14} aria-hidden="true" /> API Hub
      </button>
    </div>
  );
}

function LogoutButton() {
  const { logout } = useAuth();

  return (
    <button
      type="button"
      onClick={logout}
      style={{
        width: '100%',
        padding: '0.75rem',
        background: 'rgba(255, 59, 48, 0.1)',
        color: '#ff3b30',
        border: '1px solid rgba(255, 59, 48, 0.2)',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
      }}
    >
      🚪 Disconnect Hub
    </button>
  );
}

function Sidebar({ onOpenDevHub }) {
  return (
    <aside className="wallet-sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">B</div>
        <div>
          <div className="sidebar-logo-text">BeZhas Enterprise</div>
          <div className="sidebar-logo-version">v1.1.0 · Validator L2 · Chain 2708</div>
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
      <ApiHubButton onClick={onOpenDevHub} />

      <div style={{ marginTop: 8, padding: '0 1rem 1rem' }}>
        <LogoutButton />
      </div>
    </aside>
  );
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

        <Route path="/bez-scaner" element={<Navigate to={ROUTES.scanner} replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  const location = useLocation();
  const [devOpen, setDevOpen] = useState(false);
  const { token } = useAuth();

  const isFullscreen = useMemo(
    () => FULLSCREEN_ROUTES.has(location.pathname),
    [location.pathname]
  );

  const isDashboard = location.pathname === '/';
  const showLock = !token && !isDashboard && !isFullscreen;

  return (
    <div className="wallet-layout" style={{ gridTemplateColumns: isFullscreen ? '1fr' : undefined }}>
      {!isFullscreen && <Sidebar onOpenDevHub={() => setDevOpen(true)} />}

      <main className="wallet-main" style={{ padding: isFullscreen ? '1rem' : undefined }}>
        {/* Top Header Bar with Auth Button */}
        {!isFullscreen && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 24px',
            background: 'rgba(15, 23, 42, 0.4)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            marginBottom: '20px',
            backdropFilter: 'blur(8px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#00f0ff' }}>🌐 BeZhas L2 Network</span>
              <span style={{ fontSize: '10px', background: 'rgba(0, 240, 255, 0.1)', color: '#00f0ff', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>TESTNET ACTIVE</span>
            </div>
            <HeaderAuthButton />
          </div>
        )}

        {showLock ? (
          <LockScreen title="Módulo Wallet Restringido" />
        ) : (
          <AppRoutes />
        )}
      </main>

      {!isFullscreen && <EcosystemBar appName="BeZhas Enterprise" />}
      {devOpen && <DevHubPanel sector="enterprise-validator-scan" onClose={() => setDevOpen(false)} />}
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
