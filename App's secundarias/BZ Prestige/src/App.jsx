import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import { Diamond, Scan, Store, BarChart3, Code2 } from 'lucide-react'
import EcosystemBar from './components/EcosystemBar'
import DevHubPanel from './components/DevHubPanel'
import { AuthProvider, useAuth, HeaderAuthButton, LockScreen } from './context/AuthProvider'

// Pages
import Authenticator from './pages/Authenticator'
import SecondaryMarket from './pages/SecondaryMarket'
import BrandAnalytics from './pages/BrandAnalytics'

const App = () => {
  const [devOpen, setDevOpen] = useState(false)
  const { token } = useAuth()
  const location = useLocation()

  const isDashboard = location.pathname === '/'
  const showLock = !token && !isDashboard

  return (
    <>
      <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bz-bg)', color: 'var(--bz-text)' }}>
        <header className="header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--bz-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ color: 'var(--bz-primary)' }}>
              <Diamond size={24} />
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 3, color: 'var(--bz-primary)', fontFamily: 'Space Grotesk' }}>
              BZ PRESTIGE
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setDevOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#00f0ff', background: 'rgba(0,240,255,0.06)', padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(0,240,255,0.2)', cursor: 'pointer', fontSize: 10, fontWeight: 800 }}>
              <Code2 size={14} /> API HUB
            </button>
            <HeaderAuthButton />
          </div>
        </header>

        <main className="main-content" style={{ flex: 1, overflowY: 'auto' }}>
          {showLock ? (
            <LockScreen title="Sección Prestige Restringida" />
          ) : (
            <Routes>
              <Route path="/" element={<Authenticator />} />
              <Route path="/market" element={<SecondaryMarket />} />
              <Route path="/analytics" element={<BrandAnalytics />} />
            </Routes>
          )}
        </main>

        <nav className="bottom-nav" style={{ display: 'flex', background: '#080808', borderTop: '1px solid var(--bz-border)', padding: '12px 0' }}>
          <NavLink to="/" style={({ isActive }) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none', color: isActive ? 'var(--bz-primary)' : 'var(--bz-text-muted)' })}>
            <Scan size={24} />
            <span style={{ fontSize: 10, fontWeight: 700 }}>Authenticate</span>
          </NavLink>
          <NavLink to="/market" style={({ isActive }) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none', color: isActive ? 'var(--bz-primary)' : 'var(--bz-text-muted)' })}>
            <Store size={24} />
            <span style={{ fontSize: 10, fontWeight: 700 }}>Resale Market</span>
          </NavLink>
          <NavLink to="/analytics" style={({ isActive }) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none', color: isActive ? 'var(--bz-primary)' : 'var(--bz-text-muted)' })}>
            <BarChart3 size={24} />
            <span style={{ fontSize: 10, fontWeight: 700 }}>Royalties</span>
          </NavLink>
        </nav>
      </div>

      <EcosystemBar appName="BZ Prestige" />
      {devOpen && <DevHubPanel sector="prestige" onClose={() => setDevOpen(false)} />}
    </>
  )
}

function AppWrapper() {
  return (
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  )
}

export default AppWrapper
