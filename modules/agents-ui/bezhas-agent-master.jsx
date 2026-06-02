// ─── bezhas-agent-master.jsx ─────────────────────────────────────────────────
// ARCHIVO 6/6 — Shell principal. Importa los 5 archivos anteriores.
//
// EN bezhas-pay-system.jsx añade 3 líneas:
//   import BeZhasAgentMaster from './bezhas-agent-master';
//   { id:"agents", icon:"🤖", label:"AI Agents", color:C.violet },  // en TABS
//   case "agents": return <BeZhasAgentMaster wallet={wallet} engine={ENG} />;

import { useState, useEffect, useCallback } from "react";
import { C, ADDR, rndInt } from "./bezhas-agents-constants";
import { Tag } from "./bezhas-agents-ui";
import TabAgents from "./bezhas-tab-agents";
import { TabMCP, TabBEZ } from "./bezhas-tab-mcp-bez";
import { TabBridge, TabMerge } from "./bezhas-tab-bridge-merge";

function useLiveLog(liveData) {
  const [log, setLog] = useState([
    "SYSTEM  → BeZhas Master Agent Dashboard v2.0 LOADED",
    "MCP     → 24 tools registered | JSON-RPC 2.0 WebSocket",
    "ORACLE  → Aegis Quality Oracle | Claude Sonnet READY",
    "BEZ     → Polygon 0xEcBa… | BNB 0x8a1e… | $1.2400",
    "BRIDGE  → LayerZero Poly↔BNB | Wormhole ETH↔Poly ACTIVE",
    "PAYMENT → BEZ + Stripe + SEPA ING ES77 1465… ALL LIVE",
    "DAO     → Treasury 0x89c2… | Gnosis Safe MONITORING",
    "STAKING → StakingPoolV2.sol APY 9.2%",
  ]);
  const add = useCallback((msg) => {
    const ts = new Date().toTimeString().slice(0, 8);
    setLog((p) => [`[${ts}] ${msg}`, ...p].slice(0, 50));
  }, []);

  // If we have live SSE events from backend, use those instead of mock
  useEffect(() => {
    if (liveData?.sseEvents && liveData.sseEvents.length > 0) {
      const formatted = liveData.sseEvents.slice(0, 10).map(evt => {
        const ts = new Date(evt.timestamp).toTimeString().slice(0, 8);
        const sev = evt.severity === 'critical' ? '🔴' : evt.severity === 'warning' ? '🟡' : '🟢';
        return `[${ts}] ${sev} ${(evt.module || '').toUpperCase()} → ${evt.action}${evt.tx_hash ? ` tx:${evt.tx_hash.slice(0, 10)}…` : ''}`;
      });
      if (formatted.length > 0) {
        setLog(prev => [...formatted, ...prev.filter(l => !l.includes('→'))].slice(0, 50));
      }
    }
  }, [liveData?.sseEvents]);

  // Fallback to mock rotation if no live data
  useEffect(() => {
    if (liveData?.sseConnected) return; // Don't add fake entries if SSE is active
    const msgs = [
      "MCP → analyzeGasStrategy() = 18 gwei OPTIMAL",
      "ORACLE → Aegis BCM-2025-0443 Score 97 → RELEASE_FULL",
      "BRIDGE → LayerZero Poly→BNB confirmed 0x7f3a…",
      "ECON → APY rebalanced 9.2%→9.8% demand spike",
      "DAO → Treasury BEZ 61% (OK < 65%)",
      "SWAP → BEZ→USDC QuickSwap V3 slippage 0.03%",
      "SSI → DID issued 0x2b8d… PoR initialized",
      "FOOD → BCM-2025-0444 minted 🔥 0.5 BEZ burned",
      "PAY → SEPA → ING ES77 1465… EUR 4,200 sent",
      "AUDIT → Solidity scan: 0 vulnerabilities found",
    ];
    const t = setInterval(() => add(msgs[rndInt(0, msgs.length - 1)]), 3200);
    return () => clearInterval(t);
  }, [add, liveData?.sseConnected]);
  return { log, add };
}

const TABS = [
  { id: "agents", icon: "🤖", label: "AI Agents", col: "#00C896" },
  { id: "mcp", icon: "⚡", label: "MCP Server", col: "#00FFB2" },
  { id: "bez", icon: "🪙", label: "BEZ Flows", col: "#FFB800" },
  { id: "bridge", icon: "🌉", label: "Bridge & APIs", col: "#2563EB" },
  { id: "merge", icon: "🔗", label: "Merge Guide", col: "#7C3AED" },
];

