# BeZhas Blockchain - Mapa del Repositorio

> Ultima actualizacion: 2026-03-17

---

## Estado del Proyecto

**Fase actual: 17 de 17+ — Tracking + Customs Monetization COMPLETADA**

| Fase | Sector | Agentes UI | Contratos | Tests | Estado |
|------|--------|-----------|-----------|-------|--------|
| 1 | Logistica | 6 | 3 (core) + 2 (tokens) | 7 | Completada |
| 2 | Bienes Raices | 4 | — | — | Completada |
| 3 | Salud (Healthcare) | 4 | 4 | 33 | Completada |
| 4 | Energia Renovable | 4 | 4 | 34 | Completada |
| 5 | Automotriz | 4 | 4 | 37 | Completada |
| 6 | Manufactura | 4 | 4 | 39 | Completada |
| 7 | Agricultura | 4 | 4 | 40 | Completada |
| 8 | Seguros | 4 | 4 | 45 | Completada |
| 9 | Educacion | 4 | 4 | 43 | Completada |
| 10 | Entretenimiento | 4 | 4 | 56 | Completada |
| 11 | Legal | 4 | 4 | 58 | Completada |
| 12 | Supply Chain | 4 | 4 | 69 | Completada |
| 13 | Gobierno | 4 | 4 | 65 | Completada |
| 14 | Finanzas | 4 | 4 | ~64 | Completada |
| 15 | Servicios | 4 | 4 | ~80 | Completada |
| 16 | Otros | 4 | 4 | 72 | Completada |
| 17 | Tracking + Customs | 1 (extended) | 4 | 87+ | **IN PROGRESS** |

**Totales actuales:** 70 agentes JSX | 63 contratos Solidity | 827+ tests (all passing) | 381 herramientas MCP

---

## Carpetas Principales

```
BeZhas Blockchain/
|-- AI_CONTEXT.md              Guia maestra IA (leer primero)
|-- PROJECT_STRUCTURE.md       Este archivo — inventario detallado
|-- deploy-config.json         Configuracion genesis/deploy
|-- docker-compose.yml         Orquestacion de 10 servicios
|-- aegis/                     Backend de control IA (FastAPI, puerto 8001)
|-- ai-engine/                 Servidor MCP (Node/Express, puerto 3002)
|-- api/                       Backend Web2/Web3 (Node/Express, puerto 3001)
|-- bezhas-edge-node/          Nodo empresarial webhooks ERP y firmado L2 (puerto 4000)
|-- control-center/frontend/   Frontend Next.js 14.2.3 (puerto 3000)
|-- docs/                      Documentacion funcional y arquitectonica (38 archivos)
|-- modules/agents-ui/         Modulo UI de agentes (53 archivos, 49 agentes)
|-- sdk/                       Cliente/SDK e integraciones B2B
|-- smart-contracts/            Contratos Solidity y tests Foundry
|   |-- src/{sector}/           31 contratos organizados por sector
|   |-- test/{sector}/          31 test suites organizados por sector (espejo de src/)
|   |-- lib/                    forge-std, openzeppelin-contracts
```

---

## Detalle: modules/agents-ui/ (53 archivos, 49 agentes)

### Core / Logistica (13 archivos)
- `bezhas-agent-master.jsx` — Panel maestro de agentes
- `bezhas-agents-constants.js` — Constantes, colores, grupos, MCP_TOOLS (215 herramientas)
- `bezhas-agents-ui.jsx` — UI base para sistema de agentes
- `bezhas-ai-agents.jsx` — Definiciones de agentes IA por sector
- `bezhas-budget-presupuesto.jsx` — Agente de presupuestos
- `bezhas-rwa-roadmap.jsx` — Roadmap de activos RWA
- `bezhas-tab-agents.jsx` — Tab de agentes
- `bezhas-tab-bridge-merge.jsx` — Tab de bridge/merge
- `bezhas-tab-mcp-bez.jsx` — Tab MCP
- `customsclear-agent.jsx` — Agente de aduanas
- `rwa-cargo-agent.jsx` — Agente de carga RWA
- `shiptrack-agent.jsx` — Agente de rastreo maritimo
- `README.md` — Documentacion del modulo

