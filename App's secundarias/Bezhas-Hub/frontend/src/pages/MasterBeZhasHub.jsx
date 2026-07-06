import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, BookOpen, Zap, DollarSign, Settings, Users, Lock, TrendingUp, ArrowRight, ExternalLink } from 'lucide-react';
import Header from '../components/layout/Header';
import SidebarDrawer from '../components/SidebarDrawer';
import NodeNetworkBackground from '../components/landing/NodeNetworkBackground';
import { subappUrl } from '../config/subappUrls';

const C = {
  bg: '#05080F',
  panel: 'rgba(255,255,255,0.03)',
  panelHi: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.09)',
  cyan: '#00F0FF',
  emerald: '#10B981',
  gold: '#FFD700',
  text: '#E6EDF7',
  dim: '#93A1B5',
};

const mono = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };

function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}
      style={{ opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(24px)', transition: `opacity .6s ease ${delay}ms, transform .6s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

function GlassCard({ children, accent = C.cyan, className = '' }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`relative rounded-2xl p-6 backdrop-blur-sm transition-all duration-300 ${className}`}
      style={{
        background: hover ? C.panelHi : C.panel,
        border: `1px solid ${hover ? `${accent}66` : C.border}`,
        boxShadow: hover ? `0 0 28px ${accent}22` : 'none',
        transform: hover ? 'translateY(-4px)' : 'none',
      }}
    >
      <span className="absolute top-4 right-4 w-2 h-2 rounded-full transition-all"
        style={{ background: accent, boxShadow: hover ? `0 0 12px ${accent}` : 'none', opacity: hover ? 1 : 0.4 }} />
      {children}
    </div>
  );
}

function SectionHeading({ kicker, title, sub }) {
  return (
    <div className="max-w-3xl mb-10">
      {kicker && (
        <span className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: C.cyan }}>
          {kicker}
        </span>
      )}
      <h2 className="text-3xl md:text-[42px] font-extrabold leading-tight text-white tracking-tight mt-2">{title}</h2>
      {sub && <p className="mt-4 text-lg leading-relaxed" style={{ color: C.dim }}>{sub}</p>}
    </div>
  );
}

const ROLES = [
  { name: 'Propietario', icon: Users, desc: 'Control total: crea sedes, asigna roles, ve toda la información' },
  { name: 'Admin Organización', icon: Settings, desc: 'Gestiona usuarios, claves API y configuraciones' },
  { name: 'Gestor de Sede', icon: DollarSign, desc: 'Opera dentro de su sede: pedidos, pagos, envíos' },
  { name: 'Operador', icon: Zap, desc: 'Ejecuta tareas del día a día' },
  { name: 'Auditor', icon: Lock, desc: 'Solo lectura: revisa datos sin modificar' },
];

const SERVICES = [
  { name: 'Pagos y Tesorería', desc: 'Liquidación instantánea SEPA, custodia automatizada, tesorería real-time', link: '/capital', external: true },
  { name: 'Logística y Aduanas', desc: 'CargoLink, documentación aduanera, gestión de flotas, trazabilidad inmutable', link: 'cargolink', external: true },
  { name: 'Energía y Sostenibilidad', desc: 'Virtual Power Plant, mercado OMIE, certificados energéticos', link: 'energy', external: true },
  { name: 'Compliance y Auditoría', desc: 'Verificación de socios, cumplimiento regulatorio, registro inmutable', link: 'purescan', external: true },
  { name: 'Inteligencia Artificial', desc: 'Asistente de negocio, análisis predictivo, automatización de procesos', link: '/oracle', external: false },
  { name: 'Identidad y Gobernanza', desc: 'BeZhas_ID, DAO, club B2B Prestige', link: 'wallet', external: true },
];

const PLANS = [
  { name: 'Starter', price: '€0/mes', for: 'Autónomos / Startups', features: ['Acceso básico', '150 acciones IA/mes', 'Wallet corporativa'] },
  { name: 'Creator Pro', price: '€99/mes', for: 'Pymes', features: ['1.500 acciones IA', 'Custodia automatizada', 'Soporte prioritario'] },
  { name: 'Business', price: '€499/mes', for: 'Empresas en crecimiento', features: ['15.000 acciones IA', 'Integraciones SAP/Odoo', 'Soporte 24/7'] },
  { name: 'Enterprise VIP', price: '€2.499/mes', for: 'Holdings / Instituciones', featured: true, features: ['IA ilimitada', 'Marca blanca', 'Gestión de 50 sub-empresas', '20% comisiones de red'] },
];

