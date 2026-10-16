import React from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Terminal,
  Map as MapIcon,
  Fingerprint,
  Box,
  Globe,
  Wallet as WalletIcon,
  Code2,
  Users,
  Radio,
  Settings as SettingsIcon,
  HelpCircle,
  Building2,
} from 'lucide-react'
import EcosystemBar from './components/EcosystemBar'
import GuidedTour, { TOUR_EVENT } from './components/GuidedTour'
import HeaderMenu from '../../_shared/HeaderMenu.jsx'
import { AuthProvider, useAuth, HeaderAuthButton, LockScreen, OrganizationBar, OrganizationSettingsPage } from './context/AuthProvider'
import AIWorkspaceBar from '../../_shared/ai-chat/AIWorkspaceBar.jsx';

// Pages
import ActiveRoute from './pages/ActiveRoute'
import CargoFingerprint from './pages/CargoFingerprint'
import SmartStowage from './pages/SmartStowage'
import CustomsSync from './pages/CustomsSync'
import Wallet from './pages/Wallet'
import DeveloperIntegration from './pages/DeveloperIntegration'
import Operators from './pages/Operators'
import TransactionDetail from './pages/TransactionDetail'
import Telemetry from './pages/Telemetry'
import Settings from './pages/Settings'

const App = () => {
  const { token, user } = useAuth()
  const isAdmin = (user?.role || '').toLowerCase() === 'admin'
  const location = useLocation()
  const navigate = useNavigate()

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <HeaderMenu
              onNavigate={navigate}
              items={[
                { key: 'tour', label: 'Cómo usar', hint: 'Recorrido animado por cada función', icon: HelpCircle, onClick: () => window.dispatchEvent(new CustomEvent(TOUR_EVENT)) },
                { key: 'settings', label: 'Configuración y sensores', icon: SettingsIcon, to: '/settings' },
                { key: 'api', label: 'API Hub', hint: 'Claves, webhooks e integración', icon: Code2, to: '/integration' },
                { key: 'org', label: 'Organización', hint: 'KYB, blockchain, facturación', icon: Building2, to: '/organization' },
              ]}
              auth={<HeaderAuthButton />}
            >
              <OrganizationBar />
            </HeaderMenu>
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
              <Route path="/operators" element={<Operators />} />
              <Route path="/integration" element={<DeveloperIntegration />} />
              <Route path="/telemetry" element={<Telemetry />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/organization" element={<OrganizationSettingsPage />} />
              <Route path="/tx/:bUid" element={<TransactionDetail />} />
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
          {isAdmin && (
            <NavLink to="/telemetry" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Radio size={24} />
              <span>IoT</span>
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/operators" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={24} />
              <span>Operarios</span>
            </NavLink>
          )}
        </nav>
      </div>

      <EcosystemBar appName="BZ CargoLink" />
      <GuidedTour />
    </>
  )
}

export default function AppWrapper() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <App />
        {/* Chat de la plataforma (el mismo de www.bezhas.com) */}
        <AIWorkspaceBar hideAppId="app_cargolink" bottomOffset={92} />
      </AuthProvider>
    </Router>
  )
}
