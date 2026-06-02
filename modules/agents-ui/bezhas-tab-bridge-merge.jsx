// ─── bezhas-tab-bridge-merge.jsx ─────────────────────────────────────────────
// ARCHIVO 5/6 — Tab Bridge & APIs + Tab Merge Guide
// Importar: import { TabBridge, TabMerge } from './bezhas-tab-bridge-merge'

import { useState } from "react";
import { C } from "./bezhas-agents-constants";
import { Box, Tag, Btn } from "./bezhas-agents-ui";

// ─── TAB: BRIDGE & APIs ──────────────────────────────────────────────────────
export function TabBridge() {
  const bridges = [
    { r: "Ethereum L1 → Polygon L2", m: "Lock-and-Mint",   t: "~2 min", fee: "0.3%",  live: true  },
    { r: "Polygon L2 → BNB Chain",   m: "LayerZero relay", t: "~45s",   fee: "0.15%", live: true  },
    { r: "BNB Chain → Polygon",       m: "Wormhole Guard",  t: "~1 min", fee: "0.15%", live: true  },
    { r: "Polygon → Arbitrum",        m: "LayerZero CCIP",  t: "~30s",   fee: "0.2%",  live: false },
  ];

  const rails = [
    { n: "BEZ-Coin On-Chain",  t: "NATIVO",    i: "🪙", d: "Polygon + BNB Chain",        c: "#FFB800", live: true  },
    { n: "SEPA / SWIFT",       t: "BANCARIO",  i: "🏦", d: "ING España ES77 1465…",      c: "#2563EB", live: true  },
    { n: "Stripe",             t: "TARJETA",   i: "💳", d: "Cards + Apple/Google Pay",   c: "#635BFF", live: true  },
    { n: "MoonPay",            t: "FIAT RAMP", i: "🌙", d: "BEZ compra directa tarjeta", c: "#7D00FF", live: true  },
    { n: "Transak",            t: "FIAT RAMP", i: "🔄", d: "170+ países 75+ monedas",    c: "#00A2FF", live: true  },
    { n: "QuickSwap V3",       t: "DEX AMM",   i: "⚡", d: "Polygon LP pools BEZ/USDC",  c: "#00C896", live: true  },
  ];

  const apis = [
    { n: "Marine Traffic API",    c: "Logística",  s: "🟢", d: "AIS buques tiempo real"        },
    { n: "Bloomberg Commodity",   c: "RWA",        s: "🟡", d: "Precios commodity live"         },
    { n: "ASYCUDA World UNCTAD",  c: "Aduanas",    s: "🟢", d: "100+ países customs"            },
    { n: "Chainlink Oracles",     c: "Oracle",     s: "🟢", d: "Price feeds + VRF"              },
    { n: "Gemini 1.5 Pro Vision", c: "Cloud AI",   s: "🟢", d: "Visión + razonamiento"          },
    { n: "Claude Sonnet 4.6",     c: "Cloud AI",   s: "🟢", d: "Agente + visión API"            },
    { n: "ING Open Banking",      c: "Banking",    s: "🟢", d: "SEPA IBAN ES77 1465…"           },
    { n: "Tally Governance",      c: "DAO",        s: "🟢", d: "Propuestas + votos"             },
    { n: "Kleros Court SDK",      c: "Arbitraje",  s: "🟡", d: "Resolución disputas"            },
    { n: "Sensitech IoT",         c: "Cold Chain", s: "🟡", d: "Sensores temperatura"           },
    { n: "Slither / MythX",       c: "Security",   s: "🟢", d: "Auditoría smart contracts"      },
    { n: "SIMPLE Puertos ES",     c: "Aduanas",    s: "🟡", d: "Plataforma portuaria España"    },
  ];

  return (
    <div>
      {/* Bridge + Rails */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <Box glow col="#00C896">
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>CROSS-CHAIN BRIDGE</div>
          {bridges.map((b) => (
            <div key={b.r} style={{ padding: "8px 10px", background: C.card2, borderRadius: 10, marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: C.text2, fontFamily: C.mono }}>{b.r}</span>
                <span style={{ fontSize: 14 }}>{b.live ? "🟢" : "🔵"}</span>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 9, color: C.muted, fontFamily: C.mono }}>
                <span>{b.m}</span>
                <span>⏱ {b.t}</span>
                <span>🪙 {b.fee}</span>
              </div>
            </div>
          ))}
        </Box>

        <Box glow col="#2563EB">
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>PAYMENT RAILS ACTIVOS</div>
          {rails.map((r) => (
            <div
              key={r.n}
              style={{ padding: "7px 10px", background: C.card2, borderRadius: 10, marginBottom: 5, display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 16 }}>{r.i}</span>
                <div>
                  <div style={{ fontSize: 10, color: C.text, fontWeight: 700 }}>{r.n}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>{r.d}</div>
                </div>
              </div>
              <Tag col={r.c} sm>{r.live ? "LIVE" : "SOON"}</Tag>
            </div>
          ))}
        </Box>
      </div>

      {/* APIs table */}
      <Box>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
          EXTERNAL API INTEGRATIONS ({apis.length})
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 8 }}>
          {apis.map((a) => (
            <div
              key={a.n}
              style={{ padding: "10px 12px", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 12 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: C.text, fontWeight: 700 }}>{a.n}</span>
                <span style={{ fontSize: 14 }}>{a.s}</span>
              </div>
              <Tag col="#2563EB" sm>{a.c}</Tag>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 5 }}>{a.d}</div>
            </div>
          ))}
        </div>
      </Box>
    </div>
  );
}