### Bienes Raices / Logistica Avanzada (4 archivos — Fase 2)
- `real-estate-agents.jsx` — Agentes inmobiliarios (4-en-1: tokenizacion, valuacion, renta, hipoteca)
- `cold-chain-agent.jsx` — Agente de cadena de frio para logistica
- `maritime-insurance-agent.jsx` — Agente de seguros maritimos
- `port-finance-agent.jsx` — Agente de financiamiento portuario

### Salud (4 archivos — Fase 3)
- `medrecord-agent.jsx` — Registros medicos SBT
- `pharmatrak-agent.jsx` — Trazabilidad farmaceutica
- `claimbot-agent.jsx` — Escrow de seguros medicos
- `biodata-agent.jsx` — Marketplace de datos clinicos

### Energia Renovable (4 archivos — Fase 4)
- `greentoken-agent.jsx` — Creditos de carbono y RECs (ERC-1155)
- `p2penergy-agent.jsx` — Mercado P2P de energia con smart meters
- `solardefi-agent.jsx` — Inversion fraccionada en granjas solares/eolicas
- `esgscore-agent.jsx` — Oraculo de scoring ESG on-chain

### Automotriz (4 archivos — Fase 5)
- `vehiclenft-agent.jsx` — NFT de identidad vehicular con VIN y oraculo de millaje
- `autoparts-agent.jsx` — Registro anti-falsificacion de autopartes con cadena de custodia
- `fleetdefi-agent.jsx` — Leasing descentralizado de flotas con escrow de mantenimiento
- `evcharge-agent.jsx` — Red tokenizada de estaciones de carga EV con roaming

### Manufactura (4 archivos — Fase 6)
- `qualitychain-agent.jsx` — Certificados de calidad NFT con auditorias ISO
- `digitaltwin-agent.jsx` — Gemelos digitales de equipos con telemetria IoT
- `supplymrp-agent.jsx` — Planificacion de materiales (MRP) on-chain con BOM
- `predmaint-agent.jsx` — Mantenimiento predictivo con IA y sensores IoT

### Agricultura (4 archivos — Fase 7)
- `croptoken-agent.jsx` — Futuros de cosecha tokenizados con certificación por oráculo
- `agrisupply-agent.jsx` — Trazabilidad farm-to-table con GPS y cadena de frío
- `aquafarm-agent.jsx` — Monitoreo IoT de acuacultura e hidroponía
- `landregistry-agent.jsx` — Registro de títulos de tierra NFT con datos de suelo

### Seguros (4 archivos — Fase 8)
- `policynft-agent.jsx` — Pólizas de seguro tokenizadas como NFTs con primas y renovación
- `claimadjuster-agent.jsx` — Ajuste de siniestros con IA, scoring de fraude y pago automático
- `reinsurance-agent.jsx` — Pools de reaseguro DeFi con rendimiento y tokenización de riesgo
- `parametric-agent.jsx` — Seguros paramétricos con oráculos de clima/sísmica/hidrología

### Educacion (4 archivos — Fase 9)
- `coursetoken-agent.jsx` — Cursos tokenizados con certificados NFT y pago de matricula
- `scholarpool-agent.jsx` — Pools de becas DeFi con distribución basada en mérito
- `edudao-agent.jsx` — Gobernanza DAO para instituciones educativas
- `skillbadge-agent.jsx` — Micro-credenciales soulbound (SBT) con niveles y scoring

### Entretenimiento (4 archivos — Fase 10)
- `eventticket-agent.jsx` — Tickets de eventos tokenizados con anti-scalping y resale verificado
- `royaltydist-agent.jsx` — Distribucion automatica de regalias para creadores de contenido
- `fantoken-agent.jsx` — DAO de fans con gobernanza, votacion y rewards por engagement
- `streamingrights-agent.jsx` — Marketplace de derechos de streaming/licensing con DRM

