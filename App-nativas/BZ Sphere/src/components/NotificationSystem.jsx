import React, { useState, useEffect, createContext, useContext } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bell, 
  Zap, 
  Info, 
  ShoppingBag, 
  AlertCircle, 
  X,
  MapPin
} from 'lucide-react'

const NotificationContext = createContext()

export const useNotifications = () => useContext(NotificationContext)

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([])

  const addNotification = (notif) => {
    const id = Date.now()
    setNotifications(prev => [{ ...notif, id }, ...prev])
    // Auto-remove after 6 seconds
    setTimeout(() => {
      removeNotification(id)
    }, 6000)
  }

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
      <NotificationOverlay />
    </NotificationContext.Provider>
  )
}

const NotificationOverlay = () => {
  const { notifications, removeNotification } = useNotifications()

  return (
    <div className="fixed top-20 right-6 left-6 z-[300] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="pointer-events-auto"
          >
            <div className="glass-panel ghost-border rounded-2xl p-4 flex items-start gap-4 bg-[#181c22]/90 backdrop-blur-xl border-[#00e5ff]/30 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${notif.type === 'offer' ? 'bg-[#f4ce0010] text-[#f4ce00]' : 'bg-[#00e5ff10] text-[#00e5ff]'}`}>
                {notif.type === 'offer' ? <Zap size={20} /> : <Info size={20} />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                   <h4 className="text-xs font-black uppercase tracking-widest text-white/90">{notif.title}</h4>
                   <button onClick={() => removeNotification(notif.id)} className="text-white/20 hover:text-white">
                     <X size={14} />
                   </button>
                </div>
                <p className="text-xs text-white/60 mt-1 leading-relaxed">{notif.message}</p>
                {notif.vendor && (
                  <div className="flex items-center gap-2 mt-2">
                    <MapPin size={10} className="text-[#00e5ff]" />
                    <span className="text-[9px] font-bold text-[#00e5ff] uppercase">{notif.vendor}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export const NotificationBell = () => {
  const { notifications } = useNotifications()
  return (
    <div className="relative">
      <Bell size={20} className="text-white/60 hover:text-white transition-colors cursor-pointer" />
      {notifications.length > 0 && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#f4ce00] rounded-full border-2 border-[#181c22] animate-pulse" />
      )}
    </div>
  )
}
