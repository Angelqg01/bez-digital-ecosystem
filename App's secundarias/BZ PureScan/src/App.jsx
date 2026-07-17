import React, { useState, useCallback } from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  useNavigate,
  useLocation,
  Navigate,
} from 'react-router-dom'
import {
  ArrowLeft,
  Settings,
  LayoutList,
  Database,
  User,
  QrCode,
  CreditCard,
  Cpu,
  X,
} from 'lucide-react'

// Wallet login / subscribe (shared)
import WalletAuthButton from './WalletAuthButton.jsx'

// Pages
import Dashboard from './pages/Dashboard'
import Scanner from './pages/Scanner'
import Storage from './pages/Storage'
import Profile from './pages/Profile'
import Billing from './pages/Billing'

// ─── FIX #9: Títulos de documento por ruta ────────────────────────────────────
const ROUTE_META = [
  { path: '/', title: 'Dashboard — Food Oracle Scan' },
  { path: '/scan', title: 'Scanner — Food Oracle Scan' },
  { path: '/storage', title: 'Storage — Food Oracle Scan' },
  { path: '/billing', title: 'Billing — Food Oracle Scan' },
  { path: '/profile', title: 'Profile — Food Oracle Scan' },
]

const SETTINGS_ITEMS = [
  { icon: Cpu, label: 'Sensores', path: '/scan', action: 'sensors' },
  { icon: User, label: 'Profile', path: '/profile' },
  { icon: Database, label: 'Storage', path: '/storage' },
  { icon: CreditCard, label: 'Billing', path: '/billing' },
]

const SettingsPanel = ({ onClose, onItem }) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Configuración"
    className="absolute top-14 right-4 z-50 w-56 bg-bz-surface border border-bz-primary/30
      rounded-xl shadow-2xl p-2 flex flex-col"
  >
    <div className="flex justify-between items-center px-2 py-1.5 mb-1">
      <h2 className="font-bold text-sm">Configuración</h2>
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="p-1 rounded hover:bg-bz-primary/20 transition-colors"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
    {SETTINGS_ITEMS.map(({ icon: Icon, label, path, action }) => (
      <button
        key={label}
        onClick={() => onItem(path, action)}
        className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium
          text-bz-text hover:bg-bz-primary/10 transition-colors text-left"
      >
        <Icon size={18} className="text-bz-text-muted flex-shrink-0" aria-hidden="true" />
        {label}
      </button>
    ))}
    <div className="mt-1 border-t border-bz-ghost-border pt-2 px-3 pb-1">
      <p className="text-bz-text-muted text-[11px]">BZ PureScan v1.0.0</p>
    </div>
  </div>
)

// ─── FIX #9: Hook que actualiza document.title al cambiar de ruta ─────────────
const useDocumentTitle = () => {
  const { pathname } = useLocation()
  React.useEffect(() => {
    const meta = ROUTE_META.find(r => r.path === pathname)
    if (meta) document.title = meta.title
  }, [pathname])
}

// ─── FIX #1: AppShell separado — hijo de <Router>, puede usar hooks de RR ─────
// useNavigate y useLocation DEBEN llamarse dentro de un descendiente de <Router>,
// nunca en el mismo componente que renderiza <Router>.
const AppShell = () => {
  const navigate = useNavigate()           // ✅ aquí sí es válido
  const location = useLocation()
  const [showSettings, setShowSettings] = useState(false)

  // ─── FIX #9 ───────────────────────────────────────────────────────────────
  useDocumentTitle()

  // ─── FIX #2: Sólo navegar atrás si hay historial interno de la app ────────
  const handleBackClick = useCallback(() => {
    if (location.pathname === '/') return // ya estamos en raíz, no hacer nada
    navigate(-1)
  }, [navigate, location.pathname])

  const toggleSettings = useCallback(() => setShowSettings(v => !v), [])
  const closeSettings = useCallback(() => setShowSettings(false), [])

  const handleSettingsItem = useCallback((path, action) => {
    closeSettings()
    navigate(path)
    if (action === 'sensors') {
      setTimeout(() => window.dispatchEvent(new CustomEvent('open-sensors')), 120)
    }
  }, [navigate, closeSettings])

  // Ocultar botón back en la ruta raíz
  const isRoot = location.pathname === '/'

  return (
    <div className="app-shell">
      <header className="header">
        <div className="flex items-center gap-3">
          {/* ─── FIX #2: Botón oculto en "/" para no salir de la app ──── */}
          {!isRoot && (
            <button
              onClick={handleBackClick}
              className="btn btn-icon bg-bz-primary/10 text-bz-primary hover:bg-bz-primary/20"
              aria-label="Go back"
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
          )}
          <h1 className="text-lg font-bold">
            Food Oracle <span className="text-bz-neon">Scan</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
        <WalletAuthButton accent="#00D4AA" statement="Inicia sesión en BZ PureScan." subscribePlan={{ amountBEZ: 25, label: 'PureScan Pro' }} />
        {/* ─── FIX #3: Botón de settings con panel real ──────────────── */}
        <div className="relative">
          <button
            onClick={toggleSettings}
            className="p-2 hover:bg-bz-surface rounded-lg transition-colors"
            aria-label={showSettings ? 'Close settings' : 'Open settings'}
            aria-expanded={showSettings}
            aria-haspopup="dialog"
          >
            {showSettings
              ? <X size={20} aria-hidden="true" />
              : <Settings size={20} className="text-bz-text-muted" aria-hidden="true" />
            }
          </button>

          {showSettings && <SettingsPanel onClose={closeSettings} onItem={handleSettingsItem} />}
        </div>
        </div>
      </header>

      {/* Overlay para cerrar settings al clicar fuera */}
      {showSettings && (
        <div
          className="fixed inset-0 z-40"
          aria-hidden="true"
          onClick={closeSettings}
        />
      )}

      <main className={`main-content ${location.pathname === '/scan' ? 'main-content-scan' : ''}`}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/scan" element={<Scanner />} />
          <Route path="/storage" element={<Storage />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/profile" element={<Profile />} />

          {/* ─── FIX #5: Ruta 404 — redirige a raíz ─────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* ─── FIX #8: Accesibilidad en nav ──────────────────────────────── */}
      <nav className="bottom-nav" aria-label="Main navigation">
        <NavLink
          to="/scan"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          aria-label="Scanner"
        >
          <QrCode size={24} aria-hidden="true" />
          <span>Scan</span>
        </NavLink>

        {/* ─── FIX #4: prop end para que "/" no active en subrutas ──── */}
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          aria-label="Dashboard"
        >
          <LayoutList size={24} aria-hidden="true" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/storage"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          aria-label="Storage"
        >
          <Database size={24} aria-hidden="true" />
          <span>Storage</span>
        </NavLink>

        {/* ─── FIX #6: CreditCard en vez de Settings para Billing ──── */}
        <NavLink
          to="/billing"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          aria-label="Billing"
        >
          <CreditCard size={24} aria-hidden="true" />
          <span>Billing</span>
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          aria-label="Profile"
        >
          <User size={24} aria-hidden="true" />
          <span>Profile</span>
        </NavLink>
      </nav>
    </div>
  )
}

// ─── FIX #1: App sólo envuelve Router — no usa hooks de RR directamente ───────
const App = () => (
  <Router>
    <AppShell />
  </Router>
)

export default App
