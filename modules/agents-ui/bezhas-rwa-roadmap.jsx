import { useState, useEffect } from "react";

const ALL_SECTORS = [
  {
    id: "logistics",
    phase: 1,
    priority: "FASE 1 — LANZAMIENTO",
    icon: "⚓",
    title: "Logística Marítima & Aduanas",
    subtitle: "Bill of Lading · Contenedores · Flete · Aduana",
    color: "#F5A623",
    dark: "#7A4F08",
    marketSize: "$14 Billones/año",
    bezRevenue: "$2M–80M/año",
    readiness: 95,
    tags: ["NFT", "Oracle", "IoT", "RFID", "AIS"],
    agents: [
      {
        name: "ShipTrack Agent",
        icon: "🚢",
        description: "Conecta APIs AIS (Marine Traffic, VesselFinder) en tiempo real. Tokeniza cada Bill of Lading como NFT único con metadatos del contenedor: ruta, peso, manifiesto, temperatura. El NFT transfiere la propiedad de la carga on-chain.",
        contracts: ["LogisticsContainer.sol", "BeZhasNFT.sol", "BeZhasMarketplace.sol"],
        apis: ["Marine Traffic API", "AIS Hub", "MSC API", "Maersk Connect"],
        revenue: "0.2–0.5% sobre valor de cada carga tokenizada",
        impact: "🔴 CRÍTICO",
        steps: [
          "Integrar Marine Traffic API → obtener posición y datos del buque",
          "Al cargar contenedor, mint NFT con hash del B/L original",
          "Smart contract LogisticsContainer.sol registra: origen, destino, naviera, ETA",
          "Transferencia de B/L = transferencia del NFT → elimina fraude documental",
          "Fee en BEZ por cada mint + por cada transferencia de propiedad",
        ],
      },
      {
        name: "CustomsClear Agent",
        icon: "🛃",
        description: "IA con visión artificial (Claude Vision) lee documentos aduaneros (DUA, CMR, AWB) y los verifica automáticamente. Cuando todos los documentos están validados on-chain, el smart contract libera la carga sin intervención humana.",
        contracts: ["BeZhasCore.sol", "QualityEscrow", "LogisticsContainer.sol"],
        apis: ["AEAT API España", "EU Customs API", "WCO DataModel", "TradeNet Singapore"],
        revenue: "Fee fijo por despacho ($50–500) + penalización automática por fraude",
        impact: "🔴 CRÍTICO",
        steps: [
          "Upload documento aduanero → Claude Vision extrae datos estructurados",
          "Verificación cruzada con base de datos TARIC/HS Codes on-chain",
          "QualityEscrow bloquea fondos hasta liberación aduanera",
          "Agente confirma matching → smart contract libera carga + fondos",
          "Registro inmutable de toda la cadena de custodia",
        ],
      },
      {
        name: "RWA Cargo Agent",
        icon: "📦",
        description: "Tokeniza cargas de alto valor (petróleo, grano, cobre, LNG) como activos fraccionados negociables. Inversores compran fracciones de la carga física en tránsito y reciben rendimiento cuando llega al destino.",
        contracts: ["BeZhasRWAFactory.sol", "QualityOracle.sol", "StakingPoolV2.sol"],
        apis: ["Bloomberg Commodity API", "LME (London Metal Exchange)", "Platts S&P"],
        revenue: "2–5% management fee + 15% carried interest sobre plusvalías",
        impact: "🟡 ALTO",
        steps: [
          "Valuación de carga via oráculos de precios commodity",
          "Mint tokens ERC-1155 representando fracciones de la carga",
          "Pool de liquidez en QuickSwap V3 para trading secundario",
          "Entrega física certificada = burn del token + distribución de ganancias",
          "Seguro on-chain via BeZhasCore.sol",
        ],
      },
      {
        name: "Port Finance Agent",
        icon: "🏗️",
        description: "Financia operaciones portuarias (grúas, almacenes, terminales) emitiendo bonos tokenizados respaldados por flujos de caja del puerto. Los holders reciben cupones en BEZ-Coin cada mes.",
        contracts: ["BeZhasRWAFactory.sol", "BeZhasRewardsCalculator.sol", "StakingPoolV2.sol"],
        apis: ["APM Terminals API", "DP World API", "Port Authority APIs"],
        revenue: "Fee de emisión 1% + spread de gestión 0.5%/año",
        impact: "🟡 ALTO",
        steps: [
          "Due diligence financiero del puerto con IA",
          "Emisión de tokenBond con calendario de cupones coded en contrato",
          "Distribución automática de cupones mensuales en BEZ",
          "Rating crediticio on-chain actualizado por QualityOracle",
          "Mercado secundario en BeZhasMarketplace.sol",
        ],
      },
      {
        name: "Maritime Insurance Agent",
        icon: "🛡️",
        description: "Crea pólizas de seguro marítimo P&I (Protection & Indemnity) on-chain. Sensores IoT en contenedores reportan temperatura, humedad y golpes. Si hay siniestro, el agente liquida automáticamente sin reclamación manual.",
        contracts: ["BeZhasCore.sol", "QualityEscrow", "QualityOracle.sol"],
        apis: ["Chainlink Weather", "IoT Platform AWS", "Lloyd's of London API", "P&I Clubs"],
        revenue: "Prima del seguro en BEZ + float de reservas en DeFi (APY 8–15%)",
        impact: "🟢 MEDIO",
        steps: [
          "Sensor IoT reporta datos del contenedor cada hora a Oracle",
          "Prima calculada dinámicamente según ruta, clima, tipo de carga",
          "Reservas en StakingPool generando rendimiento mientras no hay siniestro",
          "Siniestro detectado automáticamente → liquidación instantánea en BEZ",
          "Histórico de reclamaciones mejora modelo de pricing on-chain",
        ],
      },
      {
        name: "Cold Chain Agent",
        icon: "❄️",
        description: "Especializado en cadena de frío farmacéutica y alimentaria. Monitorea temperatura crítica en tiempo real. Si se rompe la cadena de frío, el NFT se marca como comprometido y activa compensación automática.",
        contracts: ["LogisticsContainer.sol", "QualityOracle.sol", "BeZhasNFT.sol"],
        apis: ["Sensitech API", "Emerson Cold Chain", "FDA Track & Trace", "EFSA APIs"],
        revenue: "SaaS mensual $2K–20K por flota + penalizaciones automáticas",
        impact: "🟢 MEDIO",
        steps: [
          "Sensors IoT BLE/NFC en cada envío reportan temp cada 15min",
          "Oracle on-chain actualiza estado del NFT en tiempo real",
          "Temperatura fuera de rango → NFT estado = COMPROMISED",
          "Smart contract activa compensación automática al destinatario",
          "Trazabilidad completa cumpliendo GDP/GMP regulatorio",
        ],
      },
    ],
  },
  {
    id: "realestate",
    phase: 2,
    priority: "FASE 2 — Q2 2025",
    icon: "🏢",
    title: "Inmobiliaria & Proptech",
    subtitle: "Tokenización · Fracciones · Rentas · Hipotecas",
    color: "#FF6B35",
    dark: "#7A2808",
    marketSize: "$326 Billones/año",
    bezRevenue: "$5M–200M/año",
    readiness: 88,
    tags: ["ERC-1155", "RWA", "SEPA", "KYC", "DeFi"],
    agents: [
      { name: "PropToken Agent", icon: "🏠", description: "Fracciona inmuebles en tokens ERC-1155. 1 token = 1m² o fracción proporcional. Inversores desde €100 compran fracciones de edificios prime en Madrid, CDMX o Miami.", contracts: ["BeZhasRealEstate.sol", "BeZhasRWAFactory.sol"], apis: ["Catastro España API", "Registro Propiedad", "Idealista API", "Zillow API"], revenue: "1.5% tokenización + 10% de rentas mensuales como fee de gestión", impact: "🔴 CRÍTICO", steps: ["Due diligence jurídico automatizado con IA", "Tasación con comparables en tiempo real", "Mint tokens ERC-1155 con metadatos del inmueble", "Distribución automática de rentas mensuales en BEZ", "Mercado secundario P2P en BeZhasMarketplace"] },
      { name: "SmartMortgage Agent", icon: "🏦", description: "Hipotecas DeFi: el inmueble tokenizado es el colateral. Préstamos en stablecoins o BEZ con liquidación automática si LTV supera umbral. Sin bancos, sin esperas, sin burocracia.", contracts: ["BeZhasCore.sol", "StakingPoolV2.sol", "QualityEscrow"], apis: ["ING España SEPA", "SWIFT gpi", "Euribor Oracle"], revenue: "Spread de interés 1–3% + fee de originación 0.5%", impact: "🔴 CRÍTICO", steps: ["Tasación del inmueble → valor on-chain vía oracle", "LTV máximo 70% → préstamo en BEZ o USDC", "Cuotas mensuales via SEPA automatizado", "LTV > 80% → liquidación parcial automática", "Historial crediticio on-chain para re-scoring"] },
      { name: "RentStream Agent", icon: "💳", description: "Cobra alquileres en fiat via SEPA/SWIFT, convierte a BEZ automáticamente y distribuye proporcional a todos los token-holders en el mismo bloque.", contracts: ["BeZhasRewardsCalculator.sol", "StakingPoolV2.sol"], apis: ["ING España ES77 1465 0100 91 1766376210", "Stripe Rent", "SEPA Direct Debit"], revenue: "0.5% por distribución + float en staking entre cobro y distribución", impact: "🟡 ALTO", steps: [] },
      { name: "DueDiligence Agent", icon: "🔍", description: "Audita en minutos lo que un notario tarda semanas: cargas, hipotecas, embargos, litigios, ocupantes ilegales. Genera informe certificado on-chain con hash verificable.", contracts: ["QualityOracle.sol", "BeZhasNFT.sol"], apis: ["Registro Propiedad API", "AEAT Embargos", "Poder Judicial API", "Catastro"], revenue: "€500–2000 por informe + SaaS €2K/mes para agencias", impact: "🟡 ALTO", steps: [] },
    ],
  },
  {
    id: "health",
    phase: 3,
    priority: "FASE 3 — Q3 2025",
    icon: "🏥",
    title: "Salud & Hospitales",
    subtitle: "Historiales · Farmacia · Seguros · Ensayos Clínicos",
    color: "#00FF88",
    dark: "#006633",
    marketSize: "$12 Billones/año",
    bezRevenue: "$3M–100M/año",
    readiness: 75,
    tags: ["ZK-Proof", "SBT", "HL7", "FHIR", "GDPR"],
    agents: [
      { name: "MedRecord Agent", icon: "📋", description: "Historial clínico como Soulbound Token (SBT) — no transferible, solo el paciente controla acceso. Hospitales pagan en BEZ para consultar con autorización del paciente.", contracts: ["BeZhasNFT.sol", "BeZhasCore.sol"], apis: ["HL7 FHIR R4", "IHE XDS", "Seguridad Social API España"], revenue: "€0.50–5 por consulta de historial + SaaS hospital €10K–50K/mes", impact: "🔴 CRÍTICO", steps: [] },
      { name: "PharmaTrak Agent", icon: "💊", description: "Rastreo de medicamentos desde laboratorio hasta paciente con NFC/RFID. Detecta falsificaciones, caducidades y desvíos. Cumple EU FMD (Falsified Medicines Directive).", contracts: ["LogisticsContainer.sol", "QualityOracle.sol"], apis: ["EMVO EMVS API", "GS1 EPCIS", "AEMPS España"], revenue: "B2B SaaS €50K–500K/año por laboratorio farmacéutico", impact: "🔴 CRÍTICO", steps: [] },
      { name: "ClaimBot Agent", icon: "🤝", description: "Procesa reclamaciones de seguros médicos en segundos. IA verifica diagnóstico CIE-10, valida tratamiento según protocolos, calcula indemnización y liquida en BEZ al instante.", contracts: ["QualityEscrow", "BeZhasRewardsCalculator.sol"], apis: ["ICD-10 WHO API", "Asisa API", "Sanitas API", "Adeslas API"], revenue: "1.5% de cada liquidación + float de reservas médicas en DeFi", impact: "🟡 ALTO", steps: [] },
      { name: "BioData Agent", icon: "🧬", description: "Anonimiza y tokeniza datos clínicos para venta ética a farmacéuticas e investigadores. El paciente recibe micropagos en BEZ cada vez que sus datos (anonimizados) son usados en estudios.", contracts: ["BeZhasMarketplace.sol", "BeZhasRWAFactory.sol"], apis: ["ZK-SNARK Proof", "Genomics APIs", "ClinicalTrials.gov"], revenue: "20% de cada venta de dataset + 80% al paciente-proveedor", impact: "🟡 ALTO", steps: [] },
    ],
  },
  {
    id: "energy",
    phase: 4,
    priority: "FASE 4 — Q4 2025",
    icon: "⚡",
    title: "Energía Renovable",
    subtitle: "Créditos Carbono · RECs · P2P Energy · Solar DeFi",
    color: "#FFD700",
    dark: "#7A6200",
    marketSize: "$2.3 Billones/año",
    bezRevenue: "$1M–40M/año",
    readiness: 80,
    tags: ["Carbon", "REC", "IoT", "P2P", "ESG"],
    agents: [
      { name: "GreenToken Agent", icon: "🌱", description: "Tokeniza créditos de carbono verificados (Gold Standard, VCS) y RECs. Empresas compran en BeZhasMarketplace para compensar su huella. Más transparente que el mercado OTC actual.", contracts: ["BeZhasRWAFactory.sol", "QualityOracle.sol", "BeZhasMarketplace.sol"], apis: ["Verra Registry API", "Gold Standard API", "ERCOT", "REGo UK"], revenue: "2% sobre cada tonelada CO2 tokenizada + trading fees", impact: "🔴 CRÍTICO", steps: [] },
      { name: "P2P Energy Agent", icon: "🔋", description: "Vecinos con paneles solares venden excedentes a vecinos sin paneles, liquidando automáticamente en BEZ según lectura de smart meters cada 15 minutos.", contracts: ["BeZhasMarketplace.sol", "BeZhasCore.sol"], apis: ["Endesa API", "Iberdrola Smart Meter", "ENTSO-E", "REE Red Eléctrica"], revenue: "Spread de mercado 0.3–1% + fee de matching €0.001/kWh", impact: "🟡 ALTO", steps: [] },
      { name: "Solar DeFi Agent", icon: "☀️", description: "Fracciona parques solares y eólicos. Inversores desde €500 reciben dividendos diarios según producción real medida por oracle IoT. Liquidity pool en QuickSwap.", contracts: ["StakingPoolV2.sol", "BeZhasRWAFactory.sol"], apis: ["SolarEdge API", "PVGIS Europa", "Windcentrale", "OMIE precios España"], revenue: "Management fee 1.5%/año + 10% de producción excedente", impact: "🟡 ALTO", steps: [] },
    ],
  },
  {
    id: "agro",
    phase: 5,
    priority: "FASE 5 — Q1 2026",
    icon: "🌾",
    title: "Agroindustria & Commodities",
    subtitle: "Cosechas · Ganado · Agua · Tierras Agrícolas",
    color: "#8BC34A",
    dark: "#3A5F1A",
    marketSize: "$10 Billones/año",
    bezRevenue: "$2M–60M/año",
    readiness: 70,
    tags: ["Commodities", "IoT", "GIS", "Satellite", "DeFi"],
    agents: [
      { name: "CropToken Agent", icon: "🌽", description: "Tokeniza cosechas antes de la siembra: inversores financian la campaña agrícola y reciben parte de la cosecha al precio de mercado. Agricultura DeFi = nuevo modelo de financiación rural.", contracts: ["BeZhasRWAFactory.sol", "QualityOracle.sol"], apis: ["CBOT CME Futures", "Copernicus Satellite", "AEMET Agro", "USDA NASS"], revenue: "Fee de originación 1% + 5% del yield de la cosecha", impact: "🔴 CRÍTICO", steps: [] },
      { name: "LandToken Agent", icon: "🗺️", description: "Tokeniza hectáreas de tierras agrícolas en LATAM (Brasil, Argentina, Colombia) donde los precios son 10x más bajos que Europa. Fraccionamiento desde €1000/ha.", contracts: ["BeZhasRealEstate.sol", "BeZhasRWAFactory.sol"], apis: ["INCRA Brasil", "Catastro Argentina", "GPS Satellite APIs", "LandDB"], revenue: "1.5% tokenización + 8% de renta agrícola anual", impact: "🔴 CRÍTICO", steps: [] },
      { name: "WaterRight Agent", icon: "💧", description: "Tokeniza derechos de agua en zonas de escasez hídrica. Los derechos de agua son activos regulados con valor creciente por cambio climático. Primer mercado on-chain de agua.", contracts: ["BeZhasRWAFactory.sol", "BeZhasMarketplace.sol"], apis: ["CHE Ebro API", "AQUASTAT FAO", "DGA Chile"], revenue: "2% tokenización + trading fees en mercado secundario", impact: "🟡 ALTO", steps: [] },
    ],
  },
  {
    id: "mining",
    phase: 6,
    priority: "FASE 6 — Q2 2026",
    icon: "⛏️",
    title: "Minería & Metales Preciosos",
    subtitle: "Oro · Plata · Litio · Cobre · Diamantes",
    color: "#C0A060",
    dark: "#5A4010",
    marketSize: "$20 Billones/año",
    bezRevenue: "$3M–90M/año",
    readiness: 65,
    tags: ["Gold", "Bullion", "RWA", "Custody", "Fraccional"],
    agents: [
      { name: "GoldToken Agent", icon: "🥇", description: "Cada token = 1 gramo de oro físico custodiado en bóvedas certificadas (Brinks, Loomis). Respaldo 1:1 verificable on-chain via auditoría IoT de peso en tiempo real.", contracts: ["BeZhasRWAFactory.sol", "QualityOracle.sol"], apis: ["LBMA Gold Price", "Comex CME", "Brinks Vault API", "Assay Certificate APIs"], revenue: "0.15%/año custody fee + 0.1% transacción", impact: "🔴 CRÍTICO", steps: [] },
      { name: "LithiumChain Agent", icon: "🔋", description: "Tokeniza reservas y producción de litio (crítico para baterías EV). Mineras en Chile y Bolivia pueden financiarse emitiendo tokens respaldados por reservas certificadas.", contracts: ["BeZhasRWAFactory.sol", "BeZhasCore.sol"], apis: ["USGS Mineral Resources", "Fastmarkets Lithium", "SQM Chile API"], revenue: "1% emisión + 0.5% royalty por tonelada producida", impact: "🟡 ALTO", steps: [] },
    ],
  },
  {
    id: "aviation",
    phase: 7,
    priority: "FASE 7 — Q3 2026",
    icon: "✈️",
    title: "Aviación & Transporte Aéreo",
    subtitle: "Flota · MRO · Slots · Carga Aérea · AWB",
    color: "#4FC3F7",
    dark: "#0A4A6A",
    marketSize: "$900B/año",
    bezRevenue: "$1M–30M/año",
    readiness: 55,
    tags: ["AWB", "MRO", "Slots", "Leasing", "NFT"],
    agents: [
      { name: "AircraftToken Agent", icon: "🛩️", description: "Tokeniza aviones como activos fraccionables. Un Boeing 737 vale $80M — fraccionar en 80,000 tokens de $1000 cada uno, con yield por leasing operativo.", contracts: ["BeZhasRWAFactory.sol", "StakingPoolV2.sol"], apis: ["ACAS Aircraft Values", "Avac Appraisal", "ICAO Aircraft Registry"], revenue: "1% tokenización + 8-12% yield anual por leasing", impact: "🟡 ALTO", steps: [] },
      { name: "AirCargo Agent", icon: "📬", description: "Tokeniza Air Waybills (AWB) de carga aérea, mismo modelo que Bill of Lading marítimo pero para carga urgente de alto valor (electrónica, farmacéutica, perecederos).", contracts: ["LogisticsContainer.sol", "BeZhasNFT.sol"], apis: ["IATA Cargo APIs", "CHAMP Cargosystems", "WorldACD"], revenue: "0.3% por AWB tokenizado + fee de financiación de carga", impact: "🟡 ALTO", steps: [] },
    ],
  },
  {
    id: "art",
    phase: 8,
    priority: "FASE 8 — Q4 2026",
    icon: "🎨",
    title: "Arte, Lujo & Coleccionables",
    subtitle: "Arte · Vinos · Relojes · Coches Clásicos · Whisky",
    color: "#CE93D8",
    dark: "#5A1A6A",
    marketSize: "$1.7 Billones/año",
    bezRevenue: "$500K–15M/año",
    readiness: 72,
    tags: ["NFT", "Provenance", "Fraccional", "Custody", "Luxury"],
    agents: [
      { name: "ArtToken Agent", icon: "🖼️", description: "Tokeniza obras de arte físicas con certificado de autenticidad on-chain. Fraccionamiento desde €500 por Picasso o Basquiat. Custodia en freeport certificado con seguro on-chain.", contracts: ["BeZhasNFT.sol", "BeZhasRWAFactory.sol", "BeZhasMarketplace.sol"], apis: ["Artory Registry", "Art Basel Index", "Christie's API", "Sotheby's Metaverse"], revenue: "2% tokenización + 15% comisión en reventa", impact: "🟡 ALTO", steps: [] },
      { name: "WineVault Agent", icon: "🍷", description: "Tokeniza botellas de vino fine y whisky añejo custodiadas en bodegas certificadas. El token certifica origen, custodia y valoración actualizada por sommelier oracle.", contracts: ["BeZhasRWAFactory.sol", "QualityOracle.sol"], apis: ["Liv-ex Wine Exchange", "Wine-Searcher API", "Berry Bros API"], revenue: "1% tokenización + trading fees + custody 0.5%/año", impact: "🟢 MEDIO", steps: [] },
    ],
  },
  {
    id: "automotive",
    phase: 9,
    priority: "FASE 9 — 2027",
    icon: "🚗",
    title: "Automoción & Flota Vehicular",
    subtitle: "Historial · Leasing · Flotas · Coches Clásicos",
    color: "#EF9A9A",
    dark: "#6A1A1A",
    marketSize: "$4 Billones/año",
    bezRevenue: "$500K–20M/año",
    readiness: 60,
    tags: ["VIN", "NFT", "Telemática", "DeFi", "Leasing"],
    agents: [
      { name: "CarHistory Agent", icon: "🔑", description: "El historial completo del vehículo (accidentes, mantenimientos, propietarios, km reales) inmutable on-chain. Fraude en odómetros = €6B de pérdidas anuales en Europa. Solución on-chain.", contracts: ["BeZhasNFT.sol", "QualityOracle.sol", "LogisticsContainer.sol"], apis: ["CARFAX API", "autoCheck", "DGT España API", "TÜV Report"], revenue: "€10–50 por informe + SaaS concesionarios €5K–50K/mes", impact: "🔴 CRÍTICO", steps: [] },
      { name: "FleetFinance Agent", icon: "🚌", description: "Tokeniza flotas de vehículos comerciales para financiación DeFi. Transportistas emiten tokens respaldados por su flota y obtienen liquidez sin banco.", contracts: ["BeZhasRWAFactory.sol", "StakingPoolV2.sol"], apis: ["Samsara Fleet", "Geotab API", "TomTom Telematics"], revenue: "1.5% originación + spread de interés 2–4%", impact: "🟡 ALTO", steps: [] },
    ],
  },
  {
    id: "fisheries",
    phase: 10,
    priority: "FASE 10 — 2027",
    icon: "🌊",
    title: "Pesca & Acuicultura",
    subtitle: "Cuotas · Trazabilidad · Pesca Ilegal · Certificación",
    color: "#26C6DA",
    dark: "#00505A",
    marketSize: "$400B/año",
    bezRevenue: "$200K–8M/año",
    readiness: 50,
    tags: ["Quota", "MSC", "Trazabilidad", "Satélite", "IoT"],
    agents: [
      { name: "FishToken Agent", icon: "🐟", description: "Tokeniza cuotas de pesca reguladas. Pescadores venden fracciones de su cuota como activo financiero. Cada captura es registrada on-chain desde el barco hasta la lonja.", contracts: ["BeZhasRWAFactory.sol", "LogisticsContainer.sol", "QualityOracle.sol"], apis: ["FAO FisheryAPI", "MSC Certification", "ICCAT Quota DB", "VMS Vessel Monitoring"], revenue: "0.5% por transferencia de cuota + SaaS cofradías €2K/mes", impact: "🟡 ALTO", steps: [] },
    ],
  },
];

