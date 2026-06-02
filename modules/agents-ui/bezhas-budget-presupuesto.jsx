import { useState } from "react";

// ══════════════════════════════════════════════════════════════
// BUDGET DATA — BEZHAS COMPLETE SYSTEM
// ══════════════════════════════════════════════════════════════

const PHASES = [
  {
    id: "mvp",
    label: "FASE 0",
    name: "MVP / Bootstrap",
    timeline: "Mes 1–3",
    color: "#00C8FF",
    total_min: 28500,
    total_max: 52000,
    icon: "🚀",
    description: "ShipTrack Agent + CustomsClear Agent + infraestructura base. Suficiente para lanzar piloto con 1 naviera.",
    categories: [
      {
        name: "🖥️ Hardware",
        items: [
          { item: "Servidor Principal (HP ProLiant DL380 Gen10 / Dell PowerEdge R750)", spec: "2x Xeon Gold 6330, 256GB RAM, 4TB NVMe RAID", min: 4500, max: 8000, note: "Nodo blockchain + agentes IA" },
          { item: "Servidor Backup / Réplica", spec: "Ryzen 9 7950X, 128GB RAM, 2TB NVMe", min: 2000, max: 3500, note: "Alta disponibilidad 99.9%" },
          { item: "GPU para modelos IA locales (NVIDIA RTX 4090 × 2)", spec: "24GB VRAM, PCIe 4.0", min: 1800, max: 2600, note: "Whisper OCR, embeddings locales" },
          { item: "Switch de red 10GbE managed", spec: "Cisco SG350X / Netgear M4300", min: 400, max: 800, note: "Red interna rápida" },
          { item: "SAI / UPS 3000VA", spec: "APC Smart-UPS 3000", min: 600, max: 900, note: "Protección cortes de luz" },
          { item: "Hardware Wallet (Ledger Nano X × 5)", spec: "Firma de transacciones en frío", min: 600, max: 600, note: "Hot wallet + multisig" },
          { item: "Raspberry Pi 4 × 3 (nodos edge)", spec: "8GB RAM, 256GB SD", min: 300, max: 400, note: "Oráculos IoT edge" },
          { item: "Cableado, rack 19\", accesorios", spec: "Rack 12U, PDU, patch cables", min: 800, max: 1200, note: "" },
        ]
      },
      {
        name: "🏠 Hosting & Cloud (mensual × 3)",
        items: [
          { item: "VPS cloud primario (AWS EC2 c6i.4xlarge)", spec: "16 vCPU, 32GB RAM, SSD", min: 600, max: 900, note: "×3 meses = base" },
          { item: "CDN + DDoS protection (Cloudflare Pro)", spec: "Plan Pro + WAF", min: 60, max: 60, note: "×3 = €180" },
          { item: "Backup cloud (S3 / Wasabi)", spec: "2TB encrypted backups", min: 30, max: 60, note: "×3 = €90" },
          { item: "Dominio + SSL wildcard", spec: "bez.digital + *.bez.digital", min: 150, max: 150, note: "Anual" },
          { item: "VPN empresarial (WireGuard VPS)", spec: "Acceso seguro al servidor", min: 20, max: 40, note: "×3 meses" },
        ]
      },
      {
        name: "⛓️ Blockchain & Smart Contracts",
        items: [
          { item: "Auditoría de Smart Contracts (Certik / Hacken)", spec: "5 contratos principales", min: 8000, max: 20000, note: "CRÍTICO — sin esto no hay confianza inversora" },
          { item: "Despliegue contratos Polygon (gas)", spec: "Deploy + verify todos los contratos", min: 200, max: 500, note: "MATIC para gas fees" },
          { item: "Despliegue contratos BNB Chain", spec: "Deploy + verify todos los contratos", min: 100, max: 300, note: "BNB para gas fees" },
          { item: "Chainlink Oracle subscription", spec: "Price feeds + VRF + Functions", min: 300, max: 600, note: "×3 meses" },
          { item: "The Graph (indexer)", spec: "Subgraph hosting para queries", min: 100, max: 200, note: "×3 meses" },
          { item: "LayerZero / Wormhole cross-chain", spec: "Mensajes cross-chain fees", min: 200, max: 400, note: "×3 meses estimado" },
        ]
      },
      {
        name: "🤖 APIs de IA",
        items: [
          { item: "Anthropic Claude API (Sonnet)", spec: "~2M tokens/día para agentes", min: 300, max: 600, note: "×3 meses" },
          { item: "Gemini API (Google)", spec: "Fallback + análisis documental", min: 100, max: 200, note: "×3 meses" },
          { item: "OpenAI API (GPT-4 Vision fallback)", spec: "Backup para OCR documentos", min: 100, max: 200, note: "×3 meses" },
        ]
      },
      {
        name: "🌊 APIs de Datos Marítimos",
        items: [
          { item: "Marine Traffic API (Business)", spec: "AIS data, vessel tracking, histórico", min: 600, max: 1200, note: "×3 meses" },
          { item: "VesselFinder API", spec: "Backup AIS + port calls", min: 300, max: 600, note: "×3 meses" },
        ]
      },
      {
        name: "👨‍💻 Desarrollo (equipo mínimo × 3 meses)",
        items: [
          { item: "Lead Blockchain Dev (Solidity + React)", spec: "Full-time 3 meses", min: 6000, max: 12000, note: "€2K-4K/mes — crítico" },
          { item: "DevOps / SysAdmin", spec: "Part-time 3 meses", min: 1500, max: 3000, note: "€500-1K/mes" },
        ]
      },
      {
        name: "⚖️ Legal & Compliance",
        items: [
          { item: "Constitución empresa (SL en España)", spec: "Notario + Registro Mercantil", min: 500, max: 1000, note: "SL mínimo €3K capital" },
          { item: "Asesoría legal crypto/fintech inicial", spec: "Revisión modelo de negocio", min: 1000, max: 2000, note: "Imprescindible" },
        ]
      },
      {
        name: "🔧 Software & Licencias",
        items: [
          { item: "GitHub Enterprise (team)", spec: "CI/CD + repos privados", min: 90, max: 90, note: "×3 meses" },
          { item: "Slack Business + Notion", spec: "Comunicación + documentación", min: 60, max: 90, note: "×3 meses" },
          { item: "Datadog / Grafana Cloud", spec: "Monitoring + alertas", min: 120, max: 240, note: "×3 meses" },
        ]
      },
    ]
  },
  {
    id: "fase1",
    label: "FASE 1",
    name: "Logística Completa",
    timeline: "Mes 4–9",
    color: "#F5A623",
    total_min: 95000,
    total_max: 185000,
    icon: "⚓",
    description: "6 agentes logísticos completos: ShipTrack, CustomsClear, RWA Cargo, Port Finance, Insurance, Cold Chain. Primeros contratos con navieras.",
    categories: [
      {
        name: "🖥️ Hardware Adicional",
        items: [
          { item: "Servidor dedicado adicional (escala)", spec: "2U rack server, 512GB RAM, 8TB NVMe", min: 6000, max: 10000, note: "Escala para 100+ usuarios" },
          { item: "GPU cluster ampliación (× 4 RTX 4090)", spec: "Para modelos IA en producción", min: 3600, max: 5200, note: "Velocidad de procesamiento" },
          { item: "IoT Gateway industrial × 5", spec: "Conexión sensores RFID/BLE de contenedores", min: 1500, max: 3000, note: "Cold Chain + tracking" },
          { item: "Sensores IoT temperatura/humedad × 50", spec: "Sensitech TempTale / ELPRO", min: 2500, max: 5000, note: "Cold Chain Agent" },
        ]
      },
      {
        name: "☁️ Cloud & Hosting (6 meses)",
        items: [
          { item: "AWS EC2 producción (multi-region)", spec: "eu-west-1 + us-east-1, c6i.8xlarge", min: 3600, max: 7200, note: "×6 meses" },
          { item: "RDS PostgreSQL Multi-AZ", spec: "Base de datos operacional", min: 1200, max: 2400, note: "×6 meses" },
          { item: "ElasticSearch / OpenSearch", spec: "Búsqueda B/L, historial", min: 600, max: 1200, note: "×6 meses" },
          { item: "Redis Cluster", spec: "Cache + pub/sub agentes", min: 300, max: 600, note: "×6 meses" },
        ]
      },
      {
        name: "🔗 Blockchain & Infraestructura",
        items: [
          { item: "Nodo Polygon validador propio", spec: "Sincronización full node", min: 1000, max: 2000, note: "Independencia de terceros" },
          { item: "Nodo BNB Chain propio", spec: "BSC full node", min: 1000, max: 2000, note: "Independencia" },
          { item: "Chainlink CCIP / Functions", spec: "Llamadas externas + cross-chain", min: 1200, max: 2400, note: "×6 meses" },
          { item: "Safe Multisig setup + Gnosis", spec: "Treasury DAO management", min: 500, max: 1000, note: "Setup + config" },
          { item: "The Graph hosted service", spec: "Indexer produción", min: 600, max: 1200, note: "×6 meses" },
        ]
      },
      {
        name: "🤖 APIs IA & Datos (6 meses)",
        items: [
          { item: "Anthropic Claude API (escala)", spec: "~10M tokens/día agentes activos", min: 1800, max: 3600, note: "×6 meses" },
          { item: "Marine Traffic API Business+", spec: "Acceso completo + histórico 2 años", min: 3600, max: 7200, note: "×6 meses" },
          { item: "Bloomberg Commodity API", spec: "Precios commodity para RWA Cargo", min: 6000, max: 12000, note: "×6 meses" },
          { item: "Chainlink Price Feeds adicionales", spec: "Oil, gold, grain, metals", min: 600, max: 1200, note: "×6 meses" },
          { item: "AEAT eDUA API (España)", spec: "Integración aduanas españolas", min: 0, max: 500, note: "Gratuito + homologación" },
          { item: "Lloyd's of London API", spec: "Seguros marítimos automatizados", min: 2000, max: 4000, note: "×6 meses" },
        ]
      },
      {
        name: "👨‍💻 Equipo Desarrollo (6 meses)",
        items: [
          { item: "Lead Blockchain Dev senior", spec: "Full-time 6 meses", min: 18000, max: 36000, note: "€3K-6K/mes" },
          { item: "Backend Dev (Node.js + Python)", spec: "Full-time 6 meses", min: 12000, max: 24000, note: "€2K-4K/mes" },
          { item: "Frontend Dev (React + Web3)", spec: "Full-time 6 meses", min: 12000, max: 24000, note: "€2K-4K/mes" },
          { item: "DevOps / Cloud Engineer", spec: "Part-time 6 meses", min: 6000, max: 12000, note: "€1K-2K/mes" },
          { item: "IA / ML Engineer", spec: "Part-time 6 meses", min: 6000, max: 12000, note: "€1K-2K/mes" },
        ]
      },
      {
        name: "⚖️ Legal & Regulación",
        items: [
          { item: "Registro VASP (Proveedor de Servicios de Activos Virtuales)", spec: "Banco de España registro obligatorio", min: 3000, max: 6000, note: "OBLIGATORIO en España" },
          { item: "Abogado especialista crypto/fintech", spec: "Contratos, ToS, Privacy Policy, KYC/AML", min: 4000, max: 8000, note: "Completo compliance" },
          { item: "Auditoría KYC/AML (Sumsub / Onfido setup)", spec: "Verificación de identidad usuarios", min: 1200, max: 2400, note: "€200-400/mes" },
          { item: "Seguro de Responsabilidad Civil profesional", spec: "Para operaciones con activos reales", min: 1500, max: 3000, note: "Anual" },
        ]
      },
      {
        name: "🚢 Comercial & Pilotos",
        items: [
          { item: "Comercial / Business Dev senior", spec: "Para cerrar contratos con navieras", min: 3000, max: 9000, note: "3-6 meses salary" },
          { item: "Viajes y relaciones navieras", spec: "Visitas Maersk, MSC, CMA CGM", min: 3000, max: 6000, note: "Fairs: TOC Europe, Posidonia" },
          { item: "TOC Europe conference (Hamburgo)", spec: "Stand + asistencia", min: 2000, max: 5000, note: "Principal feria logística" },
        ]
      },
    ]
  },
  {
    id: "fase2",
    label: "FASE 2",
    name: "Inmobiliaria + Salud",
    timeline: "Mes 10–18",
    color: "#FF6B35",
    total_min: 180000,
    total_max: 380000,
    icon: "🏢",
    description: "PropToken, SmartMortgage, RentStream, MedRecord, PharmaTrak, ClaimBot. Expansión a 2 nuevos sectores de alto valor.",
    categories: [
      {
        name: "🖥️ Hardware Adicional",
        items: [
          { item: "Datacenter propio / Colocation rack", spec: "Rack 42U en CPD certificado Tier III", min: 8000, max: 15000, note: "Setup + 6 meses hosting" },
          { item: "Servidores adicionales × 3", spec: "Scale out cluster", min: 12000, max: 22000, note: "Alta disponibilidad" },
          { item: "HSM (Hardware Security Module)", spec: "Thales Luna / AWS CloudHSM", min: 5000, max: 12000, note: "Custodia claves privadas" },
          { item: "Impresoras NFC/RFID industriales × 3", spec: "Zebra ZT411 para etiquetas activos", min: 3000, max: 6000, note: "RWA físico tagging" },
        ]
      },
      {
        name: "☁️ Cloud Scale (9 meses)",
        items: [
          { item: "AWS infraestructura completa", spec: "Multi-region, auto-scaling", min: 9000, max: 18000, note: "×9 meses" },
          { item: "IPFS / Filecoin storage", spec: "Documentos inmobiliarios NFT metadata", min: 1800, max: 3600, note: "×9 meses" },
          { item: "CDN global (Cloudflare Enterprise)", spec: "Latencia < 50ms mundial", min: 2700, max: 5400, note: "×9 meses" },
        ]
      },
      {
        name: "🏠 APIs Inmobiliaria",
        items: [
          { item: "API Registro de la Propiedad España", spec: "Consultas automáticas cargas", min: 1800, max: 4500, note: "×9 meses" },
          { item: "Idealista API Pro", spec: "Valoración automática de mercado", min: 1800, max: 3600, note: "×9 meses" },
          { item: "Catastro API (FEGA)", spec: "Datos catastrales oficiales", min: 0, max: 0, note: "Gratuito con homologación" },
          { item: "Notarías digitales (API Consejo Notarial)", spec: "Firma electrónica notarial", min: 2700, max: 5400, note: "×9 meses" },
        ]
      },
      {
        name: "🏥 APIs Salud",
        items: [
          { item: "HL7 FHIR R4 integration", spec: "Interoperabilidad hospitales", min: 5000, max: 12000, note: "Setup + certificación" },
          { item: "AEMPS API (Agencia Medicamento)", spec: "Trazabilidad farmacéutica EU FMD", min: 3000, max: 6000, note: "Homologación" },
          { item: "GS1 EPCIS (trazabilidad global)", spec: "Serialización medicamentos", min: 4000, max: 8000, note: "Membresía + setup" },
          { item: "ICD-10 / SNOMED CT licencia", spec: "Codificación diagnósticos", min: 1800, max: 3600, note: "×9 meses" },
          { item: "ZK-Proof library (zkSync / StarkNet)", spec: "Privacidad datos médicos", min: 3000, max: 6000, note: "Integración + audit" },
        ]
      },
      {
        name: "👨‍💻 Equipo Ampliado (9 meses)",
        items: [
          { item: "Blockchain Dev #2 (especialista ZK-proofs)", spec: "Full-time", min: 27000, max: 54000, note: "€3K-6K/mes" },
          { item: "Backend Dev #2 (salud/inmobiliaria APIs)", spec: "Full-time", min: 18000, max: 36000, note: "€2K-4K/mes" },
          { item: "Legal Compliance Officer", spec: "Full-time", min: 22500, max: 45000, note: "€2.5K-5K/mes" },
          { item: "Product Manager", spec: "Full-time", min: 18000, max: 36000, note: "€2K-4K/mes" },
          { item: "QA / Security Tester", spec: "Full-time", min: 13500, max: 27000, note: "€1.5K-3K/mes" },
        ]
      },
      {
        name: "⚖️ Regulación Sectorial",
        items: [
          { item: "Homologación RGPD datos sanitarios (DPO)", spec: "Delegado de Protección de Datos", min: 6000, max: 12000, note: "OBLIGATORIO para datos médicos" },
          { item: "Certificación ISO 27001 (seguridad)", spec: "Necesaria para contratos hospitalarios", min: 12000, max: 25000, note: "Auditoría + certificación" },
          { item: "Registro actividad inmobiliaria", spec: "Agente API registrado en CNMV si aplica", min: 3000, max: 8000, note: "Consultar abogado" },
          { item: "Segunda auditoría smart contracts", spec: "Nuevos contratos inmobiliaria/salud", min: 15000, max: 30000, note: "Trail of Bits / OpenZeppelin" },
        ]
      },
      {
        name: "📈 Marketing & Ventas",
        items: [
          { item: "MIPIM (Feria inmobiliaria Cannes)", spec: "Stand + asistencia + red B2B", min: 8000, max: 15000, note: "Mayor feria inmobiliaria mundial" },
          { item: "HIMSS Europe (Salud digital)", spec: "Networking hospitales y aseguradoras", min: 5000, max: 10000, note: "Barcelona / Helsinki" },
          { item: "Marketing digital B2B (LinkedIn Ads)", spec: "Lead gen sector inmobiliario/salud", min: 4500, max: 9000, note: "×9 meses €500-1K/mes" },
          { item: "PR / Notas de prensa crypto + TradFi media", spec: "CoinDesk, Forbes, Expansión", min: 3000, max: 6000, note: "Lanzamiento público" },
        ]
      },
    ]
  },
  {
    id: "fase3",
    label: "FASE 3–10",
    name: "Energía + 7 Sectores",
    timeline: "Mes 19–36",
    color: "#FFD700",
    total_min: 350000,
    total_max: 850000,
    icon: "⚡",
    description: "Expansión a Energía, Agroindustria, Minería, Aviación, Arte, Automoción, Pesca. Escala global. Equipo de 25-50 personas.",
    categories: [
      {
        name: "🖥️ Infraestructura Global",
        items: [
          { item: "Datacenter secundario (Frankfurt / Dublin)", spec: "Colocation Tier IV, disaster recovery", min: 24000, max: 48000, note: "18 meses" },
          { item: "Kubernetes cluster managed (EKS)", spec: "500+ pods, auto-scaling", min: 18000, max: 36000, note: "18 meses" },
          { item: "CDN + WAF enterprise", spec: "Cloudflare Enterprise + Magic Transit", min: 9000, max: 18000, note: "18 meses" },
          { item: "Servidores GPU A100 × 4", spec: "LLM propio fine-tuning (BeZhasAI)", min: 40000, max: 80000, note: "Modelo IA propio especializado" },
        ]
      },
      {
        name: "⚡ APIs Energía / Otros sectores",
        items: [
          { item: "Verra Registry API (créditos carbono)", spec: "Tokenización VCS/GS créditos", min: 6000, max: 12000, note: "18 meses" },
          { item: "ENTSO-E / REE España API", spec: "Datos red eléctrica tiempo real", min: 2700, max: 5400, note: "18 meses" },
          { item: "LBMA Gold / CME Comex API", spec: "Precios metales preciosos live", min: 7200, max: 14400, note: "18 meses" },
          { item: "CARFAX / DGT API", spec: "Historial vehículos", min: 3600, max: 7200, note: "18 meses" },
          { item: "Artory / Art Basel data", spec: "Valoración arte", min: 5400, max: 10800, note: "18 meses" },
          { item: "FAO Fisheries + MSC API", spec: "Cuotas pesca + certificación", min: 1800, max: 3600, note: "18 meses" },
        ]
      },
      {
        name: "👥 Equipo Completo (18 meses)",
        items: [
          { item: "CTO (Chief Technology Officer)", spec: "Full-time", min: 54000, max: 108000, note: "€3K-6K/mes" },
          { item: "Blockchain Devs × 4", spec: "Full-time", min: 72000, max: 144000, note: "€1K-2K/mes × 4" },
          { item: "Backend Devs × 3", spec: "Full-time", min: 54000, max: 108000, note: "€1K-2K/mes × 3" },
          { item: "Frontend/UX × 2", spec: "Full-time", min: 36000, max: 72000, note: "€1K-2K/mes × 2" },
          { item: "IA/ML Engineers × 2", spec: "Full-time", min: 54000, max: 108000, note: "€1.5K-3K/mes × 2" },
          { item: "Sales & BD × 3 (sectores)", spec: "Full-time", min: 54000, max: 108000, note: "Por sector" },
          { item: "Legal / Compliance × 2", spec: "Full-time", min: 36000, max: 72000, note: "" },
          { item: "Soporte / Operaciones × 3", spec: "Full-time", min: 27000, max: 54000, note: "" },
        ]
      },
      {
        name: "⚖️ Regulación Global",
        items: [
          { item: "Licencia MiCA (Markets in Crypto-Assets EU)", spec: "Regulación obligatoria EU 2024", min: 30000, max: 80000, note: "IMPRESCINDIBLE para operar en EU" },
          { item: "Auditorías anuales contratos (todos sectores)", spec: "Certik, OpenZeppelin, Trail of Bits", min: 40000, max: 100000, note: "Por fase" },
          { item: "Registro en jurisdicciones adicionales", spec: "Malta / Dubai / Singapur (fallback)", min: 15000, max: 30000, note: "Diversificación regulatoria" },
        ]
      },
      {
        name: "📣 Marketing & Expansión",
        items: [
          { item: "Davos / WEF side events", spec: "Acceso inversores institucionales", min: 10000, max: 25000, note: "Alto ROI en captación" },
          { item: "TOKEN2049 Dubai / Singapur", spec: "Presencia en las mayores conferencias crypto", min: 15000, max: 30000, note: "Anual" },
          { item: "Marketing digital global", spec: "Google, LinkedIn, Twitter/X Ads", min: 18000, max: 36000, note: "18 meses" },
          { item: "Programa de aceleración / VCs", spec: "Techstars, Outlier Ventures, Fabric Ventures", min: 5000, max: 15000, note: "Aplicación + prep" },
        ]
      },
    ]
  },
];

