/**
 * InstitutionalLanding — Home (/) institucional de BeZhas.
 *
 * Contenido íntegro de la "Presentación Institucional" (inversores, holdings y
 * grandes corporaciones), con tema visual de CONEXIÓN DE NODOS (fondo de red
 * animada + tarjetas interactivas). Hereda el Header original del resto de la
 * app; sin menú feed móvil.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Activity, Zap, GitBranch, Layers, Cpu, Network, Boxes,
  AlertTriangle, Clock, FileWarning, Repeat, Eye, Coins, Building2,
  Landmark, Ship, Bolt, ScanLine, BadgeCheck, Briefcase, TrendingUp,
  Server, Globe2, Lock, Workflow, LineChart, Wallet, ArrowRight, CheckCircle2,
  Users, Gauge, PiggyBank, Crown, Rocket, Target,
} from 'lucide-react';
import Header from '../components/layout/Header';
import SidebarDrawer from '../components/SidebarDrawer';
import NodeNetworkBackground from '../components/landing/NodeNetworkBackground';
import { nativeAppUrl } from '../config/nativeAppUrls';

// ── Tokens de diseño ──────────────────────────────────────────────────────────
const C = {
  bg: '#0A0B10',
  graphite: '#15161C',
  panel: 'rgba(255,255,255,0.03)',
  panelHi: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.09)',
  cyan: '#00E5FF',
  cyanDeep: '#00B4D8',
  glow: '#00F5D4',
  emerald: '#10B981',
  gold: '#D4AF37',
  purple: '#7209B7',
  magenta: '#D90429',
  text: '#F2F6FF',
  dim: '#98A4BC',
  danger: '#F87171',
};

// Degradados de marca
const G = {
  cyanPurple: `linear-gradient(135deg, ${C.cyan}, ${C.purple})`,
  purpleMagenta: `linear-gradient(135deg, ${C.purple}, ${C.magenta})`,
  goldCyan: `linear-gradient(135deg, ${C.gold}, ${C.cyan})`,
};

// ── Reveal on scroll ──────────────────────────────────────────────────────────
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

// ── Count-up al entrar en viewport ───────────────────────────────────────────
function CountUp({ to, suffix = '', prefix = '', duration = 1400 }) {
  const ref = useRef(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(eased * to));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, duration]);
  return <span ref={ref}>{prefix}{val}{suffix}</span>;
}

// ── Primitivos ────────────────────────────────────────────────────────────────
const chip = (label, tone = C.cyan) => (
  <span key={label} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
    style={{ color: tone, background: `${tone}14`, border: `1px solid ${tone}40` }}>
    <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone, boxShadow: `0 0 8px ${tone}` }} />
    {label}
  </span>
);

// ── Malla de gradientes suaves en movimiento (mesh gradient background) ────────
function MeshBackground({ className = '' }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <div className="bez-anim absolute -top-1/4 -left-1/4 w-[60vw] h-[60vw] rounded-full"
        style={{ background: `radial-gradient(circle, ${C.cyan}22, transparent 65%)`, filter: 'blur(60px)', animation: 'bezMesh1 22s ease-in-out infinite' }} />
      <div className="bez-anim absolute top-1/3 right-0 w-[55vw] h-[55vw] rounded-full"
        style={{ background: `radial-gradient(circle, ${C.purple}26, transparent 65%)`, filter: 'blur(70px)', animation: 'bezMesh2 28s ease-in-out infinite' }} />
      <div className="bez-anim absolute bottom-0 left-1/4 w-[50vw] h-[50vw] rounded-full"
        style={{ background: `radial-gradient(circle, ${C.glow}1c, transparent 65%)`, filter: 'blur(64px)', animation: 'bezMesh3 25s ease-in-out infinite' }} />
    </div>
  );
}

// ── Botón con efecto magnético hacia el cursor ────────────────────────────────
function MagneticButton({ children, onClick, variant = 'primary', className = '', style = {} }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.3;
    const y = (e.clientY - r.top - r.height / 2) * 0.4;
    el.style.transform = `translate(${x}px, ${y}px)`;
  };
  const reset = () => { if (ref.current) ref.current.style.transform = 'translate(0,0)'; };
  const primary = variant === 'primary';
  return (
    <button
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      onClick={onClick}
      className={`relative px-8 h-14 rounded-2xl font-bold text-sm transition-[transform,box-shadow] duration-200 will-change-transform ${className}`}
      style={{
        background: primary ? G.cyanPurple : 'rgba(255,255,255,0.04)',
        color: primary ? '#06121A' : C.text,
        border: primary ? 'none' : `1px solid ${C.cyan}55`,
        boxShadow: primary ? `0 10px 40px -8px ${C.cyan}66` : 'none',
        backdropFilter: primary ? 'none' : 'blur(10px)',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── Marquee infinito (sectores / partners) ────────────────────────────────────
function Marquee({ items, speed = 32 }) {
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden py-3"
      style={{ maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
      <div className="bez-anim flex w-max gap-4" style={{ animation: `bezMarquee ${speed}s linear infinite` }}>
        {row.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm whitespace-nowrap"
            style={{ color: C.dim, background: C.panel, border: `1px solid ${C.border}` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.cyan, boxShadow: `0 0 8px ${C.cyan}` }} />
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Token BEZ 3D flotante (moneda con giro + glow) ────────────────────────────
function FloatingToken({ size = 132 }) {
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size, perspective: '600px' }} aria-hidden>
      <div className="absolute inset-0 rounded-full bez-anim"
        style={{ background: `radial-gradient(circle, ${C.cyan}55, transparent 70%)`, filter: 'blur(22px)', animation: 'bezPulseGlow 4s ease-in-out infinite' }} />
      <div className="bez-anim relative" style={{ width: size, height: size, animation: 'bezFloat 6s ease-in-out infinite' }}>
        <div className="bez-anim absolute inset-0 rounded-full grid place-items-center"
          style={{
            background: G.cyanPurple,
            boxShadow: `inset 0 0 40px ${C.glow}66, 0 14px 50px -10px ${C.purple}aa`,
            border: `2px solid ${C.glow}88`,
            transformStyle: 'preserve-3d',
            animation: 'bezSpin 9s linear infinite',
          }}>
          <span className="text-4xl font-black" style={{ color: '#fff', textShadow: `0 0 18px ${C.glow}` }}>B</span>
        </div>
      </div>
    </div>
  );
}

/**
 * GlassCard — tarjeta con interacción estilo AVAX.network:
 *  · spotlight radial que SIGUE al cursor dentro de la tarjeta
 *  · borde degradado que se ilumina justo donde está el ratón (mask-composite)
 *  · lift suave + sombra proyectada al hover
 * El seguimiento del cursor se hace vía CSS vars (--mx/--my) sin re-render.
 */
