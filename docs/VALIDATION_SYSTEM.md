# BeZhas Blockchain — Sistema de Validación Corporativa

> Guía técnica completa: cómo funciona la validación, cómo instalar un nodo, y cómo ganar recompensas en BEZ-Coin.
> Versión: 1.0 | Fecha: 2026-03-23

---

## Tabla de Contenidos

1. [Resumen del Sistema](#1-resumen-del-sistema)
2. [Arquitectura de Validación](#2-arquitectura-de-validación)
3. [Tiers Corporativos](#3-tiers-corporativos)
4. [Contratos del Sistema](#4-contratos-del-sistema)
5. [Flujos de Validación](#5-flujos-de-validación)
6. [Instalación del Nodo Validador](#6-instalación-del-nodo-validador)
7. [Registro como Validador On-Chain](#7-registro-como-validador-on-chain)
8. [Recompensas y Cómo se Calculan](#8-recompensas-y-cómo-se-calculan)
9. [Sistema de Penalidades (Slashing)](#9-sistema-de-penalidades-slashing)
10. [Gobernanza DAO](#10-gobernanza-dao)
11. [Referencia de Configuración](#11-referencia-de-configuración)
12. [FAQ](#12-faq)

---

## 1. Resumen del Sistema

BeZhas utiliza un modelo híbrido de validación **PoA + PoS + Proof of Contribution (PoC)** diseñado para empresas B2B. A diferencia de blockchains públicas donde individuos compiten por recompensas, en BeZhas **las empresas instalan nodos que validan datos de negocio** (IoT, trazabilidad, compliance) y ganan BEZ-Coin proporcional a:

1. **Capital bloqueado (Stake)** — Cuánto BEZ tiene en staking.
2. **Contribución operacional** — Cuántos datos valida su nodo (DePIN mining).
3. **Participación en gobernanza** — Votar en la DAO.

### ¿Qué valida un nodo BeZhas?

- Datos de sensores IoT (temperatura, GPS, humedad)
- Trazabilidad de supply chain (checkpoints de envíos)
- Verificación de cumplimiento regulatorio (compliance checks via Aegis AI)
- Transacciones de contratos inteligentes sectoriales (salud, energía, automotriz, etc.)
- Producción de bloques L2 (sequencer rotation para nodos Gold/Platinum)

---

## 2. Arquitectura de Validación

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      BEZHAS L2 — VALIDATION ECOSYSTEM                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐     ┌──────────────────┐     ┌────────────────────┐      │
│   │  BEZCoinV2   │────▶│ValidatorRegistry │◀────│  SlashingManager   │      │
│   │ (Token+Votes)│     │  (Core Registry)  │     │    (Penalidades)   │      │
│   └──────┬───────┘     └───────┬──────────┘     └────────────────────┘      │
│          │                     │                                             │
│          │              ┌──────┴──────┐                                      │
│          │              ▼             ▼                                       │
│          │    ┌─────────────┐  ┌──────────────────┐                          │
│          │    │EdgeNodeRewards│  │SequencerRotation │                         │
│          │    │ (DePIN Mining)│  │ (Block Producer)  │                         │
│          │    └──────────────┘  └──────────────────┘                          │
│          │                                                                   │
│          ▼                                                                   │
│   ┌──────────────┐     ┌──────────────────┐     ┌────────────────────┐      │
│   │ StakingPool  │     │GovernanceSystem  │     │  Edge Node Server  │      │
│   │(Passive Yield)│     │    (DAO B2B)     │     │   (Port 4000)      │      │
│   └──────────────┘     └──────────────────┘     └────────────────────┘      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

INFRAESTRUCTURA L2 (OP Stack):
┌────────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────┐
│  op-geth   │  │ op-node  │  │  op-batcher   │  │  Aegis   │
│  (:8545)   │  │ (:5052)  │  │  (L1 poster)  │  │ AI (:8001)│
└────────────┘  └──────────┘  └──────────────┘  └──────────┘
```

### Componentes Clave

| Componente | Rol | Puerto |
|-----------|-----|--------|
| **op-geth** | Motor de ejecución L2 (EVM) | 8545 (RPC), 8546 (WS) |
| **op-node** | Consenso L2, sequencer mode | 5052 |
| **op-batcher** | Publica batches a L1 (Sepolia) | — |
| **Edge Node** | Relay de datos ERP → L2 | 4000 |
| **Aegis AI** | Compliance check, anomaly detection | 8001 |
| **MCP Server** | Herramientas AI para validación | 3002 |
| **API Backend** | Gestión empresarial, auth, DB | 3001 |

---

## 3. Tiers Corporativos

El sistema usa 4 niveles basados en la cantidad de BEZ-Coin bloqueado en stake:

| Tier | Nombre | Stake Mínimo | Boost de Recompensa | Productor de Bloques | Propuestas DAO |
|------|--------|-------------|--------------------|-----------------------|----------------|
| 1 | **Bronze** | 10,000 BEZ | 1.0x (base) | No | No (< 10K threshold) |
| 2 | **Silver** | 50,000 BEZ | 1.25x | No | Sí |
| 3 | **Gold** | 250,000 BEZ | 1.5x | **Sí** | Sí |
| 4 | **Platinum** | 1,000,000 BEZ | 2.0x | **Sí** (prioridad) | Sí |

### Beneficios por Tier

**Bronze (10K BEZ):**
- Registro como validador activo
- Participación en DePIN mining (recompensas base 1x)
- Acceso a contratos sectoriales

**Silver (50K BEZ):**
- Todo lo de Bronze
- Boost de recompensas 1.25x
- Capacidad de crear propuestas en DAO (requiere ≥10K BEZ delegados)

**Gold (250K BEZ):**
- Todo lo de Silver
- Boost de recompensas 1.5x
- **Elegible como sequencer** (productor de bloques)
- 50% de transaction fees durante su turno como sequencer

**Platinum (1M BEZ):**
- Todo lo de Gold
- Boost de recompensas **2.0x** (el doble vs base)
- **Prioridad** en la cola de sequencer (ordenado por stake)
- Mayor peso en gobernanza (más votos delegados)

---

## 4. Contratos del Sistema

### 4.1 ValidatorRegistry.sol — Registro Central

El contrato núcleo que gestiona registro, tiers, stake, heartbeats y contribuciones.

```
Ubicación: smart-contracts/src/core/ValidatorRegistry.sol
Roles: DEFAULT_ADMIN_ROLE, ORACLE_ROLE, SLASHER_ROLE
```

**Funciones principales:**
| Función | Quién la llama | Descripción |
|---------|---------------|-------------|
| `registerValidator(name, amount)` | Empresa | Registrarse con stake mínimo 10K BEZ |
| `addStake(amount)` | Validador | Agregar stake (puede subir de tier) |
| `initiateUnbonding(amount)` | Validador | Iniciar retiro (7 días de espera) |
| `completeWithdraw()` | Validador | Completar retiro después del periodo |
| `heartbeat()` | Nodo | Probar que sigue vivo (llamar cada <4h) |
| `recordContribution(addr, points, task)` | Oracle | Registrar contribución de validador |
| `slash(addr, amount, reason)` | SlashingManager | Penalizar validador |
| `reactivateValidator(stakeAmount)` | Validador | Reactivar después de penalización |
| `getRewardBoost(addr)` | EdgeNodeRewards/StakingPool | Consultar multiplicador de tier |

### 4.2 EdgeNodeRewards.sol — Recompensas DePIN

Gestiona las recompensas por procesamiento de datos en el edge node.

```
Ubicación: smart-contracts/src/core/EdgeNodeRewards.sol
Roles: DEFAULT_ADMIN_ROLE, ORACLE_ROLE
Dependencias: ValidatorRegistry, BEZCoinV2
```

**Puntos por tipo de tarea:**
| Tarea | Puntos |
|-------|--------|
| IoT Traceability | 5 |
| AI Image Verification | 10 |
| Compliance Check | 15 |
| Supply Chain Validation | 8 |
| Smart Contract Deploy | 20 |
| DAO Vote Participation | 3 |
| Enterprise Referral | 50 |

### 4.3 SequencerRotation.sol — Rotación de Bloques

Gestiona qué validador Gold/Platinum produce bloques en cada epoch.

```
Ubicación: smart-contracts/src/core/SequencerRotation.sol
Roles: DEFAULT_ADMIN_ROLE, ROTATION_MANAGER_ROLE
Epoch: 7200 bloques (~4 horas a 2s/bloque)
Fee Share: 50% de fees de transacciones para el sequencer activo
```

### 4.4 SlashingManager.sol — Sistema de Penalidades

5 tipos de infracciones con penalidades proporcionales:

| Infracción | Penalidad | Detectado por |
|-----------|-----------|---------------|
| Downtime (>4h sin heartbeat) | 2% del stake | SLASHER_ROLE |
| Datos fraudulentos | 5% del stake | AEGIS_AI_ROLE |
| Inactividad DAO (3+ votos perdidos) | 1% del stake | SLASHER_ROLE |
| Fallo como sequencer | 3% del stake | SLASHER_ROLE |
| Doble firma | 10% del stake | SLASHER_ROLE |

**Protecciones:**
- Cooldown: 24 horas entre penalidades al mismo validador
- Máximo: 25% del stake penalizable en 30 días
- Apelaciones: el validador apela → admin/DAO revierte si procede

### 4.5 BEZCoinV2.sol — Token Nativo

```
Estándar: ERC20 + ERC20Burnable + ERC20Permit + ERC20Votes + AccessControl
Supply: 100,000,000 BEZ (pre-minted)
Decimales: 18
Clock Mode: timestamp (para gobernanza)
```

ERC20Votes permite delegar poder de voto para la DAO sin mover tokens.

### 4.6 GovernanceSystem.sol — DAO Corporativa

```
Voting Delay: 1 día
Voting Period: 7 días
Proposal Threshold: 10,000 BEZ
Quorum: 4% de votos delegados
Timelock: ejecución diferida con TimelockController
```

### 4.7 StakingPool.sol — Staking Pasivo

Staking simple de BEZ con recompensas potenciadas por tier de validador:
- Validador Platinum: 2x recompensas
- No-validador: 1x base

---

## 5. Flujos de Validación

### Flujo 1: Registro de Empresa como Validador

```
Empresa adquiere BEZ-Coin
    → Aprueba transferencia: bez.approve(registryAddress, amount)
    → Registra: registry.registerValidator("Mi Empresa", 250000e18)
    → Se asigna Tier 3 (Gold) automáticamente
    → Se activa como validador + elegible sequencer
    → Instala Edge Node en su servidor
```

### Flujo 2: Validación de Datos (DePIN Mining)

```
ERP (SAP/Oracle/Shopify) envía webhook
    → Edge Node (:4000) recibe POST /webhook/logistics
    → auto-signer.js verifica compliance via Aegis AI
    → Si aprobado: firma tx con PRIVATE_KEY del nodo
    → Envía a QualityEscrow.registerSensorData() en L2
    → Oracle registra puntos en EdgeNodeRewards
    → Empresa acumula puntos de contribución
```

### Flujo 3: Reclamo de Recompensas

```
Empresa llama EdgeNodeRewards.claimRewards()
    → baseReward = puntosAcumulados × 1 BEZ por punto
    → boost = registry.getRewardBoost(empresa)  // ej: 15000 = 1.5x Gold
    → recompensaFinal = (baseReward × boost) / 10000
    → Transferencia de BEZ al operador
    → Puntos de contribución sincronizados al ValidatorRegistry
```

### Flujo 4: Producción de Bloques (Sequencer)

```
Solo validadores Gold/Platinum participan:
    → ROTATION_MANAGER llama refreshSequencerQueue()
    → Cola ordenada por stake (mayor primero)
    → Cada epoch (7200 bloques ≈ 4h):
        → advanceEpoch() rota al siguiente en cola
        → Sequencer activo produce bloques en op-geth
        → Recibe 50% de transaction fees del epoch
    → Si falla: forceRotation() + slashForSequencerFailure()
```

### Flujo 5: Gobernanza

```
Validador Silver+ delega votos: bez.delegate(self)
    → Crea propuesta en GovernanceSystem (requiere ≥10K BEZ)
    → 1 día de espera (voting delay)
    → 7 días de votación
    → Si aprobada + quorum 4%: se encola en TimelockController
    → Ejecución diferida (seguridad)
    → ¡Ojo! 3 votos perdidos = 1% slash por inactividad DAO
```

---

## 6. Instalación del Nodo Validador

### Requisitos del Servidor

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 4 cores | 8 cores |
| RAM | 8 GB | 16 GB |
| Almacenamiento | 100 GB SSD | 500 GB NVMe |
| Red | 50 Mbps | 100+ Mbps |
| OS | Ubuntu 22.04 / Debian 12 | Ubuntu 24.04 LTS |
| Docker | 24.0+ | 27.0+ |
| Docker Compose | v2.20+ | v2.30+ |

### 6.1 — Instalación Rápida (Docker)

```bash
# 1. Clonar el repositorio
git clone https://github.com/bezhas/bezhas-blockchain.git
cd bezhas-blockchain

# 2. Copiar y configurar variables de entorno
cp .env.example .env
```

Editar `.env` con los datos de tu empresa:

```env
# === Nodo L2 ===
RPC_URL=http://bezhas-geth:8545
L2_CHAIN_ID=2708

# === Edge Node (tu nodo validador) ===
EDGE_NODE_PRIVATE_KEY=0x_TU_CLAVE_PRIVADA_AQUI
EDGE_NODE_API_KEY=tu_api_key_segura_generada
ESCROW_CONTRACT_ADDRESS=0x_DIRECCION_DEL_CONTRATO

# === Conexión a Aegis AI ===
MCP_URL=http://ai-gateway:3002

# === Base de datos local ===
POSTGRES_USER=bezhas_user
POSTGRES_PASSWORD=tu_password_seguro
POSTGRES_DB=bezhas_db

# === Redis ===
REDIS_URL=redis://redis:6379
```

> **SEGURIDAD:** Nunca compartas tu `EDGE_NODE_PRIVATE_KEY`. Esta clave firma transacciones en nombre de tu empresa.

```bash
# 3. Levantar el stack completo (10 servicios)
docker compose up -d

# 4. Verificar que todos los servicios están saludables
docker compose ps

# Output esperado:
# bezhas-geth        running (healthy)
# bezhas-node        running (healthy)
# bezhas-batcher     running
# bezhas-edge-node   running (healthy)   ← Tu nodo validador
# api                running (healthy)
# aegis              running (healthy)
# ai-gateway         running (healthy)
# postgres           running (healthy)
# redis              running (healthy)
# control-center     running (healthy)
```

```bash
# 5. Verificar salud del edge node
curl http://localhost:4000/health

# Respuesta esperada:
# {"status":"ok","node":"BeZhas Edge Relay","version":"1.0.0"}

# 6. Verificar conexión a la L2
curl http://localhost:4000/network/stats

# Respuesta esperada:
# {"chain_id":2708,"status":"connected","block_height":12345,"gas_price_gwei":"0.001"}
```

### 6.2 — Instalación Manual (sin Docker)

```bash
# Requisitos: Node.js 20+, npm 10+
# 1. Instalar dependencias del edge node
cd bezhas-edge-node
npm install

# 2. Configurar .env
cat > .env << 'EOF'
PORT=4000
RPC_URL=https://rpc.bezhas.network
PRIVATE_KEY=0x_TU_CLAVE_PRIVADA
ESCROW_CONTRACT_ADDRESS=0x_CONTRATO
MCP_URL=https://ai.bezhas.network:3002
API_KEY=tu_api_key_segura
EOF

# 3. Iniciar el nodo
npm start

# El nodo escucha en puerto 4000
# Endpoints disponibles:
#   GET  /health           — Estado del nodo
#   GET  /network/stats    — Info de la red L2
#   POST /webhook/logistics — Recibir datos de ERP
```

### 6.3 — Configuración del ERP (Webhooks)

Tu sistema ERP debe enviar datos al endpoint del edge node:

```bash
# Ejemplo: enviar datos de sensor IoT
curl -X POST http://TU_SERVIDOR:4000/webhook/logistics \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tu_api_key_segura" \
  -d '{
    "container_id": "MSKU-1234567",
    "temperature": 4.2,
    "status": "in_transit"
  }'

# Respuesta exitosa:
# {
#   "success": true,
#   "tx_hash": "0xabc123...",
#   "l2_block": 54321
# }
```

**Integraciones ERP soportadas:**
- SAP S/4HANA (vía SAP PI/PO o Integration Suite)
- Oracle NetSuite (SuiteScript + RESTlet)
- Shopify (Webhooks nativos)
- Custom ERP (cualquier sistema que envíe HTTP POST)

### 6.4 — Configuración del Heartbeat

Tu nodo debe enviar heartbeats al contrato `ValidatorRegistry` cada **4 horas** para evitar penalidades por downtime.

```bash
# Ejemplo con cron job (cada 3 horas para margen de seguridad)
# Agregar a crontab: crontab -e
0 */3 * * * /usr/local/bin/node /opt/bezhas/scripts/heartbeat.js >> /var/log/bezhas-heartbeat.log 2>&1
```

Script de heartbeat (`scripts/heartbeat.js`):
```javascript
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const registry = new ethers.Contract(
  process.env.VALIDATOR_REGISTRY_ADDRESS,
  ['function heartbeat() external'],
  wallet
);

(async () => {
  const tx = await registry.heartbeat();
  await tx.wait();
  console.log(`[${new Date().toISOString()}] Heartbeat sent: ${tx.hash}`);
})();
```

---

## 7. Registro como Validador On-Chain

Después de instalar el nodo, registro on-chain del validador:

### Paso 1: Obtener BEZ-Coin

Adquiere BEZ-Coin a través de:
- Compra directa del tesoro BeZhas
- Bridge desde L1 (Sepolia/Mainnet) via `BeZhasBridgeL2`
- Recompensas acumuladas de operación

### Paso 2: Aprobar y Registrar

```javascript
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://rpc.bezhas.network');
const wallet = new ethers.Wallet('0x_PRIVATE_KEY', provider);

// Direcciones de contratos (verificar en deployments/2708.json)
const BEZ_ADDRESS = '0x...';
const REGISTRY_ADDRESS = '0x...';

const bez = new ethers.Contract(BEZ_ADDRESS, [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function delegate(address delegatee) external'
], wallet);

const registry = new ethers.Contract(REGISTRY_ADDRESS, [
  'function registerValidator(string calldata companyName, uint256 stakeAmount) external',
  'function addStake(uint256 amount) external',
  'function getValidatorInfo(address) external view returns (string, uint256, uint256, uint8, bool, bool, uint256)'
], wallet);

async function register() {
  const stakeAmount = ethers.parseEther('250000'); // Gold tier = 250K BEZ

  // 1. Aprobar transferencia de BEZ al Registry
  const approveTx = await bez.approve(REGISTRY_ADDRESS, stakeAmount);
  await approveTx.wait();
  console.log('Aprobación confirmada');

  // 2. Registrar como validador
  const registerTx = await registry.registerValidator('Mi Empresa S.A.', stakeAmount);
  await registerTx.wait();
  console.log('¡Registrado como validador Gold!');

  // 3. Delegar votos a sí mismo para gobernanza
  const delegateTx = await bez.delegate(wallet.address);
  await delegateTx.wait();
  console.log('Votos delegados para DAO');

  // Verificar registro
  const info = await registry.getValidatorInfo(wallet.address);
  console.log(`Empresa: ${info[0]}`);
  console.log(`Stake: ${ethers.formatEther(info[1])} BEZ`);
  console.log(`Tier: ${info[3]} (1=Bronze, 2=Silver, 3=Gold, 4=Platinum)`);
  console.log(`Activo: ${info[4]}`);
  console.log(`Sequencer Elegible: ${info[5]}`);
}

register();
```

### Paso 3: Subir de Tier

```javascript
async function upgradeToPlat() {
  const additionalStake = ethers.parseEther('750000'); // 250K → 1M = +750K

  await (await bez.approve(REGISTRY_ADDRESS, additionalStake)).wait();
  await (await registry.addStake(additionalStake)).wait();

  console.log('¡Upgrade a Platinum completado!');
}
```

---

## 8. Recompensas y Cómo se Calculan

### 8.1 Recompensas por DePIN Mining (EdgeNodeRewards)

Cada vez que tu nodo procesa datos, un oracle registra puntos:

```
Puntos × Tasa base (1 BEZ/punto) × Boost de Tier = Recompensa
```

**Ejemplo para un validador Gold (1.5x) que procesa diariamente:**

| Actividad diaria | Puntos | BEZ base | Con boost 1.5x |
|------------------|--------|----------|----------------|
| 20 IoT Traceability | 100 | 100 BEZ | 150 BEZ |
| 5 Compliance Checks | 75 | 75 BEZ | 112.5 BEZ |
| 10 Supply Chain Validations | 80 | 80 BEZ | 120 BEZ |
| 1 DAO Vote | 3 | 3 BEZ | 4.5 BEZ |
| **Total diario** | **258** | **258 BEZ** | **387 BEZ** |
| **Total mensual** | **~7,740** | **~7,740 BEZ** | **~11,610 BEZ** |

### 8.2 Recompensas por Sequencer (SequencerRotation)

Si eres Gold o Platinum, participas en la rotación de producción de bloques:

- **Epoch:** 7,200 bloques (~4 horas a 2s/bloque)
- **Fee Share:** 50% de las transaction fees del epoch
- **Rotación:** round-robin ordenado por stake (Platinum primero)

### 8.3 Recompensas por Staking Pasivo (StakingPool)

Depositar BEZ adicional en el StakingPool genera rendimiento:

- **Base rate:** configurable por el admin
- **Boost:** si eres validador registrado, tu tier multiplica las recompensas
- **Ejemplo:** Platinum staker gana **2x** vs un staker no-validador

### 8.4 Resumen de Ingresos

Para un validador **Gold (250K BEZ)** activo:

| Fuente | Estimado mensual |
|--------|-----------------|
| DePIN Mining (datos procesados) | ~11,610 BEZ |
| Sequencer Fees (cuando toca turno) | Variable (~500-5,000 BEZ) |
| Staking Pool (si deposita extra) | Según tasa × 1.5x |
| **Total aproximado** | **12,000-17,000 BEZ/mes** |

---

## 9. Sistema de Penalidades (Slashing)

### Infracciones y Penalidades

| Tipo | Penalidad | Cómo evitarlo |
|------|-----------|---------------|
| **Downtime** (>4h sin heartbeat) | 2% del stake | Heartbeat cada 3h con cron |
| **Datos fraudulentos** (detectado por IA) | 5% del stake | No manipular datos de sensores |
| **Inactividad DAO** (3+ votos perdidos) | 1% del stake | Votar en todas las propuestas |
| **Fallo de sequencer** (no produjo bloques) | 3% del stake | Mantener nodo online 24/7 |
| **Doble firma** (firmas conflictivas) | 10% del stake | No correr nodo duplicado |

### Protecciones

- **Cooldown:** Mínimo 24 horas entre penalidades al mismo validador.
- **Límite periódico:** Máximo 25% del stake penalizable en 30 días.
- **Apelaciones:** Si crees que fue injusto, puedes apelar:
  1. Validador llama `slashing.appealSlash(slashId)`
  2. Admin/DAO revisa la evidencia
  3. Si procede: `slashing.reverseSlash(slashId)` — stake devuelto

### Reactivación después de deactivación

Si tu stake baja del mínimo del tier y te desactivan:

```javascript
// Depositar suficiente BEZ para cumplir el mínimo
await bez.approve(REGISTRY_ADDRESS, ethers.parseEther('10000'));
await registry.reactivateValidator(ethers.parseEther('10000'));
```

---

## 10. Gobernanza DAO

### Cómo Participar

1. **Delegar votos:** `bez.delegate(tuAddress)` — activa tu poder de voto
2. **Crear propuesta:** Necesitas ≥10,000 BEZ delegados
3. **Votar:** Durante los 7 días de votación
4. **Quorum:** 4% de todos los votos delegados deben participar

### Importancia para Validadores

- **No votar tiene costo:** 3 votos perdidos consecutivos = 1% slash
- **Propuestas afectan operación:** Pueden cambiar tiers, tasas de recompensa, parámetros de slashing
- El counter de votos perdidos se resetea después de cada penalización

---

## 11. Referencia de Configuración

### Red L2

| Parámetro | Valor |
|-----------|-------|
| Chain ID | 2708 |
| Block Time | 2 segundos |
| Token de Gas | BEZ-Coin |
| RPC (mainnet futuro) | `https://rpc.bezhas.network` |
| RPC (local Docker) | `http://localhost:8545` |
| WS (local) | `ws://localhost:8546` |
| Explorer | Blockscout (por configurar) |

### Contratos Core (direcciones según deployment)

| Contrato | Descripción |
|----------|-------------|
| BEZCoinV2 | Token nativo ERC20+Votes |
| ValidatorRegistry | Registro de validadores |
| EdgeNodeRewards | Recompensas DePIN |
| SequencerRotation | Rotación de sequencer |
| SlashingManager | Sistema de penalidades |
| StakingPool | Staking pasivo |
| GovernanceSystem | DAO corporativa |
| QualityEscrow | Escrow de calidad IoT |
| BeZhasBridgeL2 | Bridge L1↔L2 |

> Las direcciones exactas se publican en `smart-contracts/deployments/{chainId}.json` después del deploy.

### Paquete npm del Edge Node

```json
{
  "name": "bezhas-edge-node",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "ethers": "^6.11.1",
    "express": "^4.19.2"
  }
}
```

### Variables de Entorno Requeridas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `RPC_URL` | URL del nodo L2 | `http://bezhas-geth:8545` |
| `PRIVATE_KEY` | Clave privada del nodo | `0xac0974bec...` |
| `ESCROW_CONTRACT_ADDRESS` | Dirección del QualityEscrow | `0x5FbDB2...` |
| `MCP_URL` | URL del servidor AI/MCP | `http://ai-gateway:3002` |
| `API_KEY` | Clave de autenticación B2B | (generada por admin) |
| `PORT` | Puerto del edge node | `4000` |

---

## 12. FAQ

### ¿Cuánto BEZ necesito como mínimo para ser validador?
10,000 BEZ (tier Bronze). Pero para producir bloques y ganar fees, necesitas 250,000 BEZ (Gold).

### ¿Puedo retirar mi stake cuando quiera?
Sí, pero hay un período de unbonding de **7 días**. Llamas `initiateUnbonding(amount)` y después de 7 días `completeWithdraw()`.

### ¿Qué pasa si mi nodo se cae?
Si no envías heartbeat por más de 4 horas, recibes una penalidad del 2%. Configura monitoreo y heartbeat automático con cron.

### ¿Puedo subir de tier sin reinstalar?
Sí. Solo necesitas agregar más stake con `addStake(amount)`. El tier se recalcula automáticamente.

### ¿Las penalidades son permanentes?
No. Puedes apelar cualquier penalidad. Si la DAO la revierte, el stake se devuelve. Además, hay un máximo de 25% penalizable en 30 días.

### ¿Puedo correr varios nodos?
No corras el mismo validador en múltiples servidores — esto puede causar doble firma (penalidad del 10%). Un nodo por empresa registrada.

### ¿Cómo verifico que mi nodo está validando correctamente?
```bash
# Verificar salud
curl http://localhost:4000/health

# Verificar info on-chain
# Usar el SDK o llamar directamente:
# registry.getValidatorInfo(tuAddress)
```

### ¿Dónde obtengo soporte?
- Documentación: `docs/` en el repositorio
- Dashboard: `http://localhost:3000/dashboard`
- API status: `http://localhost:3001/api/health`
[[oracle-webhook]]