import React from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import { 
  LayoutGrid, 
  Activity, 
  ShieldCheck, 
  Wallet, 
  BarChart3,
  Settings,
  Users,
  Bell,
  Cpu,
  FileText
} from 'lucide-react'

// Wallet login / subscribe (shared)
import { HeaderAuthButton } from '../../_shared/BezhasAuthProvider.jsx'
import useMe from './hooks/useMe'

// Pages
import Dashboard from './pages/Dashboard'
import Scada from './pages/Scada'
import Aegis from './pages/Aegis'
import EnergyWallet from './pages/Wallet'
import Analytics from './pages/Analytics'
import Suppliers from './pages/Suppliers'
import Docs from './pages/Docs'
import Operators from './pages/Operators'

const App = () => {
  const { me } = useMe()
  return (
    <Router>
      <div className="app-shell">
        {/* Top Bar */}
        <header className="top-bar">
          <div className="node-info">
            <div style={{ color: 'var(--bez-primary)' }}>
              <ShieldCheck size={28} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', letterSpacing: '-0.5px' }}>
                BeZhas Node 01
              </div>
              <div className="status-badge">
                <span style={{ color: 'var(--bez-secondary)' }}>●</span> Status: Synchronized
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <HeaderAuthButton />
            <div style={{ textAlign: 'right', display: 'none', md: 'block' }}>
              <div style={{ fontSize: '12px', color: 'var(--bez-text-muted)', fontFamily: 'monospace' }}>v4.0.2-Stable</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bez-surface-2)', border: '1px solid var(--bez-border)', overflow: 'hidden' }}>
              <img src="https://api.dicebear.com/9.x/avataaars/svg?seed=Felix" alt="User" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scada" element={<Scada />} />
            <Route path="/aegis" element={<Aegis />} />
            <Route path="/wallet" element={<EnergyWallet />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/operators" element={<Operators />} />
            <Route path="/docs" element={<Docs />} />
          </Routes>
        </main>

        {/* Bottom Nav */}
        <nav className="bottom-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <LayoutGrid size={24} />
            <span>Grid</span>
          </NavLink>
          <NavLink to="/scada" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Activity size={24} />
            <span>SCADA</span>
          </NavLink>
          <NavLink to="/aegis" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ShieldCheck size={24} />
            <span>Aegis</span>
          </NavLink>
          <NavLink to="/wallet" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Wallet size={24} />
            <span>Wallet</span>
          </NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <BarChart3 size={24} />
            <span>NegaW</span>
          </NavLink>
          {me.is_admin && (
            <NavLink to="/operators" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={24} />
              <span>Operarios</span>
            </NavLink>
          )}
          <NavLink to="/docs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileText size={24} />
            <span>Docs</span>
          </NavLink>
        </nav>
      </div>
    </Router>
  )
}

export default App
