'use client';

/**
 * BeZhas War Room — Pantalla de monitorización unificada.
 *
 * Vive en /monitor (top-level), FUERA del árbol /dashboard a propósito:
 * proxy.ts exige cookie de sesión para todo lo que cuelga de /dashboard,
 * y un Raspberry Pi recién arrancado (o un Chromium en --incognito) nunca
 * la tiene. Puesta aquí, la pantalla carga sin login — protegida en su
 * lugar por MONITOR_ACCESS_TOKEN a nivel de servidor (ver app/api/monitor/route.ts).
 *
 * PROMPT DE DISEÑO APLICADO:
 * ─────────────────────────────────────────────────────────────────
 * "Diseña un dashboard de monitorización estilo War Room / NOC
 *  (Network Operations Center) para una pantalla externa conectada
 *  a un Raspberry Pi. Requisitos:
 *
 *  LAYOUT:
 *  - Header compacto con logo, reloj en vivo, indicador de conexión
 *    y barra de salud global (score 0-100 calculado por peso).
 *  - Fila superior: 3 KPI hero cards grandes (Block Height, Uptime del
 *    sistema, Apps Nativas UP/total como anillo de progreso).
 *  - Grid 4×2 de paneles de detalle debajo.
 *  - Cada panel tiene borde lateral coloreado (accent stripe),
 *    header con icono + badge, y contenido scrollable.
 *
 *  VISUAL:
 *  - Fondo: negro profundo (#080911) sin gradientes.
 *  - Paneles: glassmorphism oscuro con borde rgba blanco 6%.
 *  - Accent stripe por panel: teal (#00D4AA) blockchain, gold (#FFD700)
 *    infra, pink (#FF6B9D) apps nativas, blue (#5B8DEF) API, purple (#A78BFA)
 *    agents, amber (#F59E0B) aegis, cyan (#22D3EE) brain, red (#EF4444)
 *    gas/energy.
 *  - Status dots con pulse animado para 'live'. Tipografía: Space Grotesk,
 *    monospace tabular para valores numéricos. Radius: 8px paneles.
 *
 *  COMPORTAMIENTO:
 *  - Auto-refresh cada 8s. Modo Kiosk: ?kiosk=1 → fullscreen, sin cursor.
 *  - Barra de salud global: media ponderada de subsistemas.
 *  - Responsive: < 1280px colapsa a 2 columnas.
 *
 *  ANTI-PATRONES:
 *  - Nada de gradientes llamativos, scroll horizontal, texto < 11px,
 *    ni animaciones que distraigan del dato."
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity, Server, Boxes, Cpu, Shield, BrainCircuit, Fuel,
  Monitor, Maximize2, Minimize2, RefreshCw, ArrowUpDown,
  X, ExternalLink, Expand,
} from 'lucide-react';

// Same-origin — the Next.js route handler proxies to the Express API
// server-side, so the browser never crosses origins and CORS never applies.
const REFRESH_MS = 8_000;

/**
 * Acceso directo de cada panel: adónde va quien quiere ACTUAR, no solo mirar.
 *
 * Son URLs de herramienta (Prometheus, el panel de administración, la UI del
 * Brain), no de dato: el dato ya está en la tarjeta. Se resuelven en el cliente
 * porque dependen del host desde el que se abre el kiosko.
 *
 * `null` o url vacía = ese panel no tiene destino y solo abre su ventana de
 * detalle. Preferible a un enlace que lleve a un 404.
 */