### Legal (4 archivos — Fase 11)
- `smartlegal-agent.jsx` — Contratos legales on-chain con firmas digitales y resolucion de disputas
- `evidencevault-agent.jsx` — Boveda de evidencia tamper-proof con cadena de custodia
- `arbitration-agent.jsx` — DAO de arbitraje descentralizado con paneles y votacion
- `ipregistry-agent.jsx` — Registro de propiedad intelectual y marketplace de licencias

### Supply Chain (4 archivos — Fase 12)
- `supplytracker-agent.jsx` — Rastreo end-to-end de envios con checkpoints IoT y prueba de entrega
- `procurement-agent.jsx` — Ordenes de compra tokenizadas con multi-aprobacion y auto-liquidacion
- `warehouse-agent.jsx` — Gestion de inventario con tracking de lotes y monitoreo de expiracion
- `supplierscore-agent.jsx` — Scoring de reputacion de proveedores con auditorias y certificaciones

### Gobierno (4 archivos — Fase 13)
- `citizenidentity-agent.jsx` — Identidad ciudadana SBT con verificacion y acceso a servicios publicos
- `publicbudget-agent.jsx` — DAO de presupuesto publico con propuestas, votacion y ejecucion
- `landcadastral-agent.jsx` — Registro catastral de terrenos con transferencias y verificacion de limites
- `voting-agent.jsx` — Sistema electoral on-chain con registro, boletas y conteo

### Finanzas (4 archivos — Fase 14)
- `microlending-agent.jsx` — Pool de micro-prestamos con colateral, financiamiento y repago
- `invoicefactoring-agent.jsx` — Factoring de facturas con descuento, financiamiento y liquidacion
- `treasuryvault-agent.jsx` — Tesoreria multi-firma con limites diarios y aprobaciones
- `creditscore-agent.jsx` — Oraculo de puntaje crediticio con historial y tiers de riesgo

### Servicios (4 archivos — Fase 15)
- `freelance-agent.jsx` — Marketplace de freelancers con gigs, milestones, escrow y disputas
- `subscription-agent.jsx` — Gestion de planes de suscripcion con renovaciones y revenue
- `slamonitor-agent.jsx` — Monitor de SLAs con depositos, penalidades por breach e incidentes
- `servicereputation-agent.jsx` — Reputacion de proveedores con reviews, badges y job tracking

### Otros (4 archivos — Fase 16)
- `loyalty-agent.jsx` — Programa de lealtad con puntos, tiers (Bronze-Diamond) y redenciones
- `crowdfunding-agent.jsx` — Pool de crowdfunding con campañas, pledges, finalizacion y reembolsos
- `p2pmarketplace-agent.jsx` — Marketplace P2P con listings, escrow, disputas y fee de plataforma
- `charityvault-agent.jsx` — Boveda de caridad con causas, donaciones, retiros y tracking de impacto

---

## Detalle: smart-contracts/ (59 contratos, 740+ tests)

### src/tokens/ (2 contratos)
- `BEZCoinV2.sol` — Token nativo $BEZ (ERC-20, roles BRIDGE/MINTER)
- `BeZhasLogisticsNFT.sol` — NFT de activos logisticos

### src/core/ (5 contratos)
- `QualityEscrow.sol` — Escrow con inspeccion de calidad
- `BeZhasBridgeL2.sol` — Puente L1-L2 con bridgeBurn
- `GovernanceSystem.sol` — Sistema de gobernanza DAO
- `LiquidityFarming.sol` — Farming de liquidez con staking
- `StakingPool.sol` — Pool de staking

### src/health/ (4 contratos — Fase 3)
- `HealthRecordSBT.sol` — Soulbound token de registros medicos
- `PharmaTracker.sol` — Trazabilidad de farmacos on-chain
- `HealthInsuranceEscrow.sol` — Escrow automatico de seguros de salud
- `ClinicalDataMarketplace.sol` — Marketplace de datos clinicos anonimizados

