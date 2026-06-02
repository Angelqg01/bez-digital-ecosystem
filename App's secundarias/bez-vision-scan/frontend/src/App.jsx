import React, { useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import AllScans from './pages/AllScans';
import ScanNew from './pages/ScanNew';
import ScanDetail from './pages/ScanDetail';
import Blockchain from './pages/Blockchain';
import AiInsights from './pages/AiInsights';
import ScanCredits from './pages/ScanCredits';
import CommandCenter from './pages/CommandCenter';
import { AuthProvider, useAuth, HeaderAuthButton, LockScreen } from './context/AuthProvider';
import EcosystemBar from './components/EcosystemBar';
import DevHubPanel from './components/DevHubPanel';
import { Code2 } from 'lucide-react';

const NAV_MAIN = [
  { path: '/', icon: '⊞', label: 'Overview', id: 'overview' },
  { path: '/scans', icon: '⊡', label: 'Scans', id: 'scans' },
  { path: '/blockchain', icon: '⬡', label: 'Blockchain', id: 'blockchain' },
  { path: '/ai-insights', icon: '◎', label: 'AI Insights', id: 'ai' },
];

const NAV_TOOLS = [
  { path: '/command-center', icon: '⌘', label: 'Command Center', id: 'cmd' },
  { path: '/credits', icon: '◉', label: 'Scan Credits', id: 'credits' },
];

function App() {
  const location = useLocation();
  const [devOpen, setDevOpen] = useState(false);
  const { token } = useAuth();

  const isDashboard = location.pathname === '/';
  const showLock = !token && !isDashboard;

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo">★</div>
          <div>
            <h2>BeZhas Scan</h2>
            <span>SDK</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">Main</div>
          {NAV_MAIN.map(n => (
            <NavLink key={n.id} to={n.path} end={n.path === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="icon">{n.icon}</span>
              {n.label}
              {n.id === 'ai' && <span className="badge">4</span>}
            </NavLink>
          ))}

          <div className="sidebar-section">Tools</div>
          {NAV_TOOLS.map(n => (
            <NavLink key={n.id} to={n.path}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}

        </nav>

        <div className="sidebar-footer">
          <span className="dot"></span>
          BeZhas-ID: 884-XTR
        </div>
        <div className="sidebar-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
          <span className="icon">⚙</span> Settings
        </div>
        <div style={{ padding: '0 1rem 0.5rem' }}>
          <button onClick={() => setDevOpen(true)} style={{ width: '100%', padding: '0.6rem', background: 'rgba(0,240,255,0.06)', color: '#00f0ff', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Code2 size={14} /> API Hub
          </button>
        </div>
        <div style={{ marginTop: 8, padding: '0 1rem 1rem' }}>
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <div className="top-bar">
          <div>
            <h1>{getPageTitle(location.pathname)}</h1>
          </div>
          <div className="top-bar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <input className="search-box" placeholder="Search Assets or Hashes..." style={{ margin: 0 }} />
            <HeaderAuthButton />
          </div>
        </div>

        {showLock ? (
          <LockScreen title="Análisis de Visión Artificial Restringido" />
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scans" element={<AllScans />} />
            <Route path="/scan/new" element={<ScanNew />} />
            <Route path="/scan/:id" element={<ScanDetail />} />
            <Route path="/blockchain" element={<Blockchain />} />
            <Route path="/ai-insights" element={<AiInsights />} />
            <Route path="/credits" element={<ScanCredits />} />
            <Route path="/command-center" element={<CommandCenter />} />
          </Routes>
        )}
      </main>

      {/* Mobile Bottom Tabs */}
      <div className="bottom-tabs">
        <div className="bottom-tabs-inner">
          <NavLink to="/" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
            <span className="tab-icon">⊞</span>Dashboard
          </NavLink>
          <NavLink to="/scans" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
            <span className="tab-icon">⊡</span>Scans
          </NavLink>
          <NavLink to="/scan/new">
            <button className="tab-scan-btn">+</button>
          </NavLink>
          <NavLink to="/blockchain" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
            <span className="tab-icon">⬡</span>Blockchain
          </NavLink>
          <NavLink to="/credits" className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}>
            <span className="tab-icon">⚙</span>Settings
          </NavLink>
        </div>
      </div>

      <EcosystemBar appName="Vision Scan" />
      {devOpen && <DevHubPanel sector="vision" onClose={() => setDevOpen(false)} />}
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

function getPageTitle(path) {
  const titles = {
    '/': 'Unified Dashboard',
    '/scans': 'Audit Log',
    '/scan/new': 'New Scan',
    '/blockchain': 'Blockchain Proof',
    '/ai-insights': 'AI Insights',
    '/credits': 'Scan Credits',
    '/command-center': 'Command Center',
  };
  return titles[path] || 'BeZhas Scan';
}
