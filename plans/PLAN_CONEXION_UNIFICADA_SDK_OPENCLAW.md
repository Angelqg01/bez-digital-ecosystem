# Plan de Conexión Unificada: BeZhas-Blockchain ↔ BeZhas-Web3

**Fecha:** 2 de Abril 2026  
**Objetivo:** Unificar `@bezhas/sdk` y `@bezhas/openclaw-unified` para que sirvan como punto único de conexión entre todas las plataformas del ecosistema BeZhas.

---

## 1. Diagnóstico Actual — Problemas Detectados

### 1.1 SDK Duplicado y Divergente

Existen **dos copias** del SDK con el mismo nombre `@bezhas/sdk` v2.0.0 que ya divergieron:

| Aspecto | BeZhas-Blockchain/sdk | BeZhas-Web3/bezhas-web3/sdk |
|---------|----------------------|----------------------------|
| ValidatorClient | ✅ Presente | ❌ No existe |
| CommercialAPIClient | ✅ Presente | ❌ No existe |
| GatewayClient | ✅ Presente | ❌ No existe |
| IntegrationAssistant | ✅ (reemplaza TrojanAgent) | ❌ Tiene TrojanAgent (obsoleto) |
| Red `bezhas_l2` | ✅ Soportada | ❌ No soportada |
| Contratos Polygon | ✅ Direcciones vía .env | ✅ Direcciones vía .env |
| Contratos L2 (2708) | ✅ 66 deployados (Anvil) | ❌ No los conoce |
| Sector Modules (7) | ✅ Iguales | ✅ Iguales |
| Build (webpack) | ✅ CDN browser bundle | ✅ CDN browser bundle |

**Impacto:** Cualquier mejora en un SDK no llega al otro. Ya hay 4 módulos nuevos que Web3 no tiene.

### 1.2 Registros de Contratos Fragmentados

```
BeZhas-Blockchain → 78 contratos en Anvil (31337) + Polygon + Amoy + L2(2708)
BeZhas-Web3       → 8 contratos en Polygon (137) + Amoy (80002)
```

No existe un **registro unificado** de direcciones. Cada SDK lee de sus propias variables de entorno.

### 1.3 OpenClaw Preparado pero No Conectado

`Sincronizar OpenClaw/` tiene la arquitectura correcta (`~/.openclaw/openclaw.json` como config canónica), pero:
- No está instalado como dependencia en ninguno de los dos proyectos
- No hay import/require de `@bezhas/openclaw-unified` en ningún servicio
- Los health checks de `platforms.blockchain` y `platforms.web3` no se ejecutan

### 1.4 GatewayClient Existe pero Sin Contraparte

El SDK de Blockchain tiene un `GatewayClient` completo (SSO, wallet, staking, farming, governance, bridge, contracts) que apunta a `localhost:3001/api/gateway/v1`, pero:
- La API no tiene ruta `/api/gateway/v1` implementada
- Web3 no conoce este cliente

---

## 2. Arquitectura Propuesta — SDK Monorepo Unificado

### 2.1 Principio: Una Sola Fuente de Verdad

```
BeZhas Blockchain/sdk/          ← CANÓNICO (primario, más evolucionado)
    ├── index.js                ← Entry point único
    ├── contracts.js            ← Registro multi-chain unificado
    ├── gateway-client.js       ← Cross-app communication
    ├── modules/                ← Sector + platform modules
    ├── dist/                   ← Browser bundle
    └── package.json            ← @bezhas/sdk v3.0.0

BeZhas Web/bezhas-web3/sdk/     ← SE ELIMINA, reemplazado por:
    → npm link @bezhas/sdk      (desarrollo local)
    → npm install @bezhas/sdk   (producción, desde registry)
```

### 2.2 Diagrama de Conexión

