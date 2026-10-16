import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Wind, Droplets, BatteryCharging, Plug, Settings2, ChevronDown, Power, Plus, Trash2, Copy } from 'lucide-react'
import { getTelemetry, sendControlCommand, getNodes, registerNode, revokeNode, getPendingApprovals, approveJob, rejectJob } from '../api'
import useMe from '../hooks/useMe'
import SourceBadge from '../components/SourceBadge'
import { fmtPower, fmtPct } from '../utils/units'

const TYPE_UI = {
  SOLAR: { icon: <Sun size={32} />, bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--bez-solar)', label: 'Solar' },
  WIND: { icon: <Wind size={32} />, bg: 'rgba(6, 182, 212, 0.1)', color: 'var(--bez-wind)', label: 'Eólica' },
  HYDRO: { icon: <Droplets size={32} />, bg: 'rgba(99, 102, 241, 0.1)', color: 'var(--bez-hydro)', label: 'Hidráulica' },
  BATTERY: { icon: <BatteryCharging size={32} />, bg: 'rgba(78, 222, 163, 0.1)', color: 'var(--bez-secondary)', label: 'Batería' },
  LOAD: { icon: <Plug size={32} />, bg: 'rgba(255, 107, 157, 0.1)', color: '#FF6B9D', label: 'Carga controlable' },
}

/** Comandos que el backend acepta (api/routes/energy.js → SCADA_COMMANDS), con su parámetro y límites. */
const COMMANDS = {
  CHARGE_BATTERY: { label: 'Cargar batería', param: { key: 'powerKw', unit: 'kW', def: 50, max: 500 }, types: ['BATTERY'] },
  DISCHARGE_BATTERY: { label: 'Descargar / vender', param: { key: 'powerKw', unit: 'kW', def: 50, max: 500 }, types: ['BATTERY'] },
  SHED_LOAD: { label: 'Reducir carga (aprobación)', param: { key: 'durationMin', unit: 'min', def: 60, max: 120 }, types: ['LOAD'] },
  SET_REACTIVE_POWER: { label: 'Potencia reactiva', param: { key: 'kvar', unit: 'kvar', def: 50, max: 200 }, types: ['SOLAR', 'WIND', 'HYDRO', 'BATTERY'] },
  ISLANDING_MODE: { label: 'Modo isla (aprobación)', param: { key: 'durationMin', unit: 'min', def: 30, max: 60 }, types: ['SOLAR', 'WIND', 'HYDRO', 'BATTERY', 'LOAD'] },
  EMERGENCY_STOP: { label: 'Parada de emergencia', param: null, types: ['SOLAR', 'WIND', 'HYDRO', 'BATTERY', 'LOAD'], danger: true },
}