const FUNDING_SOURCES = [
  { name: "Bootstrapping propio", amount: "€30K–80K", description: "Fase 0 completa + inicio Fase 1", risk: "BAJO", color: "#00E676", icon: "💰" },
  { name: "FFF (Friends, Family, Fools)", amount: "€50K–150K", description: "Completar Fase 1 con tracción demostrada", risk: "BAJO", color: "#69F0AE", icon: "👥" },
  { name: "ENISA Jóvenes Emprendedores", amount: "€75K (préstamo)", description: "Préstamo participativo sin garantías reales", risk: "MUY BAJO", color: "#40C4FF", icon: "🏛️" },
  { name: "ENISA Crecimiento", amount: "€300K (préstamo)", description: "Fase de crecimiento con plan de negocio", risk: "MUY BAJO", color: "#40C4FF", icon: "🏛️" },
  { name: "CDTI (I+D+i)", amount: "€100K–500K", description: "Subvención/préstamo para proyectos tecnológicos", risk: "MUY BAJO", color: "#40C4FF", icon: "🔬" },
  { name: "ICO Fondo Emprendedores", amount: "€200K–1.5M", description: "Inversión equity + préstamo", risk: "BAJO", color: "#64B5F6", icon: "🇪🇸" },
  { name: "Subvenciones EU (Horizon Europe)", amount: "€500K–3M", description: "Proyectos blockchain/DLT para logística/salud", risk: "MEDIO", color: "#7986CB", icon: "🇪🇺" },
  { name: "Angel Investors / Crypto VCs", amount: "€500K–3M", description: "Equity stake, tras MVP con tracción", risk: "MEDIO", color: "#CE93D8", icon: "👼" },
  { name: "ICO / Token Sale (BEZ-Coin)", amount: "€1M–20M", description: "Venta pública de BEZ con utilidad demostrada", risk: "ALTO", color: "#FF6B35", icon: "🪙" },
  { name: "Strategic Partners (Maersk, hospitals)", amount: "€500K–5M", description: "Inversión de clientes ancla a cambio de equity", risk: "BAJO", color: "#F5A623", icon: "🤝" },
];