### src/energy/ (4 contratos — Fase 4)
- `CarbonCreditToken.sol` — Token ERC-1155 de creditos de carbono y RECs
- `P2PEnergyMarket.sol` — Mercado peer-to-peer de energia con pruebas de smart meter
- `SolarFarmToken.sol` — Token ERC-1155 fraccionado de granjas renovables con dividendos
- `ESGScoreOracle.sol` — Oraculo ESG con scoring ponderado (E:40, S:30, G:30) y certificacion

### src/automotive/ (4 contratos — Fase 5)
- `VehicleIdentityNFT.sol` — ERC-721 de identidad vehicular con VIN, oraculo de millaje, reporte de robo
- `AutoPartsRegistry.sol` — Registro de autopartes con verificacion de fabricante y recalls por lote
- `FleetLeaseEscrow.sol` — Escrow de leasing de flotas con pool de mantenimiento (80/20)
- `EVChargeToken.sol` — Registro de estaciones de carga y liquidacion de sesiones en BEZ

### src/manufacturing/ (4 contratos — Fase 6)
- `QualityCertificateNFT.sol` — ERC-721 de certificados de calidad con logging de defectos
- `DigitalTwinRegistry.sol` — Registro de gemelos digitales con telemetria IoT y health scoring
- `MaterialTokenMRP.sol` — Inventario tokenizado con ordenes de compra y BOM on-chain
- `PredictiveMaintenanceLog.sol` — Log de sensores IoT con umbrales de alerta y registros de mantenimiento

### src/agriculture/ (4 contratos — Fase 7)
- `CropTokenFutures.sol` — Futuros de cosecha tokenizados con certificación de oráculo y settlement
- `AgriSupplyChain.sol` — Trazabilidad farm-to-table con GPS proofs y certificaciones
- `AquaFarmMonitor.sol` — Monitoreo IoT de acuacultura con umbrales de alerta y harvest
- `LandTitleNFT.sol` — ERC-721 registro de parcelas con datos de suelo y fraccionalización

### src/insurance/ (4 contratos — Fase 8)
- `PolicyNFT.sol` — Pólizas tokenizadas con primas, cancelación, renovación y reclamos
- `ClaimAdjuster.sol` — Procesamiento de siniestros con scoring IA, detección de fraude y pago
- `ReinsurancePool.sol` — Pools de reaseguro DeFi con depósitos, yield y cobertura de siniestros
- `ParametricInsurance.sol` — Seguros indexados con lecturas de oráculo y pago automático por trigger

### src/education/ (4 contratos — Fase 9)
- `CourseTokenNFT.sol` — Cursos tokenizados con inscripción, pago y certificados NFT al completar
- `ScholarshipPool.sol` — Pools de becas DeFi financiados por sponsors con distribución por mérito
- `EduDAO.sol` — DAO de gobernanza institucional con propuestas, votación y tesorería
- `SkillBadgeSBT.sol` — Badges soulbound de habilidades con niveles 1-3, scoring y revocacion

### src/entertainment/ (4 contratos — Fase 10)
- `EventTicketNFT.sol` — Tickets tokenizados con tier (General/VIP/Premium/Backstage), anti-scalping y reembolsos
- `RoyaltyDistributor.sol` — Splits de regalias automaticos para beneficiarios con deposito/retiro
- `FanTokenDAO.sol` — Clubs de fans con polls, votacion, engagement scoring y reward pool
- `StreamingRightsMarket.sol` — Registro de IP, licencias por territorio, reporte de streams y DRM

### src/legal/ (4 contratos — Fase 11)
- `SmartLegalContract.sol` — Contratos legales on-chain con firmas digitales, clausulas y disputas
- `EvidenceVault.sol` — Boveda de evidencia tamper-proof con cadena de custodia y verificacion de hash
- `ArbitrationDAO.sol` — DAO de arbitraje con paneles de arbitros, votacion y apelaciones
- `IPRegistryNFT.sol` — Registro de propiedad intelectual (patentes, marcas, copyright) con licensing