// ─── TAB: MERGE GUIDE ────────────────────────────────────────────────────────
export function TabMerge() {
  const [cp, setCp] = useState("");
  const copy = (k, v) => {
    navigator.clipboard?.writeText(v);
    setCp(k);
    setTimeout(() => setCp(""), 2000);
  };

  const snippet = `// ── bezhas-pay-system.jsx — FUSIÓN EN 3 PASOS ──

// PASO 1: Importar el Master Dashboard (al inicio del archivo)
import BeZhasAgentMaster from './bezhas-agent-master';

// PASO 2: Añadir al array TABS (busca "const TABS=[")
{ id:"agents", icon:"🤖", label:"AI Agents", color:C.violet },

// PASO 3: Añadir en renderTab() (busca "switch(tab)")
case "agents": return <BeZhasAgentMaster wallet={wallet} engine={ENG} />;`;

  const envText = `# .env.production — Variables necesarias para los agentes

# ── IA ──────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...

# ── MCP Server ──────────────────────────────────────
MCP_SERVER_URL=mcp.bez.digital:4001
MCP_SERVER_PORT=4001

# ── Blockchain ───────────────────────────────────────
POLYGON_RPC=https://polygon-amoy.infura.io/v3/YOUR_KEY
BNB_RPC=https://bsc-dataseed.binance.org/

# ── Contratos (ya los tienes) ────────────────────────
BEZ_POLYGON=0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
BEZ_BNB=0x8a1e3930fde1f151471c368fdbb39f3f63a65b55
ESCROW=0x3EfC42095E8503d41Ad8001328FC23388E00e8a3
DAO=0x89c23890c742d710265dD61be789C71dC8999b12
HOT_WALLET=0x52Df82920CBAE522880dD7657e43d1A754eD044E

# ── Bridge ───────────────────────────────────────────
LAYERZERO_ENDPOINT=0x3c2269811836af69497E5F486A85D7316753cf62
WORMHOLE_BRIDGE=0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B

# ── Pagos fiat ───────────────────────────────────────
ING_IBAN=ES77146501009117663762100
MOONPAY_KEY=pk_live_...
TRANSAK_KEY=...

# ── Aduanas ──────────────────────────────────────────
ASYCUDA_API_URL=https://api.asycudaworld.org/v2
SIMPLE_API_URL=https://api.puertos.es/simple/v1`;

  const files = [
    { f: "bezhas-agents-constants.js",   d: "ARCHIVO 1 — Constantes compartidas: C, ADDR, GROUPS, MCP_TOOLS" },
    { f: "bezhas-agents-ui.jsx",         d: "ARCHIVO 2 — Átomos UI: Box, Tag, Btn, StatCard, StatusDot" },
    { f: "bezhas-tab-agents.jsx",        d: "ARCHIVO 3 — Tab 'AI Agents': 7 grupos, 24 agentes expandibles" },
    { f: "bezhas-tab-mcp-bez.jsx",       d: "ARCHIVO 4 — Tab 'MCP Server' + Tab 'BEZ Flows'" },
    { f: "bezhas-tab-bridge-merge.jsx",  d: "ARCHIVO 5 — Tab 'Bridge & APIs' + Tab 'Merge Guide'" },
    { f: "bezhas-agent-master.jsx",      d: "ARCHIVO 6 — Shell principal: header, tabs, log, ensamblaje" },
  ];

  const packageFiles = [
    { f: "packages/mcp-server/orchestrator.ts",    d: "analyzeGasStrategy · calculateSmartSwap · verifyAML" },
    { f: "packages/mcp-server/gas-strategy.ts",    d: "monitorCongestion · batchTransactions · predictWindow" },
    { f: "packages/mcp-server/smart-swap.ts",      d: "routeSwap · calcSlippage · findBestPool · crossChain" },
    { f: "packages/oracle/aegis-quality.ts",       d: "Claude Vision → score JSON → QualityEscrow trigger" },
    { f: "packages/oracle/food-oracle.ts",         d: "LiDAR + YOLOv8-S + Gemini → BCM NFT + ASYCUDA" },
    { f: "packages/oracle/cold-chain.ts",          d: "Sensitech IoT + Chainlink → cold break detection" },
    { f: "packages/bridge/universal-bridge.ts",    d: "LayerZero Lock-Mint · Wormhole · SAP/Shopify sync" },
    { f: "packages/payment/hybrid-payment.ts",     d: "Stripe + SEPA + MoonPay + Transak · dispenseTokens()" },
    { f: "packages/tokenomics/tokenomics-agent.ts",d: "APY dinámico · burn deflacionario · liquidez RT" },
    { f: "packages/dao/governor.ts",               d: "Tally + Snapshot · tesorería algorítmica · Gnosis" },
    { f: "packages/identity/did-agent.ts",         d: "W3C DIDs + VCs · Sumsub KYC · Proof-of-Reputation" },
    { f: "packages/staking/dynamic-staking.ts",    d: "StakingPoolV2.sol · lock multipliers · APY boost" },
    { f: "packages/social/content-quality.ts",     d: "Claude + Gemini eval · BEZ rewards automáticos" },
    { f: "packages/ai/bezhas-assistant.ts",        d: "NL → MCP tool call · staking/logistics por chat" },
    { f: "packages/audit/code-auditor.ts",         d: "Slither + MythX · PR auto con fix + gas optimization" },
  ];

  return (
    <div>
      {/* Intro banner */}
      <div
        style={{ padding: "12px 16px", background: "#00C89610", border: "1px solid #00C89633", borderRadius: 12, marginBottom: 14 }}
      >
        <div style={{ fontSize: 10, color: "#00C896", letterSpacing: 2, marginBottom: 4 }}>
          FUSIÓN AUTOMÁTICA CON bezhas-pay-system.jsx
        </div>
        <div style={{ fontSize: 11, color: C.text2, lineHeight: 1.8 }}>
          <strong style={{ color: "#00FFB2" }}>6 archivos JSX</strong> listos para copiar en tu proyecto.
          El componente <code style={{ color: "#FFB800", fontFamily: C.mono }}>BeZhasAgentMaster</code> acepta las props{" "}
          <code style={{ color: "#FFB800", fontFamily: C.mono }}>wallet</code> y{" "}
          <code style={{ color: "#FFB800", fontFamily: C.mono }}>engine</code> del BeZhasPayEngine ya existente.
        </div>
      </div>

      {/* Code snippets */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <Box>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: 2 }}>IMPORT EN PAY-SYSTEM.JSX</span>
            <Btn onClick={() => copy("snip", snippet)} col="#00C896" sm>
              {cp === "snip" ? "✓ Copiado" : "📋 Copiar"}
            </Btn>
          </div>
          <pre
            style={{ margin: 0, padding: 12, background: C.card3, borderRadius: 10, fontSize: 9.5, color: "#00FFB2", fontFamily: C.mono, overflow: "auto", lineHeight: 1.8, maxHeight: 200 }}
          >
            {snippet}
          </pre>
        </Box>
        <Box>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: C.muted, letterSpacing: 2 }}>VARIABLES DE ENTORNO</span>
            <Btn onClick={() => copy("env", envText)} col="#FFB800" sm>
              {cp === "env" ? "✓ Copiado" : "📋 Copiar"}
            </Btn>
          </div>
          <pre
            style={{ margin: 0, padding: 12, background: C.card3, borderRadius: 10, fontSize: 9.5, color: C.text2, fontFamily: C.mono, overflow: "auto", lineHeight: 1.8, maxHeight: 200 }}
          >
            {envText}
          </pre>
        </Box>
      </div>

      {/* 6 JSX files */}
      <Box style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
          LOS 6 ARCHIVOS JSX — COPIAR EN CARPETA /src O /components
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {files.map((f, i) => (
            <div
              key={f.f}
              style={{ padding: "9px 12px", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, display: "flex", gap: 10, alignItems: "center" }}
            >
              <div
                style={{ width: 22, height: 22, borderRadius: "50%", background: "#00C89620", border: "1px solid #00C89644", display: "flex", alignItems: "center", justifyContent: "center", color: "#00C896", fontSize: 9, fontWeight: 900, flexShrink: 0, fontFamily: C.mono }}
              >
                {i + 1}
              </div>
              <div>
                <div style={{ color: "#00C896", fontFamily: C.mono, fontSize: 10, marginBottom: 2 }}>{f.f}</div>
                <div style={{ fontSize: 9.5, color: C.text2 }}>{f.d}</div>
              </div>
            </div>
          ))}
        </div>
      </Box>

      {/* Package files */}
      <Box>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 12 }}>
          FICHEROS TypeScript BACKEND — CARPETA /packages ({packageFiles.length} ficheros)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {packageFiles.map((f) => (
            <div
              key={f.f}
              style={{ padding: "8px 10px", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, display: "flex", gap: 8 }}
            >
              <span style={{ color: "#7C3AED", fontSize: 14, flexShrink: 0 }}>📄</span>
              <div>
                <div style={{ color: "#7C3AED", fontFamily: C.mono, fontSize: 9, marginBottom: 2 }}>{f.f}</div>
                <div style={{ fontSize: 9, color: C.text2 }}>{f.d}</div>
              </div>
            </div>
          ))}
        </div>
      </Box>
    </div>
  );
}
