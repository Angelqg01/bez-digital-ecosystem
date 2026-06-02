// ─── bezhas-tab-agents.jsx ───────────────────────────────────────────────────
// ARCHIVO 3/6 — Tab "AI Agents" con los 7 grupos y 24 agentes
// Importar: import TabAgents from './bezhas-tab-agents'

import { useState, useCallback } from "react";
import { C, GROUPS } from "./bezhas-agents-constants";
import { Box, Tag, StatCard, StatusDot } from "./bezhas-agents-ui";

export default function TabAgents({ engine, liveData }) {
  const [activeGroup, setActiveGroup] = useState("mcp");
  const [openAgent, setOpenAgent] = useState(null);
  const [invokeResult, setInvokeResult] = useState(null);
  const [invoking, setInvoking] = useState(null);

  // MCP tool invocation handler
  const handleInvokeTool = useCallback(async (toolName) => {
    if (!engine?.invoke) return;
    setInvoking(toolName);
    setInvokeResult(null);
    try {
      const clean = toolName.replace(/[()]/g, '');
      const result = await engine.invoke(clean, {});
      setInvokeResult({ tool: clean, success: true, data: result });
    } catch (err) {
      setInvokeResult({ tool: toolName, success: false, error: err.message });
    } finally {
      setInvoking(null);
    }
  }, [engine]);

  const grp = GROUPS.find((g) => g.id === activeGroup);
  const allAgents = GROUPS.flatMap((g) => g.agents);
  const activeCount = allAgents.filter((a) => a.status === "ACTIVE").length;

  return (
    <div>
      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        <StatCard label="Agentes LIVE" value={`${activeCount}/${allAgents.length}`} col="#00C896" icon="🤖" />
        <StatCard label="Grupos" value={liveData?.registry?.total_groups || GROUPS.length} col="#FFB800" icon="📦" />
        <StatCard label="MCP Tools" value={`${engine?.toolCount || 24} expuestas`} col="#00FFB2" icon="⚡" />
        <StatCard label="Acciones 24h" value={liveData?.analytics?.total_actions_24h ?? '—'} col="#7C3AED" icon="⛓️" />
      </div>

      {/* MCP Invocation Result Banner */}
      {invokeResult && (
        <div style={{
          padding: "8px 14px", marginBottom: 12, borderRadius: 10,
          background: invokeResult.success ? "#00C89616" : "#EF444416",
          border: `1px solid ${invokeResult.success ? '#00C89644' : '#EF444444'}`,
          fontSize: 10, fontFamily: C.mono, color: invokeResult.success ? '#00C896' : '#EF4444',
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>{invokeResult.success ? '✅' : '❌'} {invokeResult.tool}: {invokeResult.success ? 'OK' : invokeResult.error}</span>
          <button onClick={() => setInvokeResult(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12 }}>✕</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14 }}>
        {/* ── Group sidebar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {GROUPS.map((g) => {
            const on = g.id === activeGroup;
            return (
              <button
                key={g.id}
                onClick={() => { setActiveGroup(g.id); setOpenAgent(null); }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  background: on ? `${g.color}15` : C.card,
                  border: `1px solid ${on ? g.color : C.border}`,
                  borderLeft: `3px solid ${on ? g.color : C.border}`,
                  boxShadow: on ? `0 0 12px ${g.color}18` : "none",
                  transition: "all 0.18s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 16 }}>{g.icon}</span>
                  <span style={{ color: on ? g.color : C.text2, fontFamily: C.mono, fontSize: 10, fontWeight: 800 }}>
                    {g.label}
                  </span>
                </div>
                <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono }}>
                  {g.agents.length} agentes · {g.agents.filter((a) => a.status === "ACTIVE").length} ACTIVE
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Agents panel ── */}
        {grp && (
          <div>
            {/* Group header */}
            <div
              style={{
                padding: "10px 14px",
                background: `${grp.color}10`,
                border: `1px solid ${grp.color}22`,
                borderRadius: 12,
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 9, color: grp.color, letterSpacing: 2, marginBottom: 3 }}>
                {grp.icon} {grp.label}
              </div>
              <div style={{ fontSize: 11, color: C.text2, lineHeight: 1.7 }}>{grp.desc}</div>
            </div>

            {/* Agent cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {grp.agents.map((ag) => {
                const open = openAgent === ag.id;
                return (
                  <div
                    key={ag.id}
                    onClick={() => setOpenAgent(open ? null : ag.id)}
                    style={{
                      background: open ? C.card2 : C.card,
                      border: `1px solid ${open ? ag.color + "66" : C.border}`,
                      borderLeft: `3px solid ${open ? ag.color : C.border}`,
                      borderRadius: 14,
                      padding: "12px 14px",
                      cursor: "pointer",
                      boxShadow: open ? `0 0 18px ${ag.color}10` : "none",
                      transition: "all 0.2s",
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 22 }}>{ag.icon}</span>
                        <div>
                          <div style={{ color: C.text, fontWeight: 800, fontSize: 13 }}>{ag.name}</div>
                          <div style={{ fontSize: 9, color: C.muted, fontFamily: C.mono }}>{ag.file}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        <StatusDot status={ag.status} />
                        <span style={{ fontSize: 9, color: "#FFB800", fontFamily: C.mono }}>🪙 {ag.fee}</span>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {open && (
                      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                        {/* MCP Tools */}
                        <div>
                          <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>
                            MCP TOOLS EXPUESTAS
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {ag.tools.map((t) => (
                              <button
                                key={t}
                                onClick={(e) => { e.stopPropagation(); handleInvokeTool(t); }}
                                disabled={invoking === t}
                                style={{
                                  fontSize: 9,
                                  padding: "3px 9px",
                                  background: invoking === t ? `${ag.color}30` : `${ag.color}12`,
                                  color: ag.color,
                                  border: `1px solid ${ag.color}33`,
                                  borderRadius: 8,
                                  fontFamily: C.mono,
                                  cursor: engine?.invoke ? 'pointer' : 'default',
                                  opacity: invoking === t ? 0.6 : 1,
                                  transition: 'all 0.15s',
                                }}
                                title={engine?.invoke ? `Click to invoke ${t}` : 'MCP not connected'}
                              >
                                {invoking === t ? '⏳ ' : '▶ '}{t}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 3 columns: contracts / apis / automations */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>CONTRATOS</div>
                            {ag.contracts.map((ct) => (
                              <div
                                key={ct}
                                style={{
                                  fontSize: 9,
                                  padding: "3px 8px",
                                  background: C.card3,
                                  color: C.text2,
                                  border: `1px solid ${C.border2}`,
                                  borderRadius: 8,
                                  fontFamily: C.mono,
                                  marginBottom: 4,
                                }}
                              >
                                {ct}
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>APIS</div>
                            {ag.apis.map((a) => (
                              <div
                                key={a}
                                style={{
                                  fontSize: 9,
                                  padding: "3px 8px",
                                  background: C.card2,
                                  color: C.muted,
                                  border: `1px solid ${C.border}`,
                                  borderRadius: 8,
                                  marginBottom: 4,
                                }}
                              >
                                {a}
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{ fontSize: 8, color: C.muted, letterSpacing: 2, marginBottom: 6 }}>AUTOMATIZACIONES</div>
                            {ag.auto.map((a) => (
                              <div
                                key={a}
                                style={{ fontSize: 10, color: C.text2, marginBottom: 5, display: "flex", gap: 5 }}
                              >
                                <span style={{ color: ag.color, flexShrink: 0 }}>→</span>
                                {a}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
