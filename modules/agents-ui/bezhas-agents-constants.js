// ─── bezhas-agents-constants.js ──────────────────────────────────────────────
// ARCHIVO 1/6 — Constantes compartidas por todos los módulos
// Importar en cada archivo: import { C, ADDR, GROUPS, MCP_TOOLS } from './bezhas-agents-constants'

export const C = {
  bg: "#03060E", surf: "#070D1C", card: "#0C1628", card2: "#101E38",
  card3: "#142444", border: "#0D2040", border2: "#163560", border3: "#1E4A8A",
  primary: "#00C896", gold: "#FFB800", neon: "#00FFB2",
  blue: "#2563EB", violet: "#7C3AED", pink: "#EC4899",
  orange: "#F97316", red: "#EF4444", yellow: "#EAB308",
  text: "#E8F4FF", text2: "#A8C4E0", muted: "#3D5E80",
  mono: "'JetBrains Mono','Courier New',monospace",
  sans: "'Inter','Segoe UI',system-ui,sans-serif",
};

export const ADDR = {
  BEZ_POL: "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8",
  BEZ_BNB: "0x8a1e3930fde1f151471c368fdbb39f3f63a65b55",
  ESCROW: "0x3EfC42095E8503d41Ad8001328FC23388E00e8a3",
  DAO: "0x89c23890c742d710265dD61be789C71dC8999b12",
  HOT: "0x52Df82920CBAE522880dD7657e43d1A754eD044E",
};

