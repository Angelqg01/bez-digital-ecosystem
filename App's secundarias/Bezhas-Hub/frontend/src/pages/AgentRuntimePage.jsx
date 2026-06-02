/**
 * BeZhas-Hub — AgentRuntimePage
 * Dashboard principal de control del Agent Runtime.
 * Ruta: /dashboard/agents
 *
 * Design system BeZhas:
 *   bg:     #03060E   surface: #070D1A   border: rgba(0,200,150,0.15)
 *   teal:   #00C896   gold:    #FFB800   red:    #FF4D6A
 *   fonts:  JetBrains Mono (monospace) / Syne (headings) / Inter (body)
 */

import { useState } from 'react';
import { useAgentRuntime } from '../hooks/useAgentRuntime';

// ─── Design tokens ────────────────────────────────────────
const C = {
  bg:       '#03060E',
  surface:  '#070D1A',
  surface2: '#0A1225',
  teal:     '#00C896',
  tealDim:  'rgba(0,200,150,0.12)',
  tealBrd:  'rgba(0,200,150,0.20)',
  gold:     '#FFB800',
  goldDim:  'rgba(255,184,0,0.10)',
  red:      '#FF4D6A',
  redDim:   'rgba(255,77,106,0.12)',
  muted:    '#3A4A60',
  text:     '#C8D8F0',
  textDim:  '#6B8099',
};

const STATUS_COLOR = {
  idle:    C.teal,
  running: C.gold,
  error:   C.red,
  paused:  C.muted,
};

const TASK_COLOR = {
  completed: C.teal,
  running:   C.gold,
  failed:    C.red,
  queued:    C.muted,
};

const SEVERITY_LABEL = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const SEVERITY_COLOR = ['#4ADE80', C.gold, '#FB923C', C.red];

// ─── Sub-components ───────────────────────────────────────

function PulsingDot({ color }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: 8, height: 8 }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: color, opacity: 0.4,
        animation: 'bezPulse 1.8s ease-in-out infinite',
      }} />
      <span style={{ position: 'absolute', inset: 2, borderRadius: '50%', background: color }} />
    </span>
  );
}

function Badge({ label, color }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11,
      fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em',
      background: color + '22', color, border: `1px solid ${color}44`,
      textTransform: 'uppercase',
    }}>{label}</span>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.tealBrd}`,
      borderRadius: 12, padding: '20px 24px',
      position: 'relative', overflow: 'hidden', ...style,
    }}>
      {/* Scan line effect */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${C.teal}66, transparent)`,
      }} />
      {children}
    </div>
  );
}

function SectionTitle({ children, icon }) {
  return (
    <h2 style={{
      fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700,
      color: C.teal, letterSpacing: '0.15em', textTransform: 'uppercase',
      margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {icon && <span>{icon}</span>}{children}
    </h2>
  );
}

// ─── Agent Card ───────────────────────────────────────────

function AgentCard({ agent }) {
  const color = STATUS_COLOR[agent.status] || C.muted;
  return (
    <div style={{
      background: C.surface2, border: `1px solid ${color}33`,
      borderRadius: 10, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'border-color 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PulsingDot color={color} />
        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: C.text }}>
          {agent.name}
        </span>
        <Badge label={agent.status} color={color} />
      </div>

      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.textDim }}>
        ID: {agent.id}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {(agent.capabilities || []).map(cap => (
          <span key={cap} style={{
            padding: '2px 6px', borderRadius: 3, fontSize: 10,
            background: C.tealDim, color: C.teal,
            fontFamily: 'JetBrains Mono, monospace',
          }}>{cap}</span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: C.textDim }}>
        <span>✅ {agent.tasksExecuted || 0} completadas</span>
        <span>❌ {agent.tasksFailed || 0} fallidas</span>
      </div>
    </div>
  );
}

// ─── Task Row ─────────────────────────────────────────────

function TaskRow({ task }) {
  const color = TASK_COLOR[task.status] || C.muted;
  const ago   = task.createdAt
    ? Math.round((Date.now() - new Date(task.createdAt)) / 1000) + 's'
    : '—';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 140px 80px 60px',
      alignItems: 'center', padding: '10px 0',
      borderBottom: `1px solid ${C.tealBrd}`,
      fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color, fontSize: 14 }}>●</span>
        <span style={{ color: C.text }}>{task.type}</span>
        <span style={{ color: C.textDim, fontSize: 11 }}>#{task.id?.slice(-6)}</span>
      </div>
      <div>
        <Badge label={task.status} color={color} />
      </div>
      <div style={{ color: C.textDim }}>
        <Badge label={task.priority || 'normal'} color={task.priority === 'critical' ? C.red : C.muted} />
      </div>
      <div style={{ color: C.textDim, textAlign: 'right' }}>{ago}</div>
    </div>
  );
}

