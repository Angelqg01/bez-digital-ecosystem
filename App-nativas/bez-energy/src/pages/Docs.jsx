import React from 'react'
import { motion } from 'framer-motion'
import { FileText, Download, ShieldCheck, Zap, Database, ArrowRight } from 'lucide-react'

const Docs = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 80 }}>
      
      {/* Hero Section */}
      <section className="card" style={{ padding: 40, background: 'linear-gradient(135deg, var(--bez-surface), rgba(0, 240, 255, 0.05))', border: '1px solid var(--bez-primary)' }}>
        <div style={{ maxWidth: 800 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>BeZhas Energy Infrastructure</h1>
          <p style={{ fontSize: 16, color: 'var(--bez-text-muted)', lineHeight: 1.6, marginBottom: 32 }}>
            La primera Virtual Power Plant (VPP) ciberfísica gobernada por Inteligencia Artificial y Smart Contracts. 
            Transformamos la energía en un Activo Real (RWA) tokenizado, eliminando intermediarios y maximizando la rentabilidad para los prosumidores.
          </p>
          
          <a 
            href="/BeZhas_Autonomous_Infrastructure_Energy.pdf" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: 16, textDecoration: 'none' }}
          >
            <Download size={20} />
            Descargar Whitepaper (PDF)
          </a>
        </div>
      </section>

      {/* Value Proposition */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        
        <ValueCard 
          icon={<Zap size={32} color="var(--bez-solar)" />}
          title="¿Qué es BeZhas Energy?"
          desc="Una plataforma que conecta tus plantas, baterías y cargas a una capa de monitorización, alertas y órdenes auditadas. Lee los precios reales del mercado diario (OMIE) y los datos de la red (REE); un agente propone cuándo cargar, descargar o vender y una persona lo autoriza. Los comandos se firman y sólo se dan por entregados cuando un equipo los recibe. No eres operador del sistema ni presentas ofertas en el mercado a través de BeZhas."
        />

        <ValueCard 
          icon={<Database size={32} color="var(--bez-secondary)" />}
          title="¿Qué Ganas como Usuario?"
          desc="Ves tu generación y tus precios en un único panel, recibes alertas calculadas con los precios publicados y puedes ordenar la batería y las cargas con aprobación humana. Las recompensas en token BEZ por flexibilidad y arbitraje dependen de contratos que todavía no constan como desplegados en su totalidad y no hay rentabilidad garantizada: confirma con BeZhas qué está activo antes de contar con ellas."
        />

        <ValueCard 
          icon={<ShieldCheck size={32} color="var(--bez-reputation)" />}
          title="Certificados RWA y CAEs"
          desc="Los certificados de ahorro energético (CAE) y los créditos de carbono son instrumentos regulados: los contratos están escritos y probados, pero no todos constan como desplegados. El valor de un certificado lo fija el mercado y la normativa aplicable, y no hay equivalencia fija entre un kWh y un BEZ. Consulta a tu asesor legal antes de emitirlos o venderlos."
        />

      </section>

      {/* Embedded Document Viewer Preview */}
      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 24, borderBottom: '1px solid var(--bez-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
            <FileText size={24} color="var(--bez-primary)" />
            Documento Técnico Oficial
          </h3>
          <a href="/BeZhas_Autonomous_Infrastructure_Energy.pdf" target="_blank" className="btn" style={{ fontSize: 12, padding: '6px 12px' }}>
            Abrir en pestaña nueva <ArrowRight size={14} style={{ marginLeft: 4 }} />
          </a>
        </div>
        <div style={{ height: 600, background: '#1a1b23' }}>
          <iframe 
            src="/BeZhas_Autonomous_Infrastructure_Energy.pdf#toolbar=0" 
            width="100%" 
            height="100%" 
            style={{ border: 'none' }}
            title="BeZhas Energy Whitepaper"
          />
        </div>
      </section>

    </div>
  )
}

const ValueCard = ({ icon, title, desc }) => (
  <motion.div 
    className="card"
    whileHover={{ y: -4, borderColor: 'var(--bez-primary-light)' }}
    style={{ transition: 'all 0.2s ease' }}
  >
    <div style={{ marginBottom: 20 }}>{icon}</div>
    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{title}</h3>
    <p style={{ fontSize: 14, color: 'var(--bez-text-muted)', lineHeight: 1.5 }}>{desc}</p>
  </motion.div>
)

export default Docs