export const GROUPS = [
  {
    id: "mcp", label: "MCP SERVER CORE", icon: "🎛️", color: "#00FFB2",
    desc: "Orquestador central BeZhas. Analiza gas en tiempo real, calcula swaps BEZ↔FIAT, verifica AML/KYC. packages/mcp-server/",
    agents: [
      {
        id: "orch", name: "MCP Orchestrator", icon: "🧠", status: "ACTIVE", fee: "0.05 BEZ/op", color: "#00FFB2",
        tools: ["analyzeGasStrategy()", "calculateSmartSwap()", "verifyRegulatoryCompliance()", "routeTransaction()"],
        contracts: ["BeZhasCore.sol", "BezhasToken.sol"],
        apis: ["Chainlink Gas Feed", "QuickSwap V3 SDK", "Sumsub KYC API"],
        auto: ["Gas monitor 15s → batch óptimo", "AML screen antes de cada pago", "Smart routing BEZ↔FIAT RT"],
        file: "packages/mcp-server/orchestrator.ts"
      },
      {
        id: "gas", name: "Gas Strategy Agent", icon: "⛽", status: "ACTIVE", fee: "0.02 BEZ/batch", color: "#00FFB2",
        tools: ["monitorCongestion()", "batchTransactions()", "predictGasWindow()"],
        contracts: ["BeZhasCore.sol"],
        apis: ["Polygon Gas Station", "Infura RPC", "Alchemy Webhook"],
        auto: ["Congestion >80 gwei → rebatch", "50 tx → 1 on-chain", "Ahorro 70% en fees"],
        file: "packages/mcp-server/gas-strategy.ts"
      },
      {
        id: "swap", name: "Smart Swap Agent", icon: "🔄", status: "ACTIVE", fee: "0.1% spread", color: "#00FFB2",
        tools: ["routeSwap()", "calcSlippage()", "findBestPool()", "executeCrossChain()"],
        contracts: ["BeZhasMarketplace.sol", "StakingPoolV2.sol"],
        apis: ["QuickSwap V3", "1inch API", "0x Protocol", "LayerZero"],
        auto: ["Ruta óptima 3 DEX", "Slippage <0.5%", "Bridge Poly↔BNB si mejor precio"],
        file: "packages/mcp-server/smart-swap.ts"
      },
    ]
  },
  {
    id: "oracle", label: "ORÁCULO AEGIS", icon: "🔮", color: "#F97316",
    desc: "Motor de validación física on-chain. Claude Vision + Gemini certifican activos reales. 0.5 BEZ quemado por scan. packages/oracle/",
    agents: [
      {
        id: "aegis", name: "Aegis Quality Oracle", icon: "⚖️", status: "ACTIVE", fee: "0.5 BEZ 🔥", color: "#F97316",
        tools: ["analyzeEvidence()", "emitQualityScore()", "triggerEscrow()", "haltPayment()"],
        contracts: ["QualityEscrow 0x3EfC…", "QualityOracle.sol", "BeZhasCore.sol"],
        apis: ["Claude Sonnet 4.6 Vision", "Gemini 1.5 Pro", "Chainlink Oracle", "IPFS"],
        auto: ["Imagen→JSON score→escrow auto", "Score≥80 → RELEASE_FULL", "Score<65 → HOLD+alerta"],
        file: "packages/oracle/aegis-quality.ts"
      },
      {
        id: "food", name: "Food Oracle Agent", icon: "🍎", status: "BETA", fee: "0.5🔥 + 1 mint", color: "#F97316",
        tools: ["scanLiDAR3D()", "detectFungal()", "calcBiomass()", "mintBCMNFT()", "syncASYCUDA()"],
        contracts: ["BeZhasNFT.sol (BCM)", "QualityEscrow", "LogisticsContainer.sol"],
        apis: ["ARCore Depth", "YOLOv8-S Edge", "Gemini Vision", "ASYCUDA World", "SIMPLE Puertos"],
        auto: ["LiDAR→SLAM 3D→Claude Vision", "BCM NFT mint auto", "DPP→ASYCUDA XML sync"],
        file: "packages/oracle/food-oracle.ts"
      },
      {
        id: "cold", name: "Cold Chain Monitor", icon: "❄️", status: "DEV", fee: "0.3 BEZ/alerta", color: "#F97316",
        tools: ["detectColdBreak()", "correlateIoT()", "triggerDispute()"],
        contracts: ["LogisticsContainer.sol", "QualityOracle.sol"],
        apis: ["Sensitech IoT", "ELPRO Sensors", "AWS IoT", "Chainlink Weather"],
        auto: ["Temp fuera rango → COMPROMISED", "Penalización auto carrier", "Escrow hold+notificación"],
        file: "packages/oracle/cold-chain.ts"
      },
    ]
  },
  {
    id: "ssi", label: "SSIaaS / IDENTIDAD", icon: "🪪", color: "#7C3AED",
    desc: "Identidad Auto-soberana. DIDs W3C + Credenciales Verificables + Proof-of-Reputation on-chain. packages/identity/",
    agents: [
      {
        id: "did", name: "SSI / DID Agent", icon: "🔐", status: "ACTIVE", fee: "0.1 BEZ/DID 🔥", color: "#7C3AED",
        tools: ["issueDID()", "issueVC()", "revokeVC()", "verifyCredential()"],
        contracts: ["BeZhasCore.sol", "BeZhasNFT.sol (SBT)"],
        apis: ["did:polygon", "W3C VC API", "Sumsub KYC", "Onfido"],
        auto: ["DID auto al registrar empresa", "VC tras KYC aprobado", "Revocación on-chain inmediata"],
        file: "packages/identity/did-agent.ts"
      },
      {
        id: "por", name: "Proof-of-Reputation", icon: "⭐", status: "DEV", fee: "APY boost", color: "#7C3AED",
        tools: ["calcReputationScore()", "updatePoR()", "adjustStakingAPY()"],
        contracts: ["BeZhasRewardsCalculator.sol", "StakingPoolV2.sol"],
        apis: ["QualityOracle feed", "The Graph", "Chainlink VRF"],
        auto: ["PoR recalcula cada 24h", "Score alto → APY +12%", "Score bajo → fee penalty"],
        file: "packages/identity/reputation.ts"
      },
    ]
  },
  {
    id: "dao", label: "DAO CORE-PLUGIN", icon: "🏛️", color: "#EAB308",
    desc: "Aragon OSx pattern. Core inmutable + Plugins evolutivos. Tesorería algorítmica + HR + DePub + Kleros. packages/dao/",
    agents: [
      {
        id: "gov", name: "DAO Governor", icon: "🗳️", status: "ACTIVE", fee: "0.5% TVL/año", color: "#EAB308",
        tools: ["submitProposal()", "executeVote()", "rebalanceTreasury()", "checkConcentrationRisk()"],
        contracts: ["Treasury DAO 0x89c2…", "Safe Wallet 0x3EfC…"],
        apis: ["Tally Governance", "Snapshot.org", "Gnosis Safe", "Chainlink Price"],
        auto: ["BEZ >65% → rebalanceo auto", "Propuesta urgente auto", "Exec tras 48h voting"],
        file: "packages/dao/governor.ts"
      },
      {
        id: "hr", name: "DAO HR Agent", icon: "👤", status: "DEV", fee: "0.5% milestone", color: "#EAB308",
        tools: ["createVesting()", "verifyMilestone()", "releasePay()", "escalateKleros()"],
        contracts: ["BeZhasCore.sol", "StakingPoolV2.sol"],
        apis: ["Kleros Court SDK", "IPFS evidencias", "GitHub API"],
        auto: ["Cliff check diario", "Milestone→commit verify", "Disputa→Kleros auto"],
        file: "packages/dao/hr-agent.ts"
      },
      {
        id: "depub", name: "DePub Ads Agent", icon: "📢", status: "DESIGN", fee: "10% presupuesto", color: "#EAB308",
        tools: ["mintAdCard()", "verifyMetrics()", "distributeRevenue()", "detectBotTraffic()"],
        contracts: ["BeZhasNFT.sol (Ad Cards)", "QualityEscrow", "BeZhasRewardsCalculator.sol"],
        apis: ["Chainlink Functions", "Playwright anti-bot", "Brave Attention"],
        auto: ["Impresiones RT anti-bot", "Pago creador+user+DAO auto", "Escrow→release por métricas"],
        file: "packages/dao/depub.ts"
      },
      {
        id: "arb", name: "Arbitraje Agent", icon: "⚖️", status: "DEV", fee: "10 BEZ/disputa 🔥", color: "#EAB308",
        tools: ["openDispute()", "lockEscrow()", "submitKleros()", "executeSentence()"],
        contracts: ["QualityEscrow 0x3EfC…", "BeZhasCore.sol"],
        apis: ["Kleros Court SDK", "Aragon Court", "IPFS upload"],
        auto: ["Escrow lock al abrir disputa", "Kleros→exec sentencia", "Slashing si fraude"],
        file: "packages/dao/arbitrage.ts"
      },
    ]
  },
  {
    id: "baas", label: "BaaS SDK & BRIDGE", icon: "🌉", color: "#00C896",
    desc: "Universal Bridge ETH↔Polygon↔BNB. SDK integra SAP, Shopify, ASYCUDA. Code Auditor autónomo. packages/bridge/",
    agents: [
      {
        id: "bridge", name: "Universal Bridge", icon: "🌉", status: "ACTIVE", fee: "0.3%/bridge", color: "#00C896",
        tools: ["lockAndMint()", "burnAndUnlock()", "syncERP()", "routeCrossChainMessage()"],
        contracts: ["BezhasToken BEP-20 0x8a1e…", "BezhasToken ERC-20 0xEcBa…"],
        apis: ["LayerZero Endpoint", "Wormhole Guardian", "SAP BTP", "Shopify Admin"],
        auto: ["Lock ETH→mint BEZ Polygon", "Burn Poly→unlock ETH", "SAP inventory→NFT sync"],
        file: "packages/bridge/universal-bridge.ts"
      },
      {
        id: "sdk", name: "BeZhas SDK Agent", icon: "🔧", status: "ACTIVE", fee: "micro-fee/call", color: "#00C896",
        tools: ["signTransaction()", "estimateGas()", "deployContract()", "syncASYCUDA()"],
        contracts: ["ABI registry todos contratos"],
        apis: ["ASYCUDA World UNCTAD", "SIMPLE Puertos ES", "Make.com", "GitHub CI/CD"],
        auto: ["Nonce manager anti-replay", "Gas estimación dinámica", "ASYCUDA XML auto"],
        file: "packages/sdk/bezhas-sdk.ts"
      },
      {
        id: "audit", name: "Code Auditor", icon: "🔍", status: "ACTIVE", fee: "cert hash on-chain", color: "#00C896",
        tools: ["auditSolidity()", "scanFrontend()", "proposeRefactor()", "generateTests()"],
        contracts: ["QualityOracle.sol (cert hash)"],
        apis: ["Slither Static Analysis", "MythX Security", "GitHub Actions", "GCP Cloud Run"],
        auto: ["Scan Solidity cada PR", "Gas inefficiency→PR fix", "Tests auto-generados"],
        file: "packages/audit/code-auditor.ts"
      },
    ]
  },
  {
    id: "token", label: "TOKENOMICS & PAGO", icon: "💎", color: "#FFB800",
    desc: "Motor económico BEZ-Coin. APY dinámico, burn deflacionario, pago híbrido propio. packages/tokenomics/ + packages/payment/",
    agents: [
      {
        id: "tknomics", name: "Tokenomics Agent", icon: "📈", status: "ACTIVE", fee: "protege TVL", color: "#FFB800",
        tools: ["adjustStakingAPY()", "executeBurn()", "calcCirculatingSupply()", "monitorLiquidity()"],
        contracts: ["BezhasToken.sol", "StakingPoolV2.sol", "BeZhasRewardsCalculator.sol"],
        apis: ["Chainlink BEZ/USD", "CoinGecko Market", "DexScreener", "QuickSwap V3"],
        auto: ["APY ajusta cada 4h", "0.5 BEZ burned/op logística", "Conc.>65%→diversificación"],
        file: "packages/tokenomics/tokenomics-agent.ts"
      },
      {
        id: "pay", name: "Hybrid Payment", icon: "💳", status: "ACTIVE", fee: "0.5-1.5% conversión", color: "#FFB800",
        tools: ["processPayment()", "convertBEZtoFIAT()", "executeSepa()", "dispenseTokens()"],
        contracts: ["BezhasToken.sol", "BeZhasCore.sol", "QualityEscrow 0x3EfC…", "Hot Wallet 0x52Df…"],
        apis: ["Stripe Payment Intents", "MoonPay Widget", "Transak API", "ING SEPA ES77 1465…"],
        auto: ["BEZ liquidación interna siempre", "SEPA→IBAN proveedor auto", "MoonPay si sin wallet"],
        file: "packages/payment/hybrid-payment.ts"
      },
      {
        id: "stake", name: "Dynamic Staking", icon: "🏦", status: "ACTIVE", fee: "APY hasta 12%", color: "#FFB800",
        tools: ["stakeTokens()", "claimRewards()", "adjustMultiplier()", "calcAPYBoost()"],
        contracts: ["StakingPoolV2.sol", "BeZhasRewardsCalculator.sol", "BezhasToken.sol"],
        apis: ["QuickSwap V3 LP", "Chainlink VRF", "The Graph Staking"],
        auto: ["Lock multiplier 3x a 365d", "Rewards cada bloque", "APY boost por PoR score"],
        file: "packages/staking/dynamic-staking.ts"
      },
    ]
  },
  {
    id: "health", label: "HEALTHCARE", icon: "🏥", color: "#00FF88",
    desc: "Sector Salud. Historiales clínicos SBT, cadena farmacéutica, seguros con IA, datos clínicos tokenizados. modules/agents-ui/",
    agents: [
      {
        id: "medrecord", name: "MedRecord Agent", icon: "📋", status: "ACTIVE", fee: "0.2 BEZ/mint", color: "#00FF88",
        tools: ["mintMedRecordSBT()", "grantAccess()", "verifyWithZKProof()", "emergencyAccess()", "revokeAllAccess()"],
        contracts: ["HealthRecordSBT.sol"],
        apis: ["HL7 FHIR R4 API", "ZK-SNARK Verifier", "Hospital EHR Systems"],
        auto: ["FHIR sync → SHA-256 hash → SBT update", "ZK-proof consent verification", "Emergency multi-sig override"],
        file: "modules/agents-ui/medrecord-agent.jsx"
      },
      {
        id: "pharmatrak", name: "PharmaTrak Agent", icon: "💊", status: "ACTIVE", fee: "0.3 BEZ/lot", color: "#00D4FF",
        tools: ["registerPharmaBatch()", "logTemperature()", "verifyCertificate()", "transferCustody()", "triggerAlert()"],
        contracts: ["PharmaTracker.sol", "QualityOracle.sol"],
        apis: ["RFID/NFC Scanners", "IoT Temp Sensors", "EU FMD API", "FDA DSCSA"],
        auto: ["Temp out-of-range → auto ALERT", "RFID scan → on-chain verify", "Chain of custody immutable log"],
        file: "modules/agents-ui/pharmatrak-agent.jsx"
      },
      {
        id: "claimbot", name: "ClaimBot Agent", icon: "🤖", status: "ACTIVE", fee: "0.5 BEZ/claim", color: "#FFD700",
        tools: ["submitClaim()", "setAIVerification()", "autoApprove()", "flagFraud()", "releasePayout()"],
        contracts: ["HealthInsuranceEscrow.sol", "QualityEscrow.sol"],
        apis: ["Claude Sonnet 4.6 OCR", "ICD-10 Validator", "Insurance APIs"],
        auto: ["AI score ≥85 → auto-approve", "AI score <50 → fraud flag", "Escrow lock → release payout"],
        file: "modules/agents-ui/claimbot-agent.jsx"
      },
      {
        id: "biodata", name: "BioData Agent", icon: "🧬", status: "ACTIVE", fee: "5% commission", color: "#7C3AED",
        tools: ["registerTrial()", "signConsent()", "tokenizeDataset()", "purchaseDataAccess()", "distributeRewards()"],
        contracts: ["ClinicalDataMarketplace.sol"],
        apis: ["ZK-SNARK Anonymizer", "EIP-712 Consent", "Research APIs"],
        auto: ["On-chain informed consent", "ZK-anonymized dataset tokenization", "Patient BEZ reward distribution"],
        file: "modules/agents-ui/biodata-agent.jsx"
      },
    ]
  },
  {
    id: "automotive", label: "AUTOMOTRIZ", icon: "\uD83D\uDE97", color: "#3B82F6",
    desc: "Sector Automotriz. Identidad vehicular NFT, trazabilidad de autopartes, leasing DeFi, red de carga EV. modules/agents-ui/",
    agents: [
      {
        id: "vehiclenft", name: "VehicleNFT Agent", icon: "\uD83D\uDE97", status: "ACTIVE", fee: "0.5 BEZ/mint", color: "#3B82F6",
        tools: ["mintVehicle()", "updateMileage()", "transferVehicle()", "reportStolen()", "getHistory()"],
        contracts: ["VehicleIdentityNFT.sol"],
        apis: ["OBD-II IoT", "DMV Registry API", "Interpol Stolen DB"],
        auto: ["VIN scan → NFT mint", "OBD-II → mileage oracle update", "Stolen report → transfer block"],
        file: "modules/agents-ui/vehiclenft-agent.jsx"
      },
      {
        id: "autoparts", name: "AutoParts Agent", icon: "\u2699\uFE0F", status: "ACTIVE", fee: "0.3 BEZ/part", color: "#F97316",
        tools: ["registerPart()", "verifyAuthenticity()", "transferCustody()", "issueRecall()", "isCounterfeit()"],
        contracts: ["AutoPartsRegistry.sol"],
        apis: ["NFC/RFID Scanner", "AI Visual Hash", "OEM Database"],
        auto: ["NFC scan → hash verify", "Batch recall → auto-flag parts", "Custody log with IoT proof"],
        file: "modules/agents-ui/autoparts-agent.jsx"
      },
      {
        id: "fleetdefi", name: "FleetDeFi Agent", icon: "\uD83D\uDE9A", status: "ACTIVE", fee: "1% lease value", color: "#A78BFA",
        tools: ["createLease()", "makePayment()", "claimMaintenance()", "approveMaintenance()", "terminateLease()"],
        contracts: ["FleetLeaseEscrow.sol"],
        apis: ["Fleet Telematics", "Insurance Pool API", "OBD-II Maintenance"],
        auto: ["Monthly auto-escrow release", "OBD-II alert → maintenance claim", "Usage-based insurance adjust"],
        file: "modules/agents-ui/fleetdefi-agent.jsx"
      },
      {
        id: "evcharge", name: "EVCharge Agent", icon: "\u26A1", status: "ACTIVE", fee: "0.5% per session", color: "#10B981",
        tools: ["registerStation()", "startSession()", "endSession()", "settleSession()", "withdrawRevenue()"],
        contracts: ["EVChargeToken.sol"],
        apis: ["OCPI Network", "Smart Meter IoT", "Grid DSO API"],
        auto: ["Plug-in → session start", "Meter proof → end + settle", "Cross-border roaming auto-settle"],
        file: "modules/agents-ui/evcharge-agent.jsx"
      },
    ]
  },
  {
    id: "manufacturing", label: "MANUFACTURA", icon: "🏭", color: "#F97316",
    desc: "Sector Manufactura. Certificados de calidad NFT, gemelos digitales IoT, MRP on-chain, mantenimiento predictivo. modules/agents-ui/",
    agents: [
      {
        id: "qualitychain", name: "QualityChain Agent", icon: "📜", status: "ACTIVE", fee: "0.5 BEZ/cert", color: "#00FF88",
        tools: ["mintCertificate()", "logDefect()", "revokeCertificate()", "recertify()", "getCertificate()"],
        contracts: ["QualityCertificateNFT.sol"],
        apis: ["SGS API", "Bureau Veritas API", "TÜV Rheinland API", "DNV GL API"],
        auto: ["Batch inspection → NFT cert", "Defect score < 50 → auto-revoke", "Recertify triggers new audit"],
        file: "modules/agents-ui/qualitychain-agent.jsx"
      },
      {
        id: "digitaltwin", name: "DigitalTwin Agent", icon: "🏭", status: "ACTIVE", fee: "1.0 BEZ/twin", color: "#7C3AED",
        tools: ["mintTwin()", "logTelemetry()", "updateHealth()", "decommission()"],
        contracts: ["DigitalTwinRegistry.sol"],
        apis: ["IoT Hub MQTT", "Azure Digital Twins", "AWS IoT Core", "OPC-UA Gateway"],
        auto: ["IoT heartbeat → telemetry log", "Health < 50 → alert", "Decommission → NFT archive"],
        file: "modules/agents-ui/digitaltwin-agent.jsx"
      },
      {
        id: "supplymrp", name: "SupplyMRP Agent", icon: "📦", status: "ACTIVE", fee: "0.5 BEZ/PO", color: "#F97316",
        tools: ["registerMaterial()", "createPurchaseOrder()", "receiveOrder()", "addBOMEntry()", "consumeMaterial()"],
        contracts: ["MaterialTokenMRP.sol"],
        apis: ["SAP ERP API", "Oracle NetSuite", "Supplier EDI Gateway"],
        auto: ["Stock < reorder → auto PO", "BOM calc → material demand", "Receipt QC → supply update"],
        file: "modules/agents-ui/supplymrp-agent.jsx"
      },
      {
        id: "predmaint", name: "PredMaint Agent", icon: "🔧", status: "ACTIVE", fee: "0.05 BEZ/reading", color: "#EF4444",
        tools: ["registerEquipment()", "logSensorReading()", "setThresholds()", "recordMaintenance()", "deactivateEquipment()"],
        contracts: ["PredictiveMaintenanceLog.sol"],
        apis: ["TensorFlow Serving", "IoT MQTT Broker", "Vibration Analyzer API"],
        auto: ["Threshold breach → alert + log", "AI RUL prediction → schedule", "Maintenance proof on-chain"],
        file: "modules/agents-ui/predmaint-agent.jsx"
      },
    ]
  },
  {
    id: "energy", label: "ENERGIA RENOVABLE", icon: "\u26A1", color: "#FFD700",
    desc: "Sector Energia. Creditos de carbono, trading P2P, granjas solares fraccionalizadas, scoring ESG on-chain. modules/agents-ui/",
    agents: [
      {
        id: "greentoken", name: "GreenToken Agent", icon: "\uD83C\uDF3F", status: "ACTIVE", fee: "2% per batch", color: "#00FF88",
        tools: ["mintCreditBatch()", "verifyBatch()", "retireCredits()", "tradeCredits()", "getRetirementCertificate()"],
        contracts: ["CarbonCreditToken.sol"],
        apis: ["Verra Registry API", "Gold Standard API", "AIB REC Registry", "UNFCCC CDM"],
        auto: ["Registry sync → mint ERC-1155", "Oracle verification → certified", "Retirement burn → NFT certificate"],
        file: "modules/agents-ui/greentoken-agent.jsx"
      },
      {
        id: "p2penergy", name: "P2P Energy Agent", icon: "\u26A1", status: "ACTIVE", fee: "0.5% per trade", color: "#00D4FF",
        tools: ["registerProsumer()", "createOffer()", "matchAndSettle()", "withdrawEarnings()", "cancelOffer()"],
        contracts: ["P2PEnergyMarket.sol"],
        apis: ["Smart Meter IoT", "Grid DSO API", "Weather API"],
        auto: ["IoT meter reading → signed proof", "Auto-match surplus → buyer", "Settlement in BEZ instant"],
        file: "modules/agents-ui/p2penergy-agent.jsx"
      },
      {
        id: "solardefi", name: "Solar DeFi Agent", icon: "\u2600\uFE0F", status: "ACTIVE", fee: "1.5% AUM/yr", color: "#F97316",
        tools: ["registerFarm()", "investInFarm()", "distributeDividends()", "claimDividends()", "redeemTokens()"],
        contracts: ["SolarFarmToken.sol", "StakingPoolV2.sol"],
        apis: ["QuickSwap V3 LP", "Energy Production API", "LayerZero Bridge"],
        auto: ["Daily production → dividend calc", "Auto-distribute to holders", "Funding round → PRODUCING status"],
        file: "modules/agents-ui/solardefi-agent.jsx"
      },
      {
        id: "esgscore", name: "ESG Score Agent", icon: "\uD83D\uDCCA", status: "ACTIVE", fee: "SaaS + advisory", color: "#7C3AED",
        tools: ["registerCompany()", "submitAudit()", "certifyScore()", "getCompanyScore()", "getGrade()"],
        contracts: ["ESGScoreOracle.sol", "QualityOracle.sol"],
        apis: ["Claude AI Analysis", "DNV API", "SGS API", "Bureau Veritas"],
        auto: ["AI + third-party dual audit", "Score → grade auto (A+ to F)", "Re-audit resets certification"],
        file: "modules/agents-ui/esgscore-agent.jsx"
      },
    ]
  },
  {
    id: "social", label: "RED SOCIAL + IA", icon: "🌐", color: "#EC4899",
    desc: "Red social Web3+IA soberana. Chatbot AI Assistant + Content Quality con Claude+Gemini. packages/social/ + packages/ai/",
    agents: [
      {
        id: "content", name: "Content Quality Agent", icon: "✍️", status: "ACTIVE", fee: "reward en BEZ", color: "#EC4899",
        tools: ["evaluateContent()", "detectSpam()", "assignQualityScore()", "distributeReward()"],
        contracts: ["BeZhasRewardsCalculator.sol", "BeZhasMarketplace.sol"],
        apis: ["Claude Sonnet 4.6", "Gemini API", "Perspective API", "Firecrawl"],
        auto: ["Score post→BEZ reward auto", "Spam→shadow-ban on-chain", "Premium boost por stake"],
        file: "packages/social/content-quality.ts"
      },
      {
        id: "assistant", name: "BeZhas AI Assistant", icon: "💬", status: "ACTIVE", fee: "€9.99/mes Premium", color: "#EC4899",
        tools: ["executeNLCommand()", "queryBlockchain()", "executeStaking()", "showLogistics()"],
        contracts: ["Todos vía BeZhas SDK"],
        apis: ["Claude Sonnet 4.6 API", "MCP Server mcp.bez.digital:4001", "WS ws.bez.digital:3002"],
        auto: ["NL→MCP tool call auto", "'Stakear 500 BEZ'→exec", "Logística RT"],
        file: "packages/ai/bezhas-assistant.ts"
      },
    ]
  },
  {
    id: "insurance", label: "SEGUROS", icon: "🛡️", color: "#EF4444",
    desc: "Sector Seguros. Pólizas NFT, ajuste de siniestros con IA, pools de reaseguro DeFi, seguros paramétricos con oráculos.",
    agents: [
      {
        id: "policynft", name: "PolicyNFT Agent", icon: "🛡️", status: "ACTIVE", fee: "0.5 BEZ/policy", color: "#3B82F6",
        tools: ["mintPolicy()", "payPremium()", "cancelPolicy()", "renewPolicy()", "fileClaim()"],
        contracts: ["PolicyNFT.sol"],
        apis: ["Underwriting Oracle", "Risk Score API", "Premium Calculator"],
        auto: ["Premium due → auto-remind", "Expiry → renewal offer", "Claim filed → escrow lock"],
        file: "modules/agents-ui/policynft-agent.jsx"
      },
      {
        id: "claimadjuster", name: "ClaimAdjuster Agent", icon: "📋", status: "ACTIVE", fee: "0.5 BEZ/claim", color: "#F97316",
        tools: ["fileClaim()", "submitEvidence()", "aiScoreClaim()", "approveClaim()", "payoutClaim()"],
        contracts: ["ClaimAdjuster.sol"],
        apis: ["Claude AI Scorer", "Fraud Detection ML", "Evidence IPFS", "ICD-10 Validator"],
        auto: ["AI score ≥85 → fast-track", "Fraud risk >70 → flag", "Approved → auto payout"],
        file: "modules/agents-ui/claimadjuster-agent.jsx"
      },
      {
        id: "reinsurance", name: "ReinsurancePool Agent", icon: "🏦", status: "ACTIVE", fee: "1% AUM/yr", color: "#7C3AED",
        tools: ["createPool()", "deposit()", "withdraw()", "claimYield()", "payClaimFromPool()"],
        contracts: ["ReinsurancePool.sol"],
        apis: ["DeFi Yield Oracle", "Risk Modeling API", "Capital Markets Feed"],
        auto: ["TVL cap → close pool", "Quarterly yield distribution", "Claim event → pool debit"],
        file: "modules/agents-ui/reinsurance-agent.jsx"
      },
      {
        id: "parametric", name: "ParametricIns Agent", icon: "⚡", status: "ACTIVE", fee: "3.0 BEZ/policy", color: "#EF4444",
        tools: ["createParametric()", "submitReading()", "claimPayout()", "expirePolicy()"],
        contracts: ["ParametricInsurance.sol"],
        apis: ["Weather Oracle", "Seismic Oracle", "Hydro Oracle", "Chainlink Functions"],
        auto: ["Oracle reading → trigger check", "Trigger met → auto-payout", "Expiry → deactivate"],
        file: "modules/agents-ui/parametric-agent.jsx"
      },
    ]
  },
  {
    id: "agriculture", label: "AGRICULTURA", icon: "🌾", color: "#10B981",
    desc: "Tokenización agrícola completa. Futuros de cosecha, trazabilidad farm-to-table, acuacultura IoT, y registro de tierras NFT.",
    agents: [
      {
        id: "croptoken", name: "CropToken Agent", icon: "🌽", status: "ACTIVE", fee: "1.0 BEZ/future", color: "#10B981",
        tools: ["createFuture()", "buyFuture()", "certifyHarvest()", "settleFuture()"],
        contracts: ["CropTokenFutures.sol"],
        apis: ["Weather Oracle API", "Commodity Price Feed", "Chainlink Functions"],
        auto: ["Harvest date → auto-certify request", "Buyer payment → escrow", "Oracle certify → settlement"],
        file: "modules/agents-ui/croptoken-agent.jsx"
      },
      {
        id: "agrisupply", name: "AgriSupply Agent", icon: "🥑", status: "ACTIVE", fee: "0.5 BEZ/product", color: "#10B981",
        tools: ["registerProduct()", "addCheckpoint()", "addCertification()", "markDelivered()"],
        contracts: ["AgriSupplyChain.sol"],
        apis: ["GPS Tracker API", "Cold Chain IoT", "USDA Organic API", "GlobalGAP"],
        auto: ["GPS checkpoint auto-log", "Cold chain breach → alert", "Delivery → status update"],
        file: "modules/agents-ui/agrisupply-agent.jsx"
      },
      {
        id: "aquafarm", name: "AquaFarm Agent", icon: "🐟", status: "ACTIVE", fee: "0.05 BEZ/reading", color: "#06B6D4",
        tools: ["registerTank()", "logReading()", "setThresholds()", "harvestTank()"],
        contracts: ["AquaFarmMonitor.sol"],
        apis: ["Water Sensor IoT", "pH/O2 Oracle", "Ammonia Monitor API"],
        auto: ["Sensor → on-chain cada 5min", "Threshold breach → alert", "Harvest → settlement"],
        file: "modules/agents-ui/aquafarm-agent.jsx"
      },
      {
        id: "landregistry", name: "LandRegistry Agent", icon: "🏞️", status: "ACTIVE", fee: "2.0 BEZ/title", color: "#A78BFA",
        tools: ["mintTitle()", "updateSoilData()", "transferTitle()", "fractionalizeTitle()"],
        contracts: ["LandTitleNFT.sol"],
        apis: ["Catastro API", "Soil Analysis IoT", "GPS Bounds API"],
        auto: ["Survey → mint NFT", "Soil data log periodic", "Fractionalize → ERC-1155 shares"],
        file: "modules/agents-ui/landregistry-agent.jsx"
      },
    ]
  },
  {
    id: "education", label: "EDUCATION & CREDENTIALS", icon: "📚", color: "#3B82F6",
    desc: "Tokenized courses, DeFi scholarships, DAO governance for institutions, soulbound skill badges. src/education/",
    agents: [
      {
        id: "coursetoken", name: "CourseToken Agent", icon: "📖", status: "ACTIVE", fee: "1.0 BEZ/course", color: "#3B82F6",
        tools: ["createCourse()", "enrollStudent()", "issueCertificate()", "closeCourse()"],
        contracts: ["CourseTokenNFT.sol"],
        apis: ["IPFS Metadata API", "BeZhas Identity Oracle", "Credential Verification API"],
        auto: ["Enrollment → payment escrow", "Completion → auto-mint cert NFT", "Course full → waitlist"],
        file: "modules/agents-ui/coursetoken-agent.jsx"
      },
      {
        id: "scholarpool", name: "ScholarPool Agent", icon: "🎓", status: "ACTIVE", fee: "0.5 BEZ/application", color: "#10B981",
        tools: ["createPool()", "applyForScholarship()", "approveScholar()", "distributeAward()"],
        contracts: ["ScholarshipPool.sol"],
        apis: ["GPA Oracle", "Merit Score API", "FAFSA Integration"],
        auto: ["GPA verified → auto-approve if threshold", "Award → direct transfer", "Pool depleted → close"],
        file: "modules/agents-ui/scholarpool-agent.jsx"
      },
      {
        id: "edudao", name: "EduDAO Agent", icon: "🏛️", status: "ACTIVE", fee: "0.1 BEZ/vote", color: "#EAB308",
        tools: ["registerInstitution()", "createProposal()", "castVote()", "executeProposal()"],
        contracts: ["EduDAO.sol"],
        apis: ["Governance Subgraph", "Snapshot Oracle", "Treasury API"],
        auto: ["Quorum met → auto-execute", "Treasury funded → notify members", "Deadline → finalize"],
        file: "modules/agents-ui/edudao-agent.jsx"
      },
      {
        id: "skillbadge", name: "SkillBadge Agent", icon: "🏅", status: "ACTIVE", fee: "0.25 BEZ/badge", color: "#7C3AED",
        tools: ["registerIssuer()", "mintBadge()", "verifyBadge()", "revokeBadge()"],
        contracts: ["SkillBadgeSBT.sol"],
        apis: ["Skill Assessment API", "LinkedIn Verify", "Accreditation Oracle"],
        auto: ["Assessment passed → auto-mint SBT", "Issuer accredited → verify chain", "Violation → revoke"],
        file: "modules/agents-ui/skillbadge-agent.jsx"
      },
    ]
  },
  {
    id: "entertainment", label: "ENTERTAINMENT & MEDIA", icon: "🎬", color: "#E040FB",
    desc: "Tokenized event tickets, automated royalty splits, fan governance DAOs, streaming rights marketplace. src/entertainment/",
    agents: [
      {
        id: "eventticket", name: "EventTicket Agent", icon: "🎫", status: "ACTIVE", fee: "0.5 BEZ/ticket", color: "#E040FB",
        tools: ["createEvent()", "purchaseTicket()", "useTicket()", "listForResale()", "buyResale()", "cancelEvent()", "refundTicket()"],
        contracts: ["EventTicketNFT.sol"],
        apis: ["Venue Capacity API", "Anti-Scalping Oracle", "QR Scanner API"],
        auto: ["Sold out → close sales", "Cancel → auto-refund queue", "Resale markup → anti-scalp check"],
        file: "modules/agents-ui/eventticket-agent.jsx"
      },
      {
        id: "royaltydist", name: "RoyaltyDist Agent", icon: "🎵", status: "ACTIVE", fee: "0.5% per distribution", color: "#FFD700",
        tools: ["registerContent()", "configureSplits()", "depositRevenue()", "distributeRoyalties()", "withdraw()", "deactivateContent()"],
        contracts: ["RoyaltyDistributor.sol"],
        apis: ["Streaming Analytics API", "IPFS Metadata", "Creator Verification Oracle"],
        auto: ["Revenue threshold → auto-distribute", "Splits configured → notify beneficiaries", "Withdrawal → settlement"],
        file: "modules/agents-ui/royaltydist-agent.jsx"
      },
      {
        id: "fantoken", name: "FanToken Agent", icon: "🏟️", status: "ACTIVE", fee: "0.5 BEZ/join", color: "#3B82F6",
        tools: ["createClub()", "joinClub()", "createPoll()", "vote()", "finalizePoll()", "depositRewards()", "claimReward()"],
        contracts: ["FanTokenDAO.sol"],
        apis: ["Fan Engagement API", "Sports Data Oracle", "Merch Voting API"],
        auto: ["Poll ended → auto-finalize", "Engagement threshold → reward eligible", "New member → welcome bonus"],
        file: "modules/agents-ui/fantoken-agent.jsx"
      },
      {
        id: "streamingrights", name: "StreamingRights Agent", icon: "🎬", status: "ACTIVE", fee: "2.0 BEZ/registration", color: "#EF4444",
        tools: ["registerIP()", "createLicense()", "reportStreams()", "revokeLicense()", "withdrawRevenue()", "deactivateIP()"],
        contracts: ["StreamingRightsMarket.sol"],
        apis: ["IPFS DRM Proof API", "Stream Count Oracle", "Territory Rights API"],
        auto: ["Stream cap hit → notify licensee", "License expired → auto-revoke", "Revenue threshold → payout"],
        file: "modules/agents-ui/streamingrights-agent.jsx"
      },
    ]
  },
  {
    id: "legal", label: "LEGAL & COMPLIANCE", icon: "⚖️", color: "#8B5CF6",
    desc: "On-chain legal agreements, tamper-proof evidence vault, decentralized arbitration DAO, IP registration & licensing. src/legal/",
    agents: [
      {
        id: "smartlegal", name: "SmartLegal Agent", icon: "📜", status: "ACTIVE", fee: "0.5 BEZ/contract", color: "#8B5CF6",
        tools: ["draftContract()", "signContract()", "addClause()", "fulfillClause()", "raiseDispute()", "terminateContract()", "checkExpiry()"],
        contracts: ["SmartLegalContract.sol"],
        apis: ["Document Hash API", "Notary Verification Oracle", "Expiry Monitor API"],
        auto: ["All signed → activate contract", "Expiry reached → status update", "Dispute raised → notify parties"],
        file: "modules/agents-ui/smartlegal-agent.jsx"
      },
      {
        id: "evidencevault", name: "EvidenceVault Agent", icon: "🔒", status: "ACTIVE", fee: "0.3 BEZ/evidence", color: "#3B82F6",
        tools: ["submitEvidence()", "transferCustody()", "sealEvidence()", "challengeEvidence()", "releaseEvidence()", "verifyHash()"],
        contracts: ["EvidenceVault.sol"],
        apis: ["Content Hash API", "Chain of Custody Oracle", "Forensic Verification API"],
        auto: ["Evidence sealed → lock transfers", "Hash mismatch → alert", "Challenge filed → notify custodian"],
        file: "modules/agents-ui/evidencevault-agent.jsx"
      },
      {
        id: "arbitration", name: "Arbitration Agent", icon: "⚖️", status: "ACTIVE", fee: "1.0 BEZ/dispute", color: "#F59E0B",
        tools: ["fileDispute()", "assignPanel()", "startDeliberation()", "castVote()", "resolveDispute()", "fileAppeal()", "withdrawStake()"],
        contracts: ["ArbitrationDAO.sol"],
        apis: ["Arbiter Registry API", "Stake Escrow Oracle", "Case Category Classifier"],
        auto: ["Majority reached → resolve", "Appeal filed → reset status", "Stake returned to winner"],
        file: "modules/agents-ui/arbitration-agent.jsx"
      },
      {
        id: "ipregistry", name: "IPRegistry Agent", icon: "🏛️", status: "ACTIVE", fee: "0.8 BEZ/registration", color: "#EC4899",
        tools: ["registerIP()", "approveRegistration()", "grantLicense()", "revokeLicense()", "disputeIP()", "revokeIP()", "withdrawRevenue()", "verifyProof()"],
        contracts: ["IPRegistryNFT.sol"],
        apis: ["Proof Hash API", "IP Database Oracle", "License Marketplace API"],
        auto: ["Approved → status REGISTERED", "License expired → deactivate", "Revenue threshold → payout"],
        file: "modules/agents-ui/ipregistry-agent.jsx"
      },
    ]
  },
  {
    id: "supplychain", label: "SUPPLY CHAIN", icon: "🚚", color: "#06B6D4",
    desc: "End-to-end shipment tracking, tokenized procurement, warehouse inventory, supplier reputation oracle. src/supplychain/",
    agents: [
      {
        id: "supplytracker", name: "SupplyTracker Agent", icon: "📦", status: "ACTIVE", fee: "0.3 BEZ/shipment", color: "#06B6D4",
        tools: ["createShipment()", "recordCheckpoint()", "markInTransit()", "confirmDelivery()", "cancelShipment()", "getShipmentCheckpoints()", "getSenderShipments()"],
        contracts: ["SupplyTracker.sol"],
        apis: ["IoT Checkpoint Oracle", "GPS Tracking API", "Temperature Monitor API"],
        auto: ["Checkpoint recorded → status update", "Delivery confirmed → close", "Temperature alert → notify operator"],
        file: "modules/agents-ui/supplytracker-agent.jsx"
      },
      {
        id: "procurement", name: "Procurement Agent", icon: "🛒", status: "ACTIVE", fee: "0.5 BEZ/order", color: "#F97316",
        tools: ["createPO()", "submitForApproval()", "approvePO()", "markShipped()", "confirmReceipt()", "settle()", "cancelPO()", "getBuyerOrders()", "getSupplierOrders()"],
        contracts: ["ProcurementNFT.sol"],
        apis: ["Escrow Management Oracle", "Multi-Approval Engine", "Settlement Processor API"],
        auto: ["All approvals → status APPROVED", "Receipt confirmed → enable settle", "Cancel → refund escrow"],
        file: "modules/agents-ui/procurement-agent.jsx"
      },
      {
        id: "warehouse", name: "Warehouse Agent", icon: "🏭", status: "ACTIVE", fee: "0.2 BEZ/lot", color: "#22D3EE",
        tools: ["registerWarehouse()", "receiveLot()", "reserveLot()", "consumeLot()", "markExpired()", "transferLot()", "deactivateWarehouse()", "getWarehouseLots()", "isLotExpired()"],
        contracts: ["WarehouseManager.sol"],
        apis: ["Inventory Sync API", "Expiry Monitor Oracle", "Capacity Tracker API"],
        auto: ["Expiry reached → mark expired", "Capacity threshold → alert", "Full consumption → close lot"],
        file: "modules/agents-ui/warehouse-agent.jsx"
      },
      {
        id: "supplierscore", name: "SupplierScore Agent", icon: "🏢", status: "ACTIVE", fee: "0.4 BEZ/audit", color: "#A855F7",
        tools: ["registerSupplier()", "recordOrder()", "performAudit()", "issueCertification()", "revokeCertification()", "markCertExpired()", "deactivateSupplier()", "getDeliveryRate()", "getSupplierAudits()", "getSupplierCerts()", "isCertValid()"],
        contracts: ["SupplierScoreOracle.sol"],
        apis: ["KPI Analytics Oracle", "Cert Verification API", "Reputation Index API"],
        auto: ["Audit complete → update quality score", "Cert expired → mark", "Low score → alert buyer"],
        file: "modules/agents-ui/supplierscore-agent.jsx"
      },
    ]
  },
  {
    id: "government", label: "GOVERNMENT", icon: "🏛️", color: "#10B981",
    desc: "Digital citizen identity & KYC, transparent public budget DAO, cadastral land registry, on-chain elections & voting. src/government/",
    agents: [
      {
        id: "citizenid", name: "CitizenIdentity Agent", icon: "🪪", status: "ACTIVE", fee: "0.3 BEZ/citizen", color: "#10B981",
        tools: ["registerCitizen()", "submitKYC()", "verifyKYC()", "revokeKYC()", "issueDocument()", "revokeDocument()", "deactivateCitizen()", "getCitizenDocs()", "isDocValid()", "isKYCVerified()"],
        contracts: ["CitizenIdentityNFT.sol"],
        apis: ["KYC Verification Oracle", "Biometric Hash API", "Document Registry API"],
        auto: ["KYC submitted → pending review", "Document expired → revoke", "Citizen deactivated → revoke all docs"],
        file: "modules/agents-ui/citizenid-agent.jsx"
      },
      {
        id: "publicbudget", name: "PublicBudget Agent", icon: "📋", status: "ACTIVE", fee: "0.5 BEZ/proposal", color: "#EAB308",
        tools: ["createProposal()", "openProposal()", "castVote()", "tallyVotes()", "executeProposal()", "cancelProposal()", "getProposalStatus()", "getProposalVotes()", "getProposalCore()", "treasuryBalance()"],
        contracts: ["PublicBudgetDAO.sol"],
        apis: ["Treasury Oracle", "Council Voting Engine", "Budget Analytics API"],
        auto: ["Voting ended → auto tally", "Approved → enable execution", "Treasury low → alert council"],
        file: "modules/agents-ui/publicbudget-agent.jsx"
      },
      {
        id: "landcadastral", name: "LandCadastral Agent", icon: "🗺️", status: "ACTIVE", fee: "0.4 BEZ/parcel", color: "#A78BFA",
        tools: ["registerParcel()", "transferParcel()", "appraiseParcel()", "rezoneParcel()", "disputeParcel()", "freezeParcel()", "unfreezeParcel()", "deregisterParcel()", "getParcelTransfers()", "getOwnerParcels()"],
        contracts: ["LandCadastralRegistry.sol"],
        apis: ["GIS Coordinate Oracle", "Zoning Authority API", "Appraisal Valuation API"],
        auto: ["Transfer recorded → update ownership", "Dispute filed → freeze parcel", "Court resolved → unfreeze"],
        file: "modules/agents-ui/landcadastral-agent.jsx"
      },
      {
        id: "voting", name: "VotingSystem Agent", icon: "🗳️", status: "ACTIVE", fee: "0.2 BEZ/election", color: "#3B82F6",
        tools: ["createElection()", "openRegistration()", "registerCandidate()", "registerVoter()", "startVoting()", "castBallot()", "tallyResults()", "cancelElection()", "getElectionCandidates()", "getCandidateVotes()", "isRegisteredVoter()", "hasVoted()"],
        contracts: ["VotingSystem.sol"],
        apis: ["Voter Registry Oracle", "Ballot Integrity API", "Election Results API"],
        auto: ["Registration ended → enable voting", "Voting ended → auto tally", "Duplicate vote → reject"],
        file: "modules/agents-ui/voting-agent.jsx"
      },
    ]
  },
  {
    id: "finance", label: "FINANCE", icon: "💰", color: "#F59E0B",
    desc: "Micro-lending pools with collateral, invoice factoring & settlement, multi-sig treasury vaults with daily limits, on-chain credit scoring oracle. src/finance/",
    agents: [
      {
        id: "microlending", name: "MicroLending Agent", icon: "💰", status: "ACTIVE", fee: "0.3 BEZ/loan", color: "#F59E0B",
        tools: ["requestLoan()", "fundLoan()", "repay()", "markDefault()", "cancelLoan()", "getBorrowerLoans()", "getTotalOwed()", "getRemainingDebt()"],
        contracts: ["MicroLendingPool.sol"],
        apis: ["Collateral Valuation Oracle", "Interest Rate API", "Default Risk Engine"],
        auto: ["Loan funded → transfer principal", "Fully repaid → return collateral", "Past due → enable default"],
        file: "modules/agents-ui/microlending-agent.jsx"
      },
      {
        id: "invoicefactoring", name: "InvoiceFactoring Agent", icon: "📄", status: "ACTIVE", fee: "0.4 BEZ/invoice", color: "#8B5CF6",
        tools: ["submitInvoice()", "approveInvoice()", "fundInvoice()", "repayInvoice()", "markDefaulted()", "cancelInvoice()", "withdrawRepaid()", "getSellerInvoices()", "getDiscountedAmount()", "isOverdue()"],
        contracts: ["InvoiceFactoring.sol"],
        apis: ["Invoice Verification Oracle", "Discount Rate API", "Debtor Credit Check API"],
        auto: ["Invoice approved → enable funding", "Repaid → enable withdrawal", "Past due → enable default"],
        file: "modules/agents-ui/invoicefactoring-agent.jsx"
      },
      {
        id: "treasuryvault", name: "TreasuryVault Agent", icon: "🏦", status: "ACTIVE", fee: "0.2 BEZ/withdrawal", color: "#10B981",
        tools: ["deposit()", "requestWithdrawal()", "approveWithdrawal()", "rejectWithdrawal()", "executeWithdrawal()", "setDailyLimit()", "setRequiredApprovals()", "getVaultBalance()", "getDailyRemaining()"],
        contracts: ["TreasuryVault.sol"],
        apis: ["Multi-Sig Oracle", "Spending Limit API", "Treasury Analytics API"],
        auto: ["Enough approvals → auto approve", "Daily reset → clear spend", "Rejected → notify requester"],
        file: "modules/agents-ui/treasuryvault-agent.jsx"
      },
      {
        id: "creditscore", name: "CreditScore Agent", icon: "📊", status: "ACTIVE", fee: "0.1 BEZ/query", color: "#EC4899",
        tools: ["createProfile()", "recordPayment()", "recordLoan()", "openDispute()", "resolveDispute()", "overrideScore()", "deactivateProfile()", "getSubjectRecords()", "getSubjectDisputes()", "getScore()"],
        contracts: ["CreditScoreOracle.sol"],
        apis: ["Payment History Oracle", "Risk Tier Engine", "Dispute Resolution API"],
        auto: ["Payment recorded → recalculate score", "Loan default → penalize score", "Dispute resolved → adjust if accepted"],
        file: "modules/agents-ui/creditscore-agent.jsx"
      },
    ]
  },
  {
    title: "Servicios", id: "services",
    agents: [
      {
        id: "freelance", name: "Freelance Agent", icon: "📋", status: "ACTIVE", fee: "0.2 BEZ/gig", color: "#06B6D4",
        tools: ["createGig()", "assignFreelancer()", "addMilestone()", "deliverMilestone()", "approveMilestone()", "raiseDispute()", "resolveDispute()", "cancelGig()", "getGigMilestones()", "getClientGigs()", "getFreelancerGigs()"],
        contracts: ["FreelanceMarketplace.sol"],
        apis: ["Escrow Manager", "Milestone Tracker", "Dispute Arbiter API"],
        auto: ["All milestones approved → auto-complete gig", "Dispute raised → freeze funds", "Gig cancelled → refund client"],
        file: "modules/agents-ui/freelance-agent.jsx"
      },
      {
        id: "subscription", name: "Subscription Agent", icon: "📦", status: "ACTIVE", fee: "0.1 BEZ/sub", color: "#A855F7",
        tools: ["createPlan()", "pausePlan()", "resumePlan()", "retirePlan()", "subscribe()", "renew()", "cancelSubscription()", "withdrawRevenue()", "getSubscriberSubs()", "isSubActive()", "getPlanRevenue()"],
        contracts: ["SubscriptionManager.sol"],
        apis: ["Plan Lifecycle API", "Revenue Analytics", "Subscriber Tracker"],
        auto: ["Payment received → activate sub", "Period expired → flag expired", "Plan retired → block new subs"],
        file: "modules/agents-ui/subscription-agent.jsx"
      },
      {
        id: "slamonitor", name: "SLA Monitor Agent", icon: "📑", status: "ACTIVE", fee: "0.15 BEZ/check", color: "#F43F5E",
        tools: ["createAgreement()", "reportIncident()", "resolveIncident()", "recordBreach()", "terminateAgreement()", "markExpired()", "getAgreementIncidents()", "getProviderAgreements()", "isAgreementActive()"],
        contracts: ["SLAMonitor.sol"],
        apis: ["Uptime Monitor Oracle", "Penalty Calculator", "Incident Tracker API"],
        auto: ["Deposit depleted → auto-breach", "Past expiry → mark expired + refund", "Breach recorded → pay penalty to consumer"],
        file: "modules/agents-ui/slamonitor-agent.jsx"
      },
      {
        id: "servicereputation", name: "ServiceReputation Agent", icon: "🏆", status: "ACTIVE", fee: "0.05 BEZ/review", color: "#F97316",
        tools: ["registerProvider()", "submitReview()", "recordJobCompleted()", "recordDispute()", "deactivateProvider()", "getProviderReviews()", "getAverageScore()", "getProviderCount()", "getBadge()"],
        contracts: ["ServiceReputationNFT.sol"],
        apis: ["Review Aggregator", "Badge Calculator", "Provider Directory API"],
        auto: ["Review submitted → recalc badge", "Job completed → update stats", "Dispute recorded → check downgrade"],
        file: "modules/agents-ui/servicereputation-agent.jsx"
      },
    ]
  },
  {
    title: "Otros", id: "otros",
    agents: [
      {
        id: "loyalty", name: "Loyalty Agent", icon: "🏅", status: "ACTIVE", fee: "0.05 BEZ/action", color: "#FBBF24",
        tools: ["registerMember()", "issuePoints()", "redeemPoints()", "deactivateMember()", "getMemberCount()", "getMemberTier()", "getPoints()"],
        contracts: ["LoyaltyRewards.sol"],
        apis: ["Points Engine", "Tier Calculator", "Member Directory API"],
        auto: ["Points issued → auto-update tier", "Lifetime threshold → tier upgrade", "Deactivated → block points ops"],
        file: "modules/agents-ui/loyalty-agent.jsx"
      },
      {
        id: "crowdfunding", name: "Crowdfunding Agent", icon: "🚀", status: "ACTIVE", fee: "0.1 BEZ/campaign", color: "#14B8A6",
        tools: ["createCampaign()", "pledge()", "finalizeCampaign()", "withdrawFunds()", "refund()", "cancelCampaign()", "getCampaignPledges()", "getCreatorCampaigns()", "isCampaignActive()"],
        contracts: ["CrowdfundingPool.sol"],
        apis: ["Campaign Lifecycle", "Pledge Tracker", "Refund Engine API"],
        auto: ["Deadline passed → auto-finalize", "Goal met → FUNDED status", "Cancelled → enable refunds"],
        file: "modules/agents-ui/crowdfunding-agent.jsx"
      },
      {
        id: "p2pmarketplace", name: "P2P Marketplace Agent", icon: "🛒", status: "ACTIVE", fee: "2.5% platform fee", color: "#6366F1",
        tools: ["createListing()", "purchase()", "confirmDelivery()", "raiseDispute()", "resolveDispute()", "cancelListing()", "setPlatformFee()", "getSellerListings()", "getBuyerPurchases()", "isListingActive()"],
        contracts: ["P2PMarketplace.sol"],
        apis: ["Escrow Manager", "Dispute Resolution", "Fee Calculator API"],
        auto: ["Delivery confirmed → release escrow minus fee", "Dispute raised → freeze escrow", "Arbiter resolves → pay winner"],
        file: "modules/agents-ui/p2pmarketplace-agent.jsx"
      },
      {
        id: "charityvault", name: "CharityVault Agent", icon: "💖", status: "ACTIVE", fee: "0 BEZ (no fees)", color: "#EC4899",
        tools: ["createCause()", "donate()", "withdrawFunds()", "pauseCause()", "resumeCause()", "getCauseDonations()", "getDonorHistory()", "getAvailableFunds()", "getCauseProgress()"],
        contracts: ["CharityVault.sol"],
        apis: ["Donation Tracker", "Impact Dashboard", "Cause Lifecycle API"],
        auto: ["Goal reached → auto-complete", "Paused → block donations", "Beneficiary requests → release funds"],
        file: "modules/agents-ui/charityvault-agent.jsx"
      },
    ]
  },
];