```
┌─────────────────────────────────────────────────────────────────┐
│                     @bezhas/sdk v3.0.0                          │
│                  (Fuente Única - Blockchain/sdk)                │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ BeZhas   │  │ Gateway  │  │ Contract │  │ Commercial    │  │
│  │ (Core)   │  │ Client   │  │ Registry │  │ APIClient     │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬────────┘  │
│       │              │             │                │           │
│  ┌────┴──────────────┴─────────────┴────────────────┴────────┐ │
│  │              ChainManager (NUEVO)                          │ │
│  │  ┌──────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌────────┐ │ │
│  │  │Anvil │ │Polygon │ │ Amoy   │ │BeZhas L2 │ │Sepolia │ │ │
│  │  │31337 │ │  137   │ │ 80002  │ │   2708   │ │11155111│ │ │
│  │  └──────┘ └────────┘ └────────┘ └──────────┘ └────────┘ │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
┌──────────────────┐ ┌─────────────┐ ┌──────────────────┐
│  BeZhas-Web3     │ │ Control     │ │ Futuras Apps     │
│  (Consumer App)  │ │ Center      │ │ (DeFi, Mobile,   │
│  Vite + React    │ │ Next.js 14  │ │  Partners, B2B)  │
│  Wagmi + viem    │ │             │ │                  │
└────────┬─────────┘ └──────┬──────┘ └────────┬─────────┘
         │                  │                  │
         └──────────────────┼──────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │  @bezhas/openclaw-unified  │
              │  (Sincronizar OpenClaw/)   │
              │                            │
              │  Config: ~/.openclaw/      │
              │  Skills: 4 commercial      │
              │  Health: multi-platform    │
              └────────────────────────────┘
```

### 2.3 Multi-Chain Contract Registry (contracts.js unificado)

```javascript
// sdk/contracts.js — NUEVO: Registro de direcciones multi-chain

const CHAIN_CONFIGS = {
  // ── BeZhas L2 (OP Stack) ──────────────────────────────
  2708: {
    name: 'BeZhas L2',
    rpc: 'http://localhost:8545',          // dev
    rpcProd: 'https://rpc.bezhas.io',      // futuro
    explorer: 'http://localhost:4000',
    contracts: {} // cargado desde deployments/2708.json
  },
  // ── Desarrollo Local (Anvil) ──────────────────────────
  31337: {
    name: 'Anvil Local',
    rpc: 'http://localhost:8545',
    contracts: {} // cargado desde deployments/31337.json
  },
  // ── Polygon Mainnet ───────────────────────────────────
  137: {
    name: 'Polygon',
    rpc: 'https://polygon-bor.publicnode.com',
    explorer: 'https://polygonscan.com',
    contracts: {
      BEZCoin:           '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
      QualityEscrow:     '0x3088573c025F197A886b97440761990c9A9e83C9',
      RWAFactory:        '0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0',
      GovernanceSystem:  '0x304Fd77f64C03482edcec0923f0Cd4A066a305F3',
      LiquidityFarming:  '0x4C5330B45FEa670d5ffEAD418E74dB7EA5ECdD26',
      NFTOffers:         '0x0C9Bf667b838f6d466619ddb90a08d6c9A64d0A4',
      Marketplace:       '0x1c061A896E0ac9C046A93eaf475c45ED5Bd8A1fE',
      AdminRegistry:     '0xfCe2F7dcf1786d1606b9b858E9ba04dA499F1e3C',
    }
  },
  // ── Polygon Amoy Testnet ──────────────────────────────
  80002: {
    name: 'Polygon Amoy',
    rpc: 'https://rpc-amoy.polygon.technology',
    explorer: 'https://amoy.polygonscan.com',
    contracts: {} // mismas keys, direcciones de testnet
  },
  // ── Sepolia (L1 Reference) ────────────────────────────
  11155111: {
    name: 'Sepolia',
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    contracts: {}
  }
};
```

---

## 3. Plan de Implementación por Fases

### Fase 1: SDK Canónico (Semana 1)

**Objetivo:** Eliminar la duplicación, hacer que `BeZhas Blockchain/sdk/` sea la fuente única.

#### 1.1 Actualizar SDK a v3.0.0

```
Blockchain/sdk/package.json  →  version: "3.0.0"
```

Cambios requeridos en `sdk/contracts.js`:
- Reemplazar el sistema de `CONTRACT_ADDRESSES` basado en env vars por un **registry multi-chain** que:
  - Lee `smart-contracts/deployments/{chainId}.json` automáticamente para contratos L2
  - Tiene hardcoded las direcciones Polygon mainnet (ya deployadas)
  - Permite override vía env vars (retrocompatible)
  - Exporta `getChainConfig(chainId)` para obtener RPC + explorer + contratos

#### 1.2 Crear npm link para desarrollo
```powershell
# En BeZhas Blockchain/sdk/
npm link

# En BeZhas Web/bezhas-web3/
npm link @bezhas/sdk

# En cualquier nuevo proyecto
npm link @bezhas/sdk
```

