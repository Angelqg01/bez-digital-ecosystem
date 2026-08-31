import React, { useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import SetupWizard from './pages/SetupWizard';
import Rewards from './pages/Rewards';
import { AuthProvider, useAuth, HeaderAuthButton, LockScreen } from './context/AuthProvider';
import { useLocation } from 'react-router-dom';
import EcosystemBar from './components/EcosystemBar';
import DevHubPanel from './components/DevHubPanel';
import { Code2 } from 'lucide-react';

const NAV = [
  { path: '/', icon: '📊', label: 'Network' },
  { path: '/setup', icon: '🔧', label: 'Setup Node' },
  { path: '/rewards', icon: '💎', label: 'Rewards' },
];

function App() {
  const location = useLocation();
  const [devOpen, setDevOpen] = useState(false);
  const { token } = useAuth();

  const isDashboard = location.pathname === '/';
  const showLock = !token && !isDashboard;

  return (
    <div className="edge-layout">
      <aside className="edge-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🖥️</div>
          <div>
            <div className="sidebar-logo-text">Edge Nodes</div>
            <div className="sidebar-logo-sub">v1.0.0 · DePIN</div>
          </div>
        </div>
        <div className="sidebar-section">Management</div>
        {NAV.map(item => (
          <NavLink key={item.path} to={item.path} end={item.path === '/'} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <span className="sidebar-link-icon">{item.icon}</span>{item.label}
          </NavLink>
        ))}
        <div className="sidebar-section">Ecosystem</div>
        {[{ icon: '🏠', label: 'Hub', href: '/hub' }, { icon: '💰', label: 'Wallet', href: '/bez-wallet' }, { icon: '⛽', label: 'Gas Tank', href: '/gas-tank' }].map(e => (
          <a key={e.href} href={e.href} className="sidebar-link"><span className="sidebar-link-icon">{e.icon}</span>{e.label}</a>
        ))}
        {/* Network Health */}
        <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(16,185,129,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>🌐 Network</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--bezhas-text-muted)' }}>Nodes Online: <strong style={{ color: '#10B981' }}>847</strong></div>
          <div style={{ fontSize: '0.7rem', color: 'var(--bezhas-text-muted)' }}>TPS: <strong style={{ color: 'var(--bezhas-text)' }}>1,240</strong></div>
          <div style={{ fontSize: '0.7rem', color: 'var(--bezhas-text-muted)' }}>Your Nodes: <strong style={{ color: 'var(--bezhas-primary)' }}>3</strong></div>
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
      <main className="edge-main">
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
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#00f0ff' }}>🖥️ Edge Nodes DePIN</span>
            <span style={{ fontSize: '10px', background: 'rgba(0, 240, 255, 0.1)', color: '#00f0ff', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>CHAIN 2708</span>
          </div>
          <HeaderAuthButton />
        </div>

        {showLock ? (
          <LockScreen title="Administración DePIN Restringida" />
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/setup" element={<SetupWizard />} />
            <Route path="/rewards" element={<Rewards />} />
          </Routes>
        )}
      </main>

      <EcosystemBar appName="Edge Nodes" />
      {devOpen && <DevHubPanel sector="edge" onClose={() => setDevOpen(false)} />}
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