export const MCP_TOOLS = [
  { fn: "analyzeGasStrategy()", cat: "GAS", agent: "Gas Strategy", fee: "0.02" },
  { fn: "calculateSmartSwap()", cat: "SWAP", agent: "Smart Swap", fee: "0.1%" },
  { fn: "verifyRegulatoryCompliance()", cat: "AML", agent: "Orchestrator", fee: "0.01" },
  { fn: "mintBCMNFT()", cat: "NFT", agent: "Food Oracle", fee: "1.0🔥" },
  { fn: "releaseEscrowFunds()", cat: "ESCROW", agent: "Aegis Oracle", fee: "2%" },
  { fn: "haltPayment()", cat: "ESCROW", agent: "Aegis Oracle", fee: "0" },
  { fn: "detectFungal()", cat: "QUALITY", agent: "Food Oracle", fee: "0.5🔥" },
  { fn: "issueDID()", cat: "IDENTITY", agent: "SSI Agent", fee: "0.1🔥" },
  { fn: "updatePoRScore()", cat: "IDENTITY", agent: "PoR Agent", fee: "auto" },
  { fn: "adjustStakingAPY()", cat: "ECON", agent: "Tokenomics", fee: "0" },
  { fn: "processPayment()", cat: "PAYMENT", agent: "Hybrid Payment", fee: "1.5%" },
  { fn: "syncASYCUDA()", cat: "CUSTOMS", agent: "SDK Agent", fee: "0.2🔥" },
  { fn: "lockAndMint()", cat: "BRIDGE", agent: "Univ. Bridge", fee: "0.3%" },
  { fn: "routeCrossChain()", cat: "BRIDGE", agent: "Univ. Bridge", fee: "0.15%" },
  { fn: "auditSolidity()", cat: "SECURITY", agent: "Code Auditor", fee: "0" },
  { fn: "triggerDAOProposal()", cat: "DAO", agent: "DAO Governor", fee: "1.0" },
  { fn: "openDispute()", cat: "DAO", agent: "Arbitrage", fee: "10🔥" },
  { fn: "mintAdCard()", cat: "ADS", agent: "DePub", fee: "escrow" },
  { fn: "stakeTokens()", cat: "STAKING", agent: "Dyn. Staking", fee: "0" },
  { fn: "evaluateContent()", cat: "SOCIAL", agent: "Content Quality", fee: "reward" },
  { fn: "executeNLCommand()", cat: "AI", agent: "AI Assistant", fee: "micro" },
  { fn: "createVesting()", cat: "HR", agent: "DAO HR", fee: "0.5%" },
  { fn: "detectColdBreak()", cat: "QUALITY", agent: "Cold Chain", fee: "0.3" },
  { fn: "dispenseTokens()", cat: "PAYMENT", agent: "Hybrid Payment", fee: "0.5%" },
  { fn: "mintMedRecordSBT()", cat: "HEALTH", agent: "MedRecord", fee: "0.2🔥" },
  { fn: "verifyWithZKProof()", cat: "HEALTH", agent: "MedRecord", fee: "0.5" },
  { fn: "registerPharmaBatch()", cat: "PHARMA", agent: "PharmaTrak", fee: "0.3" },
  { fn: "logTemperatureIoT()", cat: "PHARMA", agent: "PharmaTrak", fee: "0.05" },
  { fn: "verifyCertificate()", cat: "PHARMA", agent: "PharmaTrak", fee: "0.1" },
  { fn: "submitInsuranceClaim()", cat: "INSURANCE", agent: "ClaimBot", fee: "0.5" },
  { fn: "autoApproveClaim()", cat: "INSURANCE", agent: "ClaimBot", fee: "0" },
  { fn: "flagFraudClaim()", cat: "INSURANCE", agent: "ClaimBot", fee: "0" },
  { fn: "registerClinicalTrial()", cat: "BIODATA", agent: "BioData", fee: "100" },
  { fn: "tokenizeClinicalData()", cat: "BIODATA", agent: "BioData", fee: "1.0🔥" },
  { fn: "purchaseDataAccess()", cat: "BIODATA", agent: "BioData", fee: "5%" },
  { fn: "mintCreditBatch()", cat: "CARBON", agent: "GreenToken", fee: "2%" },
  { fn: "retireCredits()", cat: "CARBON", agent: "GreenToken", fee: "0.5\uD83D\uDD25" },
  { fn: "verifyBatch()", cat: "CARBON", agent: "GreenToken", fee: "1.0" },
  { fn: "tradeCredits()", cat: "CARBON", agent: "GreenToken", fee: "0.3%" },
  { fn: "registerProsumer()", cat: "P2P_ENERGY", agent: "P2P Energy", fee: "0.1" },
  { fn: "matchAndSettle()", cat: "P2P_ENERGY", agent: "P2P Energy", fee: "0.5%" },
  { fn: "createEnergyOffer()", cat: "P2P_ENERGY", agent: "P2P Energy", fee: "0" },
  { fn: "registerFarm()", cat: "SOLAR_DEFI", agent: "Solar DeFi", fee: "2%" },
  { fn: "investInFarm()", cat: "SOLAR_DEFI", agent: "Solar DeFi", fee: "0" },
  { fn: "distributeDividends()", cat: "SOLAR_DEFI", agent: "Solar DeFi", fee: "1.5%" },
  { fn: "submitESGAudit()", cat: "ESG", agent: "ESG Score", fee: "10K" },
  { fn: "certifyESGScore()", cat: "ESG", agent: "ESG Score", fee: "0.5\uD83D\uDD25" },
  { fn: "getCompanyGrade()", cat: "ESG", agent: "ESG Score", fee: "0.1" },
  { fn: "mintVehicle()", cat: "VEHICLE", agent: "VehicleNFT", fee: "0.5" },
  { fn: "updateMileage()", cat: "VEHICLE", agent: "VehicleNFT", fee: "0.1" },
  { fn: "transferVehicle()", cat: "VEHICLE", agent: "VehicleNFT", fee: "0.2%" },
  { fn: "reportStolen()", cat: "VEHICLE", agent: "VehicleNFT", fee: "0" },
  { fn: "registerPart()", cat: "AUTOPARTS", agent: "AutoParts", fee: "0.3" },
  { fn: "verifyAuthenticity()", cat: "AUTOPARTS", agent: "AutoParts", fee: "0.5" },
  { fn: "issueRecall()", cat: "AUTOPARTS", agent: "AutoParts", fee: "2.0" },
  { fn: "createFleetLease()", cat: "FLEET", agent: "FleetDeFi", fee: "1%" },
  { fn: "claimMaintenance()", cat: "FLEET", agent: "FleetDeFi", fee: "0.5%" },
  { fn: "registerStation()", cat: "EV_CHARGE", agent: "EVCharge", fee: "5.0" },
  { fn: "settleChargingSession()", cat: "EV_CHARGE", agent: "EVCharge", fee: "0.5%" },
  { fn: "withdrawChargeRevenue()", cat: "EV_CHARGE", agent: "EVCharge", fee: "0" },
  { fn: "mintCertificate()", cat: "QUALITY_CERT", agent: "QualityChain", fee: "0.5" },
  { fn: "logDefect()", cat: "QUALITY_CERT", agent: "QualityChain", fee: "0.2" },
  { fn: "revokeCertificate()", cat: "QUALITY_CERT", agent: "QualityChain", fee: "0" },
  { fn: "recertify()", cat: "QUALITY_CERT", agent: "QualityChain", fee: "0.3" },
  { fn: "mintTwin()", cat: "DIGITAL_TWIN", agent: "DigitalTwin", fee: "1.0" },
  { fn: "logTelemetry()", cat: "DIGITAL_TWIN", agent: "DigitalTwin", fee: "0.05" },
  { fn: "updateTwinHealth()", cat: "DIGITAL_TWIN", agent: "DigitalTwin", fee: "0.2" },
  { fn: "decommissionTwin()", cat: "DIGITAL_TWIN", agent: "DigitalTwin", fee: "0" },
  { fn: "registerMaterial()", cat: "MRP", agent: "SupplyMRP", fee: "0.3" },
  { fn: "createPurchaseOrder()", cat: "MRP", agent: "SupplyMRP", fee: "0.5" },
  { fn: "consumeMaterial()", cat: "MRP", agent: "SupplyMRP", fee: "0.1" },
  { fn: "logSensorReading()", cat: "PRED_MAINT", agent: "PredMaint", fee: "0.05" },
  { fn: "recordMaintenance()", cat: "PRED_MAINT", agent: "PredMaint", fee: "0.3" },
  { fn: "createFuture()", cat: "CROP_FUTURES", agent: "CropToken", fee: "1.0" },
  { fn: "buyFuture()", cat: "CROP_FUTURES", agent: "CropToken", fee: "varies" },
  { fn: "certifyHarvest()", cat: "CROP_FUTURES", agent: "CropToken", fee: "0.5🔥" },
  { fn: "settleFuture()", cat: "CROP_FUTURES", agent: "CropToken", fee: "0" },
  { fn: "registerProduct()", cat: "AGRI_SUPPLY", agent: "AgriSupply", fee: "0.5" },
  { fn: "addCheckpoint()", cat: "AGRI_SUPPLY", agent: "AgriSupply", fee: "0.1" },
  { fn: "addCertification()", cat: "AGRI_SUPPLY", agent: "AgriSupply", fee: "1.0" },
  { fn: "markDelivered()", cat: "AGRI_SUPPLY", agent: "AgriSupply", fee: "0" },
  { fn: "registerTank()", cat: "AQUA_FARM", agent: "AquaFarm", fee: "1.0" },
  { fn: "logReading()", cat: "AQUA_FARM", agent: "AquaFarm", fee: "0.05" },
  { fn: "harvestTank()", cat: "AQUA_FARM", agent: "AquaFarm", fee: "2.0" },
  { fn: "mintTitle()", cat: "LAND_REGISTRY", agent: "LandRegistry", fee: "2.0" },
  { fn: "updateSoilData()", cat: "LAND_REGISTRY", agent: "LandRegistry", fee: "0.3" },
  { fn: "transferTitle()", cat: "LAND_REGISTRY", agent: "LandRegistry", fee: "1.5" },
  { fn: "fractionalizeTitle()", cat: "LAND_REGISTRY", agent: "LandRegistry", fee: "5.0" },
  { fn: "mintPolicy()", cat: "POLICY_NFT", agent: "PolicyNFT", fee: "0.5" },
  { fn: "payPremium()", cat: "POLICY_NFT", agent: "PolicyNFT", fee: "varies" },
  { fn: "cancelPolicy()", cat: "POLICY_NFT", agent: "PolicyNFT", fee: "0" },
  { fn: "renewPolicy()", cat: "POLICY_NFT", agent: "PolicyNFT", fee: "0.2" },
  { fn: "fileInsuranceClaim()", cat: "CLAIM_ADJ", agent: "ClaimAdjuster", fee: "0.5" },
  { fn: "submitEvidence()", cat: "CLAIM_ADJ", agent: "ClaimAdjuster", fee: "0.1" },
  { fn: "aiScoreClaim()", cat: "CLAIM_ADJ", agent: "ClaimAdjuster", fee: "0.3🔥" },
  { fn: "payoutClaim()", cat: "CLAIM_ADJ", agent: "ClaimAdjuster", fee: "0" },
  { fn: "createReinsPool()", cat: "REINSURANCE", agent: "ReinsurancePool", fee: "2.0" },
  { fn: "depositToPool()", cat: "REINSURANCE", agent: "ReinsurancePool", fee: "0" },
  { fn: "claimPoolYield()", cat: "REINSURANCE", agent: "ReinsurancePool", fee: "0.5%" },
  { fn: "payClaimFromPool()", cat: "REINSURANCE", agent: "ReinsurancePool", fee: "1%" },
  { fn: "createParametric()", cat: "PARAMETRIC_INS", agent: "ParametricIns", fee: "3.0" },
  { fn: "submitOracleReading()", cat: "PARAMETRIC_INS", agent: "ParametricIns", fee: "0.05" },
  { fn: "triggerPayout()", cat: "PARAMETRIC_INS", agent: "ParametricIns", fee: "0" },
  { fn: "expireParametric()", cat: "PARAMETRIC_INS", agent: "ParametricIns", fee: "0" },
  // ── Education & Credentials ──
  { fn: "createCourse()", cat: "COURSE_TOKEN", agent: "CourseToken", fee: "1.0" },
  { fn: "enrollStudent()", cat: "COURSE_TOKEN", agent: "CourseToken", fee: "0" },
  { fn: "issueCertificate()", cat: "COURSE_TOKEN", agent: "CourseToken", fee: "0.5" },
  { fn: "closeCourse()", cat: "COURSE_TOKEN", agent: "CourseToken", fee: "0" },
  { fn: "createPool()", cat: "SCHOLAR_POOL", agent: "ScholarPool", fee: "0" },
  { fn: "applyForScholarship()", cat: "SCHOLAR_POOL", agent: "ScholarPool", fee: "0.5" },
  { fn: "approveScholar()", cat: "SCHOLAR_POOL", agent: "ScholarPool", fee: "0.1" },
  { fn: "distributeAward()", cat: "SCHOLAR_POOL", agent: "ScholarPool", fee: "0" },
  { fn: "registerInstitution()", cat: "EDU_DAO", agent: "EduDAO", fee: "2.0" },
  { fn: "createProposal()", cat: "EDU_DAO", agent: "EduDAO", fee: "0.5" },
  { fn: "castVote()", cat: "EDU_DAO", agent: "EduDAO", fee: "0.1" },
  { fn: "executeProposal()", cat: "EDU_DAO", agent: "EduDAO", fee: "0" },
  { fn: "registerIssuer()", cat: "SKILL_BADGE", agent: "SkillBadge", fee: "1.0" },
  { fn: "mintBadge()", cat: "SKILL_BADGE", agent: "SkillBadge", fee: "0.25" },
  { fn: "verifyBadge()", cat: "SKILL_BADGE", agent: "SkillBadge", fee: "0.05" },
  { fn: "revokeBadge()", cat: "SKILL_BADGE", agent: "SkillBadge", fee: "0" },
  // ── Entertainment & Media ──
  { fn: "createEvent()", cat: "EVENT_TICKET", agent: "EventTicket", fee: "2.0" },
  { fn: "purchaseTicket()", cat: "EVENT_TICKET", agent: "EventTicket", fee: "0" },
  { fn: "useTicket()", cat: "EVENT_TICKET", agent: "EventTicket", fee: "0" },
  { fn: "listForResale()", cat: "EVENT_TICKET", agent: "EventTicket", fee: "0.1" },
  { fn: "buyResale()", cat: "EVENT_TICKET", agent: "EventTicket", fee: "0" },
  { fn: "cancelEvent()", cat: "EVENT_TICKET", agent: "EventTicket", fee: "0" },
  { fn: "refundTicket()", cat: "EVENT_TICKET", agent: "EventTicket", fee: "0" },
  { fn: "registerContent()", cat: "ROYALTY_DIST", agent: "RoyaltyDist", fee: "1.0" },
  { fn: "configureSplits()", cat: "ROYALTY_DIST", agent: "RoyaltyDist", fee: "0.5" },
  { fn: "depositRevenue()", cat: "ROYALTY_DIST", agent: "RoyaltyDist", fee: "0" },
  { fn: "distributeRoyalties()", cat: "ROYALTY_DIST", agent: "RoyaltyDist", fee: "0" },
  { fn: "withdrawRoyalties()", cat: "ROYALTY_DIST", agent: "RoyaltyDist", fee: "0" },
  { fn: "deactivateContent()", cat: "ROYALTY_DIST", agent: "RoyaltyDist", fee: "0" },
  { fn: "createClub()", cat: "FAN_TOKEN", agent: "FanToken", fee: "2.0" },
  { fn: "joinClub()", cat: "FAN_TOKEN", agent: "FanToken", fee: "0.5" },
  { fn: "createPoll()", cat: "FAN_TOKEN", agent: "FanToken", fee: "2.0" },
  { fn: "votePoll()", cat: "FAN_TOKEN", agent: "FanToken", fee: "0.1" },
  { fn: "finalizePoll()", cat: "FAN_TOKEN", agent: "FanToken", fee: "0" },
  { fn: "depositRewards()", cat: "FAN_TOKEN", agent: "FanToken", fee: "0" },
  { fn: "claimFanReward()", cat: "FAN_TOKEN", agent: "FanToken", fee: "0" },
  { fn: "registerIP()", cat: "STREAMING_RIGHTS", agent: "StreamingRights", fee: "2.0" },
  { fn: "createLicense()", cat: "STREAMING_RIGHTS", agent: "StreamingRights", fee: "0" },
  { fn: "reportStreams()", cat: "STREAMING_RIGHTS", agent: "StreamingRights", fee: "0.01" },
  { fn: "revokeLicense()", cat: "STREAMING_RIGHTS", agent: "StreamingRights", fee: "0" },
  { fn: "withdrawIPRevenue()", cat: "STREAMING_RIGHTS", agent: "StreamingRights", fee: "0" },
  { fn: "deactivateIP()", cat: "STREAMING_RIGHTS", agent: "StreamingRights", fee: "0" },
  // ── Legal & Compliance ──
  { fn: "draftContract()", cat: "SMART_LEGAL", agent: "SmartLegal", fee: "2.0" },
  { fn: "signContract()", cat: "SMART_LEGAL", agent: "SmartLegal", fee: "0" },
  { fn: "addClause()", cat: "SMART_LEGAL", agent: "SmartLegal", fee: "0.5" },
  { fn: "fulfillClause()", cat: "SMART_LEGAL", agent: "SmartLegal", fee: "0" },
  { fn: "raiseDispute()", cat: "SMART_LEGAL", agent: "SmartLegal", fee: "0" },
  { fn: "terminateContract()", cat: "SMART_LEGAL", agent: "SmartLegal", fee: "0" },
  { fn: "checkExpiry()", cat: "SMART_LEGAL", agent: "SmartLegal", fee: "0" },
  { fn: "submitEvidence()", cat: "EVIDENCE_VAULT", agent: "EvidenceVault", fee: "1.0" },
  { fn: "transferCustody()", cat: "EVIDENCE_VAULT", agent: "EvidenceVault", fee: "0.5" },
  { fn: "sealEvidence()", cat: "EVIDENCE_VAULT", agent: "EvidenceVault", fee: "0" },
  { fn: "challengeEvidence()", cat: "EVIDENCE_VAULT", agent: "EvidenceVault", fee: "0" },
  { fn: "releaseEvidence()", cat: "EVIDENCE_VAULT", agent: "EvidenceVault", fee: "0" },
  { fn: "verifyHash()", cat: "EVIDENCE_VAULT", agent: "EvidenceVault", fee: "0" },
  { fn: "fileDispute()", cat: "ARBITRATION", agent: "Arbitration", fee: "2.0" },
  { fn: "assignPanel()", cat: "ARBITRATION", agent: "Arbitration", fee: "0" },
  { fn: "startDeliberation()", cat: "ARBITRATION", agent: "Arbitration", fee: "0" },
  { fn: "castVote()", cat: "ARBITRATION", agent: "Arbitration", fee: "0.1" },
  { fn: "resolveDispute()", cat: "ARBITRATION", agent: "Arbitration", fee: "0" },
  { fn: "fileAppeal()", cat: "ARBITRATION", agent: "Arbitration", fee: "1.0" },
  { fn: "withdrawArbStake()", cat: "ARBITRATION", agent: "Arbitration", fee: "0" },
  { fn: "registerIPAsset()", cat: "IP_REGISTRY", agent: "IPRegistry", fee: "2.0" },
  { fn: "approveRegistration()", cat: "IP_REGISTRY", agent: "IPRegistry", fee: "0" },
  { fn: "grantLicense()", cat: "IP_REGISTRY", agent: "IPRegistry", fee: "0" },
  { fn: "revokeIPLicense()", cat: "IP_REGISTRY", agent: "IPRegistry", fee: "0" },
  { fn: "disputeIP()", cat: "IP_REGISTRY", agent: "IPRegistry", fee: "0" },
  { fn: "revokeIP()", cat: "IP_REGISTRY", agent: "IPRegistry", fee: "0" },
  { fn: "withdrawIPRevenue()", cat: "IP_REGISTRY", agent: "IPRegistry", fee: "0" },
  { fn: "verifyProof()", cat: "IP_REGISTRY", agent: "IPRegistry", fee: "0" },
  // ── Supply Chain ──────────────────
  { fn: "createShipment()", cat: "SUPPLY_TRACK", agent: "SupplyTracker", fee: "0.3" },
  { fn: "recordCheckpoint()", cat: "SUPPLY_TRACK", agent: "SupplyTracker", fee: "0" },
  { fn: "markInTransit()", cat: "SUPPLY_TRACK", agent: "SupplyTracker", fee: "0" },
  { fn: "confirmDelivery()", cat: "SUPPLY_TRACK", agent: "SupplyTracker", fee: "0" },
  { fn: "cancelShipment()", cat: "SUPPLY_TRACK", agent: "SupplyTracker", fee: "0" },
  { fn: "getShipmentCheckpoints()", cat: "SUPPLY_TRACK", agent: "SupplyTracker", fee: "0" },
  { fn: "getSenderShipments()", cat: "SUPPLY_TRACK", agent: "SupplyTracker", fee: "0" },
  { fn: "createPO()", cat: "PROCUREMENT", agent: "Procurement", fee: "0.5" },
  { fn: "submitForApproval()", cat: "PROCUREMENT", agent: "Procurement", fee: "0" },
  { fn: "approvePO()", cat: "PROCUREMENT", agent: "Procurement", fee: "0" },
  { fn: "markShipped()", cat: "PROCUREMENT", agent: "Procurement", fee: "0" },
  { fn: "confirmReceipt()", cat: "PROCUREMENT", agent: "Procurement", fee: "0" },
  { fn: "settle()", cat: "PROCUREMENT", agent: "Procurement", fee: "0" },
  { fn: "cancelPO()", cat: "PROCUREMENT", agent: "Procurement", fee: "0" },
  { fn: "getBuyerOrders()", cat: "PROCUREMENT", agent: "Procurement", fee: "0" },
  { fn: "getSupplierOrders()", cat: "PROCUREMENT", agent: "Procurement", fee: "0" },
  { fn: "registerWarehouse()", cat: "WAREHOUSE", agent: "Warehouse", fee: "0.2" },
  { fn: "receiveLot()", cat: "WAREHOUSE", agent: "Warehouse", fee: "0" },
  { fn: "reserveLot()", cat: "WAREHOUSE", agent: "Warehouse", fee: "0" },
  { fn: "consumeLot()", cat: "WAREHOUSE", agent: "Warehouse", fee: "0" },
  { fn: "markExpired()", cat: "WAREHOUSE", agent: "Warehouse", fee: "0" },
  { fn: "transferLot()", cat: "WAREHOUSE", agent: "Warehouse", fee: "0" },
  { fn: "deactivateWarehouse()", cat: "WAREHOUSE", agent: "Warehouse", fee: "0" },
  { fn: "getWarehouseLots()", cat: "WAREHOUSE", agent: "Warehouse", fee: "0" },
  { fn: "isLotExpired()", cat: "WAREHOUSE", agent: "Warehouse", fee: "0" },
  { fn: "registerSupplier()", cat: "SUPPLIER_SCORE", agent: "SupplierScore", fee: "0.4" },
  { fn: "recordOrder()", cat: "SUPPLIER_SCORE", agent: "SupplierScore", fee: "0" },
  { fn: "performAudit()", cat: "SUPPLIER_SCORE", agent: "SupplierScore", fee: "0" },
  { fn: "issueCertification()", cat: "SUPPLIER_SCORE", agent: "SupplierScore", fee: "0" },
  { fn: "revokeCertification()", cat: "SUPPLIER_SCORE", agent: "SupplierScore", fee: "0" },
  { fn: "markCertExpired()", cat: "SUPPLIER_SCORE", agent: "SupplierScore", fee: "0" },
  { fn: "deactivateSupplier()", cat: "SUPPLIER_SCORE", agent: "SupplierScore", fee: "0" },
  { fn: "getDeliveryRate()", cat: "SUPPLIER_SCORE", agent: "SupplierScore", fee: "0" },
  { fn: "getSupplierAudits()", cat: "SUPPLIER_SCORE", agent: "SupplierScore", fee: "0" },
  { fn: "getSupplierCerts()", cat: "SUPPLIER_SCORE", agent: "SupplierScore", fee: "0" },
  { fn: "isCertValid()", cat: "SUPPLIER_SCORE", agent: "SupplierScore", fee: "0" },
  // ── GOVERNMENT ──────────────────────────────────────
  { fn: "registerCitizen()", cat: "CITIZEN_ID", agent: "CitizenIdentity", fee: "0.3" },
  { fn: "submitKYC()", cat: "CITIZEN_ID", agent: "CitizenIdentity", fee: "0" },
  { fn: "verifyKYC()", cat: "CITIZEN_ID", agent: "CitizenIdentity", fee: "0" },
  { fn: "revokeKYC()", cat: "CITIZEN_ID", agent: "CitizenIdentity", fee: "0" },
  { fn: "issueDocument()", cat: "CITIZEN_ID", agent: "CitizenIdentity", fee: "0" },
  { fn: "revokeDocument()", cat: "CITIZEN_ID", agent: "CitizenIdentity", fee: "0" },
  { fn: "deactivateCitizen()", cat: "CITIZEN_ID", agent: "CitizenIdentity", fee: "0" },
  { fn: "getCitizenDocs()", cat: "CITIZEN_ID", agent: "CitizenIdentity", fee: "0" },
  { fn: "isDocValid()", cat: "CITIZEN_ID", agent: "CitizenIdentity", fee: "0" },
  { fn: "isKYCVerified()", cat: "CITIZEN_ID", agent: "CitizenIdentity", fee: "0" },
  { fn: "createProposal()", cat: "PUBLIC_BUDGET", agent: "PublicBudget", fee: "0.5" },
  { fn: "openProposal()", cat: "PUBLIC_BUDGET", agent: "PublicBudget", fee: "0" },
  { fn: "castVote()", cat: "PUBLIC_BUDGET", agent: "PublicBudget", fee: "0" },
  { fn: "tallyVotes()", cat: "PUBLIC_BUDGET", agent: "PublicBudget", fee: "0" },
  { fn: "executeProposal()", cat: "PUBLIC_BUDGET", agent: "PublicBudget", fee: "0" },
  { fn: "cancelProposal()", cat: "PUBLIC_BUDGET", agent: "PublicBudget", fee: "0" },
  { fn: "getProposalStatus()", cat: "PUBLIC_BUDGET", agent: "PublicBudget", fee: "0" },
  { fn: "getProposalVotes()", cat: "PUBLIC_BUDGET", agent: "PublicBudget", fee: "0" },
  { fn: "getProposalCore()", cat: "PUBLIC_BUDGET", agent: "PublicBudget", fee: "0" },
  { fn: "treasuryBalance()", cat: "PUBLIC_BUDGET", agent: "PublicBudget", fee: "0" },
  { fn: "registerParcel()", cat: "LAND_CADASTRAL", agent: "LandCadastral", fee: "0.4" },
  { fn: "transferParcel()", cat: "LAND_CADASTRAL", agent: "LandCadastral", fee: "0" },
  { fn: "appraiseParcel()", cat: "LAND_CADASTRAL", agent: "LandCadastral", fee: "0" },
  { fn: "rezoneParcel()", cat: "LAND_CADASTRAL", agent: "LandCadastral", fee: "0" },
  { fn: "disputeParcel()", cat: "LAND_CADASTRAL", agent: "LandCadastral", fee: "0" },
  { fn: "freezeParcel()", cat: "LAND_CADASTRAL", agent: "LandCadastral", fee: "0" },
  { fn: "unfreezeParcel()", cat: "LAND_CADASTRAL", agent: "LandCadastral", fee: "0" },
  { fn: "deregisterParcel()", cat: "LAND_CADASTRAL", agent: "LandCadastral", fee: "0" },
  { fn: "getParcelTransfers()", cat: "LAND_CADASTRAL", agent: "LandCadastral", fee: "0" },
  { fn: "getOwnerParcels()", cat: "LAND_CADASTRAL", agent: "LandCadastral", fee: "0" },
  { fn: "createElection()", cat: "VOTING", agent: "VotingSystem", fee: "0.2" },
  { fn: "openRegistration()", cat: "VOTING", agent: "VotingSystem", fee: "0" },
  { fn: "registerCandidate()", cat: "VOTING", agent: "VotingSystem", fee: "0" },
  { fn: "registerVoter()", cat: "VOTING", agent: "VotingSystem", fee: "0" },
  { fn: "startVoting()", cat: "VOTING", agent: "VotingSystem", fee: "0" },
  { fn: "castBallot()", cat: "VOTING", agent: "VotingSystem", fee: "0" },
  { fn: "tallyResults()", cat: "VOTING", agent: "VotingSystem", fee: "0" },
  { fn: "cancelElection()", cat: "VOTING", agent: "VotingSystem", fee: "0" },
  { fn: "getElectionCandidates()", cat: "VOTING", agent: "VotingSystem", fee: "0" },
  { fn: "getCandidateVotes()", cat: "VOTING", agent: "VotingSystem", fee: "0" },
  { fn: "isRegisteredVoter()", cat: "VOTING", agent: "VotingSystem", fee: "0" },
  { fn: "hasVoted()", cat: "VOTING", agent: "VotingSystem", fee: "0" },
  // ── Finance ──
  { fn: "requestLoan()", cat: "MICRO_LENDING", agent: "MicroLending", fee: "0.3" },
  { fn: "fundLoan()", cat: "MICRO_LENDING", agent: "MicroLending", fee: "0" },
  { fn: "repay()", cat: "MICRO_LENDING", agent: "MicroLending", fee: "0" },
  { fn: "markDefault()", cat: "MICRO_LENDING", agent: "MicroLending", fee: "0" },
  { fn: "cancelLoan()", cat: "MICRO_LENDING", agent: "MicroLending", fee: "0" },
  { fn: "getBorrowerLoans()", cat: "MICRO_LENDING", agent: "MicroLending", fee: "0" },
  { fn: "getTotalOwed()", cat: "MICRO_LENDING", agent: "MicroLending", fee: "0" },
  { fn: "getRemainingDebt()", cat: "MICRO_LENDING", agent: "MicroLending", fee: "0" },
  { fn: "submitInvoice()", cat: "INVOICE_FACTOR", agent: "InvoiceFactoring", fee: "0.4" },
  { fn: "approveInvoice()", cat: "INVOICE_FACTOR", agent: "InvoiceFactoring", fee: "0" },
  { fn: "fundInvoice()", cat: "INVOICE_FACTOR", agent: "InvoiceFactoring", fee: "0" },
  { fn: "repayInvoice()", cat: "INVOICE_FACTOR", agent: "InvoiceFactoring", fee: "0" },
  { fn: "markDefaulted()", cat: "INVOICE_FACTOR", agent: "InvoiceFactoring", fee: "0" },
  { fn: "cancelInvoice()", cat: "INVOICE_FACTOR", agent: "InvoiceFactoring", fee: "0" },
  { fn: "withdrawRepaid()", cat: "INVOICE_FACTOR", agent: "InvoiceFactoring", fee: "0" },
  { fn: "getSellerInvoices()", cat: "INVOICE_FACTOR", agent: "InvoiceFactoring", fee: "0" },
  { fn: "getDiscountedAmount()", cat: "INVOICE_FACTOR", agent: "InvoiceFactoring", fee: "0" },
  { fn: "isOverdue()", cat: "INVOICE_FACTOR", agent: "InvoiceFactoring", fee: "0" },
  { fn: "deposit()", cat: "TREASURY", agent: "TreasuryVault", fee: "0" },
  { fn: "requestWithdrawal()", cat: "TREASURY", agent: "TreasuryVault", fee: "0.2" },
  { fn: "approveWithdrawal()", cat: "TREASURY", agent: "TreasuryVault", fee: "0" },
  { fn: "rejectWithdrawal()", cat: "TREASURY", agent: "TreasuryVault", fee: "0" },
  { fn: "executeWithdrawal()", cat: "TREASURY", agent: "TreasuryVault", fee: "0" },
  { fn: "setDailyLimit()", cat: "TREASURY", agent: "TreasuryVault", fee: "0" },
  { fn: "setRequiredApprovals()", cat: "TREASURY", agent: "TreasuryVault", fee: "0" },
  { fn: "getVaultBalance()", cat: "TREASURY", agent: "TreasuryVault", fee: "0" },
  { fn: "getDailyRemaining()", cat: "TREASURY", agent: "TreasuryVault", fee: "0" },
  { fn: "createProfile()", cat: "CREDIT_SCORE", agent: "CreditScore", fee: "0.1" },
  { fn: "recordPayment()", cat: "CREDIT_SCORE", agent: "CreditScore", fee: "0" },
  { fn: "recordLoan()", cat: "CREDIT_SCORE", agent: "CreditScore", fee: "0" },
  { fn: "openDispute()", cat: "CREDIT_SCORE", agent: "CreditScore", fee: "0" },
  { fn: "resolveDispute()", cat: "CREDIT_SCORE", agent: "CreditScore", fee: "0" },
  { fn: "overrideScore()", cat: "CREDIT_SCORE", agent: "CreditScore", fee: "0" },
  { fn: "deactivateProfile()", cat: "CREDIT_SCORE", agent: "CreditScore", fee: "0" },
  { fn: "getSubjectRecords()", cat: "CREDIT_SCORE", agent: "CreditScore", fee: "0" },
  { fn: "getSubjectDisputes()", cat: "CREDIT_SCORE", agent: "CreditScore", fee: "0" },
  { fn: "getScore()", cat: "CREDIT_SCORE", agent: "CreditScore", fee: "0" },
  // ── FREELANCE ──
  { fn: "createGig()", cat: "FREELANCE", agent: "Freelance", fee: "0.2" },
  { fn: "assignFreelancer()", cat: "FREELANCE", agent: "Freelance", fee: "0" },
  { fn: "addMilestone()", cat: "FREELANCE", agent: "Freelance", fee: "0" },
  { fn: "deliverMilestone()", cat: "FREELANCE", agent: "Freelance", fee: "0" },
  { fn: "approveMilestone()", cat: "FREELANCE", agent: "Freelance", fee: "0" },
  { fn: "raiseDispute()", cat: "FREELANCE", agent: "Freelance", fee: "0" },
  { fn: "resolveDispute()", cat: "FREELANCE", agent: "Freelance", fee: "0" },
  { fn: "cancelGig()", cat: "FREELANCE", agent: "Freelance", fee: "0" },
  { fn: "getGigMilestones()", cat: "FREELANCE", agent: "Freelance", fee: "0" },
  { fn: "getClientGigs()", cat: "FREELANCE", agent: "Freelance", fee: "0" },
  { fn: "getFreelancerGigs()", cat: "FREELANCE", agent: "Freelance", fee: "0" },
  // ── SUBSCRIPTION ──
  { fn: "createPlan()", cat: "SUBSCRIPTION", agent: "Subscription", fee: "0.1" },
  { fn: "pausePlan()", cat: "SUBSCRIPTION", agent: "Subscription", fee: "0" },
  { fn: "resumePlan()", cat: "SUBSCRIPTION", agent: "Subscription", fee: "0" },
  { fn: "retirePlan()", cat: "SUBSCRIPTION", agent: "Subscription", fee: "0" },
  { fn: "subscribe()", cat: "SUBSCRIPTION", agent: "Subscription", fee: "0" },
  { fn: "renew()", cat: "SUBSCRIPTION", agent: "Subscription", fee: "0" },
  { fn: "cancelSubscription()", cat: "SUBSCRIPTION", agent: "Subscription", fee: "0" },
  { fn: "withdrawRevenue()", cat: "SUBSCRIPTION", agent: "Subscription", fee: "0" },
  { fn: "getSubscriberSubs()", cat: "SUBSCRIPTION", agent: "Subscription", fee: "0" },
  { fn: "isSubActive()", cat: "SUBSCRIPTION", agent: "Subscription", fee: "0" },
  { fn: "getPlanRevenue()", cat: "SUBSCRIPTION", agent: "Subscription", fee: "0" },
  // ── SLA ──
  { fn: "createAgreement()", cat: "SLA", agent: "SLAMonitor", fee: "0.15" },
  { fn: "reportIncident()", cat: "SLA", agent: "SLAMonitor", fee: "0" },
  { fn: "resolveIncident()", cat: "SLA", agent: "SLAMonitor", fee: "0" },
  { fn: "recordBreach()", cat: "SLA", agent: "SLAMonitor", fee: "0" },
  { fn: "terminateAgreement()", cat: "SLA", agent: "SLAMonitor", fee: "0" },
  { fn: "markExpired()", cat: "SLA", agent: "SLAMonitor", fee: "0" },
  { fn: "getAgreementIncidents()", cat: "SLA", agent: "SLAMonitor", fee: "0" },
  { fn: "getProviderAgreements()", cat: "SLA", agent: "SLAMonitor", fee: "0" },
  { fn: "isAgreementActive()", cat: "SLA", agent: "SLAMonitor", fee: "0" },
  // ── SERVICE_REP ──
  { fn: "registerProvider()", cat: "SERVICE_REP", agent: "ServiceReputation", fee: "0.05" },
  { fn: "submitReview()", cat: "SERVICE_REP", agent: "ServiceReputation", fee: "0" },
  { fn: "recordJobCompleted()", cat: "SERVICE_REP", agent: "ServiceReputation", fee: "0" },
  { fn: "recordDispute()", cat: "SERVICE_REP", agent: "ServiceReputation", fee: "0" },
  { fn: "deactivateProvider()", cat: "SERVICE_REP", agent: "ServiceReputation", fee: "0" },
  { fn: "getProviderReviews()", cat: "SERVICE_REP", agent: "ServiceReputation", fee: "0" },
  { fn: "getAverageScore()", cat: "SERVICE_REP", agent: "ServiceReputation", fee: "0" },
  { fn: "getProviderCount()", cat: "SERVICE_REP", agent: "ServiceReputation", fee: "0" },
  { fn: "getBadge()", cat: "SERVICE_REP", agent: "ServiceReputation", fee: "0" },
  // ── LOYALTY ──
  { fn: "registerMember()", cat: "LOYALTY", agent: "LoyaltyRewards", fee: "0.05" },
  { fn: "issuePoints()", cat: "LOYALTY", agent: "LoyaltyRewards", fee: "0" },
  { fn: "redeemPoints()", cat: "LOYALTY", agent: "LoyaltyRewards", fee: "0" },
  { fn: "deactivateMember()", cat: "LOYALTY", agent: "LoyaltyRewards", fee: "0" },
  { fn: "getMemberCount()", cat: "LOYALTY", agent: "LoyaltyRewards", fee: "0" },
  { fn: "getMemberTier()", cat: "LOYALTY", agent: "LoyaltyRewards", fee: "0" },
  { fn: "getPoints()", cat: "LOYALTY", agent: "LoyaltyRewards", fee: "0" },
  // ── CROWDFUND ──
  { fn: "createCampaign()", cat: "CROWDFUND", agent: "CrowdfundingPool", fee: "0.1" },
  { fn: "pledge()", cat: "CROWDFUND", agent: "CrowdfundingPool", fee: "0" },
  { fn: "finalizeCampaign()", cat: "CROWDFUND", agent: "CrowdfundingPool", fee: "0" },
  { fn: "withdrawCampaignFunds()", cat: "CROWDFUND", agent: "CrowdfundingPool", fee: "0" },
  { fn: "refundPledge()", cat: "CROWDFUND", agent: "CrowdfundingPool", fee: "0" },
  { fn: "cancelCampaign()", cat: "CROWDFUND", agent: "CrowdfundingPool", fee: "0" },
  { fn: "getCampaignPledges()", cat: "CROWDFUND", agent: "CrowdfundingPool", fee: "0" },
  { fn: "getCreatorCampaigns()", cat: "CROWDFUND", agent: "CrowdfundingPool", fee: "0" },
  { fn: "isCampaignActive()", cat: "CROWDFUND", agent: "CrowdfundingPool", fee: "0" },
  // ── P2P_MARKET ──
  { fn: "createListing()", cat: "P2P_MARKET", agent: "P2PMarketplace", fee: "0" },
  { fn: "purchase()", cat: "P2P_MARKET", agent: "P2PMarketplace", fee: "2.5%" },
  { fn: "confirmDelivery()", cat: "P2P_MARKET", agent: "P2PMarketplace", fee: "0" },
  { fn: "raiseListingDispute()", cat: "P2P_MARKET", agent: "P2PMarketplace", fee: "0" },
  { fn: "resolveListingDispute()", cat: "P2P_MARKET", agent: "P2PMarketplace", fee: "0" },
  { fn: "cancelListing()", cat: "P2P_MARKET", agent: "P2PMarketplace", fee: "0" },
  { fn: "setPlatformFee()", cat: "P2P_MARKET", agent: "P2PMarketplace", fee: "0" },
  { fn: "getSellerListings()", cat: "P2P_MARKET", agent: "P2PMarketplace", fee: "0" },
  { fn: "getBuyerPurchases()", cat: "P2P_MARKET", agent: "P2PMarketplace", fee: "0" },
  { fn: "isListingActive()", cat: "P2P_MARKET", agent: "P2PMarketplace", fee: "0" },
  // ── CHARITY ──
  { fn: "createCause()", cat: "CHARITY", agent: "CharityVault", fee: "0" },
  { fn: "donate()", cat: "CHARITY", agent: "CharityVault", fee: "0" },
  { fn: "withdrawCharityFunds()", cat: "CHARITY", agent: "CharityVault", fee: "0" },
  { fn: "pauseCause()", cat: "CHARITY", agent: "CharityVault", fee: "0" },
  { fn: "resumeCause()", cat: "CHARITY", agent: "CharityVault", fee: "0" },
  { fn: "getCauseDonations()", cat: "CHARITY", agent: "CharityVault", fee: "0" },
  { fn: "getDonorHistory()", cat: "CHARITY", agent: "CharityVault", fee: "0" },
  { fn: "getAvailableFunds()", cat: "CHARITY", agent: "CharityVault", fee: "0" },
  { fn: "getCauseProgress()", cat: "CHARITY", agent: "CharityVault", fee: "0" },
  // ── CUSTOMS & CLEARANCE ──
  { fn: "validateDuaDocument()", cat: "CUSTOMS", agent: "CustomsClear", fee: "0.02" },
  { fn: "queryTariffRate()", cat: "CUSTOMS", agent: "CustomsClear", fee: "free" },
  { fn: "preClearanceValidation()", cat: "CUSTOMS", agent: "CustomsClear", fee: "0.05%" },
  { fn: "linkShipmentToCustmsPlatform()", cat: "CUSTOMS", agent: "CustomsClear", fee: "0.15%" },
  { fn: "trackClearanceStatus()", cat: "CUSTOMS", agent: "CustomsClear", fee: "free" },
  { fn: "requestCustomsOfficerSignature()", cat: "CUSTOMS", agent: "CustomsClear", fee: "0.01" },
  { fn: "downloadClearanceCertificate()", cat: "CUSTOMS", agent: "CustomsClear", fee: "0.005" },
  { fn: "automateImportPermitCheck()", cat: "CUSTOMS", agent: "CustomsClear", fee: "0.01" },
  { fn: "calculateEstimatedDuty()", cat: "CUSTOMS", agent: "CustomsClear", fee: "free" },
  { fn: "submitClearanceQuery()", cat: "CUSTOMS", agent: "CustomsClear", fee: "0.05" },
  { fn: "trackMultiCountryClearance()", cat: "CUSTOMS", agent: "CustomsClear", fee: "0.05%" },
  // ── TRACKING INTEGRATION ──
  { fn: "mintCargoWithTracking()", cat: "TRACKING", agent: "TrackingGateway", fee: "0.5%" },
  { fn: "recordCheckpoint()", cat: "TRACKING", agent: "TrackingGateway", fee: "0.001" },
  { fn: "getShipmentHistory()", cat: "TRACKING", agent: "TrackingGateway", fee: "free" },
];