function GlassCard({ children, accent = C.cyan, className = '', interactive = true, style = {} }) {
  const [hover, setHover] = useState(false);
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!interactive || !el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  return (
    <div
      ref={ref}
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      onMouseMove={onMove}
      className={`relative rounded-[28px] p-6 backdrop-blur-md overflow-hidden transition-[transform,box-shadow,background,border-color] duration-300 ease-out ${className}`}
      style={{
        background: hover ? C.panelHi : C.panel,
        borderColor: hover ? `${accent}66` : C.border,
        borderWidth: 1, borderStyle: 'solid',
        boxShadow: hover ? `0 18px 50px -10px ${accent}33, inset 0 0 0 1px ${accent}10` : '0 2px 12px -6px rgba(0,0,0,0.5)',
        transform: hover ? 'translateY(-6px) scale(1.015)' : 'none',
        '--mx': '50%', '--my': '50%',
        ...style,
      }}
    >
      {/* textura de ruido sutil */}
      <span aria-hidden className="bez-noise pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-overlay" />
      {/* spotlight radial que sigue el cursor (estilo AVAX) */}
      <span aria-hidden className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{ opacity: hover ? 1 : 0, background: `radial-gradient(360px circle at var(--mx) var(--my), ${accent}20, transparent 60%)` }} />
      {/* borde degradado que se ilumina bajo el cursor */}
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[28px] transition-opacity duration-300"
        style={{
          opacity: hover ? 1 : 0, padding: 1,
          background: `radial-gradient(200px circle at var(--mx) var(--my), ${accent}99, transparent 65%)`,
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor', maskComposite: 'exclude',
        }} />
      {/* nodo decorativo de la tarjeta */}
      <span className="absolute top-4 right-4 w-2 h-2 rounded-full transition-all z-10"
        style={{ background: accent, boxShadow: hover ? `0 0 12px ${accent}` : 'none', opacity: hover ? 1 : 0.4 }} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function SectionHeading({ kicker, title, sub, num }) {
  return (
    <div className="max-w-3xl mb-10">
      {kicker && (
        <div className="flex items-center gap-3 mb-3">
          {num != null && (
            <span className="grid place-items-center w-8 h-8 rounded-lg text-xs font-bold"
              style={{ ...mono, color: C.cyan, background: `${C.cyan}12`, border: `1px solid ${C.cyan}33` }}>{num}</span>
          )}
          <span className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: C.cyan }}>{kicker}</span>
        </div>
      )}
      <h2 className="text-3xl md:text-[42px] font-extrabold leading-tight text-white tracking-tight">{title}</h2>
      {sub && <p className="mt-4 text-lg leading-relaxed" style={{ color: C.dim }}>{sub}</p>}
    </div>
  );
}

const mono = { fontFamily: "'JetBrains Mono', ui-monospace, monospace" };

// ── Datos derivados del PDF ───────────────────────────────────────────────────
const PROBLEMS = [
  { icon: Repeat, title: 'Ineficiencias Operativas', items: ['Validaciones manuales', 'Conciliaciones financieras', 'Gestión documental', 'Auditorías repetitivas'] },
  { icon: GitBranch, title: 'Falta de Trazabilidad', items: ['Información fragmentada', 'Sistemas desconectados', 'Difícil verificar el origen de datos'] },
  { icon: FileWarning, title: 'Fraude y Manipulación', items: ['Facturas alteradas', 'Contratos disputados', 'Manipulación documental'] },
  { icon: Clock, title: 'Procesos Lentos', items: ['Meses para validar activos', 'Semanas para cerrar auditorías', 'Días para aprobar pagos'] },
];

const BENEFITS = [
  { icon: Lock, title: 'Certificación Inmutable', desc: 'Cada operación queda registrada de forma permanente. Elimina la manipulación de datos, las versiones contradictorias y las disputas sobre quién hizo qué.' },
  { icon: Activity, title: 'Auditoría en Tiempo Real', desc: 'La información se valida automáticamente. Lo que antes requería semanas de revisión se realiza en minutos.' },
  { icon: Zap, title: 'Automatización de Pagos', desc: 'Los pagos se ejecutan automáticamente al cumplirse las condiciones acordadas. Sin correos, sin llamadas, sin aprobaciones interminables.' },
  { icon: Network, title: 'Trazabilidad Total', desc: 'Desde una mercancía hasta una factura, desde un contrato hasta un pago: todo queda conectado y verificable.' },
];

const ENTITIES = ['Empresas', 'Holdings', 'Instituciones', 'Operadores logísticos', 'Proveedores', 'Entidades financieras'];

const SECTORS = [
  { icon: Ship, name: 'Logística & Aduanas', desc: 'Flota, contenedores, manifiestos y trazabilidad puerto→entrega.', app: 'cargolink' },
  { icon: Bolt, name: 'Energía', desc: 'Virtual Power Plant, medición industrial y mercado OMIE.', app: 'energy' },
  { icon: Building2, name: 'Inmobiliaria & RWA', desc: 'Tokenización de inmuebles y activos para renta o venta.', internal: '/rwa' },
  { icon: ScanLine, name: 'Compliance & Auditoría', desc: 'Verificación de socios, certificados y auditoría continua.', app: 'purescan' },
  { icon: Eye, name: 'Visión & Trazabilidad IA', desc: 'Fingerprint visual de activos físicos con IA.', app: 'vision' },
  { icon: Landmark, name: 'Fintech & Tesorería', desc: 'DeFi corporativo: staking, liquidez y settlement.', app: 'capital' },
  { icon: BadgeCheck, name: 'Industria & Prestige', desc: 'Producto verificado, DPP y club B2B de socios.', app: 'prestige' },
  { icon: Boxes, name: 'ERP & Gestión', desc: 'Génesis: gestión empresarial integral y onboarding.', app: 'genesis' },
];

const CORP_PLANS = [
  {
    id: 'business', name: 'BUSINESS PRO', for: 'Empresas en Expansión', accent: C.cyan,
    includes: ['Automatización operativa', 'Auditoría inteligente', 'Integraciones empresariales', 'Trazabilidad certificada', 'Gestión avanzada de procesos'],
    benefits: ['Reducción significativa de costes administrativos', 'Incremento de eficiencia', 'Escalabilidad inmediata'],
    impact: 'Hasta un 45% de mejora operativa y financiera según sector y nivel de digitalización.',
  },
  {
    id: 'enterprise', name: 'ENTERPRISE INSTITUTIONAL', for: 'Holdings, Instituciones y Grandes Corporaciones', accent: C.gold, featured: true,
    includes: ['Todo lo de Business Pro', 'Marca blanca completa', 'Gestión de hasta 50 compañías', 'APIs institucionales ilimitadas', 'Gobernanza estratégica', 'SLA empresarial', 'Soporte prioritario'],
    benefits: ['Control corporativo integral', 'Escalabilidad multinacional', 'Nuevas fuentes de ingresos', 'Optimización masiva de costes'],
    impact: 'Hasta un 85% de ahorro operativo en validación, auditoría y conciliación.',
  },
];

