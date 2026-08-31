import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Send, 
  PlusCircle, 
  DollarSign, 
  User, 
  Search,
  MoreVertical,
  Zap,
  ChevronRight,
  Bell,
  Radio,
  Maximize
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import InChatTransactionWidget from '../components/InChatTransactionWidget'
import { NotificationBell, useNotifications } from '../components/NotificationSystem'
import { bzEncryption } from '../utils/EncryptionEngine'
import { 
  ShieldAlert, 
  Lock, 
  EyeOff, 
  History,
  ShieldCheck as ShieldIcon 
} from 'lucide-react'

const Chat = () => {
  const navigate = useNavigate()
  const { addNotification } = useNotifications()
  const [messages, setMessages] = useState([
    { id: 1, user: 'Maria_Ventas', text: 'Hola a todos, acabo de recibir una caja de naranjas frescas de la huerta.', time: '10:02', isEncrypted: true },
    { id: 2, user: 'Cafe_Centro', text: '¡Hola Maria! Me he quedado sin naranjas para el zumo de la tarde. ¿Alguien tiene?', time: '10:05', tag: '[Buscando Producto]', isEncrypted: true },
    { id: 3, user: 'Maria_Ventas', text: 'Tengo 10kg disponibles a 5 BEZ.', time: '10:06', isOffer: true, product: 'Naranjas Huerta (10kg)', price: 5, isEncrypted: true }
  ])
  const [input, setInput] = useState('')
  const [handshakeDone, setHandshakeDone] = useState(false)
  const [privacyMode, setPrivacyMode] = useState('E2EE') // E2EE, Vanishing

  const broadcastOffer = () => {
    addNotification({
      type: 'offer',
      title: '¡Nueva Oferta Local!',
      message: 'Huerta de Maria ha publicado Naranjas frescas. ¡Corre que vuelan!',
      vendor: 'Huerta de Maria'
    })
  }

  const handleSend = async () => {
    if (!input.trim()) return
    
    // Process through encryption engine
    const encryptedText = await bzEncryption.encrypt(input)
    console.log(`[P2P] Relaying blob: ${encryptedText}`)

    const newMessage = { 
      id: Date.now(), 
      user: 'Tu', 
      text: input, // In real app, only encrypted is sent
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isEncrypted: true,
      vanishing: privacyMode === 'Vanishing'
    }

    setMessages([...messages, newMessage])
    setInput('')

    if (privacyMode === 'Vanishing') {
      setTimeout(() => {
        setMessages(prev => prev.filter(m => m.id !== newMessage.id))
        addNotification({
          type: 'info',
          title: 'Privacidad Absoluta',
          message: 'Un mensaje se ha auto-destruido del Nodo.',
          vendor: 'Sistema BeZhas'
        })
      }, 10000)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#10141a]">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#181c22]/60 backdrop-blur-xl border-b border-[#00e5ff]/15 flex justify-between items-center px-6 h-16 max-w-[800px]">
        <Link to="/vendor/maria" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-[#262a31] flex items-center justify-center border border-[#00e5ff]/20 overflow-hidden">
            <img src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=200&auto=format&fit=crop" alt="Maria" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-[#00e5ff] glow-text font-space tracking-tight">Huerta de Maria</span>
              <ChevronRight size={14} className="text-[#00e5ff]/40" />
            </div>
            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Nodo Cádiz Centro</span>
          </div>
        </Link>
        <div className="flex items-center gap-5">
          <div 
            onClick={() => setPrivacyMode(privacyMode === 'E2EE' ? 'Vanishing' : 'E2EE')}
            className={`flex items-center gap-2 px-3 py-1 rounded-full border cursor-pointer transition-all ${privacyMode === 'Vanishing' ? 'bg-red-500/10 border-red-500/40 text-red-400' : 'bg-[#79ff5b10] border-[#79ff5b]/20 text-[#79ff5b]'}`}
          >
            {privacyMode === 'Vanishing' ? <EyeOff size={14} /> : <Lock size={14} />}
            <span className="text-[9px] font-black uppercase tracking-tighter">{privacyMode} Mode</span>
          </div>
          <NotificationBell />
          <div className="bg-[#181c22] px-4 py-1.5 rounded-full border border-[#00e5ff]/10 flex items-center gap-2">
            <Zap size={14} className="text-[#f4ce00]" />
            <span className="text-sm font-bold text-white font-space">1,250 Créditos</span>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 pt-24 pb-32 px-6 overflow-y-auto space-y-6">
        <div className="flex justify-center mb-8">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">Hoy, 5 de Mayo</span>
        </div>

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.user === 'Tu' ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className={`text-[10px] font-bold ${msg.user === 'Tu' ? 'text-white/60' : 'text-[#c3f5ff]'}`}>{msg.user}</span>
              <span className="text-[9px] text-white/30">{msg.time}</span>
            </div>
            
            <div className={`message-bubble ${msg.user === 'Tu' ? 'bg-[#00e5ff10] border-r-2 border-[#00e5ff] rounded-tr-none' : 'bg-[#262a31] border-l-2 border-[#00e5ff]/40 rounded-tl-none'}`}>
              <div className="absolute -top-2 -right-2 p-1 bg-[#10141a] border border-white/10 rounded-full text-[#79ff5b]">
                 <ShieldIcon size={10} />
              </div>
              
              {msg.vanishing && (
                <div className="flex items-center gap-1 text-[8px] font-bold text-red-400 uppercase mb-1">
                   <History size={10} /> Mensaje Efímero
                </div>
              )}
              <p className="text-sm leading-relaxed">{msg.text}</p>
              
              {msg.isOffer && (
                <InChatTransactionWidget 
                  product={msg.product} 
                  price={msg.price} 
                  seller={msg.user} 
                />
              )}
            </div>
          </div>
        ))}
      </main>

      {/* Input Area */}
      <div className="chat-input-area">
        <div className="glass-panel ghost-border rounded-full flex items-center px-4 py-2 gap-3 focus-within:border-[#00e5ff]/50 transition-all">
          <button className="p-2 text-white/40 hover:text-[#00e5ff] transition-colors">
            <PlusCircle size={20} />
          </button>
          <input 
            type="text" 
            placeholder="Escribe un mensaje o /comando..." 
            className="flex-grow bg-transparent border-none focus:ring-0 text-sm placeholder:text-white/20 py-2 outline-none text-white"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />
          <div className="flex items-center gap-2">
            <button className="p-2 text-white/40 hover:text-[#f4ce00] transition-colors">
              <DollarSign size={20} />
            </button>
            <button 
              className="w-10 h-10 rounded-full bg-[#00e5ff] text-[#00363d] flex items-center justify-center shadow-lg hover:brightness-110 active:scale-90 transition-all"
              onClick={handleSend}
            >
              <Send size={18} fill="currentColor" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Chat
