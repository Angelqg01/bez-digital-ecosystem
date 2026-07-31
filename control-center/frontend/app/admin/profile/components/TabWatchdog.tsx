'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Activity, AlertTriangle, CheckCircle2, ExternalLink, Power, PowerOff, PlayCircle, RefreshCw, Wrench, X, Loader2 } from 'lucide-react';

type AppStatus = {
  name: string;
  url: string;
  service?: string | null;
  status: 'up' | 'down' | 'flaky' | 'unknown';
  httpStatus?: number | null;
  latencyMs?: number | null;
  error?: string | null;
  consecutiveFailures?: number;
  checkedAt?: string;
};

type Snapshot = {
  status: string;
  timestamp?: string;
  summary: { total: number; up: number; down: number; flaky: number; unknown?: number };
  apps: AppStatus[];
  message?: string;
};

type CloudRunState = {
  service: string;
  ok: boolean;
  running?: boolean;
  maxInstances?: number | null;
  error?: string;
};

type CloudRunDetail = {
  service: string;
  ok: boolean;
  error?: string;
  running?: boolean;
  url?: string | null;
  project?: string;
  region?: string;
  image?: string | null;
  port?: number | null;
  containerConcurrency?: number | null;
  timeoutSeconds?: number | null;
  serviceAccount?: string | null;
  cpu?: string | null;
  memory?: string | null;
  minInstances?: number | null;
  maxInstances?: number | null;
  cpuThrottling?: string | null;
  executionEnvironment?: string | null;
  latestReadyRevision?: string | null;
  latestCreatedRevision?: string | null;
  lastModifier?: string | null;
  creationTimestamp?: string | null;
  traffic?: { revision: string; percent: number }[];
  conditions?: { type?: string; status?: string; message?: string | null }[];
  env?: { name: string; value: string }[];
  secretEnv?: string[];
};

type DetailPayload = {
  status: string;
  app?: { name: string; url: string; healthPath: string | null; service: string };
  ping?: AppStatus | null;
  cloudRun?: CloudRunDetail;
  error?: string;
};

const POLL_MS = 15_000;

const STATUS_STYLE: Record<AppStatus['status'], string> = {
  up: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  down: 'border-red-500/30 bg-red-500/10 text-red-300',
  flaky: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  unknown: 'border-white/10 bg-white/5 text-gray-400',
};

const ROADMAP = [
  { label: 'Watchdog real (ping paralelo + anti-flapping + alertas Discord/Telegram)', done: true },
  { label: 'Endpoint /health ligero en nginx de las SubApps estáticas', done: true, note: 'Requiere redeploy de cada SubApp para tomar efecto — hoy hace fallback a "/".' },
  { label: 'Fix sync-daemon (crasheaba por ESM/CJS + rutas ROOT apuntaban mal)', done: true },
  { label: 'sync-daemon: skip por hash + backup .bak + sync.log (reglas CLAUDE.md nunca implementadas)', done: true },
  { label: 'Panel Admin de monitor en vivo', done: true },
  { label: 'Encender/Apagar cada SubApp de verdad (Cloud Run maxInstances vía gcloud)', done: true, note: 'Real, no simulado — pero necesita gcloud funcional en este equipo (ver banner si falla).' },
  { label: 'Cron/scheduled task que corra el watchdog en continuo en producción', done: false, note: 'Hoy es manual: `pnpm watchdog:subapps` o el botón "Comprobar ahora".' },
];