const ROADMAP = [
  { year: 'Año 1', icon: Rocket, items: ['Despliegue institucional', 'Integraciones empresariales', 'Captación de Partners estratégicos'] },
  { year: 'Año 2–3', icon: TrendingUp, items: ['Expansión sectorial', 'Escalado multinacional', 'Crecimiento de operaciones certificadas'] },
  { year: 'Año 4–5', icon: Globe2, items: ['Consolidación como infraestructura empresarial', 'Incremento exponencial de volumen', 'Expansión a mercados internacionales'] },
];

const CONSOLE_CAPS = [
  ['Supervisar filiales', Users], ['Monitorizar operaciones', Activity], ['Gestionar permisos', Lock],
  ['Analizar rendimiento', LineChart], ['Auditar procesos', ShieldCheck], ['Controlar liquidez', Wallet],
];

// Cómo funciona, explicado en 3 pasos (didáctico)
const STEPS = [
  { n: '01', icon: Network, title: 'Conecta', desc: 'Integra tus sistemas actuales (ERP, CRM, banca) o empieza desde cero. Sin migraciones complejas: BeZhas se adapta a tu organización.' },
  { n: '02', icon: ShieldCheck, title: 'Opera', desc: 'Cada transacción, documento y contrato queda certificado y validado automáticamente. La tecnología trabaja de fondo, invisible para tu equipo.' },
  { n: '03', icon: LineChart, title: 'Controla', desc: 'Audita en segundos, ejecuta pagos automáticos y supervisa todas tus sedes desde un único panel, en tiempo real y las 24 horas.' },
];

// Para quién es — audiencias (qué gana cada perfil)
const AUDIENCES = [
  { icon: Crown, name: 'Directivos', accent: C.gold, desc: 'Visión total del grupo en un solo panel: rendimiento, liquidez y riesgos al instante para decidir con datos certificados.' },
  { icon: Workflow, name: 'Operarios', accent: C.cyan, desc: 'Tareas guiadas y sin fricción. Validar, registrar o aprobar se hace en un clic, sin papeleo ni correos interminables.' },
  { icon: Landmark, name: 'Instituciones', accent: C.emerald, desc: 'Marca blanca, gobernanza estratégica y cumplimiento regulatorio (MiCA, AEAT, DAC8) sin exponer información sensible.' },
  { icon: Briefcase, name: 'Empresarios', accent: C.cyan, desc: 'Menos costes administrativos, más velocidad y nuevas líneas de ingreso. La infraestructura pasa de gasto a activo.' },
];