const ATAJOS: Record<string, { label: string; url: string } | null> = {
  blockchain: null,
  docker: { label: 'Prometheus', url: process.env.NEXT_PUBLIC_PROMETHEUS_URL || 'http://localhost:9090/targets' },
  apps:   { label: 'Watchdog', url: '/admin/profile' },
  api:    { label: 'Health', url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/health` },
  agents: { label: 'Panel agentes', url: '/admin/profile' },
  aegis:  { label: 'Aegis', url: process.env.NEXT_PUBLIC_AEGIS_URL || '' },
  brain:  { label: 'Brain UI', url: `${process.env.NEXT_PUBLIC_BRAIN_URL || 'http://localhost:4007'}/ui` },
  gas:    { label: 'Gas Tanks', url: '/dashboard/gas' },
};

/**
 * Antigüedad legible de una marca de tiempo.
 *
 * El panel de Apps Nativas pintaba la instantánea del watchdog sin decir de
 * cuándo era: 13 filas en rojo de hace un mes se leen igual que 13 caídas
 * ahora mismo, y son cosas muy distintas.
 */
function antiguedad(iso?: string | null): { texto: string; obsoleto: boolean } | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  const min = Math.floor(ms / 60_000);
  if (min < 1) return { texto: 'ahora', obsoleto: false };
  if (min < 60) return { texto: `hace ${min} min`, obsoleto: min > 30 };
  const h = Math.floor(min / 60);
  if (h < 24) return { texto: `hace ${h} h`, obsoleto: true };
  return { texto: `hace ${Math.floor(h / 24)} d`, obsoleto: true };
}

// ── Types (mirrors api/routes/monitor.js's real response shape) ──
interface NativeAppEntry {
  name: string;
  status: 'up' | 'down' | 'flaky';
  latency_ms: number | null;
  http_status: number | null;
  failures: number;
}

interface BrainFn { fn: string; calls: number; tokens: number; bez: number }

interface OverviewData {
  timestamp: string;
  collected_ms: number;
  api: {
    status: string;
    version: string;
    uptime_s: number;
    memory_mb: number;
    services: { database: string; redis: string };
  } | null;
  blockchain: {
    block_number: number | null;
    gas_price_gwei: number | null;
    chain_id: number | null;
  } | null;
  event_pipeline: {
    listener_active: boolean;
    events_received: number;
    events_indexed: number;
    events_published: number;
    events_failed: number;
    queue_watermark: number;
    reconnects: number;
    last_event_at: string | null;
    consumer_connected: boolean;
    sse_clients: number;
  } | null;
  native_apps: {
    timestamp: string;
    summary: { total: number; up: number; down: number; flaky: number };
    apps: NativeAppEntry[];
  } | null;
  brain: {
    totals?: { calls: number; tokens: number; bez: number };
    topFunctions?: BrainFn[];
    updatedAt?: string;
  } | null;
  aegis: Record<string, unknown> | null;
  docker: {
    job: string;
    instance: string;
    health: string;
    last_scrape: string;
    scrape_duration_s: number;
  }[] | null;
  gas_balances: { name: string; balance_bez: string; updated_at: string }[] | null;
  agent_activity: { module: string; actions_24h: number; alerts_24h: number; last_action: string }[] | null;
}

// ── Helpers ──
function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function computeHealthScore(data: OverviewData | null): number {
  if (!data) return 0;
  let score = 0;
  let weight = 0;

  if (data.api) {
    weight += 25;
    let s = 25;
    if (data.api.services.database !== 'up') s -= 12;
    if (data.api.services.redis !== 'up') s -= 8;
    if (data.api.memory_mb > 1024) s -= 5;
    score += Math.max(0, s);
  }

  if (data.blockchain) {
    weight += 20;
    score += data.blockchain.block_number ? 20 : 5;
  }

  if (data.event_pipeline) {
    weight += 15;
    let s = 15;
    if (!data.event_pipeline.listener_active) s -= 10;
    if (!data.event_pipeline.consumer_connected) s -= 5;
    score += Math.max(0, s);
  }

  if (data.native_apps) {
    weight += 20;
    const ratio = data.native_apps.summary.total > 0
      ? data.native_apps.summary.up / data.native_apps.summary.total : 0;
    score += Math.round(ratio * 20);
  }

  weight += 5;
  if (data.brain) score += 5;

  weight += 5;
  if (data.aegis) score += 5;

  if (data.docker) {
    weight += 5;
    const healthy = data.docker.filter(d => d.health === 'up').length;
    const ratio = data.docker.length > 0 ? healthy / data.docker.length : 0;
    score += Math.round(ratio * 5);
  }

  weight += 5;
  if (data.agent_activity) score += 5;

  return weight > 0 ? Math.round((score / weight) * 100) : 0;
}

function healthColor(score: number): string {
  if (score >= 80) return '#00D4AA';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

// ── Micro-components ──
function LiveDot({ alive }: { alive: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {alive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${alive ? 'bg-emerald-400' : 'bg-red-500'}`} />
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'up' || status === 'healthy'
    ? 'bg-emerald-400' : status === 'down' || status === 'unhealthy'
    ? 'bg-red-400' : 'bg-amber-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${color} shrink-0`} />;
}

function HealthBar({ score }: { score: number }) {
  const c = healthColor(score);
  return (
    <div className="flex items-center gap-2">
      <div className="w-28 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${score}%`, backgroundColor: c }}
        />
      </div>
      <span className="text-xs font-mono tabular-nums" style={{ color: c }}>{score}%</span>
    </div>
  );
}

function HeroCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent: string;
}) {
  return (
    <div className="bg-surface-container-low border border-white/[0.06] rounded-lg p-4 flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">{label}</span>
      <span className="text-2xl font-bold font-mono tabular-nums" style={{ color: accent }}>{value}</span>
      {sub && <span className="text-[11px] text-on-surface-variant">{sub}</span>}
    </div>
  );
}

function Panel({ title, icon: Icon, accent, badge, id, onOpen, children }: {
  title: string;
  icon: typeof Activity;
  accent: string;
  badge?: string;
  /** Clave en ATAJOS y en el conmutador de VentanaDetalle. */
  id?: string;
  onOpen?: (id: string) => void;
  children: React.ReactNode;
}) {
  const atajo = id ? ATAJOS[id] : null;
  const abrible = Boolean(id && onOpen);

  return (
    <div className="group relative bg-surface-container-low border border-white/[0.06] rounded-lg
                    overflow-hidden flex flex-col min-h-0 hover:border-white/[0.14] transition-colors">
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: accent }} />
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 shrink-0">
        <Icon className="w-3.5 h-3.5" style={{ color: accent }} />

        {/*
          Abre el TÍTULO, no la tarjeta entera: el contenido de un panel se
          desplaza, y con toda la tarjeta como botón un arrastre para hacer
          scroll acabaría abriendo la ventana.
        */}
        {abrible ? (
          <button
            onClick={() => onOpen!(id!)}
            title={`Ver detalle de ${title}`}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-on-surface
                       hover:text-white transition-colors cursor-pointer"
          >
            {title}
            <Expand className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
          </button>
        ) : (
          <span className="text-[13px] font-semibold text-on-surface">{title}</span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {atajo?.url ? (
            <a
              href={atajo.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`Abrir ${atajo.label}`}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10"
            >
              <ExternalLink className="w-3 h-3 text-on-surface-variant" />
            </a>
          ) : null}
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-on-surface-variant font-mono">
              {badge}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-0.5 min-h-0">
        {children}
      </div>
    </div>
  );
}

/**
 * Ventana de detalle de un panel.
 *
 * Enseña todo lo que la API devuelve de ese subsistema, no el resumen que cabe
 * en la tarjeta. La tarjeta es para el kiosko, que se mira de lejos; esto es
 * para cuando alguien se acerca a averiguar qué está pasando.
 */