const Scada = () => {
  const [expandedAsset, setExpandedAsset] = useState(null)
  const [data, setData] = useState(null)
  const [nodesInfo, setNodesInfo] = useState({ simulated: true, nodes: [] })
  const [error, setError] = useState(null)
  const { me } = useMe()
  const canControl = me.is_operator // operator or admin

  const load = useCallback(async () => {
    try {
      const [telemetry, nodes] = await Promise.all([getTelemetry(), getNodes()])
      if (telemetry) { setData(telemetry); setError(null) }
      setNodesInfo(nodes)
    } catch (err) {
      setError(err.message || 'SCADA telemetry backend unreachable')
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [load])

  if (error && !data) return (
    <div style={{ color: '#FF6B9D', padding: 40 }}>
      <strong>SCADA no disponible.</strong>
      <div style={{ color: '#9aa', marginTop: 8, fontSize: 14 }}>{error}</div>
      <div style={{ color: '#667', marginTop: 8, fontSize: 13 }}>Inicia sesión y comprueba el gateway. Reintentando cada 10s…</div>
    </div>
  )
  if (!data) return <div style={{ color: 'white', padding: 40 }}>Initializing SCADA Interface...</div>

  const online = data.nodes.filter((n) => n.status === 'Online').length
  const offline = data.nodes.length - online

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Settings2 size={16} color="var(--bez-secondary)" />
          <span style={{ fontSize: 10, color: 'var(--bez-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>Asset Control Center</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700 }}>Physical Infrastructure Registry</h1>
            <p style={{ color: 'var(--bez-text-sec)', marginTop: 8, maxWidth: 600 }}>
              Monitorización y despacho de tus recursos energéticos distribuidos. Cada comando se firma y se audita; sólo se da por entregado cuando un equipo lo recibe.
            </p>
          </div>
          <SourceBadge simulated={data.simulated} source={data.source} />
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <BentoStat label="Total Output" val={fmtPower(data.global.totalOutput)} color="var(--bez-primary-light)" />
        <BentoStat label="Net Flow" val={fmtPower(data.global.netFlow)} sub={data.global.netFlow >= 0 ? 'exporta a red' : 'importa de red'} color="var(--bez-solar)" />
        <BentoStat label="Active Nodes" val={`${online}/${data.nodes.length}`} sub={offline ? `${offline} sin lectura reciente` : 'todos con lectura'} color="var(--bez-text)" subColor={offline ? 'var(--bez-aegis)' : undefined} />
        <BentoStat label="Self-Sufficiency" val={fmtPct(data.global.selfSufficiency, 0)} sub={data.global.selfSufficiency == null ? 'necesita una carga conectada' : 'generación / consumo'} color="var(--bez-hydro)" />
      </section>

      {canControl && <Approvals />}

      <ConnectPlant simulated={nodesInfo.simulated} nodes={nodesInfo.nodes} onChanged={load} />

      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {data.nodes.map((node) => {
          const ui = TYPE_UI[node.type] || TYPE_UI.SOLAR
          return (
            <AssetRow key={node.id} id={node.id} name={node.name} icon={ui.icon}
              output={fmtPower(node.output)} status={node.status}
              isExpanded={expandedAsset === node.id} onToggle={() => setExpandedAsset(expandedAsset === node.id ? null : node.id)}
              bg={ui.bg} color={ui.color}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 32, padding: 32 }}>
                <div>
                  <h4 style={H4}>Diagnostic Parameters</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    <Diag val={ui.label} label="TIPO" />
                    {Object.entries(node.diagnostics).map(([key, val]) => <Diag key={key} val={val} label={key.toUpperCase()} />)}
                    {node.lastReadingAt && <Diag val={new Date(node.lastReadingAt).toLocaleTimeString()} label="ÚLTIMA LECTURA" />}
                  </div>
                </div>
                <CommandPanel node={node} canControl={canControl} />
              </div>
            </AssetRow>
          )
        })}
      </section>
    </div>
  )
}

const H4 = { fontSize: 10, color: 'var(--bez-text-muted)', textTransform: 'uppercase', letterSpacing: 2, borderBottom: '1px solid var(--bez-border)', paddingBottom: 8, marginBottom: 16 }
const input = { width: '100%', padding: '10px 12px', background: '#090d16', border: '1px solid var(--bez-border)', borderRadius: 8, color: '#fff', fontSize: 13 }

/** Comandos del nodo con su parámetro, confirmación de la parada y el resultado real (entregado / en aprobación / no entregado). */
function CommandPanel({ node, canControl }) {
  const cmds = Object.entries(COMMANDS).filter(([, c]) => c.types.includes(node.type))
  const [vals, setVals] = useState({})
  const [busy, setBusy] = useState(null)
  const [result, setResult] = useState(null)

  const run = async (name, cfg) => {
    if (cfg.danger && !window.confirm(`¿Parada de emergencia de «${node.name}»? Interrumpe el nodo de inmediato.`)) return
    const params = cfg.param ? { [cfg.param.key]: Number(vals[name] ?? cfg.param.def) } : {}
    if (cfg.param && (!(params[cfg.param.key] > 0) || params[cfg.param.key] > cfg.param.max)) {
      setResult({ kind: 'error', text: `${cfg.param.key} debe estar entre 1 y ${cfg.param.max} ${cfg.param.unit}.` }); return
    }
    setBusy(name); setResult(null)
    try {
      const r = await sendControlCommand(node.id, name, params)
      if (r.hitl_pending) setResult({ kind: 'pending', text: `En cola de aprobación humana (${r.job_id}). No se ha ejecutado.` })
      else if (r.delivered) setResult({ kind: 'ok', text: `Comando firmado y entregado al equipo (${r.transport}).` })
      else setResult({ kind: 'warn', text: r.warning || 'Comando firmado y auditado, pero no entregado.' })
    } catch (err) {
      setResult({ kind: 'error', text: err.message || 'Comando rechazado' })
    } finally { setBusy(null) }
  }

  const tone = { ok: 'var(--bez-secondary)', pending: 'var(--bez-primary)', warn: '#f59e0b', error: '#FF6B9D' }
  return (
    <div style={{ borderLeft: '1px solid var(--bez-border)', paddingLeft: 32 }}>
      <h4 style={H4}>Operational Logic</h4>
      {!canControl && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', padding: 12, borderRadius: 12, marginBottom: 12, fontSize: 11, color: 'var(--bez-solar)' }}>
          🔒 Vista de solo lectura. El despacho de comandos requiere rol de <strong>operador</strong>.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: canControl ? 1 : 0.5, pointerEvents: canControl ? 'auto' : 'none' }}>
        {cmds.map(([name, cfg]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {cfg.param && (
              <input aria-label={`${cfg.label} (${cfg.param.unit})`} type="number" min="1" max={cfg.param.max} value={vals[name] ?? cfg.param.def}
                onChange={(e) => setVals((v) => ({ ...v, [name]: e.target.value }))} style={{ ...input, width: 84, flex: 'none' }} />
            )}
            <button type="button" className="btn" disabled={busy === name} onClick={() => run(name, cfg)}
              style={{ flex: 1, padding: '10px 12px', fontSize: 12, border: `1px solid ${cfg.danger ? '#FF6B9D' : 'var(--bez-border)'}`, color: cfg.danger ? '#FF6B9D' : 'var(--bez-text)' }}>
              {busy === name ? 'Enviando…' : cfg.label}{cfg.param ? ` (${cfg.param.unit})` : ''}
            </button>
          </div>
        ))}
      </div>
      {result && <p role="status" data-testid="command-result" style={{ marginTop: 12, fontSize: 12, color: tone[result.kind] }}>{result.text}</p>}
    </div>
  )
}

