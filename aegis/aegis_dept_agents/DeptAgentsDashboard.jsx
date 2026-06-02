/**
 * BeZhas Control Center — Department Agents Dashboard
 * Panel de monitorización en tiempo real de los 10 agentes departamentales.
 *
 * Ruta sugerida: control-center/frontend/app/dashboard/dept-agents/page.jsx
 *
 * Características:
 *   - SSE real-time updates (EventSource)
 *   - KPI cards por departamento
 *   - Lista de alertas con niveles
 *   - Controles: pause / resume / force run
 *   - Trigger de workflows desde el panel
 *   - Indicadores de ciclo y uptime
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const AEGIS_BASE = process.env.NEXT_PUBLIC_AEGIS_URL || "http://localhost:8001";

// ─── Color palette por departamento ─────────────────────────────────────────
const DEPT_COLORS = {
  dept_eng_001:      { bg: "#E6F1FB", text: "#0C447C", border: "#378ADD" },
  dept_devops_002:   { bg: "#E1F5EE", text: "#085041", border: "#1D9E75" },
  dept_ai_003:       { bg: "#EEEDFE", text: "#3C3489", border: "#7F77DD" },
  dept_defi_004:     { bg: "#FAEEDA", text: "#633806", border: "#EF9F27" },
  dept_security_005: { bg: "#FCEBEB", text: "#791F1F", border: "#E24B4A" },
  dept_bd_006:       { bg: "#E1F5EE", text: "#0F6E56", border: "#2dd4a0" },
  dept_mktg_007:     { bg: "#FAEEDA", text: "#854F0B", border: "#f59e0b" },
  dept_finance_008:  { bg: "#FBEAF0", text: "#72243E", border: "#D4537E" },
  dept_cs_009:       { bg: "#EAF3DE", text: "#27500A", border: "#639922" },
  dept_legal_010:    { bg: "#EEEDFE", text: "#26215C", border: "#534AB7" },
};

const STATUS_COLORS = {
  running:     "#1D9E75",
  paused:      "#EF9F27",
  error:       "#E24B4A",
  idle:        "#888780",
  maintenance: "#7F77DD",
};

const ALERT_COLORS = {
  critical: { bg: "#FCEBEB", text: "#791F1F", dot: "#E24B4A" },
  warning:  { bg: "#FAEEDA", text: "#633806", dot: "#EF9F27" },
  info:     { bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD" },
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useDeptAgentsSSE() {
  const [agents, setAgents]   = useState({});
  const [alerts, setAlerts]   = useState([]);
  const [summary, setSummary] = useState(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);

  useEffect(() => {
    const es = new EventSource(`${AEGIS_BASE}/dept-agents/stream`);
    esRef.current = es;

    es.onopen = () => setConnected(true);

    es.addEventListener("snapshot", (e) => {
      const data = JSON.parse(e.data);
      setAgents(prev => ({ ...prev, [data.agent_id]: data }));
    });

    es.addEventListener("kpi_update", (e) => {
      const data = JSON.parse(e.data);
      setAgents(prev => ({
        ...prev,
        [data.agent_id]: { ...prev[data.agent_id], ...data }
      }));
    });

    es.addEventListener("alert", (e) => {
      const data = JSON.parse(e.data);
      setAlerts(prev => [data, ...prev].slice(0, 50));
    });

    es.addEventListener("summary", (e) => {
      setSummary(JSON.parse(e.data));
    });

    es.addEventListener("ready", (e) => {
      const data = JSON.parse(e.data);
      setSummary({ agent_count: data.agent_count });
    });

    es.onerror = () => setConnected(false);

    return () => {
      es.close();
      setConnected(false);
    };
  }, []);

  return { agents, alerts, summary, connected };
}

// ─── API calls ───────────────────────────────────────────────────────────────

async function apiCall(path, method = "GET", body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${AEGIS_BASE}/dept-agents${path}`, opts);
  return r.json();
}

// ─── Components ──────────────────────────────────────────────────────────────

function StatusDot({ status }) {
  return (
    <span style={{
      display:      "inline-block",
      width:        8, height: 8,
      borderRadius: "50%",
      background:   STATUS_COLORS[status] || "#888",
      marginRight:  6,
      flexShrink:   0,
    }} />
  );
}

function Badge({ children, level = "info" }) {
  const c = ALERT_COLORS[level] || ALERT_COLORS.info;
  return (
    <span style={{
      background:   c.bg,
      color:        c.text,
      fontSize:     11,
      padding:      "2px 8px",
      borderRadius: 20,
      fontWeight:   500,
    }}>
      {children}
    </span>
  );
}

function KpiRow({ label, value, highlight = false }) {
  return (
    <div style={{
      display:        "flex",
      justifyContent: "space-between",
      padding:        "3px 0",
      borderBottom:   "0.5px solid rgba(0,0,0,0.05)",
      fontSize:       12,
    }}>
      <span style={{ color: "#666" }}>{label}</span>
      <span style={{ fontWeight: highlight ? 500 : 400 }}>{value ?? "—"}</span>
    </div>
  );
}

function AgentCard({ agent, onAction }) {
  const colors  = DEPT_COLORS[agent.agent_id] || DEPT_COLORS.dept_eng_001;
  const kpis    = agent.kpis || {};
  const topKpis = Object.entries(kpis).slice(0, 4);
  const [busy, setBusy] = useState(false);

  async function handleAction(action) {
    setBusy(true);
    try { await apiCall(`/${agent.agent_id}/${action}`, "POST"); onAction?.(); }
    finally { setBusy(false); }
  }

  return (
    <div style={{
      background:   "#fff",
      border:       `0.5px solid ${colors.border}`,
      borderLeft:   `3px solid ${colors.border}`,
      borderRadius: "0 12px 12px 0",
      padding:      "14px 16px",
      display:      "flex",
      flexDirection:"column",
      gap:          8,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 2 }}>
            <StatusDot status={agent.status} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>{agent.dept_name || agent.agent_id}</span>
          </div>
          <div style={{ fontSize: 11, color: "#888", marginLeft: 14 }}>
            {agent.dept_lead} · Run #{agent.run_count ?? 0}
            {agent.error_count > 0 && (
              <span style={{ color: "#E24B4A", marginLeft: 6 }}>
                · {agent.error_count} errors
              </span>
            )}
          </div>
        </div>
        <Badge level={agent.status === "error" ? "critical" : agent.status === "paused" ? "warning" : "info"}>
          {agent.status}
        </Badge>
      </div>

      {/* KPIs */}
      {topKpis.length > 0 && (
        <div style={{
          background: colors.bg,
          borderRadius: 8,
          padding: "8px 10px",
        }}>
          {topKpis.map(([k, v]) => (
            <KpiRow key={k} label={k.replace(/_/g, " ")} value={
              typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(2)) : String(v)
            } />
          ))}
        </div>
      )}

      {/* Alerts */}
      {agent.recent_alerts?.length > 0 && (
        <div style={{ fontSize: 11, color: "#E24B4A" }}>
          ⚠ {agent.recent_alerts[0]?.message?.slice(0, 60)}...
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
        {agent.status === "running" ? (
          <button
            onClick={() => handleAction("pause")}
            disabled={busy}
            style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
              border: "0.5px solid #EF9F27", background: "#FAEEDA", color: "#633806" }}
          >
            Pause
          </button>
        ) : (
          <button
            onClick={() => handleAction("resume")}
            disabled={busy}
            style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
              border: "0.5px solid #1D9E75", background: "#E1F5EE", color: "#085041" }}
          >
            Resume
          </button>
        )}
        <button
          onClick={() => handleAction("run")}
          disabled={busy}
          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
            border: "0.5px solid #378ADD", background: "#E6F1FB", color: "#0C447C" }}
        >
          Force run
        </button>
      </div>
    </div>
  );
}