async function callAction(action: string, extra?: Record<string, unknown>) {
  const res = await fetch('/api/admin/watchdog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
}

export default function TabWatchdog() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [lastLog, setLastLog] = useState<string | null>(null);
  const [cloudRun, setCloudRun] = useState<Record<string, CloudRunState>>({});
  const [cloudRunError, setCloudRunError] = useState<string | null>(null);
  const [cloudRunLoading, setCloudRunLoading] = useState(false);
  const [pendingService, setPendingService] = useState<string | null>(null);
  const [detailApp, setDetailApp] = useState<AppStatus | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/watchdog', { cache: 'no-store' });
      const data = await res.json();
      setSnapshot(data);
    } catch {
      setSnapshot((prev) => prev ?? { status: 'error', summary: { total: 0, up: 0, down: 0, flaky: 0 }, apps: [] });
    }
  }, []);

  const loadCloudRunState = useCallback(async () => {
    setCloudRunLoading(true);
    setCloudRunError(null);
    try {
      const result = await callAction('cloud_run_status_all');
      if (result.status === 'error') {
        setCloudRunError(result.error || 'Error desconocido consultando Cloud Run.');
        return;
      }
      const map: Record<string, CloudRunState> = {};
      for (const s of result.services || []) {
        map[s.service] = s;
        if (!s.ok && s.error) setCloudRunError((prev) => prev || s.error);
      }
      setCloudRun(map);
    } catch (err) {
      setCloudRunError(err instanceof Error ? err.message : 'Error de red consultando Cloud Run.');
    } finally {
      setCloudRunLoading(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  const runAction = async (action: string) => {
    setRunningAction(action);
    setLoading(true);
    try {
      const result = await callAction(action);
      setLastLog(result.log || null);
      if (action === 'run_watchdog_once') {
        setSnapshot(result);
      } else {
        await poll();
      }
    } finally {
      setLoading(false);
      setRunningAction(null);
    }
  };

  const toggleService = async (service: string, appName: string, turnOn: boolean) => {
    if (!turnOn && !window.confirm(`Vas a APAGAR ${appName} de verdad (Cloud Run, maxInstances=0). ¿Continuar?`)) return;
    setPendingService(service);
    try {
      const result = await callAction(turnOn ? 'cloud_run_start' : 'cloud_run_stop', { service });
      if (result.status !== 'ok') {
        setCloudRunError(result.log || result.error || `No se pudo ${turnOn ? 'encender' : 'apagar'} ${service}.`);
      }
      await loadCloudRunState();
    } finally {
      setPendingService(null);
    }
  };

  const openDetail = async (app: AppStatus) => {
    setDetailApp(app);
    setDetail(null);
    if (!app.service) return;
    setDetailLoading(true);
    try {
      const result = await callAction('cloud_run_detail', { service: app.service });
      setDetail(result);
    } catch (err) {
      setDetail({ status: 'error', error: err instanceof Error ? err.message : 'Error de red.' });
    } finally {
      setDetailLoading(false);
    }
  };

  const summary = snapshot?.summary || { total: 0, up: 0, down: 0, flaky: 0, unknown: 0 };
  const allDown = summary.total > 0 && summary.down === summary.total;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter uppercase mb-2">Watchdog · SubApps</h2>
          <p className="text-gray-400 text-sm max-w-3xl">
            Ping en vivo a las 13 SubApps (*.bez.digital / Cloud Run). Marca DOWN tras 2 fallos consecutivos para evitar falsas alarmas,
            y alerta por Discord/Telegram si hay webhook configurado. Encender/Apagar controla el servicio Cloud Run real.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => runAction('run_watchdog_once')}
            disabled={loading}
            className="flex items-center gap-2 border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50"
          >
            <PlayCircle size={14} className={runningAction === 'run_watchdog_once' ? 'animate-spin' : ''} />
            Comprobar ahora
          </button>
          <button
            onClick={() => runAction('run_sync_once')}
            disabled={loading}
            className="flex items-center gap-2 border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-violet-300 hover:bg-violet-500/20 disabled:opacity-50"
          >
            <Wrench size={14} className={runningAction === 'run_sync_once' ? 'animate-spin' : ''} />
            Sync ABI ahora
          </button>
          <button
            onClick={() => loadCloudRunState()}
            disabled={cloudRunLoading}
            className="flex items-center gap-2 border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <Power size={14} className={cloudRunLoading ? 'animate-spin' : ''} />
            Estado Cloud Run
          </button>
          <button onClick={() => poll()} className="flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-300 hover:bg-white/10">
            <RefreshCw size={14} /> Recargar
          </button>
        </div>
      </div>

      {allDown && (
        <div className="flex items-start gap-3 border border-red-500/40 bg-red-500/10 p-4 text-red-200">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <div className="text-sm">
            <strong>Las 13 SubApps están caídas (5xx) ahora mismo.</strong> Coincide con la auditoría previa — ningún proceso las reinicia
            automáticamente todavía. Usa &quot;Estado Cloud Run&quot; y los botones de cada tarjeta para encenderlas, o revisa Cloud Run
            (proyecto <code className="text-red-100">totemic-bonus-479312-c6</code>) manualmente.
          </div>
        </div>
      )}

      {cloudRunError && (
        <div className="flex items-start gap-3 border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <div className="text-sm">
            <strong>gcloud no responde en este equipo.</strong> Los botones de encender/apagar son reales (llaman a{' '}
            <code className="text-amber-100">gcloud run services update</code>) pero fallarán hasta que se repare la instalación local de gcloud.
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-[11px] text-amber-100">{cloudRunError}</pre>
          </div>
        </div>
      )}

      {snapshot?.message && (
        <div className="border border-white/10 bg-white/5 p-4 text-sm text-gray-400">{snapshot.message}</div>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {[
          { label: 'Total', value: summary.total, accent: 'text-gray-200' },
          { label: 'Up', value: summary.up, accent: 'text-emerald-300' },
          { label: 'Down', value: summary.down, accent: 'text-red-300' },
          { label: 'Flaky', value: summary.flaky, accent: 'text-amber-300' },
          { label: 'Última corrida', value: snapshot?.timestamp ? new Date(snapshot.timestamp).toLocaleTimeString('es-ES') : '—', accent: 'text-cyan-300' },
        ].map(({ label, value, accent }) => (
          <div key={label} className="border border-white/10 bg-white/5 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</div>
            <div className={`mt-3 text-2xl font-black ${accent}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {snapshot?.apps?.map((app) => {
          const cr = app.service ? cloudRun[app.service] : undefined;
          const isPending = pendingService === app.service;
          return (
            <div key={app.name} className="border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-cyan-500/30">
              <button onClick={() => openDetail(app)} className="w-full text-left" title={`Ver parámetros de ${app.name}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-white hover:text-cyan-300">{app.name}</span>
                  <span className={`flex items-center gap-1 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${STATUS_STYLE[app.status]}`}>
                    {app.status === 'up' ? <CheckCircle2 size={12} /> : app.status === 'down' ? <AlertTriangle size={12} /> : <Activity size={12} />}
                    {app.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-gray-500">
                  <span>HTTP {app.httpStatus ?? '—'}</span>
                  <span>{app.latencyMs != null ? `${app.latencyMs}ms` : '—'}</span>
                  <span>{app.consecutiveFailures ? `${app.consecutiveFailures} fallos` : ''}</span>
                </div>
                {app.error && <div className="mt-1 truncate text-[10px] text-red-400">{app.error}</div>}
                <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-cyan-400/70">Ver parámetros →</div>
              </button>
              <a href={app.url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 truncate text-[11px] text-gray-500 hover:text-cyan-300">
                <ExternalLink size={11} className="shrink-0" />
                <span className="truncate">{app.url}</span>
              </a>

              {app.service && (
                <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="text-[10px] uppercase tracking-widest text-gray-500">
                    {cr === undefined ? 'Cloud Run: sin consultar' : cr.ok ? (cr.running ? `Cloud Run: ON (max ${cr.maxInstances})` : 'Cloud Run: OFF') : 'Cloud Run: error'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleService(app.service as string, app.name, true)}
                      disabled={isPending}
                      title={`Encender ${app.name}`}
                      className="flex items-center gap-1 border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
                    >
                      <Power size={11} className={isPending ? 'animate-spin' : ''} /> On
                    </button>
                    <button
                      onClick={() => toggleService(app.service as string, app.name, false)}
                      disabled={isPending}
                      title={`Apagar ${app.name}`}
                      className="flex items-center gap-1 border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-bold uppercase text-red-300 hover:bg-red-500/20 disabled:opacity-40"
                    >
                      <PowerOff size={11} className={isPending ? 'animate-spin' : ''} /> Off
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lastLog && (
        <details className="border border-white/10 bg-black/30 p-4 text-xs text-gray-400">
          <summary className="cursor-pointer font-bold uppercase tracking-widest text-gray-300">Salida del último comando</summary>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{lastLog}</pre>
        </details>
      )}

      {detailApp && (
        <DetailModal
          app={detailApp}
          detail={detail}
          loading={detailLoading}
          crState={detailApp.service ? cloudRun[detailApp.service] : undefined}
          pending={pendingService === detailApp.service}
          onToggle={(on) => detailApp.service && toggleService(detailApp.service, detailApp.name, on)}
          onClose={() => { setDetailApp(null); setDetail(null); }}
        />
      )}

      <section className="border border-white/10 bg-white/[0.03] p-5">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-white">Bitácora de esta build</h3>
        <ul className="space-y-2">
          {ROADMAP.map((item) => (
            <li key={item.label} className="flex items-start gap-3 text-xs">
              {item.done
                ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                : <Activity size={16} className="mt-0.5 shrink-0 text-amber-400" />}
              <div>
                <span className={item.done ? 'text-gray-200' : 'text-amber-200'}>{item.label}</span>
                {item.note && <div className="mt-0.5 text-[11px] text-gray-500">{item.note}</div>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-1.5 text-xs">
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="text-right font-mono text-gray-200 break-all">{value ?? '—'}</span>
    </div>
  );
}

function DetailModal({
  app, detail, loading, crState, pending, onToggle, onClose,
}: {
  app: AppStatus;
  detail: DetailPayload | null;
  loading: boolean;
  crState?: CloudRunState;
  pending: boolean;
  onToggle: (on: boolean) => void;
  onClose: () => void;
}) {
  const cr = detail?.cloudRun;
  const ping = detail?.ping || app;
  const running = cr?.ok ? cr.running : crState?.running;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-auto border border-white/10 bg-[#0b0c15] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0b0c15]/95 px-6 py-4 backdrop-blur">
          <div>
            <h3 className="text-xl font-black italic uppercase tracking-tight text-white">{app.name}</h3>
            <p className="text-[11px] uppercase tracking-widest text-gray-500">Parámetros de funcionamiento</p>
          </div>
          <div className="flex items-center gap-2">
            {app.service && (
              <>
                <button
                  onClick={() => onToggle(true)}
                  disabled={pending}
                  className="flex items-center gap-1 border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
                >
                  <Power size={12} className={pending ? 'animate-spin' : ''} /> Encender
                </button>
                <button
                  onClick={() => onToggle(false)}
                  disabled={pending}
                  className="flex items-center gap-1 border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase text-red-300 hover:bg-red-500/20 disabled:opacity-40"
                >
                  <PowerOff size={12} className={pending ? 'animate-spin' : ''} /> Apagar
                </button>
              </>
            )}
            <button onClick={onClose} className="border border-white/10 bg-white/5 p-1.5 text-gray-400 hover:bg-white/10 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {/* Estado en vivo (ping) — always available, no gcloud needed */}
          <section>
            <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-300">
              <Activity size={14} /> Estado en vivo (watchdog)
            </h4>
            <div className={`mb-3 inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${STATUS_STYLE[ping.status]}`}>
              {ping.status}
            </div>
            <Row label="URL" value={<a href={app.url} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline">{app.url}</a>} />
            <Row label="Health path" value={detail?.app?.healthPath || '/ (fallback)'} />
            <Row label="HTTP status" value={ping.httpStatus ?? '—'} />
            <Row label="Latencia" value={ping.latencyMs != null ? `${ping.latencyMs} ms` : '—'} />
            <Row label="Fallos consecutivos" value={ping.consecutiveFailures ?? 0} />
            <Row label="Último check" value={ping.checkedAt ? new Date(ping.checkedAt).toLocaleString('es-ES') : '—'} />
            {ping.error && <Row label="Error" value={<span className="text-red-400">{ping.error}</span>} />}
          </section>

          {/* Cloud Run params */}
          <section>
            <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-300">
              <Power size={14} /> Configuración Cloud Run
              {running != null && (
                <span className={`ml-1 border px-1.5 py-0.5 text-[9px] ${running ? 'border-emerald-500/40 text-emerald-300' : 'border-red-500/40 text-red-300'}`}>
                  {running ? 'ON' : 'OFF'}
                </span>
              )}
            </h4>

            {loading && (
              <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
                <Loader2 size={16} className="animate-spin" /> Consultando gcloud…
              </div>
            )}

            {!loading && !app.service && (
              <p className="py-4 text-xs text-gray-500">Esta SubApp no tiene un servicio Cloud Run mapeado en subapps.json.</p>
            )}

            {!loading && cr && !cr.ok && (
              <div className="border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                No se pudo leer Cloud Run (gcloud):
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[11px]">{cr.error}</pre>
              </div>
            )}

            {!loading && cr && cr.ok && (
              <div>
                <Row label="Servicio" value={cr.service} />
                <Row label="Proyecto" value={cr.project} />
                <Row label="Región" value={cr.region} />
                <Row label="Imagen" value={cr.image} />
                <Row label="Puerto" value={cr.port} />
                <Row label="CPU / Memoria" value={`${cr.cpu || '—'} / ${cr.memory || '—'}`} />
                <Row label="Instancias (min/max)" value={`${cr.minInstances ?? '—'} / ${cr.maxInstances ?? '—'}`} />
                <Row label="Concurrencia" value={cr.containerConcurrency} />
                <Row label="Timeout" value={cr.timeoutSeconds != null ? `${cr.timeoutSeconds}s` : '—'} />
                <Row label="CPU throttling" value={cr.cpuThrottling} />
                <Row label="Entorno" value={cr.executionEnvironment} />
                <Row label="Service account" value={cr.serviceAccount} />
                <Row label="Revisión activa" value={cr.latestReadyRevision} />
                <Row label="Última revisión" value={cr.latestCreatedRevision} />
                <Row label="Modificado por" value={cr.lastModifier} />
                <Row label="Creado" value={cr.creationTimestamp ? new Date(cr.creationTimestamp).toLocaleString('es-ES') : '—'} />

                {cr.traffic && cr.traffic.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">Tráfico</div>
                    {cr.traffic.map((t, i) => (
                      <Row key={i} label={t.revision} value={`${t.percent}%`} />
                    ))}
                  </div>
                )}

                {cr.env && cr.env.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">Variables de entorno</div>
                    {cr.env.map((e) => <Row key={e.name} label={e.name} value={e.value} />)}
                  </div>
                )}

                {cr.secretEnv && cr.secretEnv.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">Secretos (Secret Manager — valores nunca expuestos)</div>
                    <div className="flex flex-wrap gap-1.5">
                      {cr.secretEnv.map((name) => (
                        <span key={name} className="border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 font-mono text-[10px] text-amber-300">{name}</span>
                      ))}
                    </div>
                  </div>
                )}

                {cr.conditions && cr.conditions.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">Condiciones</div>
                    {cr.conditions.map((c, i) => (
                      <Row key={i} label={c.type || '—'} value={<span className={c.status === 'True' ? 'text-emerald-300' : 'text-red-300'}>{c.status}{c.message ? ` · ${c.message}` : ''}</span>} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