/** Comandos críticos pendientes de una segunda persona (el que lo pide no puede aprobarlo él mismo). */
function Approvals() {
  const [jobs, setJobs] = useState([])
  const [msg, setMsg] = useState(null)
  const refresh = useCallback(() => getPendingApprovals().then(setJobs), [])
  useEffect(() => { refresh(); const t = setInterval(refresh, 8000); return () => clearInterval(t) }, [refresh])
  const act = async (fn, job) => {
    setMsg(null)
    try {
      const r = await fn(job.jobId)
      setMsg({ kind: r.transport === 'mock' ? 'warn' : 'ok', text: r.status === 'REJECTED' ? 'Comando rechazado.' : (r.transport === 'mock' ? 'Aprobado y firmado, pero ningún equipo lo ha recibido (sin edge MQTT).' : 'Aprobado, firmado y enviado al equipo.') })
    } catch (err) {
      setMsg({ kind: 'error', text: /self_approval/.test(err.message) ? 'No puedes aprobar tu propia petición: debe aprobarla otro operador.' : err.message })
    }
    refresh()
  }
  const tone = { ok: 'var(--bez-secondary)', warn: '#f59e0b', error: '#FF6B9D' }
  return (
    <section className="card" data-testid="approvals" style={{ padding: 24 }}>
      <h3 style={{ fontSize: 18, fontWeight: 700 }}>Aprobaciones pendientes</h3>
      <p style={{ fontSize: 12, color: 'var(--bez-text-muted)', marginTop: 4 }}>Los comandos críticos (modo isla, reducir carga) los aprueba una segunda persona con rol de operador.</p>
      {jobs.length === 0 && <p style={{ fontSize: 12, color: 'var(--bez-text-muted)', marginTop: 12 }}>No hay comandos esperando aprobación.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 8 }}>
        {jobs.map((j) => (
          <li key={j.jobId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 12px', background: 'var(--bez-surface-2)', borderRadius: 8, fontSize: 12 }}>
            <span><strong>{j.command}</strong> · {j.nodeId} · <span style={{ fontFamily: 'monospace', color: 'var(--bez-text-muted)' }}>{JSON.stringify(j.params)}</span></span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => act(approveJob, j)}>Aprobar</button>
              <button type="button" className="btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => act((id) => rejectJob(id, 'rechazado desde el panel'), j)}>Rechazar</button>
            </span>
          </li>
        ))}
      </ul>
      {msg && <p role="status" data-testid="approval-result" style={{ marginTop: 12, fontSize: 12, color: tone[msg.kind] }}>{msg.text}</p>}
    </section>
  )
}