function AlertList({ alerts }) {
  if (!alerts.length) return (
    <div style={{ color: "#aaa", fontSize: 13, padding: "1rem 0" }}>No alerts</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {alerts.slice(0, 20).map((a, i) => (
        <div key={i} style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          padding: "8px 12px",
          background: ALERT_COLORS[a.level]?.bg || "#f8f8f8",
          borderRadius: 8,
          borderLeft: `3px solid ${ALERT_COLORS[a.level]?.dot || "#ccc"}`,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: ALERT_COLORS[a.level]?.text }}>
              [{a.dept}] {a.message}
            </div>
            <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>
              {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : ""}
            </div>
          </div>
          <Badge level={a.level}>{a.level}</Badge>
        </div>
      ))}
    </div>
  );
}

function WorkflowPanel({ onTrigger }) {
  const [form, setForm] = useState({
    client_name: "", client_id: "", sector: "logistics", deposit: 500
  });
  const [busy, setBusy]   = useState(false);
  const [result, setResult] = useState(null);

  async function triggerOnboard() {
    setBusy(true);
    try {
      const r = await apiCall("/workflows/onboard", "POST", {
        client_name:         form.client_name,
        client_id:           form.client_id,
        sector:              form.sector,
        initial_deposit_usd: Number(form.deposit),
      });
      setResult(r);
      onTrigger?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input placeholder="Client name"
        value={form.client_name} onChange={e => setForm(p => ({...p, client_name: e.target.value}))}
        style={{ padding: "8px 12px", borderRadius: 8, border: "0.5px solid #ddd", fontSize: 13 }}
      />
      <input placeholder="Client ID"
        value={form.client_id} onChange={e => setForm(p => ({...p, client_id: e.target.value}))}
        style={{ padding: "8px 12px", borderRadius: 8, border: "0.5px solid #ddd", fontSize: 13 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <select value={form.sector} onChange={e => setForm(p => ({...p, sector: e.target.value}))}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "0.5px solid #ddd", fontSize: 13 }}>
          {["logistics","health","real-estate","energy","manufacturing","agriculture",
            "insurance","education","fintech","legal","government"].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input type="number" placeholder="Deposit USD" value={form.deposit}
          onChange={e => setForm(p => ({...p, deposit: e.target.value}))}
          style={{ width: 120, padding: "8px 12px", borderRadius: 8, border: "0.5px solid #ddd", fontSize: 13 }}
        />
      </div>
      <button onClick={triggerOnboard} disabled={busy || !form.client_name}
        style={{ padding: "10px", borderRadius: 8, fontSize: 13, cursor: "pointer",
          background: "#E1F5EE", border: "0.5px solid #1D9E75", color: "#085041", fontWeight: 500 }}>
        {busy ? "Running..." : "Start Onboarding Workflow"}
      </button>
      {result && (
        <div style={{ fontSize: 12, padding: "8px 12px", background: "#f8f8f8", borderRadius: 8 }}>
          Status: <strong>{result.status}</strong> · Steps: {result.total_steps}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DeptAgentsDashboard() {
  const { agents, alerts, summary, connected } = useDeptAgentsSSE();
  const [tab, setTab] = useState("agents");  // "agents" | "alerts" | "workflows"
  const [refresh, setRefresh] = useState(0);

  const agentList  = Object.values(agents);
  const running    = agentList.filter(a => a.status === "running").length;
  const errors     = agentList.filter(a => a.status === "error").length;
  const critAlerts = alerts.filter(a => a.level === "critical").length;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>Department Agents</h1>
          <p style={{ fontSize: 13, color: "#888", margin: "4px 0 0" }}>BeZhas — Management Automation</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 12, color: connected ? "#1D9E75" : "#E24B4A",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%",
              background: connected ? "#1D9E75" : "#E24B4A" }} />
            {connected ? "Live" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: "1.5rem" }}>
        {[
          { label: "Total agents", value: agentList.length || 10 },
          { label: "Running",      value: running,    color: "#1D9E75" },
          { label: "Errors",       value: errors,     color: errors > 0 ? "#E24B4A" : undefined },
          { label: "Crit. alerts", value: critAlerts, color: critAlerts > 0 ? "#E24B4A" : undefined },
        ].map(card => (
          <div key={card.label} style={{
            background: "#f8f8f8", borderRadius: 10, padding: "12px 14px"
          }}>
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: card.color || "#111" }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: "1rem", borderBottom: "0.5px solid #eee", paddingBottom: 8 }}>
        {["agents", "alerts", "workflows"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "6px 14px", borderRadius: "6px 6px 0 0", fontSize: 13,
            cursor: "pointer", border: "none",
            background: tab === t ? "#fff" : "transparent",
            borderBottom: tab === t ? "2px solid #378ADD" : "none",
            color: tab === t ? "#0C447C" : "#888",
            fontWeight: tab === t ? 500 : 400,
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "alerts" && alerts.length > 0 && (
              <span style={{ marginLeft: 6, background: critAlerts > 0 ? "#E24B4A" : "#EF9F27",
                color: "#fff", fontSize: 10, borderRadius: 20, padding: "1px 6px" }}>
                {alerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "agents" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {agentList.length > 0
            ? agentList.map(a => (
                <AgentCard key={a.agent_id} agent={a} onAction={() => setRefresh(r => r + 1)} />
              ))
            : Array.from({length: 10}, (_, i) => (
                <div key={i} style={{ height: 180, background: "#f0f0f0", borderRadius: 12,
                  animation: "pulse 1.5s infinite" }} />
              ))
          }
        </div>
      )}

      {tab === "alerts" && (
        <AlertList alerts={alerts} />
      )}

      {tab === "workflows" && (
        <div style={{ maxWidth: 500 }}>
          <p style={{ fontSize: 13, color: "#888", marginBottom: "1rem" }}>
            Trigger automated cross-department workflows
          </p>
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: "0.75rem" }}>
            Onboard Enterprise Client
          </h3>
          <WorkflowPanel onTrigger={() => setRefresh(r => r + 1)} />
        </div>
      )}
    </div>
  );
}