const phaseColors = ["#F5A623","#FF6B35","#00FF88","#FFD700","#8BC34A","#C0A060","#4FC3F7","#CE93D8","#EF9A9A","#26C6DA"];

export default function BeZhasRoadmap() {
  const [activeSector, setActiveSector] = useState(ALL_SECTORS[0]);
  const [activeAgent, setActiveAgent] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1200);
    return () => clearInterval(t);
  }, []);

  const ag = activeSector.agents[activeAgent] || activeSector.agents[0];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#020B14",
      color: "#CBD5E1",
      fontFamily: "'Trebuchet MS', sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Scanning line animation */}
      <style>{`
        @keyframes scanline {
          0% { top: -2px; }
          100% { top: 100%; }
        }
        @keyframes blink {
          0%,100% { opacity:1; } 50% { opacity:0.2; }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 8px currentColor; }
          50% { box-shadow: 0 0 24px currentColor; }
        }
        .sector-btn:hover { filter: brightness(1.3); }
        .agent-card:hover { transform: translateX(4px); }
      `}</style>

      {/* TOP HEADER */}
      <div style={{
        background: "rgba(0,0,0,0.6)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: 3,
            background: `linear-gradient(90deg, ${activeSector.color}, #ffffff)`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>BEZ//CHAIN</div>
          <div style={{ fontSize: 10, color: "#475569", letterSpacing: 2 }}>RWA TOKENIZATION ENGINE v2.0</div>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 11 }}>
          {[
            { label: "SECTORES ACTIVOS", val: `${ALL_SECTORS.length}` },
            { label: "AGENTES IA", val: `${ALL_SECTORS.reduce((a,s) => a+s.agents.length, 0)}` },
            { label: "MERCADO TOTAL", val: "$70T+" },
            { label: "STATUS", val: tick % 2 === 0 ? "● ONLINE" : "● ONLINE", color: "#00FF88" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ color: "#475569", letterSpacing: 1 }}>{s.label}</div>
              <div style={{ color: s.color || activeSector.color, fontWeight: 700, fontSize: 13 }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* LEFT: SECTOR TIMELINE */}
        <div style={{
          width: 220,
          flexShrink: 0,
          background: "rgba(0,0,0,0.4)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          overflowY: "auto",
          padding: "16px 0",
        }}>
          <div style={{ padding: "0 16px 12px", fontSize: 9, letterSpacing: 3, color: "#374151", textTransform: "uppercase" }}>
            — ROADMAP SECTORIAL —
          </div>
          {ALL_SECTORS.map((s, i) => (
            <div
              key={s.id}
              className="sector-btn"
              onClick={() => { setActiveSector(s); setActiveAgent(0); }}
              style={{
                padding: "10px 16px",
                cursor: "pointer",
                borderLeft: `3px solid ${activeSector.id === s.id ? s.color : "transparent"}`,
                background: activeSector.id === s.id ? `rgba(${parseInt(s.color.slice(1,3),16)},${parseInt(s.color.slice(3,5),16)},${parseInt(s.color.slice(5,7),16)},0.08)` : "transparent",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{
                width: 22, height: 22,
                borderRadius: "50%",
                border: `1px solid ${s.color}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, color: s.color, fontWeight: 700, flexShrink: 0,
              }}>{i + 1}</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: activeSector.id === s.id ? s.color : "#94A3B8" }}>
                  {s.icon} {s.title.split(" ")[0]}
                </div>
                <div style={{ fontSize: 9, color: "#374151", letterSpacing: 1 }}>{s.priority.split(" — ")[1] || s.priority}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CENTER: MAIN CONTENT */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

          {/* Sector Header */}
          <div style={{
            padding: "20px 24px",
            background: `linear-gradient(135deg, rgba(${parseInt(activeSector.color.slice(1,3),16)},${parseInt(activeSector.color.slice(3,5),16)},${parseInt(activeSector.color.slice(5,7),16)},0.12) 0%, rgba(0,0,0,0) 100%)`,
            border: `1px solid ${activeSector.color}33`,
            borderRadius: 4,
            marginBottom: 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: activeSector.color, letterSpacing: 3, marginBottom: 6, textTransform: "uppercase" }}>
                  {activeSector.priority}
                </div>
                <h2 style={{ margin: "0 0 4px", fontSize: 24, color: "#F8FAFC", letterSpacing: -0.5 }}>
                  {activeSector.icon} {activeSector.title}
                </h2>
                <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>{activeSector.subtitle}</p>
              </div>
              <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2 }}>MERCADO GLOBAL</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: activeSector.color }}>{activeSector.marketSize}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2 }}>REVENUE BEZ</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#00FF88" }}>{activeSector.bezRevenue}</div>
                </div>
              </div>
            </div>

            {/* Tags & Readiness */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {activeSector.tags.map(t => (
                  <span key={t} style={{
                    padding: "2px 8px", fontSize: 9, letterSpacing: 1,
                    border: `1px solid ${activeSector.color}44`,
                    color: activeSector.color, borderRadius: 2,
                  }}>{t}</span>
                ))}
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 9, color: "#475569", letterSpacing: 1 }}>READINESS</span>
                <div style={{ width: 100, height: 4, background: "#1E293B", borderRadius: 2 }}>
                  <div style={{ width: `${activeSector.readiness}%`, height: "100%", background: activeSector.color, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 10, color: activeSector.color }}>{activeSector.readiness}%</span>
              </div>
            </div>
          </div>

          {/* Agent Tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {activeSector.agents.map((a, i) => (
              <button
                key={i}
                onClick={() => setActiveAgent(i)}
                style={{
                  padding: "6px 14px",
                  background: activeAgent === i ? activeSector.color : "rgba(255,255,255,0.04)",
                  color: activeAgent === i ? "#000" : "#94A3B8",
                  border: `1px solid ${activeAgent === i ? activeSector.color : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 3,
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  transition: "all 0.15s",
                }}
              >
                {a.icon} {a.name}
              </button>
            ))}
          </div>

          {/* Active Agent Detail */}
          {ag && (
            <div style={{
              background: "rgba(255,255,255,0.025)",
              border: `1px solid ${activeSector.color}22`,
              borderRadius: 4,
              overflow: "hidden",
              marginBottom: 20,
            }}>
              <div style={{
                padding: "16px 20px",
                borderBottom: `1px solid rgba(255,255,255,0.05)`,
                background: `rgba(${parseInt(activeSector.color.slice(1,3),16)},${parseInt(activeSector.color.slice(3,5),16)},${parseInt(activeSector.color.slice(5,7),16)},0.06)`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <span style={{ fontSize: 22, marginRight: 10 }}>{ag.icon}</span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: "#F1F5F9" }}>{ag.name}</span>
                </div>
                {ag.impact && <span style={{
                  fontSize: 10, padding: "3px 10px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 2, letterSpacing: 1,
                }}>{ag.impact}</span>}
              </div>
              <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <h4 style={{ margin: "0 0 10px", fontSize: 10, color: "#475569", letterSpacing: 3, textTransform: "uppercase" }}>¿QUÉ HACE?</h4>
                  <p style={{ margin: 0, fontSize: 13, color: "#94A3B8", lineHeight: 1.7 }}>{ag.description}</p>
                  {ag.revenue && (
                    <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 3 }}>
                      <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, marginBottom: 3 }}>💰 REVENUE MODEL</div>
                      <div style={{ fontSize: 12, color: "#00FF88" }}>{ag.revenue}</div>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {ag.contracts && ag.contracts.length > 0 && (
                    <div>
                      <h4 style={{ margin: "0 0 8px", fontSize: 9, color: "#475569", letterSpacing: 3, textTransform: "uppercase" }}>SMART CONTRACTS</h4>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {ag.contracts.map(c => <span key={c} style={{ fontSize: 10, padding: "3px 8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2, color: activeSector.color }}>{c}</span>)}
                      </div>
                    </div>
                  )}
                  {ag.apis && ag.apis.length > 0 && (
                    <div>
                      <h4 style={{ margin: "0 0 8px", fontSize: 9, color: "#475569", letterSpacing: 3, textTransform: "uppercase" }}>APIs EXTERNAS</h4>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {ag.apis.map(a => <span key={a} style={{ fontSize: 10, padding: "3px 8px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 2, color: "#64748B" }}>{a}</span>)}
                      </div>
                    </div>
                  )}
                  {ag.steps && ag.steps.length > 0 && (
                    <div>
                      <h4 style={{ margin: "0 0 8px", fontSize: 9, color: "#475569", letterSpacing: 3, textTransform: "uppercase" }}>FLUJO DE EJECUCIÓN</h4>
                      {ag.steps.map((step, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                          <span style={{ color: activeSector.color, fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>0{i+1}→</span>
                          <span style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: REVENUE SUMMARY PANEL */}
        <div style={{
          width: 200,
          flexShrink: 0,
          background: "rgba(0,0,0,0.4)",
          borderLeft: "1px solid rgba(255,255,255,0.05)",
          padding: "16px 14px",
          overflowY: "auto",
        }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#374151", marginBottom: 16, textTransform: "uppercase" }}>— REVENUE MAP —</div>
          {ALL_SECTORS.map((s, i) => (
            <div key={s.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: activeSector.id === s.id ? s.color : "#475569" }}>{s.icon} {s.title.split(" ")[0]}</span>
              </div>
              <div style={{ fontSize: 9, color: "#00FF88", marginBottom: 4 }}>{s.bezRevenue}</div>
              <div style={{ height: 2, background: "#1E293B", borderRadius: 1 }}>
                <div style={{ height: "100%", width: `${s.readiness}%`, background: s.color, borderRadius: 1, opacity: activeSector.id === s.id ? 1 : 0.3 }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 20, padding: "12px", background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 3 }}>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, marginBottom: 4 }}>TOTAL POTENCIAL</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#00FF88" }}>$17M–600M</div>
            <div style={{ fontSize: 9, color: "#374151", marginTop: 2 }}>Revenue anual en BEZ</div>
          </div>
          <div style={{ marginTop: 12, padding: "12px", background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.15)", borderRadius: 3 }}>
            <div style={{ fontSize: 9, color: "#475569", letterSpacing: 2, marginBottom: 4 }}>ACTIVOS TOTALES</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#F5A623" }}>$70T+</div>
            <div style={{ fontSize: 9, color: "#374151", marginTop: 2 }}>Mercado tokenizable</div>
          </div>
        </div>
      </div>
    </div>
  );
}