#### 1.3 Migrar Web3 al SDK canónico
- Eliminar `bezhas-web3/sdk/` (mover a `bezhas-web3/sdk.old/` como backup)
- Reemplazar imports de `./sdk` por `@bezhas/sdk`
- Migrar `TrojanAgent` → `IntegrationAssistant`
- Validar que todos los hooks y services sigan funcionando

### Fase 2: OpenClaw como Bus de Integración (Semana 1-2)

**Objetivo:** Convertir `Sincronizar OpenClaw/` en el middleware de comunicación entre plataformas.

#### 2.1 Instalar como dependencia en ambos proyectos

```powershell
# En BeZhas Blockchain/
npm install "file:./Sincronizar OpenClaw" --save

# En BeZhas Web/bezhas-web3/
npm install "file:../../BeZhas Blockchain/Sincronizar OpenClaw" --save
```

O mover a un path limpio sin espacios para npm link:
```powershell
# Alternativa: symlink a path limpio
mklink /D "D:\bezhas-packages\openclaw-unified" "D:\Documentos D\...\Sincronizar OpenClaw"
```

#### 2.2 Integrar OpenClaw en los servicios backend

**En BeZhas Blockchain API (`api/index.js`):**
```javascript
const openclaw = require('@bezhas/openclaw-unified');

// Al iniciar el servidor
await openclaw.init({ 
  watchConfig: true, 
  watchSkills: true 
});

// Exponer status en /api/openclaw/status
app.get('/api/openclaw/status', (req, res) => {
  res.json(openclaw.getStatus());
});
```

**En BeZhas Web3 Backend (`server.js`):**
```javascript
const openclaw = require('@bezhas/openclaw-unified');
await openclaw.init({ watchConfig: true });
```

#### 2.3 Agregar Platform Discovery al OpenClaw

Nuevo método en `OpenClawClient.js`:
```javascript
async discoverPlatforms() {
  // Itera platforms.blockchain, platforms.web3, ...
  // Hace health check a cada uno
  // Retorna mapa de plataformas activas con sus capacidades
}
```

### Fase 3: Gateway API Unificado (Semana 2-3)

**Objetivo:** Implementar `/api/gateway/v1` para que el `GatewayClient` del SDK funcione.

#### 3.1 Crear las rutas Gateway en la API Blockchain

```
api/routes/gateway.js
├── POST /api/gateway/v1/sso/login          ← Wallet-based SSO
├── POST /api/gateway/v1/sso/refresh        ← Token refresh
├── GET  /api/gateway/v1/wallet/balance/:addr
├── POST /api/gateway/v1/wallet/send
├── GET  /api/gateway/v1/staking/pools
├── POST /api/gateway/v1/staking/stake
├── GET  /api/gateway/v1/farming/pools
├── GET  /api/gateway/v1/governance/proposals
├── POST /api/gateway/v1/governance/vote
├── POST /api/gateway/v1/bridge/deposit     ← L2↔Polygon
├── GET  /api/gateway/v1/bridge/status/:id
├── GET  /api/gateway/v1/contracts/:chain/:name
├── GET  /api/gateway/v1/apps/registered
└── POST /api/gateway/v1/apps/register      ← App registration
```

#### 3.2 Registrar BeZhas-Web3 como App

```javascript
const { GatewayClient } = require('@bezhas/sdk');

const gateway = new GatewayClient({
  gatewayUrl: 'http://localhost:3001/api/gateway/v1',
  apiKey: 'bzk_web3_app_key'
});

// Web3 ahora puede hacer cross-chain ops vía el gateway
const l2Balance = await gateway.wallet.getBalance('0x...');
const bridgeTx = await gateway.bridge.deposit({ amount: '100', from: 'polygon', to: 'bezhas_l2' });
```

### Fase 4: Registro de Contratos Unificado (Semana 2)

**Objetivo:** Un solo archivo `deployments/` que ambas plataformas consultan.

#### 4.1 Estructura de deployments

```
Blockchain/smart-contracts/deployments/
├── 31337.json       ← Anvil (66 contratos)
├── 2708.json        ← BeZhas L2 (cuando se haga deploy)
├── 137.json         ← Polygon Mainnet (8 contratos existentes)
├── 80002.json       ← Polygon Amoy
└── 11155111.json    ← Sepolia L1
```