const TOTAL_RANGES = [
  { label: "MÍNIMO ABSOLUTO (tú solo + IA)", min: 28500, note: "MVP funcional, servidor propio, sin equipo" },
  { label: "ARRANQUE REAL (Fase 0+1)", min: 123500, max: 237000, note: "Producto completo logística, primer contrato" },
  { label: "ESCALA SECTORES 1–3", min: 303500, max: 617000, note: "Logística + Inmobiliaria + Salud" },
  { label: "PLATAFORMA GLOBAL COMPLETA", min: 653500, max: 1467000, note: "10 sectores, 24 agentes, equipo 30 personas" },
];

// ══════════════════════════════════════════════════════════════
export default function BeZhasBudget() {
  const [activePhase, setActivePhase] = useState("mvp");
  const [expandedCat, setExpandedCat] = useState(null);
  const [viewMode, setViewMode] = useState("budget"); // budget | funding | totals | roadmap

  const phase = PHASES.find(p => p.id === activePhase);

  const fmt = (n) => n?.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const C = {
    bg: "#010A0F", panel: "#040D14", border: "rgba(20,80,110,0.4)",
    dim: "#0A1E2A", text: "#8DAFC0", bright: "#D8EEF8",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: 12 }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes slide-down { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes count-up { from{opacity:0} to{opacity:1} }
        .cat-row:hover { background: rgba(255,255,255,0.02) !important; }
        .item-row:hover { background: rgba(255,255,255,0.015) !important; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(20,120,160,0.3); }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "16px 28px", background: "rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#1A4A5A", letterSpacing: 4, marginBottom: 4 }}>
              BEZHAS BLOCKCHAIN INFRASTRUCTURE — FINANCIAL PLANNING DOCUMENT
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(18px,3vw,28px)", fontWeight: 400, color: C.bright, letterSpacing: -0.5 }}>
              Presupuesto Completo del Sistema
            </h1>
            <div style={{ fontSize: 11, color: "#2A5A70", marginTop: 3 }}>
              10 Sectores · 24 Agentes IA · Hardware · Equipo · Legal · APIs · Marketing
            </div>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { l: "INVERSIÓN TOTAL", v: "€28K–1.5M", c: "#F5A623" },
              { l: "FASES", v: "4", c: "#00C8FF" },
              { l: "ROI POTENCIAL", v: "50–500×", c: "#00E676" },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 8, color: "#1A4A5A", letterSpacing: 1, fontFamily: "monospace" }}>{l}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── VIEW MODE TABS ── */}
      <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", borderBottom: `1px solid ${C.border}`, padding: "0 28px" }}>
        {[
          { id: "budget",  label: "PRESUPUESTO DETALLADO" },
          { id: "totals",  label: "RESUMEN FINANCIERO" },
          { id: "funding", label: "FUENTES DE FINANCIACIÓN" },
          { id: "roadmap", label: "HOJA DE RUTA" },
        ].map(t => (
          <button key={t.id} onClick={() => setViewMode(t.id)} style={{
            padding: "10px 18px", background: "none", border: "none",
            borderBottom: `2px solid ${viewMode === t.id ? "#00C8FF" : "transparent"}`,
            color: viewMode === t.id ? "#00C8FF" : "#1A4A5A",
            cursor: "pointer", fontSize: 10, fontFamily: "'Courier New',monospace", letterSpacing: 1,
            fontWeight: viewMode === t.id ? 700 : 400, transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: "20px 28px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ══ BUDGET VIEW ══ */}
        {viewMode === "budget" && (
          <div>
            {/* Phase selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {PHASES.map(p => (
                <button key={p.id} onClick={() => { setActivePhase(p.id); setExpandedCat(null); }} style={{
                  padding: "8px 16px", cursor: "pointer", fontFamily: "'Courier New',monospace",
                  background: activePhase === p.id ? `${p.color}18` : C.dim,
                  border: `1px solid ${activePhase === p.id ? p.color : C.border}`,
                  color: activePhase === p.id ? p.color : "#2A5A70",
                  borderRadius: 2, fontSize: 10, letterSpacing: 1, transition: "all 0.2s",
                  boxShadow: activePhase === p.id ? `0 0 16px ${p.color}22` : "none",
                }}>
                  {p.icon} {p.label} — {p.name}
                </button>
              ))}
            </div>

            {/* Phase header */}
            <div style={{ padding: "14px 18px", background: `${phase.color}08`, border: `1px solid ${phase.color}22`, borderRadius: 3, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 9, color: phase.color, letterSpacing: 3, fontFamily: "monospace", marginBottom: 4 }}>{phase.label} — {phase.timeline}</div>
                <div style={{ fontSize: 16, color: C.bright, marginBottom: 4 }}>{phase.icon} {phase.name}</div>
                <div style={{ fontSize: 11, color: "#2A5A70", maxWidth: 600 }}>{phase.description}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "#1A4A5A", letterSpacing: 1, fontFamily: "monospace" }}>RANGO INVERSIÓN</div>
                <div style={{ fontSize: 22, color: phase.color, fontWeight: 700 }}>{fmt(phase.total_min)}</div>
                <div style={{ fontSize: 12, color: "#2A5A70" }}>hasta {fmt(phase.total_max)}</div>
              </div>
            </div>

            {/* Categories */}
            {phase.categories.map((cat, ci) => (
              <div key={ci} style={{ marginBottom: 8 }}>
                {/* Category header */}
                <div className="cat-row" onClick={() => setExpandedCat(expandedCat === ci ? null : ci)}
                  style={{ padding: "10px 14px", background: C.dim, border: `1px solid ${C.border}`, borderRadius: expandedCat === ci ? "3px 3px 0 0" : 3, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: expandedCat === ci ? "#00C8FF" : "#2A5A70", fontSize: 10, transition: "all 0.2s" }}>{expandedCat === ci ? "▼" : "▶"}</span>
                    <span style={{ fontSize: 12, color: expandedCat === ci ? C.bright : "#4A8A9A" }}>{cat.name}</span>
                    <span style={{ fontSize: 9, color: "#1A4A5A", fontFamily: "monospace" }}>{cat.items.length} partidas</span>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 8, color: "#1A4A5A", fontFamily: "monospace" }}>MÍNIMO</div>
                      <div style={{ color: "#00C8FF", fontFamily: "monospace", fontSize: 11 }}>{fmt(cat.items.reduce((s, i) => s + i.min, 0))}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 8, color: "#1A4A5A", fontFamily: "monospace" }}>MÁXIMO</div>
                      <div style={{ color: "#F5A623", fontFamily: "monospace", fontSize: 11 }}>{fmt(cat.items.reduce((s, i) => s + i.max, 0))}</div>
                    </div>
                  </div>
                </div>

                {/* Category items */}
                {expandedCat === ci && (
                  <div style={{ border: `1px solid ${C.border}`, borderTop: "none", borderRadius: "0 0 3px 3px", animation: "slide-down 0.2s ease" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", background: "rgba(0,0,0,0.4)", padding: "5px 14px", fontSize: 8, color: "#1A4A5A", fontFamily: "monospace", letterSpacing: 1 }}>
                      <span>PARTIDA / ESPECIFICACIÓN</span>
                      <span style={{ textAlign: "right", minWidth: 80 }}>MÍNIMO</span>
                      <span style={{ textAlign: "right", minWidth: 80 }}>MÁXIMO</span>
                      <span style={{ textAlign: "right", minWidth: 160 }}>NOTA</span>
                    </div>
                    {cat.items.map((item, ii) => (
                      <div key={ii} className="item-row" style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", padding: "9px 14px", borderTop: `1px solid ${C.border}22`, transition: "all 0.1s", alignItems: "start" }}>
                        <div>
                          <div style={{ fontSize: 11, color: C.bright, marginBottom: 2 }}>{item.item}</div>
                          <div style={{ fontSize: 9, color: "#2A5A70" }}>{item.spec}</div>
                        </div>
                        <div style={{ color: "#00C8FF", fontFamily: "monospace", fontSize: 11, textAlign: "right", minWidth: 80, paddingLeft: 12 }}>{fmt(item.min)}</div>
                        <div style={{ color: "#F5A623", fontFamily: "monospace", fontSize: 11, textAlign: "right", minWidth: 80, paddingLeft: 12 }}>{item.max ? fmt(item.max) : "—"}</div>
                        <div style={{ fontSize: 9, color: item.note?.includes("CRÍTICO") || item.note?.includes("OBLIGATORIO") ? "#FF6B6B" : "#2A5A70", textAlign: "right", minWidth: 160, paddingLeft: 12 }}>{item.note}</div>
                      </div>
                    ))}
                    {/* Category total */}
                    <div style={{ padding: "8px 14px", borderTop: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "1fr auto auto auto", background: "rgba(0,0,0,0.3)" }}>
                      <span style={{ fontSize: 10, color: "#4A8A9A", fontFamily: "monospace" }}>SUBTOTAL {cat.name}</span>
                      <span style={{ color: "#00C8FF", fontFamily: "monospace", fontWeight: 700, fontSize: 11, textAlign: "right", minWidth: 80 }}>{fmt(cat.items.reduce((s, i) => s + i.min, 0))}</span>
                      <span style={{ color: "#F5A623", fontFamily: "monospace", fontWeight: 700, fontSize: 11, textAlign: "right", minWidth: 80 }}>{fmt(cat.items.reduce((s, i) => s + i.max, 0))}</span>
                      <span style={{ minWidth: 160 }}></span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Phase total */}
            <div style={{ marginTop: 16, padding: "14px 18px", background: `${phase.color}10`, border: `1px solid ${phase.color}44`, borderRadius: 3, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: C.bright }}>TOTAL {phase.label} — {phase.name}</span>
              <div style={{ display: "flex", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 8, color: "#1A4A5A", fontFamily: "monospace" }}>ESCENARIO CONSERVADOR</div>
                  <div style={{ fontSize: 20, color: "#00C8FF", fontFamily: "monospace", fontWeight: 700 }}>{fmt(phase.total_min)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: "#1A4A5A", fontFamily: "monospace" }}>ESCENARIO COMPLETO</div>
                  <div style={{ fontSize: 20, color: "#F5A623", fontFamily: "monospace", fontWeight: 700 }}>{fmt(phase.total_max)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ TOTALS VIEW ══ */}
        {viewMode === "totals" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {TOTAL_RANGES.map((t, i) => (
                <div key={i} style={{ padding: 18, background: C.dim, border: `1px solid ${C.border}`, borderRadius: 3 }}>
                  <div style={{ fontSize: 9, color: "#1A4A5A", letterSpacing: 2, fontFamily: "monospace", marginBottom: 6 }}>ESCENARIO {i + 1}</div>
                  <div style={{ fontSize: 13, color: C.bright, marginBottom: 10 }}>{t.label}</div>
                  <div style={{ fontSize: 26, color: "#00C8FF", fontFamily: "monospace", fontWeight: 700 }}>{fmt(t.min)}</div>
                  {t.max && <div style={{ fontSize: 16, color: "#F5A623", fontFamily: "monospace" }}>hasta {fmt(t.max)}</div>}
                  <div style={{ fontSize: 10, color: "#2A5A70", marginTop: 8 }}>{t.note}</div>
                </div>
              ))}
            </div>

            {/* Phase comparison table */}
            <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 3, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 10, color: "#00C8FF", fontFamily: "monospace", letterSpacing: 2 }}>COMPARATIVA POR FASE</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.4)" }}>
                    {["FASE", "NOMBRE", "PERIODO", "INVERSIÓN MIN", "INVERSIÓN MAX", "% DEL TOTAL", "OBJETIVO"].map(h => (
                      <th key={h} style={{ padding: "7px 12px", fontSize: 8, color: "#1A4A5A", letterSpacing: 1, textAlign: "left", fontFamily: "monospace" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PHASES.map((p, i) => {
                    const totalMin = PHASES.reduce((s, ph) => s + ph.total_min, 0);
                    const pct = Math.round(p.total_min / totalMin * 100);
                    return (
                      <tr key={i} style={{ borderTop: `1px solid ${C.border}22` }}>
                        <td style={{ padding: "9px 12px" }}><span style={{ color: p.color, fontWeight: 700, fontFamily: "monospace" }}>{p.label}</span></td>
                        <td style={{ padding: "9px 12px", color: C.bright }}>{p.icon} {p.name}</td>
                        <td style={{ padding: "9px 12px", color: "#2A5A70", fontFamily: "monospace" }}>{p.timeline}</td>
                        <td style={{ padding: "9px 12px", color: "#00C8FF", fontFamily: "monospace", fontWeight: 700 }}>{fmt(p.total_min)}</td>
                        <td style={{ padding: "9px 12px", color: "#F5A623", fontFamily: "monospace" }}>{fmt(p.total_max)}</td>
                        <td style={{ padding: "9px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 60, height: 4, background: "#0A1A28", borderRadius: 2 }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: p.color, borderRadius: 2 }} />
                            </div>
                            <span style={{ color: p.color, fontFamily: "monospace", fontSize: 10 }}>{pct}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "9px 12px", fontSize: 10, color: "#2A5A70" }}>{p.description.split(".")[0]}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop: `1px solid ${C.border}`, background: "rgba(0,0,0,0.4)" }}>
                    <td colSpan={3} style={{ padding: "10px 12px", color: C.bright, fontWeight: 700 }}>TOTAL ACUMULADO</td>
                    <td style={{ padding: "10px 12px", color: "#00C8FF", fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{fmt(PHASES.reduce((s, p) => s + p.total_min, 0))}</td>
                    <td style={{ padding: "10px 12px", color: "#F5A623", fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{fmt(PHASES.reduce((s, p) => s + p.total_max, 0))}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ROI projection */}
            <div style={{ background: C.panel, border: `1px solid rgba(0,230,118,0.2)`, borderRadius: 3, padding: 16 }}>
              <div style={{ fontSize: 10, color: "#00E676", fontFamily: "monospace", letterSpacing: 2, marginBottom: 14 }}>PROYECCIÓN ROI — ESCENARIOS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {[
                  { scenario: "CONSERVADOR", invest: "€654K", revenue_yr3: "€2.5M/año", roi: "4×", note: "Solo logística + inmobiliaria, España" },
                  { scenario: "MODERADO", invest: "€654K", revenue_yr3: "€12M/año", roi: "18×", note: "3 sectores, EU mediterráneo" },
                  { scenario: "OPTIMISTA", invest: "€1.5M", revenue_yr3: "€80M/año", roi: "53×", note: "10 sectores, escala global, BEZ × 20" },
                ].map(s => (
                  <div key={s.scenario} style={{ padding: 14, background: "rgba(0,230,118,0.05)", border: "1px solid rgba(0,230,118,0.12)", borderRadius: 3 }}>
                    <div style={{ fontSize: 9, color: "#00E676", letterSpacing: 2, fontFamily: "monospace", marginBottom: 6 }}>{s.scenario}</div>
                    <div style={{ fontSize: 11, color: "#4A8A9A", marginBottom: 4 }}>Inversión: {s.invest}</div>
                    <div style={{ fontSize: 14, color: C.bright, fontWeight: 700, marginBottom: 2 }}>{s.revenue_yr3}</div>
                    <div style={{ fontSize: 20, color: "#00E676", fontFamily: "monospace", fontWeight: 900, marginBottom: 6 }}>ROI {s.roi}</div>
                    <div style={{ fontSize: 9, color: "#2A5A70" }}>{s.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ FUNDING VIEW ══ */}
        {viewMode === "funding" && (
          <div>
            <div style={{ marginBottom: 20, padding: 14, background: "rgba(0,200,255,0.04)", border: `1px solid rgba(0,200,255,0.15)`, borderRadius: 3 }}>
              <div style={{ fontSize: 11, color: C.bright, marginBottom: 6 }}>💡 Estrategia de financiación recomendada: capas progresivas</div>
              <div style={{ fontSize: 10, color: "#2A5A70", lineHeight: 1.8 }}>
                No necesitas todo el dinero desde el día 1. La estrategia óptima es: <strong style={{ color: "#F5A623" }}>Bootstrapping → Subvenciones públicas → Angels → ICO parcial → VCs</strong>. Cada capa te da más validación para la siguiente y reduces dilución del equity.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {FUNDING_SOURCES.map((f, i) => (
                <div key={i} style={{ padding: 16, background: C.dim, border: `1px solid ${C.border}`, borderRadius: 3, borderLeft: `3px solid ${f.color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ fontSize: 14 }}>{f.icon}</div>
                    <span style={{ fontSize: 9, padding: "2px 8px", background: `${f.color}15`, color: f.color, borderRadius: 2, fontFamily: "monospace" }}>RIESGO: {f.risk}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.bright, marginBottom: 4 }}>{f.name}</div>
                  <div style={{ fontSize: 18, color: f.color, fontFamily: "monospace", fontWeight: 700, marginBottom: 6 }}>{f.amount}</div>
                  <div style={{ fontSize: 10, color: "#2A5A70", lineHeight: 1.6 }}>{f.description}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, padding: 16, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 3 }}>
              <div style={{ fontSize: 10, color: "#00C8FF", fontFamily: "monospace", letterSpacing: 2, marginBottom: 12 }}>ORDEN DE EJECUCIÓN RECOMENDADO</div>
              {[
                { order: "1º", action: "Constituir SL, dominar bez.digital, desplegar contratos en testnet", cost: "€500–1K", timing: "Semana 1" },
                { order: "2º", action: "Solicitar ENISA Jóvenes Emprendedores (€75K, 0% garantía)", cost: "Gratuito", timing: "Mes 1" },
                { order: "3º", action: "Solicitar CDTI Neotec o Fondo Tecnológico", cost: "Gratuito", timing: "Mes 1–2" },
                { order: "4º", action: "MVP funcionando → buscar primer piloto naviera (sin cobrar)", cost: "Tiempo", timing: "Mes 2–3" },
                { order: "5º", action: "Con piloto firmado → Angels o FFF €100K–200K", cost: "15–20% equity", timing: "Mes 3–6" },
                { order: "6º", action: "Auditoría contratos + Registro VASP Banco de España", cost: "€10K–30K", timing: "Mes 4–6" },
                { order: "7º", action: "ICO privada (whitelist) solo para fondear Fase 2", cost: "10–15% supply", timing: "Mes 8–12" },
                { order: "8º", action: "Serie A con VC crypto/fintech para escala global", cost: "20–25% equity", timing: "Mes 15–24" },
              ].map(s => (
                <div key={s.order} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "#00C8FF", fontFamily: "monospace", fontWeight: 700, fontSize: 11, minWidth: 24 }}>{s.order}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 11, color: C.bright }}>{s.action}</span>
                  </div>
                  <span style={{ fontSize: 10, color: "#00E676", fontFamily: "monospace", minWidth: 100, textAlign: "right" }}>{s.cost}</span>
                  <span style={{ fontSize: 9, color: "#2A5A70", fontFamily: "monospace", minWidth: 70, textAlign: "right" }}>{s.timing}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ ROADMAP VIEW ══ */}
        {viewMode === "roadmap" && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { month: "MES 1–2", title: "Constitución & Setup", items: ["Constituir SL en España (€500)", "Solicitar ENISA + CDTI", "Comprar hardware base (€8K–15K)", "Setup servidor + Docker + CI/CD", "Desplegar contratos en Polygon testnet"], color: "#00C8FF", budget: "€10K–20K" },
                { month: "MES 3–4", title: "MVP ShipTrack + CustomsClear", items: ["ShipTrack Agent completo + Marine Traffic API", "CustomsClear Agent + Claude Vision", "Panel de administración web", "Auditoría básica smart contracts (€5K)", "Piloto gratuito con 1 naviera pequeña"], color: "#40C4FF", budget: "€20K–35K" },
                { month: "MES 5–6", title: "Primeros contratos logísticos", items: ["Contrato piloto pagado con naviera (€5K–50K/mes)", "RWA Cargo Agent + Bloomberg API", "Port Finance Agent", "Registro VASP Banco de España", "Captación €100K–200K (Angels/FFF)"], color: "#F5A623", budget: "€25K–50K" },
                { month: "MES 7–9", title: "Logística completa + escala", items: ["Cold Chain Agent + IoT sensors", "Maritime Insurance Agent (Lloyd's API)", "Auditoría completa contratos (€15K–25K)", "TOC Europe conference", "Primer revenue real €10K–100K/mes"], color: "#FF9100", budget: "€40K–80K" },
                { month: "MES 10–14", title: "Inmobiliaria + Salud", items: ["PropToken + SmartMortgage Agents", "MedRecord + PharmaTrak Agents", "ISO 27001 certificación", "Integración Registro Propiedad España", "HIMSS Europe + MIPIM conferencias", "ICO privada €500K–2M"], color: "#FF6B35", budget: "€80K–180K" },
                { month: "MES 15–18", title: "Energía + 3 sectores más", items: ["GreenToken Agent (Verra API)", "P2P Energy + Solar DeFi", "CropToken + LandToken (Agroindustria)", "GoldToken + LithiumChain (Minería)", "Licencia MiCA EU", "Serie A €1M–5M"], color: "#FFD700", budget: "€120K–250K" },
                { month: "MES 19–36", title: "Escala global — 10 sectores", items: ["Aviación, Arte, Automoción, Pesca", "Modelo IA propio BeZhasAI (fine-tuned)", "Datacenter Frankfurt", "Equipo 30–50 personas", "TOKEN2049 Singapur / Dubai", "Revenue objetivo €5M–80M/año"], color: "#00E676", budget: "€350K–850K" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 40 }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: r.color, flexShrink: 0, marginTop: 16, boxShadow: `0 0 8px ${r.color}88` }} />
                    {i < 6 && <div style={{ width: 2, flex: 1, background: `linear-gradient(${r.color}, ${[...new Array(7)].map((_,j) => ["#00C8FF","#40C4FF","#F5A623","#FF9100","#FF6B35","#FFD700","#00E676"][j])[i+1]})`, minHeight: 30 }} />}
                  </div>
                  <div style={{ flex: 1, padding: "12px 16px 20px", marginLeft: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
                      <div>
                        <span style={{ fontFamily: "monospace", fontSize: 10, color: r.color, letterSpacing: 2 }}>{r.month}</span>
                        <span style={{ fontSize: 13, color: C.bright, marginLeft: 12 }}>{r.title}</span>
                      </div>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#F5A623" }}>{r.budget}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {r.items.map((item, ii) => (
                        <span key={ii} style={{ fontSize: 10, color: "#2A5A70", padding: "3px 8px", background: `${r.color}08`, border: `1px solid ${r.color}20`, borderRadius: 2 }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