/** Conectar una planta: alta del nodo y clave de envío (sólo se ve esta vez). */
function ConnectPlant({ simulated, nodes, onChanged }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'SOLAR', capacityKw: '', location: '', protocol: 'HTTPS' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [copied, setCopied] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      const res = await registerNode({ ...form, capacityKw: Number(form.capacityKw) })
      setCreated(res); setForm({ name: '', type: 'SOLAR', capacityKw: '', location: '', protocol: 'HTTPS' }); onChanged?.()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const remove = async (id) => {
    if (!window.confirm('¿Revocar este nodo? Su clave dejará de valer.')) return
    try { await revokeNode(id); onChanged?.() } catch (err) { setError(err.message) }
  }
  const origin = typeof window !== 'undefined' ? (import.meta.env.VITE_API_URL || 'https://api.bezhas.com/api') : ''
  const snippet = created ? `curl -X POST ${origin}/energy/telemetry/ingest \\\n  -H "Authorization: Bearer ${created.nodeKey}" -H "Content-Type: application/json" \\\n  -d '{"output_kw": 120.5, "voltage_v": 400, "grid_frequency": 50.01}'` : ''

  return (
    <section className="card" data-testid="connect-plant" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700 }}>Conectar planta</h3>
          <p style={{ fontSize: 12, color: 'var(--bez-text-muted)', marginTop: 4 }}>
            {simulated ? 'Aún no has conectado ninguna planta: los nodos de abajo son de demostración.' : `${nodes.length} planta(s) conectada(s): sus lecturas son reales.`}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => { setOpen((o) => !o); setCreated(null) }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> {open ? 'Cerrar' : 'Conectar planta'}
        </button>
      </div>

      {!simulated && nodes.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'grid', gap: 8 }}>
          {nodes.map((n) => (
            <li key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bez-surface-2)', borderRadius: 8, fontSize: 12 }}>
              <span><strong>{n.name}</strong> · {TYPE_UI[n.type]?.label || n.type} · {fmtPower(n.capacity_kw)} · <span style={{ fontFamily: 'monospace', color: 'var(--bez-text-muted)' }}>{n.id}</span></span>
              <button type="button" aria-label={`Revocar ${n.name}`} onClick={() => remove(n.id)} style={{ background: 'none', border: 0, color: '#FF6B9D', cursor: 'pointer' }}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}

      {open && !created && (
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
          <label style={{ fontSize: 11 }}>Nombre<input aria-label="Nombre de la planta" required minLength={2} maxLength={80} style={input} value={form.name} onChange={set('name')} placeholder="Parque Solar Norte" /></label>
          <label style={{ fontSize: 11 }}>Tipo
            <select aria-label="Tipo de nodo" style={input} value={form.type} onChange={set('type')}>
              {Object.entries(TYPE_UI).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 11 }}>Capacidad (kW)<input aria-label="Capacidad en kW" required type="number" min="1" max="2000000" style={input} value={form.capacityKw} onChange={set('capacityKw')} placeholder="5000" /></label>
          <label style={{ fontSize: 11 }}>Ubicación<input aria-label="Ubicación" maxLength={120} style={input} value={form.location} onChange={set('location')} placeholder="Algeciras" /></label>
          <label style={{ fontSize: 11 }}>Protocolo
            <select aria-label="Protocolo" style={input} value={form.protocol} onChange={set('protocol')}>
              {['HTTPS', 'MQTT', 'MODBUS', 'OPC-UA', 'IEC-104'].map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%' }}>{busy ? 'Creando…' : 'Crear nodo'}</button></div>
        </form>
      )}
      {error && <p role="alert" style={{ color: '#FF6B9D', fontSize: 12, marginTop: 12 }}>{error}</p>}

      {created && (
        <div style={{ marginTop: 16, padding: 16, border: '1px solid var(--bez-primary)', borderRadius: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700 }}>Nodo {created.node.id} creado. Guarda su clave ahora: no se vuelve a mostrar.</p>
          <code data-testid="node-key" style={{ display: 'block', margin: '8px 0', padding: 10, background: '#090d16', borderRadius: 8, fontSize: 12, wordBreak: 'break-all' }}>{created.nodeKey}</code>
          <pre style={{ fontSize: 11, background: '#090d16', padding: 10, borderRadius: 8, overflowX: 'auto', margin: '8px 0' }}>{snippet}</pre>
          <button type="button" className="btn" onClick={async () => { try { await navigator.clipboard.writeText(snippet); setCopied(true) } catch { /* sin portapapeles */ } }} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <Copy size={14} /> {copied ? 'Copiado' : 'Copiar el comando'}
          </button>
          <p style={{ fontSize: 11, color: 'var(--bez-text-muted)', marginTop: 8 }}>
            El nodo envía sus lecturas (máx. una por segundo). Una lectura imposible (p. ej. más potencia que la capacidad declarada) se rechaza.
          </p>
        </div>
      )}
    </section>
  )
}