export const CAT_COLOR = {
  GAS: "#00FFB2", SWAP: "#00FFB2", AML: "#7C3AED", NFT: "#F97316",
  ESCROW: "#2563EB", QUALITY: "#F97316", IDENTITY: "#7C3AED", ECON: "#FFB800",
  PAYMENT: "#FFB800", CUSTOMS: "#00C896", BRIDGE: "#00C896", SECURITY: "#00C896",
  DAO: "#EAB308", ADS: "#EC4899", STAKING: "#FFB800", SOCIAL: "#EC4899",
  AI: "#EC4899", HR: "#EAB308",
  HEALTH: "#00FF88", PHARMA: "#00D4FF", INSURANCE: "#FFD700", BIODATA: "#7C3AED",
  CARBON: "#00FF88", P2P_ENERGY: "#00D4FF", SOLAR_DEFI: "#F97316", ESG: "#7C3AED",
  VEHICLE: "#3B82F6", AUTOPARTS: "#F97316", FLEET: "#A78BFA", EV_CHARGE: "#10B981",
  QUALITY_CERT: "#00FF88", DIGITAL_TWIN: "#7C3AED", MRP: "#F97316", PRED_MAINT: "#EF4444",
  CROP_FUTURES: "#10B981", AGRI_SUPPLY: "#10B981", AQUA_FARM: "#06B6D4", LAND_REGISTRY: "#A78BFA",
  POLICY_NFT: "#3B82F6", CLAIM_ADJ: "#F97316", REINSURANCE: "#7C3AED", PARAMETRIC_INS: "#EF4444",
  COURSE_TOKEN: "#3B82F6", SCHOLAR_POOL: "#10B981", EDU_DAO: "#EAB308", SKILL_BADGE: "#7C3AED",
  EVENT_TICKET: "#E040FB", ROYALTY_DIST: "#FFD700", FAN_TOKEN: "#3B82F6", STREAMING_RIGHTS: "#EF4444",
  SMART_LEGAL: "#8B5CF6", EVIDENCE_VAULT: "#3B82F6", ARBITRATION: "#F59E0B", IP_REGISTRY: "#EC4899",
  SUPPLY_TRACK: "#06B6D4", PROCUREMENT: "#F97316", WAREHOUSE: "#22D3EE", SUPPLIER_SCORE: "#A855F7",
  CITIZEN_ID: "#10B981", PUBLIC_BUDGET: "#EAB308", LAND_CADASTRAL: "#A78BFA", VOTING: "#3B82F6",
  MICRO_LENDING: "#F59E0B", INVOICE_FACTOR: "#8B5CF6", TREASURY: "#10B981", CREDIT_SCORE: "#EC4899",
  FREELANCE: "#06B6D4", SUBSCRIPTION: "#A855F7", SLA: "#F43F5E", SERVICE_REP: "#F97316",
  LOYALTY: "#FBBF24", CROWDFUND: "#14B8A6", P2P_MARKET: "#6366F1", CHARITY: "#EC4899",
  TRACKING: "#0EA5E9",
};

// Shared helpers
export const rndInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
