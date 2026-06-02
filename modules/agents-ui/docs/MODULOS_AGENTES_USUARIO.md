# Guia de funcionamiento - Modulos de agentes BeZhas

## Estado general

`modules/agents-ui` es una capa visual de agentes sectoriales. Sirve para mostrar paneles, metricas, actividad, contratos asociados y llamadas MCP. No es todavia una aplicacion transaccional completa por sector.

La conexion tecnica principal existe mediante:

- `use-agent-bridge.js`, que consulta metricas, contratos y precio BEZ desde el API.
- `D:\BeZhas-Blockchain\api\services\agentService.js`, que conecta agentes con PostgreSQL, Redis, Aegis AI y MCP Gateway.
- `D:\BeZhas-Blockchain\api\routes\contracts-abi.js`, que expone contratos y ABIs por agente.
- `D:\BeZhas-Blockchain\smart-contracts\deployments\31337.json`, que registra contratos desplegados por sector.

## Que puede hacer ahora

1. Ver paneles sectoriales de agentes.
2. Cargar metricas reales si el Core API, PostgreSQL y Aegis estan activos.
3. Consultar contratos desplegados por agente cuando el ID esta mapeado en el API.
4. Invocar herramientas MCP mediante `/agents/mcp/invoke`.
5. Mostrar modelos de oracle, escrow, pagos, DAO, staking y tokenomics como flujo operativo.

## Sectores cubiertos por contratos

Los contratos desplegados cubren estos sectores:

| Sector | Contratos principales |
|---|---|
| Core | BEZCoinV2, StakingPool, LiquidityFarming, BeZhasPayment, BeZhasDEX, GovernanceSystem, DeliveryEscrow, QualityEscrow |
| Supply Chain | SupplyTracker, ProcurementNFT, WarehouseManager, SupplierScoreOracle, CustomsClearanceOracle |
| Health | HealthRecordSBT, PharmaTracker, HealthInsuranceEscrow, ClinicalDataMarketplace |
| Energy | CarbonCreditToken, P2PEnergyMarket, SolarFarmToken, ESGScoreOracle |
| Automotive | VehicleIdentityNFT, AutoPartsRegistry, FleetLeaseEscrow, EVChargeToken |
| Manufacturing | QualityCertificateNFT, DigitalTwinRegistry, MaterialTokenMRP, PredictiveMaintenanceLog |
| Agriculture | CropTokenFutures, AgriSupplyChain, AquaFarmMonitor, LandTitleNFT |
| Insurance | PolicyNFT, ParametricInsurance, ClaimAdjuster, ReinsurancePool |
| Education | CourseTokenNFT, SkillBadgeSBT, EduDAO, ScholarshipPool |
| Entertainment | EventTicketNFT, FanTokenDAO, RoyaltyDistributor, StreamingRightsMarket |
| Legal | SmartLegalContract, EvidenceVault, ArbitrationDAO, IPRegistryNFT |
| Government | CitizenIdentityNFT, PublicBudgetDAO, LandCadastralRegistry, VotingSystem |
| Finance | MicroLendingPool, InvoiceFactoring, CreditScoreOracle, TreasuryVault |
| Services/Otros | FreelanceMarketplace, SubscriptionManager, SLAMonitor, ServiceReputationNFT, P2PMarketplace, CrowdfundingPool, CharityVault |

## Oracle y escrow

La base para oracle existe, pero no esta uniforme en todos los sectores.

Sectores con oracle claro:

- Core: AegisSecurityProvider, DeliveryEscrow con ORACLE_ROLE, ValidatorRegistry.
- Supply Chain: CustomsClearanceOracle, SupplierScoreOracle.
- Energy: ESGScoreOracle, CarbonCreditToken.
- Agriculture: CropTokenFutures, AquaFarmMonitor.
- Automotive: VehicleIdentityNFT.
- Manufacturing: DigitalTwinRegistry, PredictiveMaintenanceLog.
- Insurance: ClaimAdjuster, ParametricInsurance.
- Finance: CreditScoreOracle.

Sectores con escrow claro:

- Core: DeliveryEscrow y QualityEscrow.
- Health: HealthInsuranceEscrow.
- Automotive: FleetLeaseEscrow.
- Supply Chain: ProcurementNFT usa escrow.
- Services/Otros: FreelanceMarketplace, P2PMarketplace y SLAMonitor tienen logica de deposito/escrow o penalizacion.

Falta estandarizar un patron comun de oracle y escrow para cada sector: mismo registro de roles, eventos, evidencias, lectura desde Core Gateway y acciones de wallet.

## Conexion con tokenomics BEZ

La tokenomics central esta en Core:

- BEZCoinV2 para token base.
- StakingPool para staking.
- LiquidityFarming para rewards.
- BeZhasPayment para pagos en BEZ.
- BeZhasDEX para liquidez y trading.
- GovernanceSystem para DAO.
- DeliveryEscrow para escrows pagados en BEZ.

El problema actual es que varios contratos sectoriales usan ETH nativo o logica local, no BEZCoinV2. Por eso no todo el tokenomic esta conectado de forma uniforme. Para que cada sector alimente realmente el tokenomics de BeZhas, cada operacion sectorial deberia poder:

1. Cobrar en BEZ.
2. Enviar fee a tesoreria.
3. Quemar o reservar BEZ cuando aplique.
4. Crear eventos indexables para metricas.
5. Usar el Core Gateway como punto unico de acceso.

## Brechas detectadas

1. La UI ya tiene todos los IDs de `useAgentBridge(...)` mapeados en `contracts-abi.js`.
2. Todos los archivos `*-agent.jsx` incluyen `AgentDetailPanel`, que muestra fuente de datos, metricas Core DB y contratos desplegados.
3. Algunos paneles conservan visualizaciones sectoriales de demostracion junto al bloque real; el bloque comun indica si la fuente real esta disponible.
4. No todos los agentes tienen acciones transaccionales reales; muchos muestran ABI, actividad y modelo de negocio, pero no ejecutan `approve`, `pay`, `stake`, `escrow`, `oracle update` o `DAO execute` desde wallet.
5. El enlace con tokenomics existe a nivel Core. Se agrego `BEZSectorStandard.sol` como base para migrar todos los contratos sectoriales desde ETH nativo hacia BEZCoinV2.

## Como debe usarlo un usuario

1. Abrir el panel del agente sectorial.
2. Revisar metricas y actividad reciente.
3. Ver contratos asociados en la seccion de contratos.
4. Confirmar que el contrato aparece como desplegado.
5. Usar las acciones disponibles del agente o del Core Gateway.
6. Para operaciones economicas, verificar siempre wallet, red, token BEZ, cantidad y contrato destino.

## Estado final

El sistema tiene una arquitectura de conexion real iniciada y una cobertura amplia de contratos sectoriales. Puede mostrar agentes, contratos, metricas y rutas hacia Core. Todavia no se puede considerar totalmente conectado de punta a punta para todos los sectores, porque faltan mapeos, acciones on-chain por agente y estandarizar BEZ como token de pago/fee/escrow en cada modulo.

Prioridad recomendada:

1. Completar el mapeo de agentes faltantes en `contracts-abi.js`.
2. Cambiar visualizaciones sectoriales mock a feeds reales por dominio.
3. Crear endpoints Core por patron: oracle update, escrow create, escrow release, payment, DAO proposal.
4. Migrar contratos sectoriales que usan ETH nativo hacia `BEZSectorStandard.sol`.
5. Agregar tests end-to-end por sector: UI -> Core Gateway -> contrato -> evento.