function VentanaDetalle({ id, data, onClose }: {
  id: string;
  data: OverviewData | null;
  onClose: () => void;
}) {
  // Esc cierra: en una pantalla de guardia no se busca el ratón.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onClose]);

  const SECCIONES: Record<string, { titulo: string; accent: string; contenido: unknown }> = {
    blockchain: { titulo: 'Blockchain', accent: '#00D4AA',
                  contenido: { ...(data?.blockchain ?? {}), event_pipeline: data?.event_pipeline } },
    docker:     { titulo: 'Docker / Infra', accent: '#FFD700', contenido: data?.docker },
    apps:       { titulo: 'Apps Nativas', accent: '#FF6B9D', contenido: data?.native_apps },
    api:        { titulo: 'API Backend', accent: '#5B8DEF', contenido: data?.api },
    agents:     { titulo: 'Agent Runtime', accent: '#A78BFA', contenido: data?.agent_activity },
    aegis:      { titulo: 'Aegis Security', accent: '#F59E0B', contenido: data?.aegis },
    brain:      { titulo: 'Brain / Obsidian', accent: '#22D3EE', contenido: data?.brain },
    gas:        { titulo: 'Gas Balances', accent: '#EF4444', contenido: data?.gas_balances },
  };

  const seccion = SECCIONES[id];
  if (!seccion) return null;

  const atajo = ATAJOS[id];
  const vacio = seccion.contenido == null
    || (Array.isArray(seccion.contenido) && seccion.contenido.length === 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${seccion.titulo}`}
    >
      {/* stopPropagation: sin esto, un clic dentro burbujea al fondo y cierra. */}
      <div
        className="relative w-full max-w-3xl max-h-[80vh] flex flex-col bg-surface-container-low
                   border border-white/[0.10] rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: seccion.accent }} />

        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06] shrink-0">
          <span className="text-sm font-semibold text-on-surface">{seccion.titulo}</span>
          {atajo?.url ? (
            <a href={atajo.url} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded
                          bg-white/[0.05] hover:bg-white/[0.10] text-on-surface-variant transition-colors">
              <ExternalLink className="w-3 h-3" />
              {atajo.label}
            </a>
          ) : null}
          <span className="ml-auto text-[10px] font-mono text-on-surface-variant">
            {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '—'}
          </span>
          <button onClick={onClose} title="Cerrar (Esc)"
                  className="p-1 rounded hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {vacio ? (
            <p className="text-[12px] text-on-surface-variant">
              Sin datos: este subsistema no está respondiendo.
            </p>
          ) : (
            <pre className="text-[11px] font-mono leading-relaxed text-on-surface-variant
                            whitespace-pre-wrap break-all">
              {JSON.stringify(seccion.contenido, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, status }: { label: string; value: string | number | null; status?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-[3px]">
      <span className="text-[12px] text-on-surface-variant truncate">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {status && <StatusDot status={status} />}
        <span className="text-[12px] text-on-surface font-mono tabular-nums">{value ?? '—'}</span>
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-on-surface-variant/50 italic pt-1">{children}</p>;
}

function NativeAppRow({ app }: { app: NativeAppEntry }) {
  return (
    <div className="flex items-center justify-between gap-1 py-[3px]">
      <div className="flex items-center gap-1.5 min-w-0">
        <StatusDot status={app.status} />
        <span className={`text-[12px] truncate ${app.status === 'up' ? 'text-on-surface' : 'text-red-300'}`}>
          {app.name}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {app.failures > 0 && (
          <span className="text-[10px] text-red-400 font-mono">x{app.failures}</span>
        )}
        <span className="text-[11px] text-on-surface-variant font-mono tabular-nums w-12 text-right">
          {app.latency_ms != null ? `${app.latency_ms}ms` : '—'}
        </span>
      </div>
    </div>
  );
}

function Ring({ up, total, size = 52 }: { up: number; total: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const ratio = total > 0 ? up / total : 0;
  const offset = circ * (1 - ratio);
  const color = ratio >= 0.8 ? '#00D4AA' : ratio >= 0.5 ? '#F59E0B' : '#EF4444';
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

function Clock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('es-ES', { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="text-sm font-mono tabular-nums text-on-surface-variant">{time}</span>;
}

// ════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════
export default function MonitorWarRoom() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [isKiosk, setIsKiosk] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [booting, setBooting] = useState(true);
  const [panelAbierto, setPanelAbierto] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/monitor');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setFetching(false);
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchData]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('kiosk') === '1') setIsKiosk(true);
  }, []);

  useEffect(() => {
    if (!isKiosk) return;
    document.body.style.overflow = 'hidden';
    document.body.style.cursor = 'none';
    return () => { document.body.style.overflow = ''; document.body.style.cursor = ''; };
  }, [isKiosk]);

  const toggleKiosk = () => {
    // isKiosk can become true via ?kiosk=1 without ever entering the real
    // Fullscreen API (that only sets the CSS overlay + hides the cursor).
    // Calling exitFullscreen() when the document was never fullscreen — or
    // requestFullscreen() where the API is blocked (e.g. inside an iframe
    // without the `fullscreen` permissions policy) — throws synchronously
    // in some browsers and rejects the promise in others. Guard on actual
    // fullscreenElement state and swallow rejections either way.
    if (!isKiosk) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    setIsKiosk(k => !k);
  };

  const score = useMemo(() => computeHealthScore(data), [data]);
  const alive = !error;
  const api = data?.api;
  const bc = data?.blockchain;
  const ep = data?.event_pipeline;
  const sa = data?.native_apps;
  const br = data?.brain;
  const dk = data?.docker;
  const gb = data?.gas_balances;
  const aa = data?.agent_activity;
  const edadWatchdog = antiguedad(sa?.timestamp);

  if (booting) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Conectando con BeZhas War Room…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isKiosk ? 'fixed inset-0 z-50' : ''} bg-background min-h-screen flex flex-col`}>

      {/* ═══ HEADER ═══ */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-tertiary" />
            <h1 className="text-base font-bold text-on-surface tracking-tight">BeZhas War Room</h1>
          </div>
          <div className="flex items-center gap-2">
            <LiveDot alive={alive} />
            <span className={`text-xs ${alive ? 'text-emerald-400' : 'text-red-400'}`}>
              {alive ? 'LIVE' : error}
            </span>
          </div>
          <HealthBar score={score} />
        </div>
        <div className="flex items-center gap-4">
          <Clock />
          {lastFetch && (
            <span className="text-[10px] text-on-surface-variant font-mono">
              {data?.collected_ms ?? '—'}ms
            </span>
          )}
          <button onClick={fetchData} className="p-1.5 hover:bg-white/5 rounded-md transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 text-on-surface-variant ${fetching ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={toggleKiosk} className="p-1.5 hover:bg-white/5 rounded-md transition-colors" title="Kiosk mode">
            {isKiosk
              ? <Minimize2 className="w-4 h-4 text-on-surface-variant" />
              : <Maximize2 className="w-4 h-4 text-on-surface-variant" />}
          </button>
        </div>
      </header>

      {/* ═══ HERO KPIs ═══ */}
      <div className="grid grid-cols-3 gap-3 px-5 pt-4 pb-2 shrink-0">
        <HeroCard
          label="Block Height"
          value={bc?.block_number?.toLocaleString() ?? '—'}
          sub={bc?.chain_id ? `Chain ${bc.chain_id} · ${bc.gas_price_gwei ?? '—'} gwei` : 'Blockchain L2'}
          accent="#00D4AA"
        />
        <HeroCard
          label="System Uptime"
          value={api ? formatUptime(api.uptime_s) : '—'}
          sub={`API ${api?.version ?? '—'} · ${api?.memory_mb ?? '—'} MB RAM`}
          accent="#5B8DEF"
        />
        <div className="bg-surface-container-low border border-white/[0.06] rounded-lg p-4 flex items-center gap-4">
          <Ring up={sa?.summary.up ?? 0} total={sa?.summary.total ?? 13} />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">Apps Nativas</span>
            <span className="text-2xl font-bold font-mono tabular-nums text-on-surface">
              {sa ? `${sa.summary.up}/${sa.summary.total}` : '—/13'}
            </span>
            <span className={`text-[11px] ${edadWatchdog?.obsoleto ? 'text-amber-400/90' : 'text-on-surface-variant'}`}>
              {sa
                ? `${sa.summary.down} down · ${sa.summary.flaky} flaky${edadWatchdog ? ` · ${edadWatchdog.texto}` : ''}`
                : 'Watchdog no ejecutado'}
            </span>
          </div>
        </div>
      </div>

      {/* ═══ PANEL GRID 4×2 ═══ */}
      <div className="flex-1 grid grid-cols-4 grid-rows-2 gap-3 px-5 pb-4 pt-2 min-h-0
                       max-[1280px]:grid-cols-2 max-[1280px]:grid-rows-4">

        {/* 1 — Blockchain */}
        <Panel title="Blockchain" id="blockchain" onOpen={setPanelAbierto} icon={Activity} accent="#00D4AA"
               badge={bc?.chain_id ? `Chain ${bc.chain_id}` : 'L2'}>
          <Row label="Event Listener" value={ep?.listener_active ? 'Active' : 'Inactive'}
               status={ep?.listener_active ? 'up' : 'down'} />
          <Row label="Events Received" value={ep?.events_received?.toLocaleString() ?? null} />
          <Row label="Events Indexed" value={ep?.events_indexed?.toLocaleString() ?? null} />
          <Row label="Events Failed" value={ep?.events_failed ?? null}
               status={ep && ep.events_failed > 0 ? 'flaky' : 'up'} />
          <Row label="Queue Watermark" value={ep?.queue_watermark ?? null} />
          <Row label="SSE Clients" value={ep?.sse_clients ?? null} />
          <Row label="Reconnects" value={ep?.reconnects ?? null} />
          {ep?.last_event_at && (
            <Row label="Last Event" value={new Date(ep.last_event_at).toLocaleTimeString()} />
          )}
        </Panel>

        {/* 2 — Docker / Infra */}
        <Panel title="Docker / Infra" id="docker" onOpen={setPanelAbierto} icon={Server} accent="#FFD700"
               badge={dk ? `${dk.length} targets` : '—'}>
          {dk && dk.length > 0 ? dk.map((d, i) => (
            <Row key={i} label={d.job || d.instance}
                 value={`${(d.scrape_duration_s * 1000).toFixed(0)}ms`}
                 status={d.health} />
          )) : <EmptyState>Prometheus no disponible</EmptyState>}
        </Panel>

        {/* 3 — Apps Nativas (13) */}
        <Panel title="Apps Nativas" id="apps" onOpen={setPanelAbierto} icon={Boxes} accent="#FF6B9D"
               badge={sa ? `${sa.summary.up}/${sa.summary.total}` : '13'}>
          {/*
            La antigüedad de la instantánea va ARRIBA y en ámbar cuando pasa de
            media hora. Sin esto, 13 filas en rojo de hace un mes se leen igual
            que 13 caídas ahora mismo — y llevan a buscar una avería que no
            existe, o a ignorar una que sí.
          */}
          {edadWatchdog && (
            <div className={`text-[10px] mb-1 ${edadWatchdog.obsoleto ? 'text-amber-400/90' : 'text-on-surface-variant'}`}>
              {edadWatchdog.obsoleto
                ? `⚠ Instantánea de ${edadWatchdog.texto} — ejecuta el watchdog`
                : `Actualizado ${edadWatchdog.texto}`}
            </div>
          )}
          {sa?.apps.length ? sa.apps.map((app, i) => (
            <NativeAppRow key={i} app={app} />
          )) : <EmptyState>Watchdog no ejecutado</EmptyState>}
        </Panel>

        {/* 4 — API Backend */}
        <Panel title="API Backend" id="api" onOpen={setPanelAbierto} icon={ArrowUpDown} accent="#5B8DEF"
               badge={api?.version}>
          <Row label="Status" value={api?.status ?? null} status={api?.status === 'up' ? 'up' : 'down'} />
          <Row label="Uptime" value={api ? formatUptime(api.uptime_s) : null} />
          <Row label="Memory" value={api ? `${api.memory_mb} MB` : null} />
          <Row label="PostgreSQL" value={api?.services.database ?? null} status={api?.services.database} />
          <Row label="Redis" value={api?.services.redis ?? null} status={api?.services.redis} />
          <Row label="Consumer" value={ep?.consumer_connected ? 'Connected' : 'Off'}
               status={ep?.consumer_connected ? 'up' : 'down'} />
        </Panel>

        {/* 5 — Agent Runtime (ai_logs actividad 24h) */}
        <Panel title="Agent Runtime" id="agents" onOpen={setPanelAbierto} icon={Cpu} accent="#A78BFA" badge="24h">
          {aa && aa.length > 0 ? aa.map((row, i) => (
            <Row key={i} label={row.module}
                 value={row.alerts_24h > 0 ? `${row.actions_24h} (${row.alerts_24h}⚠)` : row.actions_24h}
                 status={row.alerts_24h > 0 ? 'flaky' : 'up'} />
          )) : <EmptyState>Sin actividad en 24h</EmptyState>}
        </Panel>

        {/* 6 — Aegis Security */}
        <Panel title="Aegis Security" id="aegis" onOpen={setPanelAbierto} icon={Shield} accent="#F59E0B" badge="IA + Rules">
          {data?.aegis ? (
            Object.entries(data.aegis).slice(0, 8).map(([k, v]) => (
              <Row key={k} label={k} value={typeof v === 'object' ? JSON.stringify(v) : String(v)} />
            ))
          ) : (
            <Row label="Aegis" value="Offline" status="down" />
          )}
        </Panel>

        {/* 7 — Brain / Obsidian */}
        <Panel title="Brain / Obsidian" id="brain" onOpen={setPanelAbierto} icon={BrainCircuit} accent="#22D3EE" badge="Knowledge Graph">
          {br ? (
            <>
              <Row label="Total Calls" value={br.totals?.calls?.toLocaleString() ?? null} />
              <Row label="Tokens" value={br.totals?.tokens?.toLocaleString() ?? null} />
              <Row label="BEZ Moved" value={br.totals?.bez?.toFixed(2) ?? null} />
              {br.topFunctions?.slice(0, 4).map((f, i) => (
                <Row key={i} label={f.fn} value={f.calls} />
              ))}
            </>
          ) : (
            <Row label="Brain MCP" value="Offline" status="down" />
          )}
        </Panel>

        {/* 8 — Gas Balances */}
        <Panel title="Gas Balances" id="gas" onOpen={setPanelAbierto} icon={Fuel} accent="#EF4444" badge="Enterprise">
          {gb && gb.length > 0 ? gb.map((g, i) => (
            <Row key={i} label={g.name}
                 value={`${parseFloat(g.balance_bez).toFixed(2)} BEZ`}
                 status={parseFloat(g.balance_bez) < 1 ? 'down' : parseFloat(g.balance_bez) < 5 ? 'flaky' : 'up'} />
          )) : <EmptyState>Sin datos de gas tanks</EmptyState>}
        </Panel>

      </div>

      {/* Ventana de detalle del panel seleccionado */}
      {panelAbierto && (
        <VentanaDetalle
          id={panelAbierto}
          data={data}
          onClose={() => setPanelAbierto(null)}
        />
      )}
    </div>
  );
}