### src/supplychain/ (4 contratos — Fase 12)
- `SupplyTracker.sol` — Rastreo de envios con checkpoints IoT, temperatura y prueba de entrega
- `ProcurementNFT.sol` — Ordenes de compra tokenizadas con escrow, multi-aprobacion y liquidacion
- `WarehouseManager.sol` — Gestion de almacenes con lotes, capacidad, transferencias y expiracion
- `SupplierScoreOracle.sol` — Oraculo de reputacion de proveedores con auditorias, KPIs y certificaciones

### src/government/ (4 contratos — Fase 13)
- `CitizenIdentityNFT.sol` — Identidad digital ciudadana con KYC, documentos biometricos y verificacion
- `PublicBudgetDAO.sol` — DAO de presupuesto publico con propuestas, votacion del consejo y ejecucion de fondos
- `LandCadastralRegistry.sol` — Registro catastral con parcelas, transferencias, zonificacion y avaluos
- `VotingSystem.sol` — Sistema electoral on-chain con registro de candidatos/votantes, boletas y conteo

### src/finance/ (4 contratos — Fase 14)
- `MicroLendingPool.sol` — Pool de micro-prestamos con colateral, financiamiento por prestamistas y repagos automaticos
- `InvoiceFactoring.sol` — Factoring de facturas tokenizadas con tasas de descuento, financiamiento y liquidacion
- `TreasuryVault.sol` — Tesoreria multi-firma con limites de gasto diario, aprobaciones y ejecucion de retiros
- `CreditScoreOracle.sol` — Oraculo de puntaje crediticio on-chain con historial de pagos, disputas y tiers de riesgo

### src/services/ (4 contratos — Fase 15)
- `FreelanceMarketplace.sol` — Marketplace de freelancers con gigs, milestones, escrow y resolucion de disputas por arbitro
- `SubscriptionManager.sol` — Gestion de planes de suscripcion con periodos, renovaciones y retiro de revenue por proveedor
- `SLAMonitor.sol` — Monitor de acuerdos SLA con depositos escrow, penalidades por breach e incidentes
- `ServiceReputationNFT.sol` — Reputacion de proveedores de servicios con reviews 1-5, badges automaticos y job tracking

### src/otros/ (4 contratos — Fase 16)
- `LoyaltyRewards.sol` — Programa de lealtad con puntos, tiers automaticos (Bronze→Diamond) y redenciones
- `CrowdfundingPool.sol` — Pool de crowdfunding con campañas, pledges, finalizacion por deadline y reembolsos
- `P2PMarketplace.sol` — Marketplace P2P con listings, escrow, disputas con arbitro y fee de plataforma 2.5%
- `CharityVault.sol` — Boveda de caridad con causas, donaciones, auto-completado al llegar a meta y retiros

### src/tracking-customs/ (4 contratos — Fase 17)
- `TrackingIntegrationGateway.sol` (440 líneas) — Registro de proveedores (FlighRadar24, MarineTraffic, SafeCube), tokenización de carga $BEZ 0.5%, checkpoint recording con sensores IoT (ubicación, temperatura, humedad), presupuestos mensuales de proveedores
- `CustomsClearanceOracle.sol` (440 líneas) — Gestión de plataformas aduanales (AduanaEasy, TradeGo, e-Aduanas, Digitrade), base de datos de tarifas TARIC por HS code con tasas 0-100%, solicitudes de tramitación aduanal con deduplicación DUA/AWB/CMR, cálculo de derechos automático, aprobación multi-firma de oficiales aduanales, distribución de ingresos 50/50 plataforma/BeZhas
- `TrackingToCustomsGateway.sol` (350 líneas) — Capa de integración composite: vinculación rastreo+aduanas, checkpoints durante transito, aprobación aduanal con liberación, flujo multi-país (Spain→France→Germany con estado por capital), certificado de liberación automático
- `ClearanceCertificateNFT.sol` (330 líneas) — ERC-721 proof of customs clearance con metadatos (shipmentId, hsCode, commodity, cargoValue, declaredDuty, origen/destino, plataforma aduanal, firma oficial), validez 30/60/90 días, revocación por fraude/error, consulta IPFS