// =============================================================================
export default function InstitutionalLanding() {
  const navigate = useNavigate();
  const open = useCallback((link, external) => {
    if (external) window.open(link, '_blank', 'noopener,noreferrer');
    else navigate(link);
  }, [navigate]);
  const demoMail = () => { window.location.href = 'mailto:info.bezcoin@bezhas.com?subject=Solicitud de demo institucional BeZhas'; };
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: C.bg, color: C.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
        @keyframes bezMesh1 { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(6%,-4%) scale(1.12); } 66% { transform: translate(-5%,5%) scale(0.94); } }
        @keyframes bezMesh2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-7%,6%) scale(1.15); } }
        @keyframes bezMesh3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(8%,4%) scale(1.1); } }
        @keyframes bezFloat { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-16px) rotate(3deg); } }
        @keyframes bezSpin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
        @keyframes bezMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes bezShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes bezPulseGlow { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
        .bez-grad-text { background: linear-gradient(120deg, ${C.glow}, ${C.cyan} 35%, ${C.purple} 80%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
        .bez-noise { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E"); }
        @media (prefers-reduced-motion: reduce) { .bez-anim { animation: none !important; } }
      `}</style>

      {/* Sidebar izquierdo heredado (mismo menú que el resto de la app) */}
      <SidebarDrawer open={sidebarOpen} setOpen={setSidebarOpen} />

      {/* Columna principal: Header sticky + contenido scrollable (sin menú feed móvil) */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />
        <main className="relative flex-1 overflow-y-auto overflow-x-hidden">
        {/* ── HERO (1) ─────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          <MeshBackground />
          <div className="absolute inset-0 z-0">
            <NodeNetworkBackground />
          </div>
          <div className="absolute inset-0 z-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 50% 0%, ${C.cyan}14, transparent 60%), linear-gradient(to bottom, transparent 60%, ${C.bg})` }} />
          <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-10 pt-24 pb-28 text-center">
            <div className="flex justify-center mb-6">{chip('Infraestructura empresarial certificada', C.cyan)}</div>
            <h1 className="text-5xl md:text-7xl lg:text-[80px] font-black leading-[1.02] tracking-[-0.03em] text-white">
              La Infraestructura que<br className="hidden md:block" />
              {' '}Convierte la <span className="bez-grad-text">Confianza</span><br className="hidden md:block" />
              {' '}en <span className="bez-grad-text">Rentabilidad</span>
            </h1>
            <p className="mt-7 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-medium" style={{ color: C.dim }}>
              La siguiente generación de infraestructura empresarial. Automatiza la confianza, certifica operaciones
              y reduce drásticamente los costes operativos. Para inversores, holdings y grandes corporaciones.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              {chip('No es una criptomoneda', C.dim)}
              {chip('No es un proyecto experimental', C.dim)}
              {chip('Opera en EUR, USD u otras FIAT', C.emerald)}
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-11">
              <MagneticButton onClick={demoMail} variant="primary">Solicitar demo institucional</MagneticButton>
              <MagneticButton onClick={() => open('/be-vip')} variant="ghost">Ver planes corporativos</MagneticButton>
            </div>
          </div>
        </section>

        {/* ── MARQUEE de sectores / partners ──────────────────────────── */}
        <div className="relative z-10 border-y" style={{ borderColor: C.border, background: 'rgba(255,255,255,0.012)' }}>
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] mb-4" style={{ color: C.dim }}>Sectores que ya operan sobre la red</p>
            <Marquee items={['Logística', 'Aduanas', 'RWA · Inmobiliario', 'Fintech', 'Energía · VPP', 'Industria', 'Legal · Compliance', 'Holdings', 'Instituciones', 'Cadena de suministro', 'Pagos B2B', 'Tesorería DeFi']} />
          </div>
        </div>

        {/* ── 2. EL PROBLEMA ───────────────────────────────────────────── */}
        <Section>
          <Reveal>
            <SectionHeading num="01" kicker="El problema" title="Un coste de miles de millones cada año"
              sub="La mayoría de organizaciones siguen operando sobre sistemas diseñados para una economía del siglo pasado. Procesos lentos, errores humanos, costes ocultos, fraude documental y falta de trazabilidad real." />
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {PROBLEMS.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <GlassCard accent={C.danger} className="h-full">
                  <div className="w-11 h-11 rounded-xl grid place-items-center mb-4" style={{ background: `${C.danger}14`, color: C.danger }}>
                    <p.icon size={22} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{p.title}</h3>
                  <ul className="space-y-2">
                    {p.items.map((it) => (
                      <li key={it} className="flex items-start gap-2 text-sm" style={{ color: C.dim }}>
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.danger }} />{it}
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {[['Cada retraso', 'es dinero inmovilizado'], ['Cada error', 'representa pérdidas'], ['Cada disputa', 'es un coste oculto']].map(([a, b]) => (
                <div key={a} className="rounded-xl px-5 py-4 text-center" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
                  <span className="font-bold text-white">{a}</span> <span style={{ color: C.dim }}>{b}.</span>
                </div>
              ))}
            </div>
          </Reveal>
        </Section>

        {/* ── 3. LA SOLUCIÓN — TUBERÍA DE CRISTAL ─────────────────────── */}
        <Section alt>
          <Reveal>
            <SectionHeading num="02" kicker="La solución" title="Optimizando el sistema empresarial"
              sub="Una capa de confianza digital donde cada transacción queda certificada, cada documento validado, cada proceso auditable en segundos y cada operación tiene una única versión de la verdad. La tecnología compleja permanece invisible para el usuario." />
          </Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            <Reveal className="flex flex-col">
              <SolutionFileStack />
            </Reveal>
            <Reveal delay={120} className="flex flex-col">
              <EntityNodeGraph />
            </Reveal>
          </div>
        </Section>

        {/* ── CÓMO FUNCIONA (didáctico, 3 pasos) ──────────────────────── */}
        <Section>
          <Reveal>
            <SectionHeading kicker="Cómo funciona" title="Tu operación, en 3 pasos sencillos"
              sub="Sin jerga técnica ni curvas de aprendizaje. Así de simple es poner a trabajar la infraestructura de confianza en tu empresa." />
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <GlassCard className="h-full relative overflow-hidden">
                  <span className="absolute -top-3 -right-2 text-[80px] font-extrabold leading-none select-none"
                    style={{ ...mono, color: `${C.cyan}0f` }}>{s.n}</span>
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl grid place-items-center mb-4" style={{ background: `${C.cyan}12`, color: C.cyan }}>
                      <s.icon size={24} />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ ...mono, color: C.cyan, background: `${C.cyan}14` }}>PASO {s.n}</span>
                      <h3 className="text-lg font-bold text-white">{s.title}</h3>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: C.dim }}>{s.desc}</p>
                  </div>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ── 4. QUÉ OBTIENE UNA EMPRESA ──────────────────────────────── */}
        <Section alt>
          <Reveal>
            <SectionHeading num="03" kicker="Beneficios" title="Qué obtiene una empresa al integrarse" />
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {BENEFITS.map((b, i) => (
              <Reveal key={b.title} delay={i * 70}>
                <GlassCard className="h-full flex gap-4">
                  <div className="w-12 h-12 rounded-xl grid place-items-center shrink-0" style={{ background: `${C.cyan}12`, color: C.cyan }}>
                    <b.icon size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1.5">{b.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: C.dim }}>{b.desc}</p>
                  </div>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ── PARA QUIÉN ES (audiencias) ──────────────────────────────── */}
        <Section>
          <Reveal>
            <SectionHeading kicker="Para quién es" title="Pensado para cada persona de tu organización"
              sub="Desde la dirección hasta el operario de planta: cada perfil encuentra una herramienta clara que le hace el día más fácil." />
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {AUDIENCES.map((a, i) => (
              <Reveal key={a.name} delay={i * 70}>
                <GlassCard accent={a.accent} className="h-full text-center">
                  <div className="mx-auto w-14 h-14 rounded-2xl grid place-items-center mb-4" style={{ background: `${a.accent}14`, color: a.accent }}>
                    <a.icon size={26} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{a.name}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: C.dim }}>{a.desc}</p>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ── 5. IA DE SUPERVISIÓN ────────────────────────────────────── */}
        <Section alt>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <Reveal>
              <SectionHeading num="04" kicker="Inteligencia artificial" title="Una auditoría continua, 24 horas al día"
                sub="BeZhas incorpora motores avanzados de análisis que aportan una segunda capa de supervisión permanente sobre toda tu operación." />
              <button onClick={() => open('/compliance')} className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: C.cyan }}>
                Ver módulo de compliance <ArrowRight size={16} />
              </button>
            </Reveal>
            <Reveal delay={100}>
              <div className="grid grid-cols-2 gap-4">
                {[['Calidad operativa', Gauge], ['Cumplimiento de reglas', ShieldCheck], ['Riesgos potenciales', AlertTriangle], ['Anomalías', Cpu]].map(([t, Icon], i) => (
                  <GlassCard key={t} accent={C.emerald} className="text-center">
                    <div className="mx-auto w-12 h-12 rounded-full grid place-items-center mb-3" style={{ background: `${C.emerald}12`, color: C.emerald }}><Icon size={22} /></div>
                    <p className="text-sm font-semibold text-white">{t}</p>
                  </GlassCard>
                ))}
              </div>
            </Reveal>
          </div>
        </Section>

        {/* ── 6. IMPACTO ECONÓMICO ────────────────────────────────────── */}
        <Section>
          <Reveal>
            <SectionHeading num="05" kicker="Impacto económico" title="Reducción de costes comprobada"
              sub="Las pruebas operativas muestran reducciones potenciales que liberan capital para crecimiento." />
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { v: 85, t: 'en integración de sistemas' },
              { v: 75, t: 'en digitalización de activos' },
              { v: 94, t: 'en auditorías y gobernanza documental' },
            ].map((m, i) => (
              <Reveal key={m.t} delay={i * 90}>
                <GlassCard className="text-center py-8">
                  <div className="text-[56px] font-extrabold leading-none" style={{ color: C.cyan, ...mono }}>
                    <CountUp to={m.v} suffix="%" />
                  </div>
                  <p className="mt-3 text-sm" style={{ color: C.dim }}>Hasta un {m.v}% {m.t}</p>
                </GlassCard>
              </Reveal>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
            <Reveal>
              <GlassCard accent={C.emerald}>
                <div className="flex items-center gap-2 mb-2"><TrendingUp size={18} style={{ color: C.emerald }} /><h3 className="font-bold text-white">Incremento de Productividad</h3></div>
                <p className="text-sm" style={{ color: C.dim }}>Procesos que hoy consumen meses pueden reducirse a semanas, y los que requieren múltiples departamentos pueden ejecutarse automáticamente.</p>
              </GlassCard>
            </Reveal>
            <Reveal delay={80}>
              <GlassCard accent={C.gold}>
                <div className="flex items-center gap-2 mb-2"><PiggyBank size={18} style={{ color: C.gold }} /><h3 className="font-bold text-white">Liberación de Capital</h3></div>
                <p className="text-sm" style={{ color: C.dim }}>Menos tiempo de espera, menos costes administrativos y menos recursos en validaciones: más capital disponible para crecimiento.</p>
              </GlassCard>
            </Reveal>
          </div>
        </Section>

        {/* ── 7 + 8. PARTNERS + WHITE LABEL ───────────────────────────── */}
        <Section alt>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Reveal>
              <GlassCard accent={C.gold} className="h-full">
                <div className="flex items-center gap-2 mb-3"><Coins size={20} style={{ color: C.gold }} /><span className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.gold }}>Nueva línea de ingresos</span></div>
                <h3 className="text-2xl font-bold text-white mb-3">Partners Institucionales para Holdings</h3>
                <p className="text-sm mb-4" style={{ color: C.dim }}>BeZhas no solo reduce costes: crea nuevas oportunidades económicas. Los grupos empresariales participan en el crecimiento del ecosistema en lugar de pagar por tecnología.</p>
                <ul className="space-y-2">
                  {['Monetizar la actividad de red', 'Participación sobre operaciones de sus filiales', 'Convertir la infraestructura en un centro de beneficios'].map((t) => (
                    <li key={t} className="flex items-center gap-2 text-sm text-white"><CheckCircle2 size={15} style={{ color: C.gold }} />{t}</li>
                  ))}
                </ul>
              </GlassCard>
            </Reveal>
            <Reveal delay={100}>
              <GlassCard accent={C.cyan} className="h-full">
                <div className="flex items-center gap-2 mb-3"><Layers size={20} style={{ color: C.cyan }} /><span className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.cyan }}>Plataforma White Label</span></div>
                <h3 className="text-2xl font-bold text-white mb-3">Opera bajo tu propia marca</h3>
                <p className="text-sm mb-4" style={{ color: C.dim }}>Las instituciones operan con su identidad, sin depender de terceros ni exponer información estratégica, y sin modificar sus procesos actuales.</p>
                <p className="text-sm font-semibold" style={{ color: C.cyan }}>BeZhas se adapta a la organización. La organización no necesita adaptarse a BeZhas.</p>
              </GlassCard>
            </Reveal>
          </div>
        </Section>

        {/* ── 9. CENTRO DE CONTROL CORPORATIVO ────────────────────────── */}
        <Section>
          <Reveal>
            <SectionHeading num="06" kicker="Centro de control" title="Tu holding, desde un único panel"
              sub="Cada holding dispone de una consola centralizada para gobernar todas sus filiales y sedes." />
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {CONSOLE_CAPS.map(([t, Icon], i) => (
              <Reveal key={t} delay={i * 60}>
                <GlassCard className="text-center py-6" interactive>
                  <div className="mx-auto w-11 h-11 rounded-full grid place-items-center mb-3" style={{ background: `${C.cyan}12`, color: C.cyan }}><Icon size={20} /></div>
                  <p className="text-xs font-medium text-white leading-tight">{t}</p>
                </GlassCard>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="text-center mt-8">
              <button onClick={() => open('/business-dashboard')} className="inline-flex items-center gap-2 px-6 h-11 rounded-xl text-sm font-bold" style={{ background: C.cyan, color: '#00252b' }}>
                Entrar al Centro de Control <ArrowRight size={16} />
              </button>
            </div>
          </Reveal>
        </Section>

        {/* ── SECTORES (servicios y productos por sector) ─────────────── */}
        <Section alt>
          <Reveal>
            <SectionHeading num="07" kicker="Sectores" title="Servicios y productos para cada sector"
              sub="Una misma capa de validación conecta empresas, holdings, instituciones, operadores logísticos, proveedores y entidades financieras." />
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SECTORS.map((s, i) => (
              <Reveal key={s.name} delay={i * 60}>
                <button onClick={() => open(s.internal || nativeAppUrl(s.app), !s.internal)} className="text-left w-full h-full">
                  <GlassCard className="h-full">
                    <div className="w-11 h-11 rounded-xl grid place-items-center mb-4" style={{ background: `${C.cyan}12`, color: C.cyan }}><s.icon size={22} /></div>
                    <h3 className="font-bold text-white mb-1.5">{s.name}</h3>
                    <p className="text-sm" style={{ color: C.dim }}>{s.desc}</p>
                    <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: C.cyan }}>Acceder <ArrowRight size={13} /></div>
                  </GlassCard>
                </button>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ── 10. PLANES CORPORATIVOS ─────────────────────────────────── */}
        <Section>
          <Reveal>
            <SectionHeading num="08" kicker="Planes corporativos" title="Elige el nivel de tu organización" />
          </Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {CORP_PLANS.map((p, i) => (
              <Reveal key={p.id} delay={i * 100}>
                <GlassCard accent={p.accent} className="h-full" interactive
                  style={p.featured ? { boxShadow: `0 0 30px ${p.accent}22`, border: `1px solid ${p.accent}55` } : {}}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {p.featured ? <Crown size={20} style={{ color: p.accent }} /> : <Briefcase size={20} style={{ color: p.accent }} />}
                      <h3 className="text-xl font-extrabold text-white">{p.name}</h3>
                    </div>
                    {p.featured && <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ ...mono, background: `${p.accent}22`, color: p.accent }}>RECOMENDADO</span>}
                  </div>
                  <p className="text-xs uppercase tracking-wider mb-4" style={{ ...mono, color: C.dim }}>Para {p.for}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-5">
                    {p.includes.map((it) => (
                      <div key={it} className="flex items-start gap-2 text-sm text-white"><CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: p.accent }} />{it}</div>
                    ))}
                  </div>
                  <div className="rounded-xl p-4 mb-5" style={{ background: `${p.accent}0d`, border: `1px solid ${p.accent}33` }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: p.accent }}>Impacto potencial</p>
                    <p className="text-sm" style={{ color: C.text }}>{p.impact}</p>
                  </div>
                  <button onClick={() => open('/be-vip')} className="w-full h-11 rounded-xl text-sm font-bold transition-transform hover:scale-[1.02]"
                    style={p.featured ? { background: p.accent, color: '#1a1500' } : { color: C.text, border: `1px solid ${C.border}`, background: C.panelHi }}>
                    Solicitar {p.name}
                  </button>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ── 11 + 12. INVERSORES + ROADMAP ───────────────────────────── */}
        <Section alt>
          <Reveal>
            <SectionHeading num="09" kicker="Oportunidad para inversores" title="Quién capturará primero los beneficios"
              sub="La digitalización del comercio global entra en una nueva fase: la automatización de la confianza. Los inversores que participan en etapas tempranas acceden al mayor potencial de crecimiento, antes de que la adopción institucional alcance escala masiva." />
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {ROADMAP.map((r, i) => (
              <Reveal key={r.year} delay={i * 100}>
                <GlassCard className="h-full" accent={C.gold}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: `${C.gold}14`, color: C.gold }}><r.icon size={20} /></div>
                    <span className="text-lg font-extrabold text-white">{r.year}</span>
                  </div>
                  <ul className="space-y-2">
                    {r.items.map((it) => (
                      <li key={it} className="flex items-start gap-2 text-sm" style={{ color: C.dim }}><span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.gold }} />{it}</li>
                    ))}
                  </ul>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ── 13. DECISIÓN ESTRATÉGICA (cierre) ──────────────────────── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 z-0 opacity-60"><NodeNetworkBackground density={0.00006} /></div>
          <div className="absolute inset-0 z-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 50%, ${C.cyan}10, transparent 60%)` }} />
          <div className="relative z-10 max-w-4xl mx-auto px-6 py-28 text-center">
            <Reveal>
              <Target size={40} className="mx-auto mb-6" style={{ color: C.cyan }} />
              <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">La pregunta ya no es <span style={{ color: C.dim }}>si</span> llegará.<br />Es <span style={{ color: C.cyan }}>quién la capturará primero.</span></h2>
              <p className="mt-6 text-lg max-w-2xl mx-auto" style={{ color: C.dim }}>
                BeZhas no es simplemente una herramienta. Es la base operativa sobre la que se construirá la siguiente generación de empresas.
              </p>
              <div className="flex flex-wrap justify-center gap-4 mt-10">
                <button onClick={demoMail} className="px-8 h-12 rounded-xl font-bold text-sm transition-transform hover:scale-[1.03]" style={{ background: C.cyan, color: '#00252b', boxShadow: `0 0 24px ${C.cyan}55` }}>
                  Posicionar mi organización
                </button>
                <button onClick={() => open('/master')} className="px-8 h-12 rounded-xl font-semibold text-sm transition-colors" style={{ color: C.emerald, border: `1px solid ${C.emerald}66`, background: 'transparent' }}>
                  📖 Guía "Cómo dominar"
                </button>
                <button onClick={() => open('/developer-console')} className="px-8 h-12 rounded-xl font-semibold text-sm" style={{ color: C.cyan, border: `1px solid ${C.cyan}66` }}>
                  Portal de desarrolladores
                </button>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t" style={{ borderColor: C.border, background: '#03060C' }}>
          <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs" style={{ color: C.dim }}>
            <div>© {new Date().getFullYear()} BeZhas · La base operativa de la siguiente generación de empresas</div>
            <div className="flex gap-6">
              <a href="/be-vip" className="hover:text-white">Planes</a>
              <a href="/developer-console" className="hover:text-white">Developers</a>
              <a href="/compliance" className="hover:text-white">Compliance</a>
              <a href="mailto:info.bezcoin@bezhas.com" className="hover:text-white">Contacto</a>
            </div>
          </div>
        </footer>
        </main>
      </div>
    </div>
  );
}

