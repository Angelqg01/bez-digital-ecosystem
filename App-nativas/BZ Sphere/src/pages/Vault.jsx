import React from 'react'
import { motion } from 'framer-motion'
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  Plus, 
  Banknote,
  ShieldCheck,
  Zap,
  TrendingUp,
  CreditCard
} from 'lucide-react'

const Vault = () => {
  return (
    <div className="flex flex-col h-full bg-[#10141a] p-6 pt-24 pb-32 overflow-y-auto">
      
      {/* Header Info */}
      <header className="mb-8">
        <h1 className="font-space font-extrabold text-3xl text-white mb-2">Mi Bóveda</h1>
        <p className="text-white/40 text-sm uppercase tracking-widest font-bold">Gestión de Créditos Locales</p>
      </header>

      {/* Main Balance Card */}
      <div className="glass-panel ghost-border rounded-[32px] p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Wallet size={120} />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-[#f4ce00]" />
            <span className="text-[10px] font-black text-[#f4ce00] uppercase tracking-[0.2em]">Saldo Disponible</span>
          </div>
          
          <div className="flex items-baseline gap-3 mb-8">
            <h2 className="text-5xl font-extrabold font-space text-white">1.250,80</h2>
            <span className="text-lg font-bold text-white/60">€</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-2 bg-[#00e5ff] text-[#00363d] py-4 rounded-2xl font-extrabold text-xs uppercase shadow-[0_10px_20px_rgba(0,229,255,0.2)]">
              <Plus size={18} />
              Recargar
            </button>
            <button className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-extrabold text-xs uppercase hover:bg-white/10 transition-all">
              <Banknote size={18} />
              Retirar
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="glass-panel rounded-3xl p-5 flex flex-col gap-2">
          <TrendingUp size={20} className="text-[#79ff5b]" />
          <div>
            <p className="text-[9px] text-white/40 uppercase font-bold tracking-wider">Ahorro Mensual</p>
            <p className="text-lg font-bold text-white">+42,50 €</p>
          </div>
        </div>
        <div className="glass-panel rounded-3xl p-5 flex flex-col gap-2">
          <ShieldCheck size={20} className="text-[#00e5ff]" />
          <div>
            <p className="text-[9px] text-white/40 uppercase font-bold tracking-wider">Nivel de Confianza</p>
            <p className="text-lg font-bold text-white">Excelente</p>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-space font-bold text-lg text-white">Actividad Reciente</h3>
          <button className="text-[10px] font-black text-[#00e5ff] uppercase tracking-widest">Ver Todo</button>
        </div>

        <div className="space-y-4">
          <TransactionItem 
            title="Compra Naranjas Huerta" 
            sub="Maria_Ventas • ID: #8821" 
            amount="-5,00" 
            type="out"
          />
          <TransactionItem 
            title="Venta Pan Artesano" 
            sub="Nodo Cádiz Centro • ID: #8810" 
            amount="+12,40" 
            type="in"
          />
          <TransactionItem 
            title="Recarga Tarjeta Bancaria" 
            sub="Mastercard **** 4421" 
            amount="+100,00" 
            type="in"
            icon={<CreditCard size={18} />}
          />
          <TransactionItem 
            title="Pago Cuota Nodo" 
            sub="Mantenimiento de Red" 
            amount="-1,50" 
            type="out"
          />
        </div>
      </section>

      {/* Bottom Spacer */}
      <div className="h-10" />

    </div>
  )
}

const TransactionItem = ({ title, sub, amount, type, icon }) => (
  <div className="glass-panel rounded-2xl p-4 flex items-center justify-between border-l-4" style={{ borderColor: type === 'in' ? '#79ff5b' : '#ffb4ab' }}>
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${type === 'in' ? 'bg-[#79ff5b10] text-[#79ff5b]' : 'bg-[#ffb4ab10] text-[#ffb4ab]'}`}>
        {icon || (type === 'in' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />)}
      </div>
      <div>
        <h4 className="text-sm font-bold text-white">{title}</h4>
        <p className="text-[10px] text-white/40 font-medium">{sub}</p>
      </div>
    </div>
    <div className="text-right">
      <p className={`font-space font-extrabold text-base ${type === 'in' ? 'text-[#79ff5b]' : 'text-white'}`}>
        {amount} €
      </p>
      <span className="text-[8px] text-white/20 uppercase font-bold">Completado</span>
    </div>
  </div>
)

export default Vault
