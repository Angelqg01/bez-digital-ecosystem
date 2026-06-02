// ─── bezhas-tab-mcp-bez.jsx ──────────────────────────────────────────────────
// ARCHIVO 4/6 — Tab MCP Server + Tab BEZ Flows
// Importar: import { TabMCP, TabBEZ } from './bezhas-tab-mcp-bez'

import { useState } from "react";
import { C, GROUPS, MCP_TOOLS, CAT_COLOR, ADDR } from "./bezhas-agents-constants";
import { Box, Tag, StatCard } from "./bezhas-agents-ui";

// ─── TAB: MCP SERVER ─────────────────────────────────────────────────────────
export function TabMCP({ engine, liveData }) {
  const [cat, setCat] = useState("ALL");
  const [invoking, setInvoking] = useState(null);
  const [result, setResult] = useState(null);
  const cats = ["ALL", ...new Set(MCP_TOOLS.map((t) => t.cat))];
  const shown = cat === "ALL" ? MCP_TOOLS : MCP_TOOLS.filter((t) => t.cat === cat);
  const totalAgents = GROUPS.flatMap((g) => g.agents).length;

  const handleInvoke = async (toolFn) => {
    if (!engine?.invoke) return;
    const clean = toolFn.replace(/[^\w_-]/g, '');
    setInvoking(clean);
    setResult(null);
    try {
      const res = await engine.invoke(clean, {});
      setResult({ ok: true, tool: clean, msg: res?.message || 'OK' });
    } catch (err) {
      setResult({ ok: false, tool: clean, msg: err.message || 'Error' });
    } finally {
      setInvoking(null);
    }
  };

  const realToolCount = engine?.toolCount ?? MCP_TOOLS.length;
  const aegisUp = engine?.aegisStatus === 'healthy';

  return (
    <div>
      {/* Result banner */}
      {result && (
        <div style={{
          marginBottom: 10, padding: "8px 14px", borderRadius: 10,
          background: result.ok ? "#00C89618" : "#EF444418",
          border: `1px solid ${result.ok ? "#00C89644" : "#EF444444"}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 10, color: result.ok ? "#00C896" : "#EF4444", fontFamily: C.mono }}>
            {result.ok ? "✅" : "❌"} {result.tool}: {result.msg}
          </span>
          <button onClick={() => setResult(null)} style={{
            background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12,
          }}>✕</button>
        </div>
      )}

      {/* Top cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        {/* Server status */}
        <div
          style={{
            background: C.card,
            border: `1px solid ${aegisUp ? "#00FFB255" : "#EF444455"}`,
            borderRadius: 14,
            padding: 14,
            boxShadow: `0 0 20px ${aegisUp ? "#00FFB212" : "#EF444412"}`,
          }}
        >
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
            MCP SERVER — {aegisUp ? "🟢 ONLINE" : "🔴 OFFLINE"} — mcp.bez.digital:4001
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
            {[
              { l: "Tools", v: realToolCount, c: "#00FFB2" },
              { l: "Agentes", v: totalAgents, c: "#00C896" },
              { l: "Aegis", v: aegisUp ? "UP" : "DOWN", c: aegisUp ? "#EAB308" : "#EF4444" },
            ].map((s) => (
              <div key={s.l} style={{ background: C.card2, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 8, color: C.muted }}>{s.l}</div>
                <div style={{ color: s.c, fontFamily: C.mono, fontWeight: 900, fontSize: 20 }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: "8px 12px", background: "#00FFB210", border: "1px solid #00FFB230", borderRadius: 10 }}>
            <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>TRANSPORT</div>
            <div style={{ fontSize: 10, color: "#00FFB2", fontFamily: C.mono }}>
              JSON-RPC 2.0 · WebSocket WSS · STDIO (local)
            </div>
          </div>
        </div>

        {/* MCP Primitives */}
        <Box>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>3 PRIMITIVAS MCP</div>
          {[
            { t: "📂 RECURSOS", d: "Balances, manifiestos, historiales on-chain, precios live", c: "#2563EB" },
            { t: "🔧 HERRAMIENTAS", d: "Firmar tx, invocar Claude Vision, mint NFT, swap BEZ, bridge", c: "#F97316" },
            { t: "📝 PROMPTS", d: "Flujos AML/KYC, calidad agroalimentaria, rebalanceo DAO, vesting", c: "#EAB308" },
          ].map((p) => (
            <div key={p.t} style={{ padding: "8px 10px", background: C.card2, borderRadius: 10, marginBottom: 6 }}>
              <div style={{ color: p.c, fontFamily: C.mono, fontSize: 10, fontWeight: 800, marginBottom: 2 }}>{p.t}</div>
              <div style={{ fontSize: 10, color: C.text2 }}>{p.d}</div>
            </div>
          ))}
        </Box>
      </div>

      {/* Tools registry */}
      <Box>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: C.muted, letterSpacing: 2 }}>
            TOOLS REGISTRY ({shown.length}/{MCP_TOOLS.length})
          </span>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                style={{
                  padding: "3px 10px",
                  borderRadius: 20,
                  cursor: "pointer",
                  fontFamily: C.mono,
                  fontSize: 9,
                  background: cat === c ? "#00C89622" : C.card2,
                  border: `1px solid ${cat === c ? "#00C896" : C.border2}`,
                  color: cat === c ? "#00C896" : C.muted,
                  fontWeight: 800,
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 8 }}>
          {shown.map((t) => {
            const cc = CAT_COLOR[t.cat] || "#00C896";
            const isInvoking = invoking === t.fn.replace(/[^\w_-]/g, '');
            return (
              <button
                key={t.fn}
                onClick={() => handleInvoke(t.fn)}
                disabled={!!invoking || !engine?.invoke}
                style={{
                  padding: "9px 11px", background: C.card2,
                  border: `1px solid ${isInvoking ? "#FFB800" : C.border}`,
                  borderRadius: 10, cursor: engine?.invoke ? "pointer" : "default",
                  textAlign: "left", transition: "border-color 0.2s",
                }}
              >
                <div style={{ color: "#00C896", fontFamily: C.mono, fontSize: 10, marginBottom: 4 }}>
                  {isInvoking ? "⏳" : "▶"} {t.fn}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <Tag col={cc} sm>{t.cat}</Tag>
                  <span style={{ fontSize: 9, color: C.muted, fontFamily: C.mono }}>{t.agent}</span>
                </div>
                <div style={{ fontSize: 8, color: "#FFB800", fontFamily: C.mono }}>🪙 {t.fee}</div>
              </button>
            );
          })}
        </div>
      </Box>
    </div>
  );
}

// ─── TAB: BEZ FLOWS ──────────────────────────────────────────────────────────
export function TabBEZ() {
  const flows = [
    { from: "Usuario", to: "MCP Orchestrator", amt: "variable", op: "Pago servicio", c: "#FFB800" },
    { from: "MCP Orchestrator", to: "Gas Strategy", amt: "0.02 BEZ", op: "Batch fee", c: "#00FFB2" },
    { from: "MCP Orchestrator", to: "Smart Swap", amt: "0.1%", op: "Swap routing", c: "#00FFB2" },
    { from: "Usuario", to: "Aegis Oracle", amt: "0.5 BEZ 🔥", op: "Burn por scan", c: "#F97316" },
    { from: "Aegis Oracle", to: "QualityEscrow", amt: "collateral", op: "Lock / Release BEZ", c: "#2563EB" },
    { from: "Food Oracle", to: "BeZhasNFT", amt: "1 BEZ 🔥", op: "BCM mint fee", c: "#F97316" },
    { from: "Food Oracle", to: "Inspector", amt: "+0.1 BEZ", op: "Reward calidad", c: "#00C896" },
    { from: "Tokenomics", to: "StakingPool", amt: "APY ≤ 12%", op: "Distribute rewards", c: "#FFB800" },
    { from: "Hybrid Payment", to: "ING SEPA", amt: "FIAT out", op: "Liquidación bancaria", c: "#2563EB" },
    { from: "DePub Agent", to: "Creador+User+DAO", amt: "90%", op: "Revenue distribución", c: "#EC4899" },
    { from: "DAO Governor", to: "Treasury DAO", amt: "rebalanceo", op: "Si BEZ conc. > 65%", c: "#EAB308" },
  ];

  const burns = [
    ["Escaneo Aegis / Food Oracle", "0.5 BEZ / scan"],
    ["Mint BCM NFT on-chain", "1.0 BEZ / mint"],
    ["Sync ASYCUDA Aduanas", "0.2 BEZ / doc"],
    ["Registro DID on-chain", "0.1 BEZ / DID"],
    ["Abrir disputa Kleros", "10.0 BEZ / disputa"],
    ["Operación logística B/L", "0.5 BEZ / tx"],
  ];

  const contracts = [
    { l: "BEZ Token Polygon", addr: ADDR.BEZ_POL, c: "#FFB800", net: "Polygon Amoy" },
    { l: "BEZ Token BNB", addr: ADDR.BEZ_BNB, c: "#EAB308", net: "BNB Chain" },
    { l: "Quality Escrow", addr: ADDR.ESCROW, c: "#2563EB", net: "Polygon" },
    { l: "Treasury DAO", addr: ADDR.DAO, c: "#7C3AED", net: "Polygon" },
    { l: "Hot Wallet", addr: ADDR.HOT, c: "#00C896", net: "Polygon" },
  ];

  return (
    <div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
        <StatCard label="Ops con BEZ burn" value="6 tipos" col="#EF4444" icon="🔥" />
        <StatCard label="Flujos auto" value={flows.length} col="#00C896" icon="🔄" />
        <StatCard label="Redes" value="Poly+BNB+ETH" col="#FFB800" icon="⛓️" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Flows list */}
        <Box>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>
            FLUJOS BEZ ENTRE AGENTES
          </div>
          {flows.map((f, i) => (
            <div key={i} style={{ padding: "7px 10px", background: C.card2, borderRadius: 10, marginBottom: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: C.text2, fontFamily: C.mono, minWidth: 118, flexShrink: 0 }}>
                  {f.from}
                </span>
                <span style={{ color: f.c, fontSize: 14, flexShrink: 0 }}>→</span>
                <span style={{ fontSize: 10, color: f.c, fontFamily: C.mono, flex: 1 }}>{f.to}</span>
                <span style={{ fontSize: 10, color: "#FFB800", fontFamily: C.mono, fontWeight: 800, flexShrink: 0 }}>
                  {f.amt}
                </span>
              </div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 2, paddingLeft: 120 }}>{f.op}</div>
            </div>
          ))}
        </Box>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Contracts */}
          <Box>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>CONTRATOS DESPLEGADOS</div>
            {contracts.map((ct) => (
              <div key={ct.addr} style={{ padding: "8px 10px", background: C.card2, borderRadius: 10, marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: C.text, fontWeight: 700 }}>{ct.l}</span>
                  <Tag col={ct.c} sm>{ct.net}</Tag>
                </div>
                <div style={{ fontSize: 9, color: ct.c, fontFamily: C.mono }}>
                  {ct.addr.slice(0, 22)}…{ct.addr.slice(-4)}
                </div>
              </div>
            ))}
          </Box>

          {/* Burn model */}
          <Box>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 10 }}>MODELO DEFLACIONARIO 🔥</div>
            {burns.map(([op, cost]) => (
              <div
                key={op}
                style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}22` }}
              >
                <span style={{ fontSize: 10, color: C.text2 }}>{op}</span>
                <span style={{ fontSize: 10, color: "#EF4444", fontFamily: C.mono, fontWeight: 800 }}>{cost}</span>
              </div>
            ))}
          </Box>
        </div>
      </div>
    </div>
  );
}