#### 4.2 Auto-descubrimiento en SDK

```javascript
// sdk/contracts.js
const path = require('path');
const fs = require('fs');

function loadDeployments() {
  const deploymentsDir = path.resolve(__dirname, '../smart-contracts/deployments');
  const registry = {};
  
  if (fs.existsSync(deploymentsDir)) {
    for (const file of fs.readdirSync(deploymentsDir)) {
      if (file.endsWith('.json')) {
        const chainId = parseInt(file.replace('.json', ''));
        registry[chainId] = JSON.parse(fs.readFileSync(path.join(deploymentsDir, file)));
      }
    }
  }
  
  // Merge hardcoded Polygon addresses (ya deployadas)
  registry[137] = { ...POLYGON_MAINNET_ADDRESSES, ...registry[137] };
  
  return registry;
}
```

### Fase 5: Bridge Cross-Chain (Semana 3-4)

**Objetivo:** Conectar los tokens BEZ entre Polygon y BeZhas L2.

Ya existen los contratos:
- `BeZhasBridgeL2.sol` — En L2
- `BEZPolygonBridge.sol` — Cross-chain a Polygon
- `WrappedBEZ.sol` — wBEZ wrapper

**Pasos:**
1. Deployar BEZCoinV2 en L2 (bloqueador actual)
2. Deployar BEZPolygonBridge en Polygon apuntando al BEZ de Polygon (0xEcBa...)
3. Deployar BeZhasBridgeL2 en L2 apuntando a BEZCoinV2
4. Configurar relayer en `bezhas-edge-node` para monitorear eventos de bridge
5. Testear flujo: Polygon → Lock BEZ → Mint wBEZ en L2 → Burn wBEZ → Unlock BEZ en Polygon

---

## 4. Estructura de Archivos Final

```
BeZhas Blockchain/
├── sdk/                              ← @bezhas/sdk v3.0.0 (CANÓNICO)
│   ├── index.js                      ← Entry point universal
│   ├── contracts.js                  ← Multi-chain registry
│   ├── chain-manager.js              ← Provider por chainId (NUEVO)
│   ├── gateway-client.js             ← Cross-app communication
│   ├── bezhas-universal.js           ← Core class
│   ├── modules/
│   │   ├── CommercialAPIClient.js
│   │   ├── ValidatorClient.js
│   │   ├── bezhas-integration-assistant.js
│   │   ├── RealEstateModule.js
│   │   ├── HealthcareModule.js
│   │   ├── ... (7 sector modules)
│   │   └── index.js                  ← Re-export all modules
│   ├── staking.js
│   ├── farming.js
│   ├── governance.js
│   ├── marketplace.js
│   ├── payments.js
│   ├── rwa.js
│   ├── logistics.js
│   ├── vip.js
│   ├── mcp-integration.js
│   ├── dist/                         ← Browser bundle (webpack)
│   │   └── bezhas-sdk.min.js
│   └── package.json
│
├── Sincronizar OpenClaw/             ← @bezhas/openclaw-unified v2.0.0
│   ├── index.js                      ← Init + status
│   ├── lib/
│   │   ├── ConfigManager.js          ← ~/.openclaw/openclaw.json
│   │   ├── SkillRegistry.js
│   │   ├── TokenManager.js
│   │   ├── OpenClawClient.js
│   │   └── PlatformDiscovery.js      ← NUEVO: auto-detect plataformas
│   ├── middleware/
│   │   └── openclawAuth.js
│   └── package.json
│
├── smart-contracts/
│   └── deployments/
│       ├── 31337.json                ← Anvil
│       ├── 137.json                  ← Polygon Mainnet (NUEVO)
│       ├── 2708.json                 ← BeZhas L2 (cuando se deploye)
│       └── 80002.json               ← Amoy testnet
│
└── api/
    └── routes/
        └── gateway.js                ← NUEVO: /api/gateway/v1/*

BeZhas Web/bezhas-web3/
├── sdk/ → ELIMINADO (usa npm link @bezhas/sdk)
├── frontend/
│   └── src/
│       └── config/
│           └── sdk.js                ← import { BeZhas } from '@bezhas/sdk'
└── backend/
    └── server.js                     ← require('@bezhas/openclaw-unified')
```

---

## 5. Cómo lo Usarán las Futuras Plataformas

### Cualquier nueva app (React, Vue, Angular, Mobile, Python, etc.)