export default function MasterBeZhasHub() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const openService = (link, external) => {
    if (external) window.open(subappUrl(link), '_blank', 'noopener,noreferrer');
    else navigate(link);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.bg, color: C.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');`}</style>
      <SidebarDrawer open={sidebarOpen} setOpen={setSidebarOpen} />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />
        <main className="relative flex-1 overflow-y-auto overflow-x-hidden">

          {/* HERO */}
          <section className="relative overflow-hidden">
            <div className="absolute inset-0 z-0"><NodeNetworkBackground /></div>
            <div className="absolute inset-0 z-0 pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 50% 0%, ${C.cyan}14, transparent 60%), linear-gradient(to bottom, transparent 60%, ${C.bg})` }} />
            <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-10 pt-20 pb-28 text-center">
              <div className="flex justify-center mb-6">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ color: C.cyan, background: `${C.cyan}14`, border: `1px solid ${C.cyan}40` }}>
                  <BookOpen size={14} />Guía educativa
                </span>
              </div>
              <h1 className="text-4xl md:text-6xl lg:text-[68px] font-extrabold leading-[1.05] tracking-tight text-white">
                Cómo dominar<br className="hidden md:block" />
                <span style={{ color: C.cyan }}> BeZhas Hub</span>
              </h1>
              <p className="mt-6 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: C.dim }}>
                Aprende a usar la plataforma, configurar tu organización, gestionar múltiples sedes y generar rentabilidades extras en el ecosistema BeZhas.
              </p>
            </div>
          </section>

          {/* 1. ESTRUCTURA JERÁRQUICA */}
          <section className="relative py-20 md:py-24">
            <div className="max-w-6xl mx-auto px-6 lg:px-10">
              <Reveal>
                <SectionHeading kicker="Paso 1" title="Entiende la estructura de control"
                  sub="BeZhas organiza tu empresa en una jerarquía clara: holding → empresas → sedes → departamentos. Cada nivel tiene permisos específicos." />
              </Reveal>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center mt-12">
                <Reveal>
                  <div className="space-y-4">
                    {['Holding / Institución', 'Empresas (A, B, C, ...)', 'Sedes y Departamentos', 'Usuarios y Roles'].map((item, i) => (
                      <div key={item} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: `${C.cyan}14`, color: C.cyan, ...mono, fontSize: '12px', fontWeight: 'bold' }}>
                          {i + 1}
                        </div>
                        <span className="text-lg font-semibold text-white">{item}</span>
                      </div>
                    ))}
                  </div>
                </Reveal>
                <Reveal delay={100}>
                  <GlassCard accent={C.emerald}>
                    <h3 className="text-xl font-bold text-white mb-4">Beneficio: Control granular</h3>
                    <p style={{ color: C.dim }} className="text-sm leading-relaxed">
                      El CEO del holding ve todo. El director de cada filial solo ve su operación. Así scaling se vuelve posible sin perder control.
                    </p>
                  </GlassCard>
                </Reveal>
              </div>
            </div>
          </section>

          {/* 2. ROLES Y PERMISOS */}
          <section className="relative py-20 md:py-24" style={{ background: 'rgba(255,255,255,0.015)' }}>
            <div className="max-w-6xl mx-auto px-6 lg:px-10">
              <Reveal>
                <SectionHeading kicker="Paso 2" title="Asigna roles según responsabilidades"
                  sub="5 niveles de acceso pre-definidos: desde control total (Propietario) hasta lectura (Auditor)." />
              </Reveal>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-12">
                {ROLES.map((role, i) => (
                  <Reveal key={role.name} delay={i * 50}>
                    <GlassCard accent={C.gold} className="h-full">
                      <div className="w-10 h-10 rounded-xl grid place-items-center mb-3" style={{ background: `${C.gold}14`, color: C.gold }}>
                        <role.icon size={20} />
                      </div>
                      <h3 className="font-bold text-white mb-2">{role.name}</h3>
                      <p className="text-xs leading-relaxed" style={{ color: C.dim }}>{role.desc}</p>
                    </GlassCard>
                  </Reveal>
                ))}
              </div>
              <Reveal delay={300}>
                <div className="mt-10 rounded-xl px-6 py-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                  <p className="text-sm" style={{ color: C.dim }}>
                    💡 <strong style={{ color: C.text }}>Pro tip:</strong> Crea roles por departamento (Logística, Finanzas, Compliance) para maximizar productividad sin comprometer seguridad.
                  </p>
                </div>
              </Reveal>
            </div>
          </section>

          {/* 3. SERVICIOS DISPONIBLES */}
          <section className="relative py-20 md:py-24">
            <div className="max-w-6xl mx-auto px-6 lg:px-10">
              <Reveal>
                <SectionHeading kicker="Paso 3" title="Activa servicios según tus necesidades"
                  sub="6 bloques de servicios listos para usar. Cada uno es independiente pero se integran perfectamente." />
              </Reveal>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
                {SERVICES.map((svc, i) => (
                  <Reveal key={svc.name} delay={i * 60}>
                    <button onClick={() => openService(svc.link, svc.external)} className="text-left w-full">
                      <GlassCard className="h-full">
                        <h3 className="font-bold text-white mb-2">{svc.name}</h3>
                        <p className="text-sm leading-relaxed mb-4" style={{ color: C.dim }}>{svc.desc}</p>
                        <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.cyan }}>
                          Acceder <ChevronRight size={12} />
                        </div>
                      </GlassCard>
                    </button>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* 4. VALIDACIÓN TRIPLE */}
          <section className="relative py-20 md:py-24" style={{ background: 'rgba(255,255,255,0.015)' }}>
            <div className="max-w-6xl mx-auto px-6 lg:px-10">
              <Reveal>
                <SectionHeading kicker="Paso 4" title="Entiende el sistema de validación"
                  sub="Toda operación (pago, envío, contrato) pasa por 3 etapas de verificación automática antes de ejecutarse." />
              </Reveal>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                {[
                  { n: '01', title: 'Solicitud', desc: 'Tu empresa ejecuta una operación (pago, envío, contrato)' },
                  { n: '02', title: 'Verificación', desc: 'Sistema valida identidad, permisos, saldos y reglas de negocio' },
                  { n: '03', title: 'Confirmación', desc: 'Queda registrado de forma permanente e inmutable con firma digital' },
                ].map((step, i) => (
                  <Reveal key={step.n} delay={i * 80}>
                    <GlassCard accent={C.emerald} className="relative">
                      <span className="absolute -top-3 -right-2 text-6xl font-extrabold select-none" style={{ ...mono, color: `${C.emerald}0f` }}>{step.n}</span>
                      <div className="relative">
                        <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                        <p className="text-sm leading-relaxed" style={{ color: C.dim }}>{step.desc}</p>
                      </div>
                    </GlassCard>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* 5. CONFIGURACIÓN INICIAL */}
          <section className="relative py-20 md:py-24">
            <div className="max-w-6xl mx-auto px-6 lg:px-10">
              <Reveal>
                <SectionHeading kicker="Paso 5" title="Configura tu organización en 5 minutos"
                  sub="Desde el registro hasta la primera operación: un flujo guiado que cualquiera puede seguir." />
              </Reveal>
              <div className="max-w-3xl space-y-4">
                {[
                  { n: 1, desc: 'Registra tu organización (nombre, país, sector)' },
                  { n: 2, desc: 'Crea tus sedes y departamentos' },
                  { n: 3, desc: 'Invita a usuarios y asigna roles' },
                  { n: 4, desc: 'Genera una clave API por cada sistema que quieras conectar' },
                  { n: 5, desc: 'Activa los servicios que necesites (pagos, logística, energía, etc.)' },
                ].map((item, i) => (
                  <Reveal key={item.n} delay={i * 50}>
                    <div className="flex gap-4 items-start rounded-xl px-5 py-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                      <div className="w-8 h-8 rounded-lg grid place-items-center shrink-0 font-bold" style={{ background: `${C.cyan}14`, color: C.cyan, ...mono }}>
                        {item.n}
                      </div>
                      <p className="text-sm text-white">{item.desc}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* 6. PLANES Y RENTABILIDAD */}
          <section className="relative py-20 md:py-24" style={{ background: 'rgba(255,255,255,0.015)' }}>
            <div className="max-w-6xl mx-auto px-6 lg:px-10">
              <Reveal>
                <SectionHeading kicker="Paso 6" title="Elige tu plan y genera ingresos"
                  sub="4 planes predefinidos. Cada uno es una puerta a diferentes niveles de rentabilidad en el ecosistema." />
              </Reveal>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-12">
                {PLANS.map((p, i) => (
                  <Reveal key={p.name} delay={i * 100}>
                    <GlassCard accent={p.featured ? C.gold : C.cyan} className="h-full"
                      style={p.featured ? { boxShadow: `0 0 30px ${C.gold}22`, border: `1px solid ${C.gold}55` } : {}}>
                      {p.featured && (
                        <span className="absolute top-4 right-4 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ ...mono, background: `${C.gold}22`, color: C.gold }}>
                          RECOMENDADO
                        </span>
                      )}
                      <div className="flex items-end justify-between mb-4">
                        <div>
                          <h3 className="text-2xl font-bold text-white">{p.name}</h3>
                          <p className="text-xs" style={{ color: C.dim }}>{p.for}</p>
                        </div>
                        <div style={{ color: C.gold, ...mono }} className="text-xl font-bold">{p.price}</div>
                      </div>
                      <div className="space-y-2">
                        {p.features.map((f) => (
                          <div key={f} className="flex items-start gap-2 text-sm text-white">
                            <ChevronRight size={14} style={{ color: p.featured ? C.gold : C.cyan }} className="mt-0.5 shrink-0" />
                            {f}
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  </Reveal>
                ))}
              </div>
              <Reveal delay={500}>
                <div className="mt-8 rounded-xl px-6 py-4" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                  <p className="text-sm" style={{ color: C.dim }}>
                    💰 <strong style={{ color: C.text }}>Rentabilidades extras:</strong> El plan Enterprise VIP incluye participación del 20% en comisiones de la red. Cuantas más operaciones generes en el ecosistema, más ingresos pasivos recibes.
                  </p>
                </div>
              </Reveal>
            </div>
          </section>

          {/* 7. INTEGRACIONES */}
          <section className="relative py-20 md:py-24">
            <div className="max-w-6xl mx-auto px-6 lg:px-10">
              <Reveal>
                <SectionHeading kicker="Paso 7" title="Conecta tus sistemas actuales"
                  sub="No necesitas migrar. BeZhas se integra con ERP, CRM, WooCommerce, SAP, Odoo y cualquier API REST." />
              </Reveal>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
                <Reveal>
                  <GlassCard accent={C.cyan}>
                    <h3 className="text-lg font-bold text-white mb-4">Integraciones pre-construidas</h3>
                    <ul className="space-y-3">
                      {['SAP / Odoo / Salesforce', 'WooCommerce / WordPress', 'Cualquier API REST', 'SDK Node.js y navegador'].map((int) => (
                        <li key={int} className="flex items-center gap-2 text-sm text-white">
                          <ArrowRight size={14} style={{ color: C.cyan }} />
                          {int}
                        </li>
                      ))}
                    </ul>
                  </GlassCard>
                </Reveal>
                <Reveal delay={100}>
                  <GlassCard accent={C.emerald}>
                    <h3 className="text-lg font-bold text-white mb-4">Flujo de integración</h3>
                    <ol className="space-y-3 text-sm" style={{ color: C.dim }}>
                      <li><strong className="text-white">1.</strong> Genera clave API en Developer Console</li>
                      <li><strong className="text-white">2.</strong> Configura tu ERP/CRM con el endpoint</li>
                      <li><strong className="text-white">3.</strong> Los datos sincronizamos en tiempo real</li>
                      <li><strong className="text-white">4.</strong> Todas las operaciones quedan validadas y auditables</li>
                    </ol>
                  </GlassCard>
                </Reveal>
              </div>
            </div>
          </section>

          {/* 8. SEGURIDAD Y COMPLIANCE */}
          <section className="relative py-20 md:py-24" style={{ background: 'rgba(255,255,255,0.015)' }}>
            <div className="max-w-6xl mx-auto px-6 lg:px-10">
              <Reveal>
                <SectionHeading kicker="Paso 8" title="Cumplimiento regulatorio automático"
                  sub="MiCA, AEAT, DAC8, SEPA. Todos los requerimientos legales están incorporados en la plataforma." />
              </Reveal>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
                {[
                  { icon: Lock, label: 'Datos cifrados', desc: 'En tránsito y en reposo' },
                  { icon: Users, label: 'Control de accesos', desc: 'Cada usuario ve solo lo suyo' },
                  { icon: TrendingUp, label: 'Auditoría inmutable', desc: 'Historial completo exportable' },
                  { icon: Settings, label: 'Regulatorio', desc: 'MiCA, AEAT, DAC8, SEPA' },
                ].map((item, i) => (
                  <Reveal key={item.label} delay={i * 60}>
                    <GlassCard interactive className="text-center">
                      <div className="mx-auto w-10 h-10 rounded-lg grid place-items-center mb-3" style={{ background: `${C.emerald}12`, color: C.emerald }}>
                        <item.icon size={20} />
                      </div>
                      <h4 className="font-bold text-white text-sm mb-1">{item.label}</h4>
                      <p className="text-xs" style={{ color: C.dim }}>{item.desc}</p>
                    </GlassCard>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* CTA FINAL */}
          <section className="relative py-20 md:py-28">
            <div className="max-w-4xl mx-auto px-6 text-center">
              <Reveal>
                <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6">
                  ¿Listo para transformar tu organización?
                </h2>
                <p className="text-lg mb-8" style={{ color: C.dim }}>
                  Empieza hoy con el plan Starter (gratis) o solicita una demo del plan Enterprise para tu holding.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <button onClick={() => navigate('/be-vip')} className="px-8 h-12 rounded-xl font-bold text-sm transition-transform hover:scale-[1.03]"
                    style={{ background: C.cyan, color: '#00252b', boxShadow: `0 0 24px ${C.cyan}55` }}>
                    Ver planes y precios
                  </button>
                  <button onClick={() => navigate('/developer-console')} className="px-8 h-12 rounded-xl font-semibold text-sm"
                    style={{ color: C.cyan, border: `1px solid ${C.cyan}66` }}>
                    Developer Console <ExternalLink size={14} className="ml-2 inline" />
                  </button>
                </div>
              </Reveal>
            </div>
          </section>

          {/* REFERENCIAS */}
          <section className="relative py-16" style={{ background: 'rgba(255,255,255,0.015)', borderTop: `1px solid ${C.border}` }}>
            <div className="max-w-6xl mx-auto px-6 lg:px-10">
              <Reveal>
                <h3 className="text-sm font-semibold uppercase tracking-wider mb-8" style={{ color: C.cyan }}>
                  📚 Referencias del documento
                </h3>
              </Reveal>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Estructura Comercial API', link: '#estructura' },
                  { label: 'Niveles de Acceso', link: '#roles' },
                  { label: 'Servicios Disponibles', link: '#servicios' },
                  { label: 'Planes de Suscripción', link: '#planes' },
                  { label: 'Validación Triple', link: '#validacion' },
                  { label: 'Seguridad y Compliance', link: '#seguridad' },
                ].map((ref) => (
                  <Reveal key={ref.label} delay={50}>
                    <a href={ref.link} className="text-xs px-3 py-2 rounded-lg transition-colors"
                      style={{ background: C.panel, border: `1px solid ${C.border}`, color: C.cyan }}>
                      {ref.label} ↗
                    </a>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t" style={{ borderColor: C.border, background: '#03060C' }}>
            <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs" style={{ color: C.dim }}>
              <div>© 2026 BeZhas · La infraestructura que convierte la confianza en rentabilidad</div>
              <div className="flex gap-6">
                <a href="/" className="hover:text-white">Inicio</a>
                <a href="/be-vip" className="hover:text-white">Planes</a>
                <a href="/developer-console" className="hover:text-white">Developers</a>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
