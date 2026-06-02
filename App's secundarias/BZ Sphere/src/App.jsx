import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Chat from './pages/Chat'
import Vault from './pages/Vault'
import VendorProfile from './pages/VendorProfile'
import VendorDashboard from './pages/VendorDashboard'
import Scanner from './pages/Scanner'
import NodeMap from './pages/NodeMap'
import FairMode from './pages/FairMode'
import GlobalBridge from './pages/GlobalBridge'
import ArbitrationPanel from './pages/ArbitrationPanel'
import P2PLending from './pages/P2PLending'
import DeliveryTerminal from './pages/DeliveryTerminal'
import InvestorDashboard from './pages/InvestorDashboard'
import EnergyModule from './pages/EnergyModule'
import IdentityModule from './pages/IdentityModule'
import IndustrialModule from './pages/IndustrialModule'
import { NavLink } from 'react-router-dom'
import { 
  MessageSquare, 
  Shield, 
  Store as StoreIcon, 
  Map as MapIcon, 
  Zap as FairIcon, 
  Globe, 
  Gavel, 
  Coins, 
  Truck,
  TrendingUp,
  Cpu,
  Fingerprint,
  Factory
} from 'lucide-react'
import { NotificationProvider } from './components/NotificationSystem'

const App = () => {
  return (
    <NotificationProvider>
      <Router>
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<Chat />} />
            <Route path="/vault" element={<Vault />} />
            <Route path="/vendor/:id" element={<VendorProfile />} />
            <Route path="/dashboard" element={<VendorDashboard />} />
            <Route path="/scanner" element={<Scanner />} />
            <Route path="/map" element={<NodeMap />} />
            <Route path="/fair" element={<FairMode />} />
            <Route path="/bridge" element={<GlobalBridge />} />
            <Route path="/arbitration" element={<ArbitrationPanel />} />
            <Route path="/lending" element={<P2PLending />} />
            <Route path="/delivery" element={<DeliveryTerminal />} />
            <Route path="/investor" element={<InvestorDashboard />} />
            <Route path="/energy" element={<EnergyModule />} />
            <Route path="/identity" element={<IdentityModule />} />
            <Route path="/industrial" element={<IndustrialModule />} />
          </Routes>

          {/* Floating Navigation (Mobile/MVP Style) */}
          <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#181c22]/80 backdrop-blur-2xl border border-[#00e5ff]/20 px-6 py-3 rounded-full flex gap-10 z-[100] shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
             <NavLink to="/" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-[#00e5ff] scale-110' : 'text-white/40'}`}>
                <MessageSquare size={18} />
                <span className="text-[8px] font-black uppercase tracking-widest">Nexus</span>
             </NavLink>
             <NavLink to="/map" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-[#00e5ff] scale-110' : 'text-white/40'}`}>
                <MapIcon size={18} />
                <span className="text-[8px] font-black uppercase tracking-widest">Mapa</span>
             </NavLink>
             <NavLink to="/fair" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-[#f4ce00] scale-125' : 'text-white/40'}`}>
                <div className="bg-[#f4ce00]/10 p-2 rounded-full border border-[#f4ce00]/20 -mt-8 shadow-lg">
                   <FairIcon size={24} fill="currentColor" className="text-[#f4ce00]" />
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest mt-1">Feria</span>
             </NavLink>
             <NavLink to="/bridge" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-[#00e5ff] scale-110' : 'text-white/40'}`}>
                <Globe size={18} />
                <span className="text-[8px] font-black uppercase tracking-widest">Global</span>
             </NavLink>
             <NavLink to="/arbitration" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-[#00e5ff] scale-110' : 'text-white/40'}`}>
                <Gavel size={18} />
                <span className="text-[8px] font-black uppercase tracking-widest">Corte</span>
             </NavLink>
             <NavLink to="/lending" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-[#00e5ff] scale-110' : 'text-white/40'}`}>
                <Coins size={16} />
                <span className="text-[7px] font-black uppercase tracking-widest">Lending</span>
             </NavLink>
             <NavLink to="/investor" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-[#f4ce00] scale-110' : 'text-white/40'}`}>
                <TrendingUp size={16} />
                <span className="text-[7px] font-black uppercase tracking-widest">Investor</span>
             </NavLink>
             <NavLink to="/energy" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-[#f4ce00] scale-110' : 'text-white/40'}`}>
                <Cpu size={16} />
                <span className="text-[7px] font-black uppercase tracking-widest">Energía</span>
             </NavLink>
             <NavLink to="/identity" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-[#00e5ff] scale-110' : 'text-white/40'}`}>
                <Fingerprint size={16} />
                <span className="text-[7px] font-black uppercase tracking-widest">DID</span>
             </NavLink>
             <NavLink to="/industrial" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-[#79ff5b] scale-110' : 'text-white/40'}`}>
                <Factory size={16} />
                <span className="text-[7px] font-black uppercase tracking-widest">Fab</span>
             </NavLink>
             <NavLink to="/delivery" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-[#00e5ff] scale-110' : 'text-white/40'}`}>
                <Truck size={16} />
                <span className="text-[7px] font-black uppercase tracking-widest">Logística</span>
             </NavLink>
             <NavLink to="/vault" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-[#00e5ff] scale-110' : 'text-white/40'}`}>
                <Shield size={16} />
                <span className="text-[7px] font-black uppercase tracking-widest">Vault</span>
             </NavLink>
             <NavLink to="/dashboard" className={({ isActive }) => `flex flex-col items-center gap-1 transition-all ${isActive ? 'text-[#00e5ff] scale-110' : 'text-white/40'}`}>
                <StoreIcon size={18} />
                <span className="text-[8px] font-black uppercase tracking-widest">Store</span>
             </NavLink>
          </nav>
        </div>
      </Router>
    </NotificationProvider>
  )
}

export default App