// ─── HITL Card ────────────────────────────────────────────

function HITLCard({ item, onApprove, onReject }) {
  const [loading, setLoading] = useState(false);

  const handle = async (approve) => {
    setLoading(true);
    await (approve ? onApprove(item.taskId) : onReject(item.taskId));
    setLoading(false);
  };

  return (
    <div style={{
      background: C.goldDim, border: `1px solid ${C.gold}44`,
      borderRadius: 10, padding: '16px 18px',
      animation: 'bezGlow 2s ease-in-out infinite',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 4 }}>
            👤 {item.context?.title || 'Confirmación requerida'}
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.textDim }}>
            Agente: {item.context?.agent} · ID: {item.taskId?.slice(-8)}
          </div>
        </div>
        <Badge label="HITL" color={C.gold} />
      </div>

      {item.context?.description && (
        <p style={{ fontSize: 12, color: C.text, margin: '0 0 14px', lineHeight: 1.5 }}>
          {item.context.description}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => handle(true)} disabled={loading} style={{
          flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${C.teal}`,
          background: C.tealDim, color: C.teal, fontFamily: 'Syne, sans-serif',
          fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}>
          ✅ Aprobar
        </button>
        <button onClick={() => handle(false)} disabled={loading} style={{
          flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${C.red}`,
          background: C.redDim, color: C.red, fontFamily: 'Syne, sans-serif',
          fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}>
          ❌ Rechazar
        </button>
      </div>
    </div>
  );
}

// ─── AEGIS Alert Row ──────────────────────────────────────

function AegisAlertRow({ alert }) {
  const sev   = alert.severity || 0;
  const color = SEVERITY_COLOR[sev] || SEVERITY_COLOR[0];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '80px 1fr 60px 80px',
      alignItems: 'center', padding: '10px 0',
      borderBottom: `1px solid ${C.tealBrd}`,
      fontSize: 12,
    }}>
      <Badge label={SEVERITY_LABEL[sev]} color={color} />
      <div style={{ fontFamily: 'JetBrains Mono, monospace', color: C.text }}>
        {alert.threatType}
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', color: C.teal, textAlign: 'center' }}>
        {alert.mlScore ? `${(alert.mlScore * 100).toFixed(0)}%` : '—'}
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', color: C.textDim, textAlign: 'right', fontSize: 11 }}>
        {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString('es-ES') : '—'}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────

