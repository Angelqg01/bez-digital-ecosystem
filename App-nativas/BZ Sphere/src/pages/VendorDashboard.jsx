import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Settings, 
  Package, 
  BarChart3, 
  Zap, 
  Trash2, 
  Edit3, 
  Save,
  X,
  Maximize
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

const VendorDashboard = () => {
  const navigate = useNavigate()
  const [showAdd, setShowAdd] = useState(false)
  const [products, setProducts] = useState([
    { id: 1, name: 'Caja Naranjas (10kg)', price: 5.00, stock: 45 },
    { id: 2, name: 'Zumo Natural (1L)', price: 2.50, stock: 120 }
  ])

  const [newProduct, setNewProduct] = useState({ name: '', price: '', stock: '' })

  const handleAdd = () => {
    if (!newProduct.name || !newProduct.price) return
    setProducts([...products, { ...newProduct, id: Date.now(), price: parseFloat(newProduct.price), stock: parseInt(newProduct.stock) || 0 }])
    setNewProduct({ name: '', price: '', stock: '' })
    setShowAdd(false)
  }

  return (
    <div className="flex flex-col h-full bg-[#10141a] p-6 pt-24 pb-32 overflow-y-auto">
      
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-space font-extrabold text-3xl text-white">Panel Vendor</h1>
          <p className="text-white/40 text-sm uppercase tracking-widest font-bold">Gestión de Catálogo Km 0</p>
        </div>
        <button className="p-3 bg-white/5 rounded-2xl border border-white/10 text-white">
          <Settings size={20} />
        </button>
      </header>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button 
          onClick={() => setShowAdd(true)}
          className="glass-panel ghost-border rounded-3xl p-6 flex flex-col items-center gap-3 border-[#00e5ff]/20 hover:bg-[#00e5ff10] transition-all"
        >
          <div className="w-12 h-12 rounded-full bg-[#00e5ff] text-[#00363d] flex items-center justify-center">
            <Plus size={24} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Añadir Producto</span>
        </button>
        <button 
          onClick={() => navigate('/scanner')}
          className="glass-panel ghost-border rounded-3xl p-6 flex flex-col items-center gap-3 border-[#79ff5b]/20 hover:bg-[#79ff5b10] transition-all"
        >
          <div className="w-12 h-12 rounded-full bg-[#79ff5b] text-[#002700] flex items-center justify-center">
            <Maximize size={24} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Escanear Entrega</span>
        </button>
      </div>

      {/* Sales Stats Simulation */}
      <div className="glass-panel rounded-3xl p-6 mb-8 border-white/5">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-space font-bold text-sm uppercase text-white/60">Ventas de hoy</h3>
          <BarChart3 size={16} className="text-[#00e5ff]" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold font-space text-white">450,20</span>
          <span className="text-sm font-bold text-[#f4ce00]">$BEZ Vol.</span>
        </div>
      </div>

      {/* Inventory List */}
      <section>
        <h3 className="font-space font-bold text-lg text-white mb-6">Mi Inventario</h3>
        <div className="space-y-4">
          {products.map(product => (
            <div key={product.id} className="glass-panel rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#00e5ff]">
                  <Package size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{product.name}</h4>
                  <p className="text-[10px] text-white/40 uppercase font-bold tracking-tighter">Stock: {product.stock} unidades</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                 <div className="text-right mr-4">
                    <p className="text-sm font-bold text-white">{product.price} €</p>
                    <p className="text-[9px] text-[#f4ce00] font-black uppercase">PVP</p>
                 </div>
                 <button className="p-2 text-white/20 hover:text-white transition-colors">
                    <Edit3 size={16} />
                 </button>
                 <button 
                  onClick={() => setProducts(products.filter(p => p.id !== product.id))}
                  className="p-2 text-white/20 hover:text-red-400 transition-colors"
                 >
                    <Trash2 size={16} />
                 </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdd(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed bottom-0 left-0 right-0 bg-[#181c22] rounded-t-[40px] p-8 z-[201] border-t border-white/10"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-space font-extrabold text-2xl text-white">Nuevo Producto</h3>
                <button onClick={() => setShowAdd(false)} className="text-white/40 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase text-white/40 tracking-widest mb-2">Nombre del Producto</label>
                  <input 
                    type="text" 
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#00e5ff]/50 transition-all"
                    placeholder="Ej. Tomates de la Huerta"
                    value={newProduct.name}
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-white/40 tracking-widest mb-2">Precio (€)</label>
                    <input 
                      type="number" 
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#00e5ff]/50 transition-all"
                      placeholder="5.00"
                      value={newProduct.price}
                      onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-white/40 tracking-widest mb-2">Stock Inicial</label>
                    <input 
                      type="number" 
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#00e5ff]/50 transition-all"
                      placeholder="10"
                      value={newProduct.stock}
                      onChange={e => setNewProduct({...newProduct, stock: e.target.value})}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleAdd}
                  className="w-full bg-[#00e5ff] text-[#00363d] py-5 rounded-2xl font-extrabold text-xs uppercase shadow-[0_10px_20px_rgba(0,229,255,0.2)]"
                >
                  Publicar en el Nodo
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  )
}

export default VendorDashboard