### test/tracking-customs/ (4 suites, 87+ tests — Fase 17)
- `TrackingIntegrationGateway.t.sol` — Registro de proveedores, tokenización con deducción de tarifa 0.5%, presupuesto enforcement, historial de checkpoints, estadisticas de proveedor (llamadas, tarifas)
- `CustomsClearanceOracle.t.sol` — Actualizacion de tarifas, registro de plataforma, deduplicación DUA, calculo de derechos USD, aprobación/rechazo oficial, retiro de ingresos plataforma, tests multi-envio
- `TrackingToCustomsGateway.t.sol` — Creación de envio integrado, adición de checkpoints, aprobación aduanal, queries de ubicación actual, flujo multi-país (ES→FR→DE), historial de envios
- `ClearanceCertificateNFT.t.sol` — Emisión de certificado con metadata, lógica expiracion (válido/expirado), revocación, mapeo shipmentId→tokenId, colección de usuario, actualizacion de transfer

```
test/
├── core/           ← QualityEscrow.t.sol, BridgeL2.t.sol, BeZhasLogisticsNFT.t.sol
├── health/         ← HealthRecordSBT, PharmaTracker, InsuranceEscrow, DataMarketplace
├── energy/         ← CarbonCredit, P2PEnergy, SolarFarm, ESGScore
├── automotive/     ← VehicleIdentity, AutoParts, FleetLease, EVCharge
├── manufacturing/  ← QualityCertificate, DigitalTwin, MaterialMRP, PredMaint
├── agriculture/    ← CropFutures, AgriSupply, AquaFarm, LandTitle
├── insurance/      ← PolicyNFT, ClaimAdjuster, ReinsurancePool, Parametric
└── education/      ← CourseTokenNFT, ScholarshipPool, EduDAO, SkillBadgeSBT
├── entertainment/  ← EventTicketNFT, RoyaltyDistributor, FanTokenDAO, StreamingRightsMarket
└── legal/          ← SmartLegalContract, EvidenceVault, ArbitrationDAO, IPRegistryNFT
└── supplychain/    ← SupplyTracker, ProcurementNFT, WarehouseManager, SupplierScoreOracle
└── government/     ← CitizenIdentityNFT, PublicBudgetDAO, LandCadastralRegistry, VotingSystem
└── finance/        ← MicroLendingPool, InvoiceFactoring, TreasuryVault, CreditScoreOracle
└── services/       ← FreelanceMarketplace, SubscriptionManager, SLAMonitor, ServiceReputationNFT
└── otros/          ← LoyaltyRewards, CrowdfundingPool, P2PMarketplace, CharityVault
└── tracking-customs/ ← TrackingIntegration, CustomsClearanceOracle, TrackingToCustomsGateway, ClearanceCertificateNFT (87+ tests)
```

| Directorio | Suites | Tests | Sector |
|------------|--------|-------|--------|
| test/core/ | 3 | 7 | Core + Tokens |
| test/health/ | 4 | 33 | Salud |
| test/energy/ | 4 | 34 | Energia |
| test/automotive/ | 4 | 37 | Automotriz |
| test/manufacturing/ | 4 | 39 | Manufactura |
| test/agriculture/ | 4 | 40 | Agricultura |
| test/insurance/ | 4 | 45 | Seguros |
| test/education/ | 4 | 43 | Educacion |
| test/entertainment/ | 4 | 56 | Entretenimiento |
| test/legal/ | 4 | 58 | Legal |
| test/supplychain/ | 4 | 69 | Supply Chain |
| test/government/ | 4 | 65 | Gobierno |
| test/finance/ | 4 | ~64 | Finanzas |
| test/services/ | 4 | ~80 | Servicios |
| test/otros/ | 4 | 72 | Otros |
| test/tracking-customs/ | 4 | 87+ | Tracking + Customs |
| **Total** | **63** | **827+** | |