export default function BeZhasAgentMaster({ wallet, engine, liveData }) {
  const [tab, setTab] = useState("agents");
  const { log } = useLiveLog(liveData);

  // Use real BEZ price from liveData if available, fallback to mock
  const [bezPrice, setBezPrice] = useState(liveData?.bezPrice || 1.24);
  const [burned, setBurned] = useState(liveData?.bezBurned || 14.5);

  // Update from live data when it arrives
  useEffect(() => {
    if (liveData?.bezPrice != null) setBezPrice(liveData.bezPrice);
    if (liveData?.bezBurned != null) setBurned(liveData.bezBurned);
  }, [liveData?.bezPrice, liveData?.bezBurned]);

  // Only use mock ticker if no live data
  useEffect(() => {
    if (liveData?.bezPrice != null) return; // Real data available
    const t = setInterval(() => {
      setBezPrice((p) => +(p * (1 + (Math.random() - 0.498) * 0.002)).toFixed(4));
      setBurned((p) => +(p + Math.random() * 0.008).toFixed(2));
    }, 1500);
    return () => clearInterval(t);
  }, [liveData?.bezPrice]);

  // Real MCP tools count + Aegis status from engine prop
  const mcpToolCount = engine?.toolCount || 24;
  const aegisStatus = engine?.aegisStatus || 'unknown';
  const sseConnected = liveData?.sseConnected || false;

  // Real analytics from liveData
  const analyticsData = liveData?.analytics;
  const registryData = liveData?.registry;

  const logColor = (e, i) => {
    if (i !== 0) return C.muted;
    if (e.includes("ORACLE") || e.includes("APPROVE")) return "#00C896";
    if (e.includes("burn") || e.includes("🔥")) return "#F97316";
    if (e.includes("MCP") || e.includes("BRIDGE")) return "#00FFB2";
    if (e.includes("PAY") || e.includes("SEPA")) return "#FFB800";
    return C.text2;
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: C.sans, fontSize: 13 }}>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#1E4A8A;border-radius:2px}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.25}}`}</style>

      {/* HEADER */}
      <div style={{ background: C.surf, borderBottom: `1px solid ${C.border}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 50, flexWrap: "wrap" }}>
        <div style={{ background: "linear-gradient(135deg,#FFB800,#00C896)", borderRadius: 12, padding: "7px 14px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <div>
            <div style={{ color: C.bg, fontFamily: C.mono, fontSize: 14, fontWeight: 900 }}>BeZhas</div>
            <div style={{ color: C.bg, fontSize: 8, opacity: 0.8, letterSpacing: 2 }}>AGENT MASTER v2</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {[
            [`${registryData?.total_groups || 7} Grupos`, "#00C896"],
            [`${registryData?.total_agents || 24} Agentes`, "#FFB800"],
            ["Polygon", "#7C3AED"],
            ["BNB Chain", "#EAB308"],
            [`MCP ${mcpToolCount > 0 ? 'Live' : 'Offline'}`, "#00FFB2"],
            [`Aegis ${aegisStatus === 'online' || aegisStatus === 'running' ? '✓' : '○'}`, "#F97316"],
          ].map(([l, c]) => (
            <span key={l} style={{ background: `${c}20`, color: c, border: `1px solid ${c}33`, borderRadius: 20, padding: "2px 8px", fontSize: 9, fontFamily: C.mono, fontWeight: 700 }}>{l}</span>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Tag col="#FFB800">🪙 BEZ ${bezPrice.toFixed(4)}</Tag>
          <Tag col="#EF4444">🔥 {burned.toFixed(2)} BEZ hoy</Tag>
          {wallet?.connected && <Tag col="#00C896">● {wallet.address?.slice(0, 6)}…{wallet.address?.slice(-4)}</Tag>}
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: C.surf, borderBottom: `1px solid ${C.border}`, padding: "6px 20px", display: "flex", gap: 4, overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? `${t.col}22` : "transparent",
            color: tab === t.id ? t.col : C.muted,
            border: `1px solid ${tab === t.id ? t.col : C.border}`,
            borderRadius: 10, padding: "7px 16px", cursor: "pointer",
            fontSize: 12, fontWeight: tab === t.id ? 800 : 400, fontFamily: C.mono,
            whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5,
            boxShadow: tab === t.id ? `0 0 12px ${t.col}33` : "none",
            transition: "all 0.18s",
          }}>
            <span style={{ fontSize: 14 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* CONTENT + LOG */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 106px)" }}>
        <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto" }}>
          {tab === "agents" && <TabAgents engine={engine} liveData={liveData} />}
          {tab === "mcp" && <TabMCP engine={engine} liveData={liveData} />}
          {tab === "bez" && <TabBEZ />}
          {tab === "bridge" && <TabBridge />}
          {tab === "merge" && <TabMerge />}
        </div>

        {/* Log */}
        <div style={{ width: 240, background: C.surf, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "7px 12px", borderBottom: `1px solid ${C.border}`, fontSize: 9, color: C.muted, letterSpacing: 2, fontFamily: C.mono, display: "flex", alignItems: "center", gap: 6 }}>
            {sseConnected ? "SSE LIVE" : "WS LIVE"} <span style={{ color: sseConnected ? "#00C896" : "#FFB800", animation: "pulse 1.5s infinite", fontSize: 12 }}>●</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {log.map((e, i) => (
              <div key={i} style={{ padding: "3px 10px", fontSize: 9, fontFamily: C.mono, lineHeight: 1.6, color: logColor(e, i) }}>{e}</div>
            ))}
          </div>
          <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}` }}>
            {[["HOT WALLET", "#00C896", ADDR.HOT], ["TREASURY DAO", "#EAB308", ADDR.DAO], ["ESCROW", "#2563EB", ADDR.ESCROW]].map(([l, c, a]) => (
              <div key={l} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 8, color: C.muted, fontFamily: C.mono, marginBottom: 1 }}>{l}</div>
                <div style={{ color: c, fontFamily: C.mono, fontSize: 9 }}>{a.slice(0, 14)}…</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "8px 20px", display: "flex", justifyContent: "space-between", color: C.muted, fontSize: 9, fontFamily: C.mono, background: C.surf, flexWrap: "wrap", gap: 4 }}>
        <span>bez.digital · Master Agent Dashboard v2.0 · 7 Grupos · 24 Agentes · BEZ-Coin Native</span>
        <span>Polygon → Mainnet · BNB · MCP Server · LayerZero · Wormhole · ASYCUDA World</span>
      </div>
    </div>
  );
}