const BentoStat = ({ label, val, sub, color, subColor }) => (
  <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
    <span style={{ fontSize: 10, color: 'var(--bez-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>
    <div style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 28, fontWeight: 700, color: color || 'white' }}>{val}</h3>
      {sub && <p style={{ fontSize: 12, color: subColor || 'var(--bez-text-muted)', fontFamily: 'monospace', marginTop: 4 }}>{sub}</p>}
    </div>
  </div>
)

const AssetRow = ({ id, name, icon, output, status, children, isExpanded, onToggle, bg, color }) => (
  <div className="card" style={{ padding: 0, overflow: 'hidden', border: isExpanded ? `1px solid ${color}` : '1px solid var(--bez-border)' }}>
    <button type="button" aria-expanded={isExpanded} onClick={onToggle}
      style={{ width: '100%', textAlign: 'left', color: 'inherit', padding: 24, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', background: isExpanded ? 'rgba(0, 98, 255, 0.05)' : 'none', border: 0, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {React.cloneElement(icon, { color: 'currentColor' })}
        </div>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 700 }}>{name}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: status === 'Online' ? 'var(--bez-secondary)' : (status === 'Offline' ? 'var(--bez-aegis)' : 'var(--bez-solar)'), background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}></span>{status}
            </span>
            <span style={{ fontSize: 10, color: 'var(--bez-text-muted)', fontFamily: 'monospace' }}>ID: {id}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 10, color: 'var(--bez-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Current Output</span>
          <span style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: 'var(--bez-primary-light)' }}>{output}</span>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '10px 16px', borderRadius: 8, background: isExpanded ? 'var(--bez-primary)' : 'var(--bez-surface-3)', color: isExpanded ? 'white' : 'var(--bez-text-sec)' }}>
          {isExpanded ? <><Power size={16} /> REMOTE CONTROL</> : <><ChevronDown size={16} /> DETAILS</>}
        </span>
      </div>
    </button>
    <AnimatePresence>
      {isExpanded && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', borderTop: '1px solid var(--bez-border)' }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
)

const Diag = ({ val, label }) => (
  <div>
    <span style={{ fontSize: 11, color: 'var(--bez-text-muted)', display: 'block', marginBottom: 4 }}>{label}</span>
    <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>{val}</span>
  </div>
)

export default Scada