// ── Sección genérica con franjas alternas ─────────────────────────────────────
function Section({ children, alt = false }) {
  return (
    <section className="relative py-20 md:py-24" style={alt ? { background: 'rgba(255,255,255,0.015)' } : {}}>
      <div className="max-w-6xl mx-auto px-6 lg:px-10">{children}</div>
    </section>
  );
}

// ── Grafo interactivo de entidades conectadas (sección Solución) ──────────────
// Pila de "archivos" de la sección Solución — pestañas pastel que se levantan al hover
const SOLUTION_FILES = [
  { icon: Lock, color: '#00F0FF', title: 'Cada transacción queda certificada',
    desc: 'Cada transacción se sella criptográficamente: queda registrada de forma permanente e imposible de alterar.' },
  { icon: ShieldCheck, color: '#10B981', title: 'Cada documento queda validado',
    desc: 'Cada documento se verifica automáticamente contra su origen. Sin copias contradictorias ni versiones falsas.' },
  { icon: Activity, color: '#FFD700', title: 'Cada proceso puede auditarse en segundos',
    desc: 'La trazabilidad completa está disponible al instante. Lo que tardaba semanas se revisa en segundos.' },
  { icon: Network, color: '#FF6B9D', title: 'Cada movimiento es trazable',
    desc: 'Desde el origen hasta el destino: cada movimiento deja un rastro verificable de extremo a extremo.' },
  { icon: CheckCircle2, color: '#B69DFF', title: 'Cada operación tiene una única versión de la verdad',
    desc: 'Todos los actores comparten la misma fuente de verdad. Se acabaron las disputas sobre qué dato es el correcto.' },
];

