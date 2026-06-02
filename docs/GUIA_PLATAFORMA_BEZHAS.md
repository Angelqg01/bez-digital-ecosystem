# Guía Completa de la Plataforma BeZhas-Blockchain

> **Propósito de este documento:** Servir como guía base para la creación de informes ejecutivos, documentación técnica, presentaciones comerciales y pitch decks del ecosistema BeZhas-Blockchain. Cada sección puede utilizarse de forma independiente según el público objetivo.

---

## Tabla de Contenidos

1. [¿Qué es BeZhas-Blockchain?](#1-qué-es-bezhas-blockchain)
2. [Arquitectura de la Plataforma](#2-arquitectura-de-la-plataforma)
3. [Ecosistema de Sub-Aplicaciones](#3-ecosistema-de-sub-aplicaciones)
4. [Productos y Funcionalidades](#4-productos-y-funcionalidades)
5. [SDK, API, ABI y Contratos Inteligentes](#5-sdk-api-abi-y-contratos-inteligentes)
6. [Inteligencia Artificial: Aegis y AI-Engine](#6-inteligencia-artificial-aegis-y-ai-engine)
7. [Agent Runtime: Automatización Inteligente](#7-agent-runtime-automatización-inteligente)
8. [Sectores de Operación (16 Industrias)](#8-sectores-de-operación-16-industrias)
9. [Tokenomics: BEZCoinV2](#9-tokenomics-bezcoinv2)
10. [DeFi: Staking, Farming y Gobernanza](#10-defi-staking-farming-y-gobernanza)
11. [Seguridad y Cumplimiento](#11-seguridad-y-cumplimiento)
12. [Infraestructura DevOps y Monitorización](#12-infraestructura-devops-y-monitorización)
13. [Beneficios y Propuesta de Valor](#13-beneficios-y-propuesta-de-valor)
14. [Rentabilidad y Modelo de Negocio](#14-rentabilidad-y-modelo-de-negocio)
15. [Métricas Clave del Proyecto](#15-métricas-clave-del-proyecto)
16. [Roadmap y Estado Actual](#16-roadmap-y-estado-actual)
17. [Glosario Técnico](#17-glosario-técnico)

---

## 1. ¿Qué es BeZhas-Blockchain?

**BeZhas-Blockchain** es una plataforma blockchain de capa 2 (Layer 2) construida sobre **OP Stack** (la misma tecnología de Optimism) que proporciona infraestructura descentralizada para la automatización empresarial multi-sectorial.

### Visión

Crear un ecosistema blockchain integral que permite a empresas de **16 industrias diferentes** automatizar sus operaciones mediante contratos inteligentes, agentes de IA y tokens programables, reduciendo costos operativos y eliminando intermediarios.

### Características Fundamentales

| Característica | Descripción |
|---|---|
| **Tipo** | Blockchain Layer 2 (OP Stack) |
| **Consenso** | Optimistic Rollup (hereda seguridad de Ethereum L1) |
| **Token Nativo** | BEZCoinV2 (ERC20 con gobernanza) |
| **Contratos Inteligentes** | 78+ contratos Solidity auditados |
| **Tests** | 1,147 tests (100% passing) |
| **Sectores** | 16 industrias cubiertas |
| **IA Integrada** | 4 modelos ML + 12 herramientas MCP |
| **Multi-chain** | 5 redes soportadas |

### ¿Qué Problema Resuelve?

1. **Costes elevados de intermediación** en transacciones comerciales B2B
2. **Falta de transparencia** en cadenas de suministro y procesos industriales
3. **Ineficiencia operativa** por procesos manuales y desconectados
4. **Ausencia de trazabilidad** en documentos, pagos y entregas
5. **Complejidad de adopción blockchain** para empresas tradicionales

---

## 2. Arquitectura de la Plataforma

### Stack Tecnológico

```
┌─────────────────────────────────────────────────────┐
│                   CAPA DE USUARIO                    │
│  Control Center (Next.js 16) │ BeZhas Web3 App      │
│  Panel Admin │ DeFi Frontend │ Agent Dashboard       │
├─────────────────────────────────────────────────────┤
│                   CAPA API / GATEWAY                 │
│  API REST (Express)    │  Gateway v1 (SSO + Rutas)  │
│  OpenClaw Integration  │  Agent Runtime v0.4.0      │
├─────────────────────────────────────────────────────┤
│                   CAPA DE IA                         │
│  Aegis (FastAPI/Python) │ AI-Engine MCP (Node.js)   │
│  4 Modelos ML           │ 12 Herramientas MCP       │
├─────────────────────────────────────────────────────┤
│                   CAPA BLOCKCHAIN                    │
│  78+ Smart Contracts (Solidity 0.8.20-0.8.34)      │
│  SDK v3.0.0 Multi-chain │ Bridge L2 ↔ Polygon      │
├─────────────────────────────────────────────────────┤
│                   CAPA INFRAESTRUCTURA               │
│  OP Stack (op-geth, op-node, op-batcher)            │
│  PostgreSQL │ Redis │ Docker │ Nginx WAF             │
│  Prometheus + Grafana + Loki (Monitorización)       │
└─────────────────────────────────────────────────────┘
```

### Componentes Principales

| Componente | Tecnología | Puerto | Función |
|---|---|---|---|
| **Control Center** | Next.js 16.2.1 | :3000 | Panel de gestión y dashboards |
| **API Backend** | Express/Node.js | :3001 | API REST principal (15 módulos de rutas) |
| **AI-Engine MCP** | Node.js | :3002 | Servidor MCP con 12 herramientas de IA |
| **DeFi Backend** | Node.js | :3003 | Backend para staking, farming, gobernanza |
| **Edge Node** | Node.js | :4000 | Nodos de borde DePIN (minería B2B) |
| **Aegis** | FastAPI/Python | :8001 | Motor de IA con 4 modelos ML |
| **PostgreSQL** | PostgreSQL 15 | :5432 | Base de datos principal |
| **Redis** | Redis Alpine | :6379 | Caché, pub/sub, rate limiting, colas |
| **Nginx** | Nginx | :80/:443 | Reverse proxy, WAF, TLS |
| **Blockchain L2** | op-geth | :8545 | Nodo de ejecución BeZhas L2 |

### Cadenas Soportadas (Multi-chain)

| Chain ID | Red | Uso |
|---|---|---|
| 31337 | Anvil (Local) | Desarrollo y testing |
| 2708 | BeZhas L2 | Red principal BeZhas |
| 137 | Polygon Mainnet | Interoperabilidad |
| 80002 | Polygon Amoy | Testnet |
| 11155111 | Sepolia | Testnet Ethereum |

---

## 3. Ecosistema de Sub-Aplicaciones

BeZhas-Blockchain no es una aplicación aislada, sino un **ecosistema interconectado** de plataformas que trabajan juntas:

### 3.1 Control Center (Panel de Gestión)

**Descripción:** Aplicación web principal para la administración de toda la plataforma.

- **Dashboard general** con métricas en tiempo real
- **Gestión de contratos** inteligentes desplegados
- **Panel de agentes IA** con monitorización SSE en tiempo real
- **Administración de sectores** (16 industrias)
- **Panel de validadores** y nodos
- **Reportes de paridad** SDK/Contratos
- **Login seguro** con bcrypt + SIWE (Sign-In With Ethereum)

### 3.2 BeZhas Web3 Social App

**Descripción:** Aplicación social Web3 para usuarios finales.

- **Wallet integrada** (SmartWallet con Account Abstraction)
- **Interacción social** tokenizada
- **Marketplace** de servicios por sector
- **Pagos P2P** con BEZCoin
- **Gamificación** con NFTs y logros

### 3.3 BeZhas DeFi

**Descripción:** Plataforma de finanzas descentralizadas.

- **Staking** de BEZCoin con múltiples pools y niveles
- **Yield Farming** con pares de liquidez
- **Gobernanza DAO** con votación on-chain
- **Bridge** L2 ↔ Polygon para transferencia de tokens
- **Treasury** management automatizado

### 3.4 OpenClaw (Integración de Habilidades)

**Descripción:** Sistema de descubrimiento y ejecución de habilidades cross-platform.

- **@bezhas/openclaw-unified v2.0.0**
- **PlatformDiscovery** — detecta automáticamente todos los servicios de la plataforma
- **Skills marketplace** — habilidades invocables por la IA
- **4 rutas API**: status, platforms, skills, invoke
- Conecta con todos los servicios del ecosistema

### 3.5 Edge Nodes (Red DePIN)

**Descripción:** Red de nodos de infraestructura física descentralizada.

- **Minería B2B** — empresas ejecutan nodos para validar y procesar
- **Auto-signer** para transacciones automatizadas
- **Recompensas** en BEZCoin por contribución de recursos
- **Monitorización** integrada con Aegis

### Interconexión del Ecosistema

```
                    ┌──────────────┐
                    │   Gateway    │
                    │   SSO v1     │
                    └──────┬───────┘
                           │ (Autenticación Unificada)
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  Control    │ │  Web3 App   │ │   DeFi      │
    │  Center     │ │  Social     │ │   Platform  │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼───┐  ┌────▼────┐  ┌───▼──────┐
       │ SDK v3   │  │ OpenClaw│  │ Agent    │
       │ Multi-   │  │ Skills  │  │ Runtime  │
       │ chain    │  │         │  │ v0.4.0   │
       └──────┬───┘  └────┬────┘  └───┬──────┘
              │            │           │
              └────────────┼───────────┘
                           │
                    ┌──────▼──────┐
                    │  Blockchain │
                    │  L2 + Smart │
                    │  Contracts  │
                    └─────────────┘
```

---

## 4. Productos y Funcionalidades

### 4.1 Para Empresas (B2B)

| Producto | Descripción | Beneficio |
|---|---|---|
| **Contratos Sectoriales** | Contratos inteligentes específicos por industria | Automatización de acuerdos sin intermediarios |
| **Agentes IA Sectoriales** | 4 agentes especializados por sector (64 total) | Monitorización y decisiones automatizadas |
| **Edge Nodes DePIN** | Infraestructura descentralizada de procesamiento | Ingresos pasivos por contribuir recursos |
| **SDK Multi-chain** | Kit de desarrollo para integración | Interoperabilidad con múltiples blockchains |
| **Smart Wallets** | Carteras inteligentes con Account Abstraction | UX simplificada sin necesidad de ETH para gas |

### 4.2 Para Desarrolladores

| Producto | Descripción | Beneficio |
|---|---|---|
| **@bezhas/sdk v3.0.0** | SDK JavaScript multi-chain | Acceso programático a todos los contratos |
| **API REST** | 15 módulos de rutas documentadas | Integración con cualquier backend |
| **MCP Tools** | 12 herramientas de IA invocables | IA como servicio integrado |
| **Agent Runtime** | Motor de agentes extensible con plugins | Crear lógica de automatización personalizada |
| **OpenClaw Skills** | Marketplace de habilidades | Extender funcionalidad de la plataforma |

### 4.3 Para Usuarios Finales

| Producto | Descripción | Beneficio |
|---|---|---|
| **BEZCoin Token** | Token de utilidad y gobernanza | Participar en el ecosistema |
| **DeFi (Staking/Farming)** | Finanzas descentralizadas | Rendimientos sobre tokens |
| **Gobernanza DAO** | Votación on-chain con BEZCoin | Decidir el futuro de la plataforma |
| **NFTs Sectoriales** | NFTs de certificación y trazabilidad | Prueba verificable de servicios/productos |
| **Gamificación** | Sistema de logros y recompensas | Incentivos por participación |

---

## 5. SDK, API, ABI y Contratos Inteligentes

### 5.1 SDK (@bezhas/sdk v3.0.0)

El SDK es la **interfaz programática principal** para interactuar con todos los contratos de la plataforma.

**Características:**
- **Multi-chain**: Soporte para 5 cadenas simultáneamente
- **ChainManager**: Gestión automática de proveedores y signers por cadena
- **Auto-discovery**: Carga automática de artefactos de despliegue por chainId
- **66+ contratos** disponibles en red local (31337)
- **10 contratos** desplegados en Polygon mainnet (137)

**Módulos del SDK:**

| Módulo | Funcionalidad |
|---|---|
| `contracts.js` | Registro centralizado de contratos por chain |
| `chain-manager.js` | ChainManager: providers, signers, instancias |
| `modules/ValidatorClient.js` | Registro, staking, heartbeat, secuenciación, slashing, gobernanza |
| `artifacts/` | ABIs compilados de todos los contratos |

**Ejemplo de uso:**
```javascript
const { ChainManager } = require('@bezhas/sdk');

const manager = new ChainManager();
const provider = manager.getProvider(2708); // BeZhas L2
const bezcoin = manager.getContractInstance('BEZCoinV2', 2708);
const balance = await bezcoin.balanceOf(address);
```

### 5.2 API REST (15 Módulos)

La API está construida con Express.js y expone **15 módulos de rutas**:

| Ruta | Descripción |
|---|---|
| `/api/auth` | Autenticación JWT + SIWE |
| `/api/users` | Gestión de usuarios |
| `/api/wallet` | Operaciones de wallet |
| `/api/contracts` | Interacción con contratos inteligentes |
| `/api/transactions` | Historial y gestión de transacciones |
| `/api/nfts` | Emisión y consulta de NFTs |
| `/api/analytics` | Métricas y analíticas de la plataforma |
| `/api/gas` | Monitorización de costes de gas |
| `/api/sectors` | Gestión de 16 sectores industriales |
| `/api/agents` | Registro, métricas y SSE de agentes IA |
| `/api/aegis` | Proxy a los modelos ML de Aegis |
| `/api/notifications` | Sistema de notificaciones |
| `/api/market` | Datos de mercado y precios |
| `/api/config` | Configuración de la plataforma |
| `/api/gamification` | Sistema de logros y recompensas |
| `/api/gateway/v1` | Gateway unificado (SSO, bridge, staking, farming, gobernanza, treasury, token) |
| `/api/openclaw` | Integración OpenClaw (status, platforms, skills, invoke) |

**Servicios internos:**
- `contractService.js` — Interacción con contratos on-chain
- `txService.js` — Procesamiento de transacciones
- `eventListener.js` — Escucha de eventos blockchain en tiempo real
- `gasMonitor.js` — Monitorización predictiva de gas
- `aegisService.js` — Proxy a modelos de IA
- `walletService.js` — Gestión de wallets
- `agentService.js` — Registro y métricas de agentes

### 5.3 ABI (Application Binary Interface)

Los ABIs de todos los contratos están disponibles en:

```
sdk/artifacts/contracts/
├── BEZCoinV2.sol/BEZCoinV2.json
├── StakingPool.sol/StakingPool.json
├── GovernanceSystem.sol/GovernanceSystem.json
├── ValidatorRegistry.sol/ValidatorRegistry.json
├── EdgeNodeRewards.sol/EdgeNodeRewards.json
├── SmartWallet.sol/SmartWallet.json
├── MultiSigWallet.sol/MultiSigWallet.json
├── ... (78+ contratos)
```

**Formato**: Hardhat-compatible JSON `{ contractName, sourceName, abi }`.

**Artefactos de despliegue** (direcciones por red):
```
smart-contracts/deployments/
├── 31337.json   (66 contratos - Anvil local)
├── 137.json     (10 contratos - Polygon mainnet)
├── 2708.json    (BeZhas L2 - mainnet)
```

### 5.4 Contratos Inteligentes (78+ Contratos)

#### Contratos Core

| Contrato | Función |
|---|---|
| **BEZCoinV2** | Token ERC20 con ERC20Votes (100M supply, 18 decimals) |
| **StakingPool** | Staking con niveles (tierBoost), períodos de lockup |
| **GovernanceSystem** | Gobernanza DAO con TimelockController |
| **Treasury** | Gestión del tesoro de la plataforma |
| **L1Bridge / BridgeL2** | Puente bidireccional L1↔L2 |
| **PolygonBridge** | Puente BeZhas ↔ Polygon |
| **wBEZ** | Wrapped BEZCoin para Polygon |

#### Contratos de Validación

| Contrato | Función |
|---|---|
| **ValidatorRegistry** | Registro y gestión de validadores |
| **EdgeNodeRewards** | Recompensas para nodos de borde |
| **SequencerRotation** | Rotación de secuenciadores L2 |
| **SlashingManager** | Penalización de validadores maliciosos |

#### Contratos de Wallet

| Contrato | Función |
|---|---|
| **SmartWallet** | Wallet con Account Abstraction |
| **SmartWalletFactory** | Fábrica de Smart Wallets |
| **MultiSigWallet** | Wallet multi-firma |
| **Paymaster** | Patrocinio de gas (gasless transactions) |
| **SecurityModule** | Módulo de seguridad para wallets |
| **WalletGuardian** | Guardián para recuperación de wallets |

#### Contratos Sectoriales (por industria)

Cada sector tiene contratos específicos. Ejemplo para Logística:

| Contrato | Función |
|---|---|
| **QualityEscrow** | Escrow con verificación de calidad |
| **BeZhasLogisticsNFT** | NFTs de trazabilidad logística |
| **PortAutomation** | Automatización portuaria |
| **FleetManagement** | Gestión de flotas |

#### Testing

- **1,147 tests** en total, todos pasando (0 fallos)
- **93 test suites** incluyendo tests unitarios, de integración e invariantes
- **5 suites de fuzz testing** (256 runs por test, 128K calls por invariante)
- Tests de invariantes para: L1Bridge, BridgeL2, ValidatorRegistry, SlashingManager, PolygonBridge
- Compilación con `forge build` (Foundry, via_ir=true, optimizer 200 runs)

---

## 6. Inteligencia Artificial: Aegis y AI-Engine

### 6.1 Aegis — Motor Central de IA

**Aegis** es el motor de inteligencia artificial de BeZhas, construido con **FastAPI (Python)** y expone 4 modelos de Machine Learning:

| Modelo | Función | Aplicación |
|---|---|---|
| **AnomalyDetector** | Detección de anomalías en transacciones y patrones | Seguridad, fraude, comportamiento inusual |
| **SentimentAnalyzer** | Análisis de sentimiento de textos y datos | UX, atención al cliente, mercado |
| **UXOptimizer** | Optimización de experiencia de usuario | Frontend adaptativo, mejoras de interfaz |
| **GasPredictor** | Predicción de costes de gas blockchain | Optimización de costes de transacción |

**Componentes adicionales de Aegis:**
- **DecisionEngine** — Motor de decisiones basado en múltiples modelos
- **AutoHealer** — Auto-reparación de incidentes del sistema
- **SystemMonitor** — Monitorización del estado de todos los servicios
- Base de datos: **asyncpg** (PostgreSQL asíncrono) + **Redis** para caché

### 6.2 AI-Engine MCP — Servidor de Herramientas

El **AI-Engine** actúa como servidor **MCP (Model Context Protocol)** que expone 12 herramientas de IA invocables por cualquier agente o aplicación:

| Herramienta MCP | Función |
|---|---|
| `analyze-gas` | Análisis de consumo de gas |
| `verify-compliance` | Verificación de cumplimiento normativo |
| `analyze-sentiment` | Análisis de sentimiento |
| `system-health` | Estado de salud del sistema |
| `audit-contract` | Auditoría de contratos inteligentes |
| `predict-demand` | Predicción de demanda |
| `score-supplier` | Puntuación de proveedores |
| `calculate-smart-swap` | Cálculo inteligente de swaps |
| `monitor-edge-node` | Monitorización de nodos de borde |
| `assess-fraud-risk` | Evaluación de riesgo de fraude |
| `optimize-route` | Optimización de rutas logísticas |
| `analyze-market` | Análisis de mercado |

**Invocación:**
```
POST /api/mcp/invoke
{ "tool": "analyze-gas", "params": { "contractAddress": "0x..." } }
```

### 6.3 Beneficios de la IA Integrada

1. **Reducción de costes**: GasPredictor optimiza el momento de las transacciones
2. **Seguridad proactiva**: AnomalyDetector identifica amenazas antes de que impacten
3. **Decisiones automatizadas**: DecisionEngine combina múltiples modelos para recomendaciones
4. **Auto-reparación**: AutoHealer resuelve incidentes sin intervención humana
5. **UX adaptativa**: UXOptimizer mejora la interfaz basándose en patrones de uso
6. **Cumplimiento**: verify-compliance automatiza auditorías regulatorias

---

## 7. Agent Runtime: Automatización Inteligente

### 7.1 Descripción

El **Agent Runtime v0.4.0** es el motor de ejecución de agentes inteligentes de la plataforma. Permite crear, desplegar y gestionar agentes autónomos que operan sobre los contratos inteligentes y la IA.

### 7.2 Arquitectura del Runtime

**Core (8 módulos):**

| Módulo | Función |
|---|---|
| **ToolRegistry** | Registro centralizado de herramientas |
| **PermissionEngine** | Control de permisos y rate limiting por usuario/herramienta |
| **CommandRouter** | Enrutamiento de comandos con aliases |
| **SessionManager** | Gestión de sesiones de usuario |
| **PluginLoader** | Auto-descubrimiento y carga de plugins |
| **ParityChecker** | Validación de paridad SDK ↔ ABIs ↔ contratos |
| **CircuitBreaker** | Protección con estados CLOSED/OPEN/HALF_OPEN |
| **RuntimeEventBus** | Bus de eventos con streaming SSE |

### 7.3 Herramientas (24+)

| Categoría | Herramientas | Cantidad |
|---|---|---|
| **Core** | bridge-health, validator-status, gas-analytics | 3 |
| **MCP Proxy** | Todas las herramientas del AI-Engine como `mcp:{name}` | 12 |
| **Deploy** | deploy-check (validación en cualquier cadena) | 1 |
| **Plugins** | logistics (2), defi (2), governance (2) | 6 |
| **Sprint 4** | incident-report (Aegis AutoHealer), sector-query (16 sectores) | 2 |

### 7.4 Comandos (8+)

| Comando | Alias | Función |
|---|---|---|
| `/bridge-health` | bh | Estado del puente L2↔Polygon |
| `/validator-status` | vs | Estado de validadores |
| `/parity-audit` | pa, parity | Auditoría de paridad SDK/Contratos |
| `/deploy-check` | dc, deploy | Verificación de despliegue |
| `/logistics` | log | Operaciones logísticas |
| `/defi` | — | Operaciones DeFi |
| `/governance` | gov | Operaciones de gobernanza |
| `/incident` | inc | Crear reporte de incidente |

### 7.5 Plugins Sectoriales

El sistema de plugins permite extender el runtime con funcionalidad específica por sector:

- **Logistics Plugin**: tracking de envíos, verificación de calidad
- **DeFi Plugin**: consulta de pools, estados de farming
- **Governance Plugin**: propuestas activas, estado de votación

### 7.6 API del Runtime (11 endpoints)

```
GET  /health          — Estado del runtime
GET  /tools           — Lista de herramientas disponibles
GET  /commands        — Lista de comandos disponibles
GET  /plugins         — Plugins cargados
GET  /parity          — Reporte de paridad
GET  /circuits        — Estado de circuit breakers
GET  /stream          — SSE streaming de eventos
POST /invoke          — Invocar herramienta
POST /command         — Ejecutar comando
GET  /session         — Obtener sesión
DELETE /session       — Eliminar sesión
```

### 7.7 Agentes Sectoriales

Cada uno de los 16 sectores tiene **4 agentes especializados** (64 agentes en total), más los 6 agentes core de logística:

**Estructura por sector:**
- `AgentDashboard.jsx` — Panel de control del sector
- `AgentMetrics.jsx` — Métricas y KPIs
- `AgentConfig.jsx` — Configuración de agentes
- `AgentActions.jsx` — Acciones y operaciones

---

## 8. Sectores de Operación (16 Industrias)

BeZhas cubre **16 sectores industriales**, cada uno con contratos inteligentes dedicados, agentes IA especializados y lógica de automatización específica:

### Matriz de Sectores

| # | Sector | Contratos | Agentes IA | Caso de Uso Principal |
|---|---|---|---|---|
| 1 | **Logística** | QualityEscrow, LogisticsNFT, PortAutomation, FleetManagement | 6 agentes | Trazabilidad portuaria, gestión de flotas, escrow de calidad |
| 2 | **Inmobiliario** | PropertyRegistry, RentalContract, RealEstateNFT | 4 agentes | Registro de propiedades, contratos de alquiler tokenizados |
| 3 | **Salud** | MedicalRecords, InsuranceClaim, PharmaSupply | 4 agentes | Historial médico inmutable, reclamaciones automáticas |
| 4 | **Energía** | EnergyTrading, GreenCertificate, GridManagement | 4 agentes | Trading P2P de energía, certificados verdes |
| 5 | **Automotriz** | VehicleRegistry, PartTraceability, ServiceRecord | 4 agentes | Trazabilidad de piezas, historial de servicio |
| 6 | **Manufactura** | ProductionTracker, QualityControl, SupplierRating | 4 agentes | Control de calidad automatizado, rating de proveedores |
| 7 | **Agricultura** | CropInsurance, FarmToFork, HarvestCertification | 4 agentes | Seguro de cosechas, trazabilidad farm-to-fork |
| 8 | **Seguros** | PolicyManager, ClaimProcessor, RiskAssessment | 4 agentes | Gestión de pólizas, procesamiento de reclamaciones |
| 9 | **Educación** | CredentialVerifier, CourseRegistry, AcademicRecord | 4 agentes | Verificación de credenciales, registros académicos |
| 10 | **Entretenimiento** | EventTicketing, RoyaltyDistribution, ContentLicense | 4 agentes | Ticketing con NFTs, distribución de royalties |
| 11 | **Legal** | ContractRegistry, DiputeResolution, EvidenceVault | 4 agentes | Registro inmutable de contratos, resolución de disputas |
| 12 | **Supply Chain** | 8 contratos (4 estándar + 4 extras con cross-deps) | 4 agentes | Cadena de suministro completa con dependencias cruzadas |
| 13 | **Gobierno** | PublicProcurement, VoterRegistry, TransparencyLedger | 4 agentes | Licitaciones transparentes, registro de votantes |
| 14 | **Finanzas** | LoanManager, CreditScoring, PaymentProcessor | 4 agentes | Préstamos automatizados, scoring crediticio on-chain |
| 15 | **Servicios** | ServiceMarketplace, ReviewSystem, FreelancerEscrow | 4 agentes | Marketplace de servicios, escrow para freelancers |
| 16 | **Otros** | GenericContract, CustomWorkflow, MultiPartyAgreement | 4 agentes | Contratos genéricos personalizables |

### Beneficios de la Automatización por Sector

**Ejemplo: Sector Logístico (Puertos)**
- ⏱ **Tiempo de despacho aduanero**: De días a minutos con contratos inteligentes
- 💰 **Ahorro en intermediarios**: Eliminación de agentes portuarios manuales
- 📊 **Trazabilidad 100%**: Cada contenedor rastreable en blockchain
- 🤖 **Agentes IA**: Monitorización predictiva de rutas y tiempos
- 🏭 **DePIN**: Nodos edge en puertos para procesamiento local

**Ejemplo: Sector Salud**
- 📋 **Historial médico**: Registro inmutable accesible por paciente y médico
- 💊 **Farmacia**: Trazabilidad completa de medicamentos
- 🏥 **Reclamaciones**: Procesamiento automático de seguros médicos
- 🔒 **Privacidad**: Datos encriptados con acceso controlado por el paciente

---

## 9. Tokenomics: BEZCoinV2

### Especificaciones del Token

| Parámetro | Valor |
|---|---|
| **Nombre** | BEZCoinV2 |
| **Estándar** | ERC20 + ERC20Votes |
| **Supply Total** | 100,000,000 BEZ |
| **Decimales** | 18 |
| **Gobernanza** | Sí (delegación de votos on-chain) |
| **Wrapped** | wBEZ (para Polygon) |

### Token Wrapped: wBEZ

- **wBEZ** se utiliza en Polygon mainnet para interoperabilidad
- Bridge bidireccional L2 ↔ Polygon
- Mismo valor 1:1 con BEZCoin nativo

### Utilidades del Token

```
BEZCoinV2
├── 💼 GAS — Pago de transacciones en BeZhas L2
├── 🏦 STAKING — Bloquear tokens para obtener rendimientos
├── 🌾 FARMING — Proveer liquidez para yield farming
├── 🗳️ GOBERNANZA — Votar propuestas de la DAO
├── 🏗️ VALIDACIÓN — Stake para operar como validador
├── 🎮 GAMIFICACIÓN — Recompensas por participación
├── 💱 BRIDGE — Transferir entre L2 y Polygon
├── 🏪 MARKETPLACE — Pago de servicios sectoriales
└── ⛏️ DePIN — Recompensas por Edge Nodes
```

### Flujo Económico

```
[Empresas]──compran BEZ──▶[Staking Pools]──generan──▶[Rendimientos]
     │                           │
     ▼                           ▼
[Pagan servicios]          [Validadores]──reciben──▶[Recompensas]
     │                           │
     ▼                           ▼
[Agentes IA]──cobran──▶[Treasury]──distribuye──▶[Holders DAO]
     │
     ▼
[Edge Nodes]──minan──▶[EdgeNodeRewards]──pagan──▶[Operadores]
```

---

## 10. DeFi: Staking, Farming y Gobernanza

### 10.1 Staking

- **Múltiples pools** con diferentes períodos de bloqueo
- **Sistema de niveles (tiers)** con bonificación por nivel
- **Recompensas automáticas** calculadas on-chain
- **Contrato**: StakingPool con tierBoost

### 10.2 Yield Farming

- **Pares de liquidez** con BEZCoin
- **APY variable** según oferta y demanda
- **Recolección automática** de rewards

### 10.3 Gobernanza DAO

- **Propuestas on-chain** creadas por holders
- **Votación** con peso basado en BEZCoin delegado (ERC20Votes)
- **TimelockController** para ejecución segura de propuestas aprobadas
- **Transparencia total** — todas las votaciones son públicas y verificables

### 10.4 Bridge (Puente)

- **L1Bridge + BridgeL2**: Puente bidireccional L1 ↔ L2
- **PolygonBridge**: Puente BeZhas L2 ↔ Polygon
- **wBEZ**: Token wrapped para Polygon
- **Tests de invariantes** aseguran que los fondos nunca se pierden en tránsito

---

## 11. Seguridad y Cumplimiento

### Capas de Seguridad

| Capa | Medidas |
|---|---|
| **Red (Nginx WAF)** | TLS 1.2/1.3, HSTS, bloqueo path traversal, XSS, SQLi, LFI, scanners |
| **API** | JWT + SIWE, rate limiting (30r/s API, 5r/s auth), bcrypt para admin |
| **Blockchain** | Smart contracts auditados, fuzz testing (256 runs), invariant testing |
| **Aplicación** | RBAC (control de acceso por roles), audit logging |
| **Infraestructura** | Contenedores non-root, multi-stage builds, secretos en .env |
| **Monitorización** | Aegis AnomalyDetector, circuit breakers, alertas en tiempo real |

### Seguridad de Contratos

- **1,147 tests** incluyendo tests de invariantes y fuzz
- **5 suites de invariantes** para contratos críticos (bridges, validadores, slashing)
- **Slither** análisis estático integrado en CI/CD
- **OpenZeppelin v5** como base segura para todos los contratos

### WAF (Web Application Firewall)

```
Protecciones Nginx:
├── Bloqueo de path traversal (../, %2e%2e)
├── Bloqueo de XSS (<script>, javascript:)
├── Bloqueo de SQLi (UNION, SELECT, DROP)
├── Bloqueo de LFI (/etc/passwd, /proc/)
├── Bloqueo de scanner bots (UA filtering)
├── Bloqueo de extensiones (.php, .asp, wp-admin)
├── Límite de conexiones (20/IP)
├── Rate limiting con zonas diferenciadas
└── /metrics endpoint bloqueado públicamente
```

---

## 12. Infraestructura DevOps y Monitorización

### CI/CD (GitHub Actions)

```yaml
# .github/workflows/ci.yml — 6 jobs:
1. contracts    — Compilación y tests Foundry
2. api-tests    — Tests Jest de la API (130 tests)
3. frontend     — Build Next.js
4. playwright   — Tests E2E (12 tests)
5. docker-push  — Push imágenes a ghcr.io
6. slither      — Análisis de seguridad estático
```

### Docker

- **Todos los servicios** containerizados con Docker
- **Multi-stage builds** para imágenes optimizadas
- **Usuario non-root** (bezhas) en todos los contenedores
- **Healthchecks** integrados en cada servicio
- **3 compose files**: base, dev (sin OP Stack), prod (con Nginx)

### Monitorización (Prometheus + Grafana + Loki)

```
┌────────────┐   ┌──────────┐   ┌────────┐
│ API :3001  │──▶│Prometheus│──▶│Grafana │ (:3030)
│ Aegis:8001 │   │          │   │12 panels│
├────────────┤   └──────────┘   └────────┘
│ PostgreSQL │──▶  postgres-exporter
│ Redis      │──▶  redis-exporter
│ Containers │──▶  node-exporter
├────────────┤   ┌────────┐
│ Docker logs│──▶│ Loki   │ (via Promtail)
└────────────┘   └────────┘
```

**Dashboard Grafana (12 paneles):**
- API: tasa de peticiones, latencia, errores
- Aegis: estado de modelos ML
- PostgreSQL: conexiones, queries
- Redis: hit rate, memoria
- Infraestructura: CPU, memoria, disco
- Logs centralizados vía Loki

---

## 13. Beneficios y Propuesta de Valor

### Para Empresas

| Beneficio | Impacto |
|---|---|
| **Eliminación de intermediarios** | Reducción de costes de transacción del 40-70% |
| **Automatización completa** | Contratos que se ejecutan solos al cumplirse condiciones |
| **Trazabilidad inmutable** | Confianza total en la cadena de suministro |
| **IA integrada** | Decisiones basadas en datos en tiempo real |
| **Multi-sector** | Una plataforma para todas las operaciones |
| **Interoperabilidad** | Conexión con Polygon y Ethereum |

### Para Desarrolladores

| Beneficio | Impacto |
|---|---|
| **SDK completo** | Integración en horas, no semanas |
| **12 herramientas MCP** | IA como servicio sin configuración |
| **Plugin system** | Extensibilidad sin modificar el core |
| **Documentación** | API, contratos y SDK documentados |
| **Tests robustos** | 1,147 tests como referencia |

### Para Inversores

| Beneficio | Impacto |
|---|---|
| **16 sectores** | Diversificación de mercado extrema |
| **Token de utilidad real** | BEZCoin tiene uso real en la plataforma |
| **DeFi integrado** | Rendimientos para holders |
| **Gobernanza** | Participación en decisiones |
| **Edge nodes (DePIN)** | Modelo B2B de ingresos recurrentes |

---

## 14. Rentabilidad y Modelo de Negocio

### Fuentes de Ingreso

```
1. COMISIONES DE TRANSACCIÓN (Gas)
   └── Cada transacción en BeZhas L2 paga gas en BEZCoin

2. STAKING POOLS
   └── Comisión sobre rendimientos generados

3. BRIDGE FEES
   └── Comisión por transferencias L2 ↔ Polygon

4. SERVICIOS DE IA (Aegis)
   └── Consultas a modelos ML (pay-per-use o suscripción)

5. EDGE NODES (DePIN)
   └── Fee por procesamiento en nodos de borde

6. MARKETPLACE SECTORIAL
   └── Comisión sobre transacciones de servicios

7. NFTs SECTORIALES
   └── Fee de minting de NFTs de certificación

8. LICENCIAS SDK
   └── Uso empresarial del SDK y herramientas
```

### Modelo de Costes y Comisiones

| Operación | Coste Estimado | Comisión BeZhas |
|---|---|---|
| Transacción L2 | ~$0.001-0.01 (gas) | Incluido en gas |
| Bridge L2→Polygon | Variable | 0.1-0.5% |
| Staking rewards | APY variable | 5-10% de rewards |
| NFT minting | Gas + fee fijo | Fee configurable |
| AI consultation | Per-call pricing | $0.01-0.10/call |
| Edge node rewards | BEZ por contribución | Auto-calculado |

### Ventaja Competitiva

1. **L2 propia** — Control total sobre costes de gas (fracción de L1)
2. **Multi-sector** — Única plataforma blockchain cubriendo 16 industrias
3. **IA nativa** — No es un add-on, está integrada en el core
4. **DePIN** — Modelo de infraestructura descentralizada B2B
5. **Gobernanza real** — DAO con TimelockController para decisiones transparentes

---

## 15. Métricas Clave del Proyecto

### Desarrollo

| Métrica | Valor |
|---|---|
| Contratos Solidity | 78+ |
| Tests totales | 1,147 (100% passing) |
| Test suites | 93 |
| Tests fuzz/invariantes | 5 suites (256 runs, 128K calls) |
| API tests (Jest) | 130 |
| E2E tests (Playwright) | 12 |
| Agent Runtime tests | 207 |
| Runtime API endpoints | 11 |
| Herramientas MCP | 12 |
| Herramientas Agent Runtime | 24+ |
| Comandos Runtime | 8+ |
| Plugins Runtime | 3 |
| Sectores industriales | 16 |
| Agentes IA sectoriales | 70 (6 logistics + 64 sectoriales) |
| Módulos API | 15+ rutas |
| Modelos ML (Aegis) | 4 |
| Cadenas soportadas | 5 |
| Contratos Anvil | 66 |
| Contratos Polygon | 10 |
| Docker services | 10 |

### Performance (k6 Load Test)

| Métrica | Valor |
|---|---|
| Iteraciones | 9,838 |
| Latencia p(95) | 11.2ms |
| Tasa de error | 0% |
| Virtual Users | 100 |

### CI/CD

| Job | Estado |
|---|---|
| Contracts build + test | ✅ |
| API tests | 130/130 ✅ |
| Frontend build | ✅ |
| Playwright E2E | 12/12 ✅ |
| Docker push | ✅ |
| Slither security | ✅ |

---

## 16. Roadmap y Estado Actual

### Fases Completadas ✅

| Fase | Descripción | Estado |
|---|---|---|
| Fase 1-2 | Smart contracts core + DeFi | ✅ Completa |
| Fase 3-11 | 16 sectores con contratos + tests + agentes | ✅ Completa |
| Fase 12 | Supply Chain + Validación | ✅ Completa |
| Fase 13A | Seguridad pre-deploy (fuzz + invariantes) | ✅ Completa |
| Fase 8 DevOps | CI/CD, Docker, monitorización, WAF | ✅ Completa |
| SDK v3.0.0 | Multi-chain + OpenClaw unificado | ✅ Completa |
| Agent Runtime | 4 sprints completos (v0.4.0) | ✅ Completa |
| Control Center | Frontend Next.js + dashboards | ✅ Completa |

### Próximos Pasos

| Fase | Descripción | Prioridad |
|---|---|---|
| Mainnet L2 | Despliegue de BeZhas L2 en producción | Alta |
| Auditoría externa | Auditoría de contratos por terceros | Alta |
| Token launch | Lanzamiento de BEZCoinV2 en mercados | Media |
| Edge nodes piloto | Prueba piloto de nodos DePIN en puertos | Media |
| Partnerships sectoriales | Acuerdos con empresas de cada sector | Media |

---

## 17. Glosario Técnico

| Término | Definición |
|---|---|
| **L2 (Layer 2)** | Cadena secundaria que hereda la seguridad de Ethereum L1 |
| **OP Stack** | Framework de Optimism para crear blockchains L2 |
| **ERC20** | Estándar de tokens fungibles en Ethereum |
| **ERC20Votes** | Extensión de ERC20 con capacidad de gobernanza |
| **DAO** | Organización Autónoma Descentralizada |
| **DeFi** | Finanzas Descentralizadas |
| **DePIN** | Redes de Infraestructura Física Descentralizada |
| **MCP** | Model Context Protocol — estándar de herramientas de IA |
| **SDK** | Kit de Desarrollo de Software |
| **ABI** | Interfaz Binaria de Aplicación (define cómo interactuar con contratos) |
| **SIWE** | Sign-In With Ethereum — autenticación con wallet |
| **NFT** | Token No Fungible — activo digital único |
| **WAF** | Web Application Firewall — protección de aplicaciones web |
| **SSE** | Server-Sent Events — streaming de datos en tiempo real |
| **Fuzz testing** | Testing con entradas aleatorias para encontrar vulnerabilidades |
| **Invariant testing** | Testing que verifica que propiedades nunca se violan |
| **Bridge** | Puente para transferir tokens entre blockchains |
| **Staking** | Bloqueo de tokens para obtener recompensas |
| **Yield Farming** | Provisión de liquidez para obtener rendimientos |
| **Circuit Breaker** | Patrón de protección que aísla servicios con fallos |
| **Paymaster** | Contrato que patrocina gas para transacciones sin coste |
| **Slashing** | Penalización económica a validadores maliciosos |

---

> **Documento generado:** 2026-04-04  
> **Versión:** 1.0  
> **Proyecto:** BeZhas-Blockchain Platform  
> **Uso:** Guía para informes, documentación y presentaciones
