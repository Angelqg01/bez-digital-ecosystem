import { useState } from "react";

const sectors = [
  {
    id: "logistics",
    icon: "⚓",
    title: "Logística Marítima & Aduanas",
    color: "#00D4FF",
    glow: "rgba(0,212,255,0.3)",
    agents: [
      {
        name: "ShipTrack Agent",
        role: "Tokeniza contenedores BL (Bill of Lading) como NFTs en tiempo real",
        revenue: "0.3% por transacción de tokenización",
        tech: "AIS API + Oracle Chainlink + BeZhasNFT.sol",
      },
      {
        name: "CustomsClear Agent",
        role: "Automatiza declaraciones aduaneras con IA, verifica documentos y libera mercancías contra smart contract",
        revenue: "Fee por despacho + penalización automática por fraude",
        tech: "LogisticsContainer.sol + GPT Vision OCR + APIs Aduanas EU",
      },
      {
        name: "RWA Cargo Agent",
        role: "Tokeniza carga física (petróleo, grano, minerales) como activos fraccionales negociables en DEX",
        revenue: "2-5% management fee anual sobre activos tokenizados",
        tech: "BeZhasRWAFactory.sol + QualityOracle.sol",
      },
      {
        name: "Insurance Escrow Agent",
        role: "Crea pólizas de seguro marítimo on-chain, liquida siniestros automáticamente con datos IoT",
        revenue: "Prima del seguro en BEZ-Coin",
        tech: "BeZhasCore.sol + Chainlink Weather + IoT Sensors",
      },
    ],
  },
  {
    id: "realestate",
    icon: "🏢",
    title: "Inmobiliaria & RWA",
    color: "#FF6B35",
    glow: "rgba(255,107,53,0.3)",
    agents: [
      {
        name: "PropToken Agent",
        role: "Fracciona propiedades en tokens ERC-1155, gestiona KYC/AML y distribuye rentas automáticamente",
        revenue: "1-3% tokenización + 10% de rentas como fee",
        tech: "BeZhasRealEstate.sol + BeZhasRWAFactory.sol",
      },
      {
        name: "Valuation Agent",
        role: "Analiza mercado inmobiliario en tiempo real, ajusta precio de tokens según comparables y macroeconomía",
        revenue: "Spread en compraventa + asesoría premium",
        tech: "Claude Sonnet + APIs Catastro + Zillow API",
      },
      {
        name: "SmartLease Agent",
        role: "Gestiona contratos de arrendamiento, cobra rentas en BEZ, ejecuta desahucio on-chain si impago",
        revenue: "Fee mensual por gestión + comisión arrendamiento",
        tech: "StakingPoolV2.sol + SEPA Rails + ING España",
      },
      {
        name: "DueDiligence Agent",
        role: "Audita documentación jurídica de inmuebles, detecta cargas, hipotecas y litigios via IA",
        revenue: "Fee por informe + SaaS subscription en BEZ",
        tech: "Registro de la Propiedad APIs + Claude Vision",
      },
    ],
  },
  {
    id: "health",
    icon: "🏥",
    title: "Salud & Hospitales",
    color: "#00FF88",
    glow: "rgba(0,255,136,0.3)",
    agents: [
      {
        name: "MedRecord Agent",
        role: "Tokeniza historiales clínicos como SBT (Soulbound Tokens), el paciente controla acceso con firma",
        revenue: "Subscription hospitales + fee por consulta de datos",
        tech: "BeZhasNFT.sol + ZK-Proofs + HL7 FHIR API",
      },
      {
        name: "PharmaTrak Agent",
        role: "Rastrea cadena de suministro farmacéutica desde laboratorio hasta paciente, detecta falsificaciones",
        revenue: "B2B SaaS fee + penalización anti-fraude",
        tech: "LogisticsContainer.sol + QualityOracle.sol + RFID",
      },
      {
        name: "Insurance Claim Agent",
        role: "Procesa reclamaciones de seguros médicos on-chain, verifica diagnósticos con IA y liquida al instante",
        revenue: "Fee por liquidación + float de fondos en staking",
        tech: "QualityEscrow + BeZhasRewardsCalculator.sol",
      },
      {
        name: "Clinical Trial Agent",
        role: "Gestiona consentimiento informado on-chain, tokeniza datos anonimizados para Big Pharma",
        revenue: "Venta de datasets tokenizados a farmacéuticas",
        tech: "ZK-SNARK + BeZhasMarketplace.sol",
      },
    ],
  },
  {
    id: "energy",
    icon: "⚡",
    title: "Energía Renovable",
    color: "#FFD700",
    glow: "rgba(255,215,0,0.3)",
    agents: [
      {
        name: "GreenToken Agent",
        role: "Tokeniza créditos de carbono y certificados REC (Renewable Energy Certificate) verificados",
        revenue: "2% comisión por emisión + trading fees en DEX",
        tech: "BeZhasRWAFactory.sol + Verra Registry API",
      },
      {
        name: "P2P Energy Agent",
        role: "Facilita comercio peer-to-peer de energía entre prosumidores via microgrid, liquida en BEZ",
        revenue: "Spread de mercado + fee de matching",
        tech: "BeZhasMarketplace.sol + Smart Meters IoT",
      },
      {
        name: "Solar DeFi Agent",
        role: "Fracciona parques solares y eólicos, distribuye dividendos de producción diaria en stablecoins",
        revenue: "Management fee + carried interest",
        tech: "StakingPoolV2.sol + QuickSwap V3 + LayerZero",
      },
      {
        name: "ESG Score Agent",
        role: "Calcula score ESG on-chain para empresas, tokeniza la reputación sostenible como activo negociable",
        revenue: "Certificación SaaS + advisory premium",
        tech: "QualityOracle.sol + Claude Analysis",
      },
    ],
  },
];