export default function AgentRuntimePage() {
  const {
    agents, tasks, hitlQueue, aegisAlerts,
    connected, loading, dispatchTask, resolveHITL, refresh,
  } = useAgentRuntime();

  const [activeTab, setActiveTab] = useState('agents'); // agents | tasks | aegis

  const stats = {
    idle:    agents.filter(a => a.status === 'idle').length,
    running: agents.filter(a => a.status === 'running').length,
    queued:  tasks.filter(t => t.status === 'queued').length,
    done:    tasks.filter(t => t.status === 'completed').length,
    critical: aegisAlerts.filter(a => a.severity >= 3).length,
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: C.teal, fontFamily: 'JetBrains Mono, monospace' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⬡</div>
          <div>Conectando al Agent Runtime...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Inter, sans-serif' }}>

      {/* Global styles */}
      <style>{`
        @keyframes bezPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes bezGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,184,0,0); }
          50% { box-shadow: 0 0 20px 0 rgba(255,184,0,0.08); }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.tealBrd}; border-radius: 2px; }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{
              fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 800,
              color: C.text, margin: 0, letterSpacing: '-0.02em',
            }}>
              Agent Runtime
            </h1>
            <p style={{ margin: '4px 0 0', color: C.textDim, fontSize: 13 }}>
              BeZhas-Hub — Control Panel
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: connected ? C.teal : C.red }}>
              <PulsingDot color={connected ? C.teal : C.red} />
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {connected ? 'Runtime conectado' : 'Sin conexión'}
              </span>
            </div>

            <button onClick={refresh} style={{
              padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.tealBrd}`,
              background: C.tealDim, color: C.teal, cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
            }}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Agentes Idle',   value: stats.idle,    color: C.teal },
            { label: 'Ejecutando',     value: stats.running, color: C.gold },
            { label: 'Cola',           value: stats.queued,  color: C.textDim },
            { label: 'Completadas',    value: stats.done,    color: C.teal },
            { label: 'HITL Pendientes', value: hitlQueue.length, color: hitlQueue.length > 0 ? C.gold : C.textDim },
          ].map(({ label, value, color }) => (
            <Card key={label} style={{ padding: '14px 18px' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 700, color }}>{value}</div>
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
            </Card>
          ))}
        </div>

        {/* ── HITL Queue — always visible if pending ── */}
        {hitlQueue.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
              fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700,
              color: C.gold, letterSpacing: '0.15em', textTransform: 'uppercase',
            }}>
              <PulsingDot color={C.gold} />
              Confirmaciones Pendientes ({hitlQueue.length})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
              {hitlQueue.map(item => (
                <HITLCard
                  key={item.taskId}
                  item={item}
                  onApprove={(id) => resolveHITL(id, true)}
                  onReject={(id)  => resolveHITL(id, false)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: `1px solid ${C.tealBrd}` }}>
          {[
            { id: 'agents', label: `🤖 Agentes (${agents.length})` },
            { id: 'tasks',  label: `📋 Tareas (${tasks.length})` },
            { id: 'aegis',  label: `🛡️ AEGIS${stats.critical > 0 ? ` (${stats.critical} críticas)` : ''}` },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '10px 20px', background: 'none', border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${C.teal}` : '2px solid transparent',
              color: activeTab === tab.id ? C.teal : C.textDim,
              fontFamily: 'Syne, sans-serif', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s', marginBottom: -1,
            }}>{tab.label}</button>
          ))}
        </div>

        {/* ── Tab content ── */}
        {activeTab === 'agents' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {agents.length === 0
              ? <p style={{ color: C.textDim, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>Sin agentes registrados</p>
              : agents.map(a => <AgentCard key={a.id} agent={a} />)
            }
          </div>
        )}

        {activeTab === 'tasks' && (
          <Card>
            <SectionTitle icon="📋">Cola de Tareas</SectionTitle>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 140px 80px 60px',
              fontSize: 10, color: C.textDim, fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '0 0 8px', borderBottom: `1px solid ${C.tealBrd}`,
            }}>
              <span>Tipo / ID</span><span>Estado</span><span>Prioridad</span><span style={{ textAlign: 'right' }}>Hace</span>
            </div>
            {tasks.length === 0
              ? <p style={{ color: C.textDim, fontSize: 13, marginTop: 12 }}>Sin tareas recientes</p>
              : tasks.map(t => <TaskRow key={t.id} task={t} />)
            }
          </Card>
        )}

        {activeTab === 'aegis' && (
          <Card>
            <SectionTitle icon="🛡️">AEGIS — Security Monitor</SectionTitle>
            <div style={{
              display: 'grid', gridTemplateColumns: '80px 1fr 60px 80px',
              fontSize: 10, color: C.textDim, fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '0 0 8px', borderBottom: `1px solid ${C.tealBrd}`,
            }}>
              <span>Severidad</span><span>Tipo de Amenaza</span><span style={{ textAlign: 'center' }}>Score ML</span><span style={{ textAlign: 'right' }}>Hora</span>
            </div>
            {aegisAlerts.length === 0
              ? <p style={{ color: C.teal, fontSize: 13, marginTop: 12 }}>✅ Sin alertas activas</p>
              : aegisAlerts.map((a, i) => <AegisAlertRow key={i} alert={a} />)
            }
          </Card>
        )}

      </div>
    </div>
  );
}