---

## Detalle: control-center/frontend/

- **Framework:** Next.js 14.2.3 con App Router (`app/`, NO `src/app/`)
- **Config:** `next.config.mjs` (NO `.ts`)
- **Package manager:** pnpm
- **Alias:** `@agents/*` apunta a `../../modules/agents-ui/*`
- **Modulos agents-ui:** 73 archivos (69 agentes)

### Paginas (app/)
- `page.tsx` — Landing principal
- `dashboard/page.tsx` — Dashboard empresarial

### Componentes
- `AgentsDashboard.tsx` — Wrapper con carga dinamica de agentes (sin SSR)
- `AILogsDashboard.tsx` — Logs de IA
- `BlockchainDashboard.tsx` — Monitor blockchain
- `BridgePortal.tsx` — Portal de bridge L1-L2
- `FarmingDashboard.tsx` — Dashboard de farming

---

## Detalle: Servicios Docker (10)

| Servicio | Puerto | Descripcion |
|----------|--------|-------------|
| postgres | 5432 | Base de datos PostgreSQL |
| redis | 6379 | Cache y colas |
| ai-gateway | 3002 | Servidor MCP (ai-engine) |
| bezhas-geth | 8545 | Nodo de ejecucion OP Stack |
| bezhas-node | 5052 | Nodo consenso OP Stack |
| bezhas-batcher | — | Batcher de transacciones L2 |
| api | 3001 | Backend API REST |
| aegis | 8001 | Control IA (FastAPI) |
| bezhas-edge-node | 4000 | Nodo borde empresarial |
| control-center | 3000 | Frontend Next.js |

---

## Herramientas MCP Registradas (179)

Agrupadas por sector en `bezhas-agents-constants.js`:
- **Core/MCP:** analyzeTx, verifyCompliance, auditContract, etc.
- **Oracle:** certifyWeight, certifyTemp, certifyHumidity, sealContainer
- **SSI:** issueDID, verifyCert, revokeCredential, resolveIdentity
- **DAO:** proposeVote, executeProposal, delegateVotes, queryTreasury
- **BaaS:** onboardTenant, provisionChain, rotateApiKey, metricsSnapshot
- **Token:** mintBEZ, bridgeTransfer, stakeBEZ, claimReward
- **Health:** mintHealthSBT, updateHealthRecord, registerDrug, verifyDrugChain, fileClaim, resolveClaim, listDataset, purchaseDataAccess
- **Energy:** mintCreditBatch, retireCredits, verifyBatch, tradeCredits, registerProsumer, matchAndSettle, createEnergyOffer, registerFarm, investInFarm, distributeDividends, submitESGAudit, certifyESGScore, getCompanyGrade
- **Automotriz:** mintVehicle, updateMileage, transferVehicle, reportStolen, registerPart, verifyAuthenticity, issueRecall, createFleetLease, claimMaintenance, registerStation, settleChargingSession, withdrawChargeRevenue
- **Manufactura:** mintCertificate, logDefect, revokeCertificate, recertify, mintTwin, logTelemetry, updateTwinHealth, decommissionTwin, registerMaterial, createPurchaseOrder, consumeMaterial, logSensorReading, recordMaintenance
- **Entretenimiento:** createEvent, purchaseTicket, useTicket, listForResale, buyResale, cancelEvent, refundTicket, registerContent, configureSplits, depositRevenue, distributeRoyalties, withdrawRoyalties, createClub, joinClub, createPoll, votePoll, finalizePoll, depositRewards, claimFanReward, registerIP, createLicense, reportStreams, revokeLicense, withdrawIPRevenue, deactivateIP
- **Legal:** draftContract, signContract, addClause, fulfillClause, raiseDispute, terminateContract, checkExpiry, submitEvidence, transferCustody, sealEvidence, challengeEvidence, releaseEvidence, verifyHash, fileDispute, assignPanel, startDeliberation, castVote, resolveDispute, fileAppeal, withdrawArbStake, registerIPAsset, approveRegistration, grantLicense, revokeIPLicense, disputeIP, revokeIP, withdrawIPRevenue, verifyProof