const monetization = [
  { icon: "💰", label: "Transaction Fees", desc: "0.1–3% en cada operación tokenizada", amount: "$2M–50M/año" },
  { icon: "📊", label: "SaaS B2B", desc: "Subscripción mensual por sector enterprise", amount: "$500–50K/mes" },
  { icon: "🏦", label: "DeFi Yield", desc: "Liquidez en pools genera APY para el protocolo", amount: "5–40% APY" },
  { icon: "🪙", label: "BEZ-Coin Utility", desc: "Demanda de token sube con cada integración", amount: "10–100x potencial" },
  { icon: "🤝", label: "B2B Licensing", desc: "API access para Maersk, hospitales, inmobiliarias", amount: "$100K–1M/contrato" },
  { icon: "📈", label: "Data Marketplace", desc: "Datos anonimizados tokenizados vendidos a empresas", amount: "$10K–500K/dataset" },
];

export default function BeZhasAgents() {
  const [activeSector, setActiveSector] = useState("logistics");
  const [hoveredAgent, setHoveredAgent] = useState(null);

  const active = sectors.find((s) => s.id === activeSector);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#030712",
      fontFamily: "'Courier New', monospace",
      color: "#e2e8f0",
      padding: "0",
      overflow: "hidden",
    }}>
      {/* Animated grid background */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            display: "inline-block",
            padding: "4px 16px",
            border: "1px solid rgba(0,212,255,0.4)",
            borderRadius: 2,
            fontSize: 11,
            letterSpacing: 4,
            color: "#00D4FF",
            marginBottom: 16,
            textTransform: "uppercase",
          }}>
            ◆ BeZhas Blockchain Intelligence ◆
          </div>
          <h1 style={{
            fontSize: "clamp(28px, 5vw, 52px)",
            fontWeight: 900,
            margin: "0 0 8px",
            fontFamily: "'Georgia', serif",
            background: "linear-gradient(135deg, #ffffff 0%, #00D4FF 50%, #FF6B35 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: -1,
          }}>
            AI Agents sobre BeZhas Chain
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>
            Tokenización RWA · Logística Marítima · Hospitales · Energía · Inmobiliaria
          </p>
        </div>

        {/* Sector Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 32, flexWrap: "wrap", justifyContent: "center" }}>
          {sectors.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSector(s.id)}
              style={{
                padding: "10px 20px",
                background: activeSector === s.id ? s.color : "rgba(255,255,255,0.04)",
                color: activeSector === s.id ? "#000" : s.color,
                border: `1px solid ${activeSector === s.id ? s.color : "rgba(255,255,255,0.1)"}`,
                borderRadius: 3,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Courier New', monospace",
                letterSpacing: 1,
                transition: "all 0.2s",
                boxShadow: activeSector === s.id ? `0 0 20px ${s.glow}` : "none",
              }}
            >
              {s.icon} {s.title.split(" ")[0]}
            </button>
          ))}
        </div>

        {/* Active Sector Title */}
        <div style={{
          padding: "16px 24px",
          borderLeft: `3px solid ${active.color}`,
          marginBottom: 24,
          background: `linear-gradient(90deg, ${active.glow} 0%, transparent 100%)`,
        }}>
          <h2 style={{ margin: 0, fontSize: 22, color: active.color, letterSpacing: 1 }}>
            {active.icon} {active.title}
          </h2>
        </div>

        {/* Agents Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginBottom: 48,
        }}>
          {active.agents.map((agent, i) => (
            <div
              key={i}
              onMouseEnter={() => setHoveredAgent(i)}
              onMouseLeave={() => setHoveredAgent(null)}
              style={{
                padding: 20,
                background: hoveredAgent === i
                  ? `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, ${active.glow} 100%)`
                  : "rgba(255,255,255,0.03)",
                border: `1px solid ${hoveredAgent === i ? active.color : "rgba(255,255,255,0.08)"}`,
                borderRadius: 4,
                cursor: "pointer",
                transition: "all 0.3s",
                transform: hoveredAgent === i ? "translateY(-3px)" : "none",
                boxShadow: hoveredAgent === i ? `0 8px 30px ${active.glow}` : "none",
              }}
            >
              <div style={{
                fontSize: 11,
                letterSpacing: 3,
                color: active.color,
                textTransform: "uppercase",
                marginBottom: 8,
                fontWeight: 700,
              }}>
                ◈ AGENT_{String(i + 1).padStart(2, "0")}
              </div>
              <h3 style={{ margin: "0 0 10px", fontSize: 16, color: "#f1f5f9", letterSpacing: 0.5 }}>
                {agent.name}
              </h3>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                {agent.role}
              </p>
              <div style={{
                padding: "8px 12px",
                background: "rgba(0,0,0,0.4)",
                borderRadius: 2,
                marginBottom: 10,
                borderLeft: `2px solid ${active.color}`,
              }}>
                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2, letterSpacing: 1 }}>REVENUE MODEL</div>
                <div style={{ fontSize: 11, color: "#e2e8f0" }}>{agent.revenue}</div>
              </div>
              <div style={{
                fontSize: 10,
                color: "#475569",
                padding: "6px 10px",
                background: "rgba(0,0,0,0.3)",
                borderRadius: 2,
                letterSpacing: 0.5,
              }}>
                🔧 {agent.tech}
              </div>
            </div>
          ))}
        </div>

        {/* Monetization Section */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: 40,
          marginBottom: 40,
        }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 11, letterSpacing: 4, color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>
              ◆ Cómo Generar Ingresos Masivos ◆
            </div>
            <h2 style={{ margin: 0, fontSize: 26, color: "#f8fafc", fontFamily: "'Georgia', serif" }}>
              Modelo de Monetización BeZhas
            </h2>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}>
            {monetization.map((m, i) => (
              <div key={i} style={{
                padding: 16,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 4,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{m.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 8, lineHeight: 1.5 }}>{m.desc}</div>
                <div style={{
                  fontSize: 11,
                  color: "#00FF88",
                  fontWeight: 700,
                  padding: "4px 8px",
                  background: "rgba(0,255,136,0.08)",
                  borderRadius: 2,
                  border: "1px solid rgba(0,255,136,0.2)",
                }}>
                  {m.amount}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Architecture Summary */}
        <div style={{
          padding: 24,
          background: "rgba(0,212,255,0.04)",
          border: "1px solid rgba(0,212,255,0.15)",
          borderRadius: 4,
          marginBottom: 32,
        }}>
          <h3 style={{ margin: "0 0 16px", color: "#00D4FF", fontSize: 14, letterSpacing: 3, textTransform: "uppercase" }}>
            ◈ Stack Técnico del Servidor de Agentes
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {[
              { layer: "Capa de Orquestación", stack: "Claude Sonnet + Gemini CLI + MCP Servers" },
              { layer: "Capa Blockchain", stack: "BNB Chain + Polygon + LayerZero + Wormhole" },
              { layer: "Capa DeFi", stack: "QuickSwap V3 + Uniswap V3 + StakingPoolV2" },
              { layer: "Capa Fiat/Banking", stack: "MoonPay + Transak + SEPA/SWIFT + ING España" },
              { layer: "Capa Datos Reales", stack: "Chainlink Oracles + AIS + HL7 + RFID IoT" },
              { layer: "Capa Seguridad", stack: "ZK-Proofs + Safe Wallet + QualityEscrow" },
            ].map((l, i) => (
              <div key={i} style={{ fontSize: 11 }}>
                <div style={{ color: "#64748b", marginBottom: 2, letterSpacing: 1 }}>{l.layer.toUpperCase()}</div>
                <div style={{ color: "#94a3b8" }}>{l.stack}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", color: "#1e293b", fontSize: 11, letterSpacing: 2 }}>
          bez.digital · BEZ-COIN · BNB CHAIN + POLYGON · AI AGENT INFRASTRUCTURE ◆
        </div>
      </div>
    </div>
  );
}
