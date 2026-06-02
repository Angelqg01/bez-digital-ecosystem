import React, { useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Recharge from './pages/Recharge';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { AuthProvider, useAuth, HeaderAuthButton, LockScreen } from './context/AuthProvider';
import { useLocation } from 'react-router-dom';
import EcosystemBar from './components/EcosystemBar';
import DevHubPanel from './components/DevHubPanel';
import { Code2 } from 'lucide-react';

const NAV = [
  { path: '/', icon: '📊', label: 'Dashboard' },
  { path: '/recharge', icon: '💳', label: 'Recharge' },
  { path: '/analytics', icon: '📈', label: 'Analytics' },
  { path: '/settings', icon: '⚙️', label: 'Settings' },
];

const ECO = [
  { icon: '🏠', label: 'BeZhas Hub', href: '/hub' },
  { icon: '💰', label: 'BEZ Wallet', href: '/bez-wallet' },
  { icon: '📷', label: 'BEZ Scanner', href: '/bez-scaner' },
];

function App() {
  const location = useLocation();
  const [devOpen, setDevOpen] = useState(false);
  const { token } = useAuth();

  const isDashboard = location.pathname === '/';
  const showLock = !token && !isDashboard;

  return (
    <div className="gas-layout">
      <aside className="gas-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⛽</div>
          <div>
            <div className="sidebar-logo-text">Gas Tank</div>
            <div className="sidebar-logo-sub">v1.0.0 · Corporate</div>
          </div>
        </div>

        <div className="sidebar-section">Management</div>
        {NAV.map(item => (
          <NavLink key={item.path} to={item.path} end={item.path === '/'} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <span className="sidebar-link-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <div className="sidebar-section">Ecosystem</div>
        {ECO.map(item => (
          <a key={item.href} href={item.href} className="sidebar-link">
            <span className="sidebar-link-icon">{item.icon}</span>
            {item.label}
          </a>
        ))}

        {/* Aegis Mini Widget */}
        <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(123,47,255,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(123,47,255,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span>🧠</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Aegis IA</span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--bezhas-text-muted)' }}>
            Best time to transact: <strong style={{ color: 'var(--bezhas-success)' }}>Now</strong>
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--bezhas-text-muted)', marginTop: '0.25rem' }}>
            Gas: 1.2 gwei · Savings: 0%
          </div>
        </div>

        {/* Dev Hub Button */}
        <div style={{ padding: '0 1rem 0.5rem' }}>
          <button onClick={() => setDevOpen(true)} style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,240,255,0.06)', color: '#00f0ff', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Code2 size={14} /> API Hub
          </button>
        </div>
        {/* Logout Button */}
        <div style={{ padding: '0 1rem 1rem' }}>
          <LogoutButton />
        </div>
      </aside>

      <main className="gas-main">
        {/* Top Header Bar with Auth Button */}
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
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#00f0ff' }}>⛽ Gas Tank Control</span>
            <span style={{ fontSize: '10px', background: 'rgba(0, 240, 255, 0.1)', color: '#00f0ff', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>L2 CORPORATE</span>
          </div>
          <HeaderAuthButton />
        </div>

        {showLock ? (
          <LockScreen title="Gestor de Gas Restringido" />
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/recharge" element={<Recharge />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        )}
      </main>

      <EcosystemBar appName="Gas Tank" />
      {devOpen && <DevHubPanel sector="gas" onClose={() => setDevOpen(false)} />}
    </div>
  );
}

// Small logout button component using the AuthContext
function LogoutButton() {
  const { logout } = useAuth();
  return (
    <button 
      onClick={logout}
      style={{
        width: '100%', padding: '0.75rem', background: 'rgba(255, 59, 48, 0.1)', 
        color: '#ff3b30', border: '1px solid rgba(255, 59, 48, 0.2)', 
        borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
      }}
    >
      🚪 Disconnect (Hub)
    </button>
  );
}

export default function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