---

## Stack Tecnico

| Capa | Tecnologia |
|------|-----------|
| L2 Chain | OP Stack (op-geth + op-node + op-batcher) |
| Smart Contracts | Solidity ^0.8.20, Foundry (Solc 0.8.34), OpenZeppelin |
| Backend API | Node.js / Express |
| AI Engine | Node.js MCP Server (JSON-RPC 2.0) |
| Control IA | Python FastAPI (Aegis) |
| Frontend | Next.js 14.2.3 + TailwindCSS |
| Edge Node | Node.js (webhook + auto-signer) |
| Base de Datos | PostgreSQL + Redis |
| Contenedores | Docker Compose (10 servicios) |

---

## Convencion del Repositorio

- Raiz: solo archivos de configuracion global y documentos de navegacion.
- Modulos por dominio tecnico: API, IA, Edge, Frontend, Contracts.
- Agentes UI centralizados en `modules/agents-ui/` para indexacion por IA.
- Code de produccion dentro de carpetas de modulo.
- Contratos organizados por sector: `src/core/`, `src/tokens/`, `src/health/`, `src/energy/`, `src/automotive/`, `src/manufacturing/`, `src/agriculture/`, `src/insurance/`, `src/education/`, `src/entertainment/`, `src/legal/`.
- Cada nuevo sector agrega: 4 agentes JSX + 4 contratos + 4 suites de test + MCP tools + CAT_COLORs.

---

## Archivos Pendientes de Mover a modules/

> Estos archivos JSX permanecen en la raiz y deberian migrarse a `modules/agents-ui/`:

- `cold-chain-agent.jsx`
- `maritime-insurance-agent.jsx`
- `port-finance-agent.jsx`
- `real-estate-agents.jsx`

---

## Roadmap de Fases de Desarrollo

| Fase | Componente | Detalles Tecnicos | Estado |
|------|-----------|-------------------|--------|
| 1. Infraestructura L2 | OP Stack + SSI/AML | Nodos RPC, W3C DIDs, RegTech | En progreso |
| 2. Desarrollo Automata IA | Agentes de codigo | Vibe Coding, Webhooks | En progreso |
| 3. Contratos Inteligentes | RWA Engine + Token $BEZ | ERC-3643, ERC-1155, ERC-20 | En progreso |
| 4. Seguridad y Auditoria | Fuzzing + Analisis | Echidna, Medusa, Slither | Pendiente |
| 5. Integracion MCP / Cloud AI | MCP Server + CoSAI | JSON-RPC 2.0, OAuth 2.1, JWT | En progreso |
| 6. Interoperabilidad (Bridges) | Bridge L1-L2 | Universal Bridge API, Oraculos | En progreso |
| 7. Adquisicion Sensorial | App movil + Edge AI | LiDAR, ToF, ML Kit, ARCore | Pendiente |
| 8. Plataforma y Gestion | SDK + Dashboard B2B | Next.js, Ethers.js/Viem | En progreso |
| 9. Gobernanza Descentralizada | BeZhas DAO | Aragon OSx o similar | Pendiente |

---

## Proxima Accion Recomendada

1. **Fase 7 — Sector Agricultura**: Crear 4 agentes + 4 contratos + tests
2. Mover los 4 archivos JSX sueltos de raiz a `modules/agents-ui/`
3. Reemplazar endpoints mock por implementaciones reales (Aegis + AI Engine)
4. Ejecutar `docker compose up --build` para validar stack end-to-end