```javascript
// 1. Instalar
npm install @bezhas/sdk @bezhas/openclaw-unified

// 2. Conectar al gateway
const { GatewayClient } = require('@bezhas/sdk');
const gateway = new GatewayClient({
  gatewayUrl: 'https://api.bezhas.io/api/gateway/v1',
  apiKey: 'bzk_tu_app_key'
});

// 3. Autenticar
const tokens = await gateway.sso.login({
  walletAddress: '0x...',
  signature: '...',
  message: 'Login to MyApp',
  appOrigin: 'my-app'
});

// 4. Operar
const balance = await gateway.wallet.getBalance('0x...');
const contract = gateway.contracts.get('SupplyTracker', 2708);
await gateway.staking.stake({ amount: '1000', pool: 'Gold' });

// 5. OpenClaw para operaciones comerciales
const openclaw = require('@bezhas/openclaw-unified');
await openclaw.init();
```

### Para SDKs en otros lenguajes (futuro)

```
@bezhas/sdk            → JavaScript/TypeScript (Node + Browser)
@bezhas/sdk-python     → Python wrapper del Gateway API
@bezhas/sdk-rust       → Rust (smart contract interactions directas)
@bezhas/sdk-mobile     → React Native / Flutter
```

Todos se conectan al mismo Gateway API.

---

## 6. Comandos de Ejecución

### Paso 1: Preparar el SDK canónico
```powershell
cd "D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Blockchain\sdk"
# Actualizar version
npm version 3.0.0 --no-git-tag-version
# Crear link global
npm link
```

### Paso 2: Conectar Web3 al SDK canónico
```powershell
cd "D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3"
# Backup del SDK viejo
Rename-Item sdk sdk.old
# Linkear al canónico
npm link @bezhas/sdk
```

### Paso 3: Preparar OpenClaw Unified
```powershell
cd "D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Blockchain\Sincronizar OpenClaw"
npm link
# Linkear en ambos proyectos
cd "D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Blockchain"
npm link @bezhas/openclaw-unified
cd "D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3"
npm link @bezhas/openclaw-unified
```

### Paso 4: Crear deployment de Polygon
```powershell
cd "D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Blockchain\smart-contracts"
# Crear 137.json con las direcciones ya deployadas en Polygon
```

### Paso 5: Verificar
```powershell
cd "D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Blockchain"
node -e "const sdk = require('@bezhas/sdk'); console.log(sdk.listContracts())"
node -e "const oc = require('@bezhas/openclaw-unified'); oc.init().then(s => console.log(s))"
```

---

## 7. Resumen de Prioridades

| # | Acción | Esfuerzo | Impacto | Dependencia |
|---|--------|----------|---------|-------------|
| 1 | SDK → v3.0.0 + multi-chain registry | 2-3 días | 🔴 Crítico | Ninguna |
| 2 | npm link SDK en Web3 | 1 hora | 🔴 Crítico | #1 |
| 3 | npm link OpenClaw en ambos | 1 hora | 🟡 Alto | Ninguna |
| 4 | Crear 137.json (Polygon addresses) | 30 min | 🟡 Alto | #1 |
| 5 | Implementar Gateway API routes | 3-5 días | 🟡 Alto | #1 |
| 6 | Migrar Web3 imports de ./sdk a @bezhas/sdk | 1-2 días | 🟡 Alto | #2 |
| 7 | Platform Discovery en OpenClaw | 1 día | 🟢 Medio | #3 |
| 8 | Bridge cross-chain deploy | 1 semana | 🟢 Medio | BEZCoinV2 deploy |
| 9 | Publish @bezhas/sdk a npm | 1 día | 🟢 Medio | Testing completo |

**Ruta Crítica:** 1 → 2 → 6 → 5 → 9

---

## 8. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Breaking changes al migrar Web3 SDK | Media | Mantener `sdk.old/` como fallback, migrar gradualmente |
| npm link se pierde con `npm install` | Alta | Usar `file:` protocol en package.json o postinstall script |
| Paths con espacios causan problemas en npm | Media | Crear symlinks a paths limpios (`D:\bezhas-packages\`) |
| Contratos Polygon vs L2 con mismos nombres | Baja | El chainId siempre diferencia, nunca ambiguo |
| Config OpenClaw sobreescrita entre plataformas | Baja | Archivo canónico con merge por prioridad ya implementado |
