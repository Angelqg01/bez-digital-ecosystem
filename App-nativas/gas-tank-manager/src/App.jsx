import React, { useState } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Recharge from './pages/Recharge';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Policies from './pages/Policies';
import { AuthProvider, useAuth, HeaderAuthButton, LockScreen } from './context/AuthProvider';
import AIWorkspaceBar from '../../_shared/ai-chat/AIWorkspaceBar.jsx';
import { useLocation } from 'react-router-dom';
import DevHubPanel from './components/DevHubPanel';
import { Code2, LogOut } from 'lucide-react';
import HeaderMenu from '../../_shared/HeaderMenu.jsx';
import { useSidebar, AppHeader, SidebarBackdrop } from '../../_shared/AppShell.jsx';

const NAV = [
  { path: '/', icon: '📊', label: 'Dashboard' },
  { path: '/recharge', icon: '💳', label: 'Recharge' },
  { path: '/policies', icon: '🛡️', label: 'Policies' },
  { path: '/analytics', icon: '📈', label: 'Analytics' },
  { path: '/settings', icon: '⚙️', label: 'Settings' },
];

// Rutas relativas (/hub, /bez-wallet) daban 404 en gas.bezhas.com: cada app vive en su subdominio.
const ECO = [
  { icon: '🏠', label: 'BeZhas Hub', href: 'https://hub.bezhas.com' },
  { icon: '💰', label: 'BEZ Wallet', href: 'https://wallet.bezhas.com' },
];

function App() {
  const location = useLocation();
  const [devOpen, setDevOpen] = useState(false);
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const sidebar = useSidebar('gas-tank');

  const isDashboard = location.pathname === '/';
  const showLock = !token && !isDashboard;

  return (
    <div className="gas-layout" {...sidebar.layoutProps}>
      <aside className="gas-sidebar bz-sb" {...sidebar.sidebarProps}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⛽</div>
          <div>
            <div className="sidebar-logo-text">Gas Tank</div>
            <div className="sidebar-logo-sub">BeZhas Corporate</div>
          </div>
        </div>

        <div className="sidebar-section">Management</div>
        {NAV.map(item => (
          <NavLink key={item.path} to={item.path} end={item.path === '/'} title={item.label} aria-label={item.label}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <span className="sidebar-link-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <div className="sidebar-section">Ecosystem</div>
        {ECO.map(item => (
          <a key={item.href} href={item.href} className="sidebar-link" title={item.label} aria-label={item.label}>
            <span className="sidebar-link-icon">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </aside>
      <SidebarBackdrop sidebar={sidebar} />

      <main className="gas-main">
        <AppHeader
          sidebar={sidebar}
          title="Gas Tank"
          section={NAV.find((n) => (n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path)))?.label}
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
                  { key: 'api', label: 'API Hub', hint: 'Endpoints y SDK de esta app', icon: Code2, onClick: () => setDevOpen(true) },
                  { key: 'out', label: 'Cerrar sesión', icon: LogOut, onClick: logout, hidden: !token },
                ]}
              />
            </>
          )}
        />

        {showLock ? (
          <LockScreen title="Gestor de Gas Restringido" />
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/recharge" element={<Recharge />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        )}
      </main>

      {devOpen && <DevHubPanel sector="gas" onClose={() => setDevOpen(false)} />}
      {/* Chat de la plataforma (el mismo de www.bezhas.com); leftOffset = ancho del sidebar */}
      <AIWorkspaceBar hideAppId="app_gas" bottomOffset={12} leftOffset={sidebar.collapsed ? 72 : 240} />
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