/**
 * SolutionFileStack — pila de tarjetas-archivo superpuestas.
 * Cada archivo tiene una pestaña pastel casi transparente; al pasar el cursor
 * (o tocar) la tarjeta se levanta, pasa al frente y despliega su contenido.
 */
function SolutionFileStack() {
  const [hi, setHi] = useState(-1);
  const N = SOLUTION_FILES.length;
  return (
    <div className="relative flex flex-col justify-between h-full" style={{ perspective: '1200px' }}>
      {SOLUTION_FILES.map((f, i) => {
        const lifted = hi === i;
        return (
          <div
            key={f.title}
            onMouseEnter={() => setHi(i)}
            onMouseLeave={() => setHi((p) => (p === i ? -1 : p))}
            onClick={() => setHi((p) => (p === i ? -1 : i))}
            className="relative cursor-pointer transition-[transform,z-index] duration-300 ease-out"
            style={{
              marginTop: i === 0 ? 0 : -38,
              zIndex: lifted ? 50 : i,
              transform: lifted ? 'translateY(-12px) scale(1.025)' : 'none',
            }}
          >
            <span className="absolute -top-2 right-5 h-3 w-14 rounded-t-lg transition-all duration-300"
              style={{ background: f.color, opacity: lifted ? 0.65 : 0.32, filter: lifted ? `drop-shadow(0 -2px 8px ${f.color}77)` : 'none' }} />
            <div
              className="rounded-xl px-4 pt-5 overflow-hidden transition-all duration-300 ease-out"
              style={{
                background: `${f.color}28`,
                border: `1px solid ${lifted ? `${f.color}88` : `${f.color}44`}`,
                borderTop: `2px solid ${f.color}${lifted ? 'dd' : '66'}`,
                boxShadow: lifted ? `0 20px 50px -10px ${f.color}45` : `0 4px 12px -6px ${f.color}22`,
                paddingBottom: lifted ? 14 : 12,
              }}
            >
              <div className="flex items-center gap-3 relative">
                <span className="grid place-items-center w-7 h-7 rounded-lg shrink-0 transition-colors"
                  style={{ background: `${f.color}18`, color: f.color }}>
                  <f.icon size={16} />
                </span>
                <span className="text-sm font-semibold" style={{ color: lifted ? '#fff' : C.dim }}>{f.title}</span>
              </div>
              <div className="grid transition-all duration-300 ease-out"
                style={{ gridTemplateRows: lifted ? '1fr' : '0fr', opacity: lifted ? 1 : 0 }}>
                <div className="overflow-hidden">
                  <p className="text-[13px] leading-relaxed pl-10 pt-2" style={{ color: C.dim }}>{f.desc}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Nodos terciarios efímeros (pequeñas empresas que se conectan y desconectan)
const TERT_NAMES = ['PYME', 'Startup', 'Taller', 'Comercio', 'Autónomo', 'Cooperativa', 'Pyme local', 'Distribuidor'];
const TERT_COUNT = 6;

/**
 * EntityNodeGraph — "Sistema Solar" de nodos en 3D.
 * El Core BeZhas permanece fijo en el centro; cada entidad orbita con ejes X/Y
 * independientes (movimiento tipo Lissajous) y oscilación de profundidad (z) que
 * escala tamaño y brillo para dar sensación 3D. Alrededor de los nodos secundarios
 * aparecen y desaparecen nodos terciarios (pequeñas empresas) conectándose a ellos.
 * Animado con requestAnimationFrame + manipulación directa del DOM (sin re-renders).
 */
function EntityNodeGraph() {
  const cx = 200, cy = 170;
  const N = ENTITIES.length;

  // Configuración orbital 3D — ejes X/Y con radios, velocidades y fases independientes + profundidad z
  const orbits = useRef(
    ENTITIES.map((_, i) => {
      const base = 60 + (i % 3) * 30; // 60 · 90 · 120
      return {
        ax: base,
        ay: base * (0.52 + (i % 3) * 0.16),                       // radio Y distinto → elipse 3D
        wx: (0.085 + (i % 4) * 0.022) * (i % 2 === 0 ? 1 : -1),   // velocidad eje X
        wy: (0.060 + (i % 3) * 0.030) * (i % 2 === 0 ? -1 : 1),   // velocidad eje Y (distinta → 3D)
        px: (Math.PI * 2 * i) / N,
        py: (Math.PI * 2 * i) / N + Math.PI / 3,
        wz: 0.11 + (i % 4) * 0.035,                               // oscilación de profundidad
        pz: i * 1.27,
      };
    })
  ).current;

  // Pares de nodos secundarios (conexiones entre vecinos)
  const pairs = useRef(
    (() => {
      const arr = [];
      for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) arr.push([a, b]);
      return arr;
    })()
  ).current;

  // Estado de nodos terciarios efímeros (mutado en cada frame)
  const tert = useRef(
    Array.from({ length: TERT_COUNT }, () => ({ active: false, parent: 0, ang: 0, dist: 22, t0: -999, life: 0 }))
  ).current;

  const activeRef = useRef(-1);
  const [active, setActive] = useState(-1);
  useEffect(() => { activeRef.current = active; }, [active]);

  // Refs a elementos SVG actualizados cada frame
  const coreLineRefs = useRef([]);
  const pairLineRefs = useRef([]);
  const nodeRefs = useRef([]);
  const haloRefs = useRef([]);
  const labelRefs = useRef([]);
  const tNodeRefs = useRef([]);
  const tLineRefs = useRef([]);
  const tLabelRefs = useRef([]);

  // Posición en t=0 (evita parpadeo antes del primer frame)
  const initPos = orbits.map((o) => ({ x: cx + o.ax * Math.cos(o.px), y: cy + o.ay * Math.sin(o.py) }));

  useEffect(() => {
    let raf, start;
    const THRESH = 100; // distancia bajo la cual nace una conexión entre nodos secundarios
    const loop = (ts) => {
      if (start === undefined) start = ts;
      const t = (ts - start) / 1000;

      // Posición + profundidad 3D de cada nodo secundario
      const pos = orbits.map((o) => {
        const x = cx + o.ax * Math.cos(o.px + o.wx * t);
        const y = cy + o.ay * Math.sin(o.py + o.wy * t);
        const z = Math.sin(o.pz + o.wz * t);       // -1..1 profundidad
        const depth = (z + 1) / 2;                  // 0 (lejos) .. 1 (cerca)
        return { x, y, depth };
      });

      for (let i = 0; i < N; i++) {
        const p = pos[i];
        const isA = activeRef.current === i;
        const scale = 0.62 + 0.55 * p.depth;        // tamaño según profundidad
        const op = 0.45 + 0.55 * p.depth;           // brillo según profundidad
        const cl = coreLineRefs.current[i];
        if (cl) {
          cl.setAttribute('x2', p.x); cl.setAttribute('y2', p.y);
          cl.setAttribute('stroke', isA ? C.emerald : C.cyan);
          cl.setAttribute('stroke-opacity', isA ? 0.85 : (0.12 + 0.18 * p.depth).toFixed(3));
        }
        const halo = haloRefs.current[i];
        if (halo) { halo.setAttribute('cx', p.x); halo.setAttribute('cy', p.y); halo.setAttribute('r', (10 * scale).toFixed(2)); }
        const nd = nodeRefs.current[i];
        if (nd) {
          nd.setAttribute('cx', p.x); nd.setAttribute('cy', p.y);
          nd.setAttribute('r', (isA ? 8.5 : 5.5 * scale).toFixed(2));
          nd.setAttribute('fill', isA ? C.emerald : C.cyan);
          nd.setAttribute('fill-opacity', isA ? 1 : op.toFixed(3));
        }
        const lb = labelRefs.current[i];
        if (lb) {
          lb.setAttribute('x', p.x);
          lb.setAttribute('y', p.y + (p.y < cy ? -12 : 17));
          lb.setAttribute('fill', isA ? C.emerald : C.text);
          lb.setAttribute('fill-opacity', (0.55 + 0.45 * p.depth).toFixed(3));
        }
      }

      // Conexiones dinámicas entre nodos secundarios vecinos
      for (let k = 0; k < pairs.length; k++) {
        const [a, b] = pairs[k];
        const pa = pos[a], pb = pos[b];
        const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
        const pl = pairLineRefs.current[k];
        if (!pl) continue;
        if (dist < THRESH) {
          pl.setAttribute('x1', pa.x); pl.setAttribute('y1', pa.y);
          pl.setAttribute('x2', pb.x); pl.setAttribute('y2', pb.y);
          pl.setAttribute('stroke-opacity', ((1 - dist / THRESH) * 0.5).toFixed(3));
        } else {
          pl.setAttribute('stroke-opacity', '0');
        }
      }

      // Nodos terciarios (pequeñas empresas) — aparecen/desaparecen junto a un secundario
      for (let k = 0; k < TERT_COUNT; k++) {
        const s = tert[k];
        if (!s.active || t - s.t0 > s.life) {
          // (re)spawn en un nodo secundario aleatorio
          s.active = true;
          s.parent = Math.floor(Math.random() * N);
          s.ang = Math.random() * Math.PI * 2;
          s.dist = 18 + Math.random() * 18;
          s.t0 = t;
          s.life = 2.6 + Math.random() * 3.4;
          const tl = tLabelRefs.current[k];
          if (tl) tl.textContent = TERT_NAMES[Math.floor(Math.random() * TERT_NAMES.length)];
        }
        const e = t - s.t0;
        const fin = 0.6, fout = 0.7;
        let fade = 1;
        if (e < fin) fade = e / fin;
        else if (e > s.life - fout) fade = Math.max(0, (s.life - e) / fout);
        const pp = pos[s.parent];
        const tx = pp.x + Math.cos(s.ang) * s.dist;
        const ty = pp.y + Math.sin(s.ang) * s.dist;
        const tn = tNodeRefs.current[k];
        if (tn) { tn.setAttribute('cx', tx); tn.setAttribute('cy', ty); tn.setAttribute('fill-opacity', (fade * 0.95).toFixed(3)); }
        const tln = tLineRefs.current[k];
        if (tln) {
          tln.setAttribute('x1', pp.x); tln.setAttribute('y1', pp.y);
          tln.setAttribute('x2', tx); tln.setAttribute('y2', ty);
          tln.setAttribute('stroke-opacity', (fade * 0.4).toFixed(3));
        }
        const tlb = tLabelRefs.current[k];
        if (tlb) { tlb.setAttribute('x', tx); tlb.setAttribute('y', ty - 6); tlb.setAttribute('fill-opacity', (fade * 0.7).toFixed(3)); }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative rounded-2xl p-4 overflow-hidden h-full flex flex-col justify-center" style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      {/* halo de fondo del Core */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full"
        style={{ background: `radial-gradient(circle, ${C.cyan}1f 0%, transparent 70%)` }} />
      <svg viewBox="0 0 400 340" className="w-full relative">
        <defs>
          <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.cyan} stopOpacity="0.45" />
            <stop offset="100%" stopColor={C.cyan} stopOpacity="0.08" />
          </radialGradient>
        </defs>

        {/* Guías de órbita (elipses tenues, ambiente 3D) */}
        {[60, 90, 120].map((r, i) => (
          <ellipse key={r} cx={cx} cy={cy} rx={r} ry={r * (0.52 + (i % 3) * 0.16)}
            fill="none" stroke={C.cyan} strokeOpacity="0.06" strokeWidth="1" strokeDasharray="2 5" />
        ))}

        {/* Conexiones nodo↔nodo (secundarios vecinos) */}
        {pairs.map((_, k) => (
          <line key={`p${k}`} ref={(el) => (pairLineRefs.current[k] = el)}
            stroke={C.cyan} strokeOpacity="0" strokeWidth="1" strokeLinecap="round" />
        ))}

        {/* Conexiones terciarias (pequeñas empresas → secundario) */}
        {Array.from({ length: TERT_COUNT }).map((_, k) => (
          <line key={`tl${k}`} ref={(el) => (tLineRefs.current[k] = el)}
            stroke={C.gold} strokeOpacity="0" strokeWidth="1" strokeLinecap="round" />
        ))}

        {/* Conexiones Core→secundario */}
        {ENTITIES.map((_, i) => (
          <line key={`c${i}`} ref={(el) => (coreLineRefs.current[i] = el)}
            x1={cx} y1={cy} x2={initPos[i].x} y2={initPos[i].y}
            stroke={C.cyan} strokeOpacity="0.22" strokeWidth="1" />
        ))}

        {/* Core BeZhas */}
        <circle cx={cx} cy={cy} r="46" fill="url(#coreGrad)">
          <animate attributeName="r" values="44;50;44" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r="32" fill={C.bg} stroke={C.cyan} strokeWidth="1.5" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="13" fontWeight="800" fill={C.cyan}>BeZhas</text>

        {/* Nodos terciarios efímeros (pequeñas empresas) */}
        {Array.from({ length: TERT_COUNT }).map((_, k) => (
          <g key={`t${k}`} style={{ pointerEvents: 'none' }}>
            <circle ref={(el) => (tNodeRefs.current[k] = el)} r="3" fill={C.gold} fillOpacity="0" />
            <text ref={(el) => (tLabelRefs.current[k] = el)} textAnchor="middle" fontSize="7.5"
              fill={C.gold} fillOpacity="0" style={{ fontWeight: 600 }} />
          </g>
        ))}

        {/* Nodos secundarios orbitando (3D) */}
        {ENTITIES.map((name, i) => (
          <g key={`n${i}`} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(-1)} style={{ cursor: 'pointer' }}>
            <circle ref={(el) => (haloRefs.current[i] = el)} cx={initPos[i].x} cy={initPos[i].y}
              r="10" fill={C.cyan} fillOpacity="0.14" />
            <circle ref={(el) => (nodeRefs.current[i] = el)} cx={initPos[i].x} cy={initPos[i].y}
              r="5.5" fill={C.cyan} />
            <text ref={(el) => (labelRefs.current[i] = el)} x={initPos[i].x}
              y={initPos[i].y + (initPos[i].y < cy ? -12 : 17)}
              textAnchor="middle" fontSize="10.5" fill={C.text} style={{ fontWeight: 600 }}>{name}</text>
          </g>
        ))}
      </svg>
      <p className="text-center text-xs mt-1 relative" style={{ color: C.dim }}>Todo operando con EUR, USD u otras monedas FIAT si así lo desean.</p>
    </div>
  );
}
