import React from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom'
import { 
  Terminal,
  Map as MapIcon,
  Fingerprint,
  Box,
  Globe,
  Wallet as WalletIcon,
  Code2
} from 'lucide-react'
import EcosystemBar from './components/EcosystemBar'
import { AuthProvider, useAuth, HeaderAuthButton, LockScreen } from './context/AuthProvider'

// Pages
import ActiveRoute from './pages/ActiveRoute'
import CargoFingerprint from './pages/CargoFingerprint'
import SmartStowage from './pages/SmartStowage'
import CustomsSync from './pages/CustomsSync'
import Wallet from './pages/Wallet'
import DeveloperIntegration from './pages/DeveloperIntegration'

const App = () => {
  const { token } = useAuth()
  const location = useLocation()

  const isDashboard = location.pathname === '/'
  const showLock = !token && !isDashboard

  return (
    <>
      <div className="app-shell">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ color: 'var(--bz-primary)' }}>
              <Terminal size={20} />
            </div>
            <h1 style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--bz-primary)' }}>
              VALIDATOR_TERMINAL
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link to="/integration" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--bz-text)', background: 'var(--bz-surface-container)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--bz-border)', textDecoration: 'none' }}>
              <Code2 size={16} color="var(--bz-primary)" />
              <span style={{ fontSize: 10, fontWeight: 800 }}>API HUB</span>
            </Link>
            <HeaderAuthButton />
          </div>
        </header>

        <main className="main-content">
          {showLock ? (
            <LockScreen title="Terminal Logística Restringida" />
          ) : (
            <Routes>
              <Route path="/" element={<ActiveRoute />} />
              <Route path="/fingerprint" element={<CargoFingerprint />} />
              <Route path="/stowage" element={<SmartStowage />} />
              <Route path="/customs" element={<CustomsSync />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/integration" element={<DeveloperIntegration />} />
            </Routes>
          )}
        </main>

        <nav className="bottom-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <MapIcon size={24} />
            <span>Active</span>
          </NavLink>
          <NavLink to="/fingerprint" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Fingerprint size={24} />
            <span>Audit</span>
          </NavLink>
          <NavLink to="/stowage" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Box size={24} />
            <span>Stowage</span>
          </NavLink>
          <NavLink to="/customs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Globe size={24} />
            <span>Customs</span>
          </NavLink>
          <NavLink to="/wallet" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <WalletIcon size={24} />
            <span>Wallet</span>
          </NavLink>
        </nav>
      </div>

      <EcosystemBar appName="BZ CargoLink" />
    </>
  )
}

export default function AppWrapper() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  )
}
