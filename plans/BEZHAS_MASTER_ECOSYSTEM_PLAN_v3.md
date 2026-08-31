# BeZhas — Master Plan: Ecosistema de Sub-Apps Integrado
**Ruta base:** `D:\BeZhas-Blockchain\App-nativas`  
**Fecha:** Mayo 2026  
**Versión:** 3.0 (Fusión Optimizada de V1 + V2)  
**Estado:** Plan de Referencia Único — Implementación Activa

> **Nota de versión:** Este documento fusiona y reemplaza a `BEZHAS_SUBAPPS_PLAN.md` (v2.0) y  
> `BEZHAS_INTEGRATED_ECOSYSTEM_PLAN.md` (v2.0). Es el único documento de referencia para el ecosistema.

---

## 0. Visión Unificada: "La Blockchain con Ojos"

BeZhas no gestiona tokens — **digitaliza la realidad física** y la certifica en la blockchain.  
Cada sub-app es una puerta de entrada a ese ecosistema, diseñada para que la empresa nunca sepa que está usando blockchain.

### Los 3 Pilares Estratégicos

| Pilar | Descripción | Efecto en la Red |
|-------|-------------|-----------------|
| **Utilidad Real** | Cada app resuelve un problema concreto de negocio | Presión de uso sobre $BEZ desde el día 1 |
| **Onboarding por Valor** | El cliente escanea, la blockchain certifica — sin fricción técnica | Adopción masiva sin curva de aprendizaje crypto |
| **Identidad Soberana** | Un solo `bezhas_uid/DID` atraviesa todas las apps | Ecosistema de confianza acumulativa |

---

## 1. Arquitectura Fundacional (Capa 0)

### 1.1 Identidad: `bezhas_uid` con DID (W3C Compatible)

El `bezhas_uid` del plan anterior se actualiza a un **DID (Decentralized Identifier)** compatible con el estándar W3C. Esto permite que las credenciales emitidas por BeZhas (calidad de producto, certificado aduanero, score de proveedor) sean reconocibles por sistemas externos.

```typescript
// packages/platform-sdk/identity/types.ts

interface BeZhasIdentity {
  // Identificadores
  did: string;                        // "did:bezhas:0x7a3...f4b2"
  platform_id: string;                // "BZH-2026-XXXXX" (legible humanos)
  wallet_address: string;             // "0x..." dirección L2

  // Tier y Acceso
  tier: "enterprise" | "pro" | "free";
  sectors: SectorKey[];               // Sectores activos contratados
  edge_nodes: number;                 // Nodos DePIN activos

  // Economía
  gas_tank_balance_usd: number;       // Saldo Gas Tank en USD
  bez_balance: number;                // BEZ-Coin en wallet
  staked_bez: number;                 // BEZ en staking

  // Reputación Acumulativa (cross-app)
  reputation_score: number;           // 0-1000, crece con uso
  verified_assets: number;            // Activos RWA registrados
  quality_verdicts: number;           // Veredictos de calidad emitidos

  // Credenciales Verificables (W3C VC)
  credentials: VerifiableCredential[];  // Licencias industriales, certificados
}
```

### 1.2 Stack Compartido (Todas las Apps)

| Capa | Tecnología | Puerto/Config | Rol |
|------|-----------|--------------|-----|
| **Framework** | Next.js 14+ App Router | :3000+ | UI de cada sub-app |
| **Auth** | SIWE + JWT — Gateway v1 | `localhost:3001/api/gateway/v1` | SSO unificado |
| **Web3** | Ethers.js v6 + @bezhas/sdk v3 | Chain 2708 | Contratos, eventos |
| **IA / Vision** | Gemini Vision API | Via @bezhas/sdk | Análisis de activos RWA |
| **MCP** | @bezhas/mcp-client | `localhost:3002` | Herramientas IA invocables |
| **Aegis** | FastAPI Python | `localhost:8001` | Modelos ML (Gas, Anomalías) |
| **Estado** | Zustand + React Query | — | Estado global + caché |
| **UI** | TailwindCSS + Shadcn/ui | — | Componentes, tokens CSS |
| **Notif.** | SSE (Agent Runtime) | `localhost:3001/stream` | Alertas en tiempo real |
| **Gas** | Paymaster + Gas Tank | Transparente | Usuario nunca ve gas crudo |

### 1.3 `@bezhas/platform-sdk` — SDK Unificado

Este es el paquete compartido que todos los proyectos en `apps/` importan. Fusiona el `platform-sdk` de V1 con la capa de Vision y MCP de V2:

```
packages/platform-sdk/
│
├── auth/
│   ├── useBezhasAuth.ts          # Hook: login SIWE + JWT
│   ├── PlatformGuard.tsx         # HOC: protección de rutas
│   └── did.ts                    # Generación y resolución de DIDs
│
├── identity/
│   ├── useBezhasUID.ts           # Hook: obtener identidad completa
│   ├── ReputationBadge.tsx       # Componente: score cross-app
│   └── CredentialCard.tsx        # Componente: VC (licencias, certs)
│
├── gas/
│   ├── useGasTank.ts             # Hook: saldo, alertas, recarga Stripe
│   ├── useAegisGasPredictor.ts   # Hook: timing óptimo de transacciones
│   └── GasIndicator.tsx          # Barra de gas en todas las apps
│
├── wallet/
│   ├── useBEZBalance.ts          # Hook: balance en tiempo real
│   ├── QuickTransfer.tsx         # Componente: transferencia rápida
│   └── useSmartWallet.ts         # Hook: Account Abstraction
│
├── vision/                       # ← NUEVO (de V2)
│   ├── useGeminiVision.ts        # Hook: análisis de imágenes RWA
│   ├── useSIFTFingerprint.ts     # Hook: huella digital visual de activos
│   ├── useVolumetric3D.ts        # Hook: cálculo de volumen por imagen
│   └── VisionUploader.tsx        # Componente: cámara/upload unificado
│
├── mcp/                          # ← NUEVO (de V2)
│   ├── useMCPTool.ts             # Hook: invocar herramientas MCP
│   ├── mcpClient.ts              # Cliente MCP tipado
│   └── tools.ts                  # Tipos de las 12 herramientas disponibles
│
├── blockchain/
│   ├── useContractCall.ts        # Hook: llamadas read/write a contratos
│   ├── useTransactionStatus.ts   # Hook: seguimiento de tx en tiempo real
│   └── contracts.ts             # Mapa de contratos por chainId
│
└── navigation/
    ├── AppSwitcher.tsx            # Navegador entre sub-apps
    └── routes.ts                  # Rutas centralizadas del ecosistema
```

### 1.4 Capa MCP — Infraestructura de Herramientas IA

El MCP Protocol conecta todas las sub-apps con las 12 herramientas de IA del `ai-engine`. Cualquier app puede invocar una herramienta con una sola línea:

```typescript
// Ejemplo: BEZ_Scaner invocando herramienta de scoring de proveedor
const { invoke } = useMCPTool();

const result = await invoke('score-supplier', {
  supplierDid: 'did:bezhas:0x...',
  assetData: visionData,
  sector: 'logistics'
});
// → { score: 847, verdict: 'APPROVED', confidence: 0.97 }
```

**Herramientas MCP disponibles para sub-apps:**

| Herramienta | Apps que la usan |
|------------|-----------------|
| `analyze-gas` | Gas Tank Manager |
| `verify-compliance` | Aduana y SupplyChain, BZ PureScan |
| `analyze-sentiment` | Trading Analytics (dentro BZ Capital) |
| `system-health` | Bezhas-Hub |
| `audit-contract` | Developer Sandbox |
| `predict-demand` | BZ Capital |
| `score-supplier` | BEZ_Scaner, Aduana y SupplyChain |
| `calculate-smart-swap` | BZ Capital |
| `monitor-edge-node` | Edge Node Manager |
| `assess-fraud-risk` | Retail y Lujo |
| `optimize-route` | Aduana y SupplyChain |
| `analyze-market` | BZ Capital |

### 1.5 Capa Vision — Gemini Multimodal para RWA

La capa Vision es lo que diferencia a BeZhas de cualquier otra blockchain B2B:

```
Objeto Físico (real) → Cámara → Gemini Vision API → SIFT Fingerprint → NFT en L2
```

```typescript
// packages/platform-sdk/vision/useGeminiVision.ts

export function useGeminiVision() {
  const analyzeAsset = async (imageStream: File, mode: VisionMode) => {
    // mode: 'quality-check' | 'volumetric-3d' | 'food-safety' | 'authenticity'
    const visionData = await fetch('/api/aegis/vision', {
      method: 'POST',
      body: createFormData(imageStream, mode)
    });

    return {
      fingerprintHash: visionData.siftHash,     // Para verificación futura
      verdict: visionData.verdict,               // APPROVED | REJECTED | PENDING
      confidence: visionData.confidence,         // 0.00 → 1.00
      metadata: visionData.extractedData,        // Volumen, peso, frescura, etc.
      txReady: true                              // Listo para minting en L2
    };
  };

  return { analyzeAsset };
}
```

---

## 2. Mapa Completo de Apps — Universo BeZhas

### Matriz Maestra (14 Apps + Expansión)

| # | Carpeta en Disco | Nombre Comercial | Categoría | Prioridad | Semanas |
|---|-----------------|-----------------|-----------|-----------|---------|
| 00 | `Bezhas-Hub/` | **The Core Hub** | Infraestructura | 🔴 P0 | 1-2 |
| 01 | `bez-wallet/` | **BEZ Wallet** | Core Finanzas | 🔴 P0 | 3-4 |
| 02 | `gas-tank-manager/` | **Corporate Gas Tank** | Core B2B | 🔴 P0 | 4-5 |
| 03 | `edge-node-manager/` | **Edge Node Manager** | Core DePIN | 🔴 P0 | 5-7 |
| 04 | `BEZ_Scaner/` | **BEZ Vision Scan** | Vision RWA | 🔴 P0 | 7-10 |
| 05 | `Aduana y SupplyChain/` | **BeZhas Customs** | Industrial | 🟠 P1 | 11-14 |
| 06 | `BZ Capital/` | **BZ Capital Hub** | DeFi + Trading | 🟠 P1 | 11-16 |
| 07 | `BZ PureScan/` | **Food Oracle** | Industrial | 🟠 P1 | 15-17 |
| 08 | `Retail y Lujo/` | **Authentic** | Industrial | 🟠 P1 | 16-18 |
| 09 | `bezhas-bridge/` | **BeZhas Bridge** | Infraestructura | 🟡 P2 | 19-20 |
| 10 | `dao-governance/` | **DAO Governance** | Ecosistema | 🟡 P2 | 21-22 |
| 11 | `bezhas-explorer/` | **BeZhas Explorer** | Ecosistema | 🟡 P2 | 21-22 |
| 12 | `developer-sandbox/` | **Dev Sandbox** | Ecosistema | 🟡 P2 | 23-25 |
| 13 | `learn-to-earn/` | **Learn-to-Earn** | Crecimiento | 🟢 P3 | 26+ |
| 14+ | `sectors/[x11]/` | **Sector Apps ×11** | Expansión | 🟢 P3 | 28+ |

> **Regla de carpetas:** Las carpetas que ya existen en disco (`Bezhas-Hub`, `BEZ_Scaner`, `Aduana y SupplyChain`, `BZ Capital`, `BZ PureScan`, `Retail y Lujo`) conservan su nombre exacto. Las nuevas se crean en minúsculas con guion.

---

## 3. Detalle por Sub-App

---

### APP 00 — Bezhas-Hub 🔴 P0
**Carpeta:** `Bezhas-Hub/`  
**Nombre Comercial:** The Core Hub  
**Descripción:** Dashboard central que orquesta todas las sub-apps. Es el punto de entrada del ecosistema: muestra el estado del usuario, sus apps activas, métricas de red y actúa como Dev Console para integradores.

**Funcionalidades Core:**
- Landing unificado con todas las sub-apps disponibles (AppSwitcher)
- Estado de salud de la red en tiempo real (TPS, gas, validadores)
- Métricas personales: BEZ acumulados, activos RWA, nodos activos, reputación
- Notificaciones cross-app (SSE: transacciones, rewards, alertas)
- Dev Console: documentación viva del SDK, playground de llamadas a contratos
- Orquestador MCP: status de las 12 herramientas IA

**Pantallas:**
```
/hub
├── / (Overview: estado usuario + red + apps activas)
├── /apps (Catálogo de sub-apps, filtro por sector/tipo)
├── /notifications (Centro de notificaciones cross-app)
├── /network (Métricas de red: bloques, TPS, validadores)
├── /dev (Dev Console: SDK docs + playground)
│   ├── /dev/mcp (Estado y test de herramientas MCP)
│   ├── /dev/contracts (ABI explorer + llamadas de prueba)
│   └── /dev/vision (Test de la API de Vision)
└── /profile (Identidad DID + credenciales + reputación)
```

**Contratos:** `BEZCoinV2`, `ValidatorRegistry`, `GovernanceSystem`  
**MCP Tools:** `system-health`, `audit-contract`  
**Métrica de éxito:** Usuario activa su primera sub-app en < 5 minutos desde registro.

---

### APP 01 — BEZ Wallet 🔴 P0
**Carpeta:** `bez-wallet/`  
**Descripción:** Wallet no-custodial con UX Web2.5 — el usuario nunca ve claves privadas ni frases semilla.

**Funcionalidades Core:**
- Saldo BEZ + NFTs RWA + historial de transacciones en BeZhas L2
- Enviar/Recibir BEZ (dirección o código QR)
- Ver saldo en USD con oráculo de precio integrado
- Galería de activos RWA tokenizados (NFTs del usuario)
- Historial de gas consumido (con equivalente USD)
- Notificaciones SSE de transacciones entrantes
- Recuperación via WalletGuardian (social recovery, sin seed phrase)

**Pantallas:**
```
/bez-wallet
├── / (Overview: saldo BEZ + USD, últimas txs, acciones rápidas)
├── /send (Envío con simulación de gas antes de confirmar)
├── /receive (QR + address + share link)
├── /assets (Galería de NFTs RWA propios)
├── /history (Historial filtrable: fecha, tipo, monto)
├── /settings (Guardian, sesiones, exportar address)
└── /onboarding (Tour 4 pasos para usuarios nuevos)
```

**Contratos:** `BEZCoinV2`, `SmartWallet`, `WalletGuardian`, `Paymaster`  
**Métrica de éxito:** Primera transacción completada en < 3 minutos desde registro.

---

### APP 02 — Corporate Gas Tank Manager 🔴 P0
**Carpeta:** `gas-tank-manager/`  
**Descripción:** Gestión de gas empresarial con recarga Fiat (Stripe) + optimización inteligente via Aegis GasPredictor. El equipo contable recarga con tarjeta; el sistema decide cuándo ejecutar transacciones pesadas.

**Funcionalidades Core:**
- Saldo actual en USD con equivalencia en BEZ y txs restantes
- Recarga manual (Stripe Checkout, tarjeta corporativa)
- Auto-Recarga: umbral configurable + importe automático
- **Aegis Integration:** Recomendación del mejor momento del día para txs L2 pesadas (RWA minting, bridge)
- Historial de recargas y consumo desglosado por sub-app y sector
- Alertas de saldo bajo (email + SSE)
- Facturación PDF descargable (para contabilidad)
- Resumen de consumo por departamento

**Pantallas:**
```
/gas-tank
├── / (Overview: saldo, consumo 30d, predicción Aegis, alertas)
├── /recharge (Stripe Checkout embebido)
├── /auto-recharge (Configurar umbral + importe)
├── /smart-timing (Predictor de gas Aegis: mejor hora para operar)
├── /history (Recargas + consumo por fecha + sub-app)
├── /billing (Facturas PDF descargables)
└── /settings (Método de pago, umbral de alerta, notificaciones)
```

**Integraciones:** Stripe SDK, Aegis `GasPredictor`, `gasMonitor.js`  
**MCP Tools:** `analyze-gas`  
**Métrica de éxito:** CFO recarga gas en < 2 minutos. Sistema nunca detiene operaciones por gas vacío.

---

### APP 03 — Edge Node Manager 🔴 P0
**Carpeta:** `edge-node-manager/`  
**Descripción:** Panel de configuración, monitorización y gestión de nodos DePIN para empresas.

**Funcionalidades Core:**
- Wizard de onboarding (5 pasos): registro → API Key → Docker → verificación → activación
- Dashboard de estado: online/offline, latencia, uptime, webhooks/hora
- Métricas de contribución: puntos acumulados, BEZ ganados, ranking en la red
- Gestión multi-nodo por empresa (hasta N nodos por tier)
- Logs en tiempo real via SSE
- Alertas de desconexión (email + SSE)
- Botón "Reclamar BEZ" (llama a `EdgeNodeRewards.claimRewards()`)

**Pantallas:**
```
/edge-node-manager
├── / (Dashboard: estado de todos los nodos + resumen rewards)
├── /setup (Wizard 5 pasos: API Key → Docker → test → activar)
├── /node/:id (Detalle: métricas, logs live, configuración webhook)
├── /rewards (Historial de recompensas + reclamación acumulada)
├── /keys (Crear, revocar, rotar API Keys)
└── /logs (Terminal de logs en tiempo real, filtro por nodo)
```

**Comando Docker generado dinámicamente:**
```bash
docker run -d --name bezhas-edge \
  -e API_KEY="${apiKey}" \
  -e BEZHAS_L2_RPC_URL="https://rpc.bez.digital" \
  -e REWARDS_CONTRACT_ADDRESS="${edgeNodeRewardsAddress}" \
  -e ENTERPRISE_DID="${userDid}" \
  -p 4000:4000 \
  bezhas/edge-node:latest
```

**Contratos:** `EdgeNodeRewards`, `ValidatorRegistry`  
**MCP Tools:** `monitor-edge-node`  
**Métrica de éxito:** Empresa activa primer nodo en < 10 minutos.

---

### APP 04 — BEZ Vision Scan 🔴 P0
**Carpeta:** `BEZ_Scaner/`  
**Nombre Comercial:** BEZ Vision Scan  
**Descripción:** La app más diferenciadora del ecosistema. Permite escanear cualquier activo físico con la cámara del móvil o una imagen, validarlo con Gemini Vision y crear su Gemelo Digital (NFT) en la L2.

**Funcionalidades Core:**
- Escaneo por cámara móvil o upload de imagen
- **SIFT Fingerprint:** Genera la "huella digital visual" del activo (irreplicable)
- **Quality Check:** Gemini Vision evalúa condición, daños, conformidad con especificaciones
- **RWA Minting:** Con un tap, el activo validado se convierte en NFT en BeZhas L2
- Comparación "Estado Original vs Estado Actual" (para verificación en destino)
- Integración directa con Aduana y SupplyChain (envío de datos)
- Historial de activos escaneados y sus estados

**Flujo Principal:**
```
1. Empresa abre BEZ_Scaner en móvil/tablet
2. Apunta cámara al producto / sube imagen
3. Gemini Vision: analiza calidad, genera SIFT Hash
4. App muestra: "Producto APROBADO — Confianza 97%"
5. Empresa confirma → NFT creado en L2 (tx ~$0.005)
6. Certificado QR descargable (verificable on-chain)
```

**Pantallas:**
```
/bez-scaner
├── / (Dashboard: activos recientes, métricas de calidad)
├── /scan (Cámara live + análisis en tiempo real)
├── /asset/:id (Detalle del activo: imagen, hash SIFT, metadata, NFT)
├── /verify (Modo verificación: escanear vs Golden Image en blockchain)
├── /batch (Escaneo múltiple para operaciones en lote)
├── /history (Todos los activos registrados, filtros)
└── /certificates (Certificados QR descargables)
```

**Contratos:** `BeZhasLogisticsNFT`, `QualityEscrow`  
**MCP Tools:** `score-supplier`, `verify-compliance`  
**Vision Modes:** `quality-check`, `volumetric-3d`  
**Métrica de éxito:** Tiempo de escaneo → NFT en blockchain < 30 segundos.

---

### APP 05 — BeZhas Customs 🟠 P1
**Carpeta:** `Aduana y SupplyChain/`  
**Nombre Comercial:** BeZhas Customs  
**Descripción:** Despacho aduanero digital integrado con los sistemas SIMPLE (España) y ASYCUDA (internacional). Los datos validados por `BEZ_Scaner` se envían automáticamente a los formularios aduaneros.

**Funcionalidades Core:**
- Importación directa de datos desde `BEZ_Scaner` (sin re-introducción manual)
- Generación automática de documentos aduaneros (DUA, CMR, BL)
- Integración API con SIMPLE (Agencia Tributaria España)
- Cálculo automático de aranceles e impuestos
- Optimización de rutas via MCP (`optimize-route`)
- Estimación de tiempos de despacho con IA
- Trazabilidad completa: fábrica → aduana → destino final
- Alertas de incidencia en tiempo real

**Pantallas:**
```
/aduana
├── / (Dashboard: operaciones en curso, alertas, estadísticas)
├── /new-shipment (Wizard: importar de BEZ_Scaner → generar docs → enviar)
├── /shipment/:id (Trazabilidad completa con mapa de estados)
├── /documents (Gestión de DUA, CMR, BL → descarga y firma digital)
├── /integrations (Config SIMPLE, ASYCUDA, APIs aduaneras)
├── /analytics (Tiempo medio de despacho, ahorro vs manual)
└── /compliance (Checker de normativas por país de destino)
```

**Contratos:** `QualityEscrow`, `BeZhasLogisticsNFT`, `PortAutomation`  
**MCP Tools:** `optimize-route`, `verify-compliance`, `score-supplier`  
**Métrica de éxito:** Reducción del 70% en tiempo de despacho aduanero.

---

### APP 06 — BZ Capital Hub 🟠 P1
**Carpeta:** `BZ Capital/`  
**Nombre Comercial:** BZ Capital Hub  
**Descripción:** Plataforma unificada de finanzas e inversión. Fusiona el DeFi Hub (Staking/Farming) y el Trading & Analytics Platform del plan anterior en una sola app. Incluye pools de RWA respaldados por activos validados en `BEZ_Scaner`.

**Módulos:**

**DeFi (Staking & Farming):**
- Pools de staking con APY, tier boost y períodos de lockup
- Yield Farming con pares de liquidez
- **RWA Pools:** Staking de tokens respaldados por activos físicos verificados
- Portfolio consolidado: staking + farming + wallet en USD
- Proyección de rendimientos a 30/90/365 días

**Trading & Analytics:**
- Gráficos OHLCV BEZ/USD, BEZ/BNB, BEZ/MATIC (TradingView integrado)
- Indicadores técnicos: RSI, MACD, Bollinger Bands, EMA/SMA, Fibonacci
- Análisis fundamental on-chain: TVL, supply circulante, volumen staking, nodos
- Bot de Trading: DCA, grid, RSI-based — paper trading + live
- Carteras de inversión con rebalanceo automático
- Alertas de precio y señales automáticas

**Capital RWA:**
- Inversión fraccionada en activos tokenizados (inmuebles, flotas, maquinaria)
- APY hasta 18.2% en pools respaldados por RWA verificados
- Predicción de mercado via Aegis + MCP

**Pantallas:**
```
/bz-capital
├── / (Overview: portfolio total USD, posiciones activas, alertas)
├── /defi
│   ├── /staking (Pools + mis posiciones + RWA pools)
│   ├── /farming (Pares LP + cosechar rewards)
│   └── /rwa-pools (Activos físicos tokenizados disponibles)
├── /trading
│   ├── /charts (Gráficos técnicos interactivos)
│   ├── /fundamentals (Métricas on-chain + tokenomics)
│   ├── /bot (Mis bots: estado, P&L, backtest)
│   └── /alerts (Alertas de precio configuradas)
├── /portfolio
│   ├── / (Resumen: BEZ + staking + farming + RWA)
│   ├── /create (Nueva cartera con reglas de rebalanceo)
│   └── /:id (Detalle + análisis de riesgo)
└── /history (Todas las operaciones DeFi + trading)
```

**Contratos:** `StakingPool`, `LiquidityFarming`, `BEZCoinV2`, `Treasury`, `MicroLendingPool`  
**MCP Tools:** `analyze-market`, `predict-demand`, `calculate-smart-swap`, `analyze-sentiment`  
**Métrica de éxito:** Usuario configura primera estrategia de staking en < 5 minutos.

---

### APP 07 — Food Oracle (BZ PureScan) 🟠 P1
**Carpeta:** `BZ PureScan/`  
**Nombre Comercial:** BZ PureScan — Food Oracle  
**Descripción:** Trazabilidad alimentaria y verificación de seguridad alimentaria con IA. Detecta frescura, alérgenos, composición nutricional y cadena de frío. Orientado a distribuidores, retailers y hospitales.

**Funcionalidades Core:**
- Escaneo de alimentos con detección de frescura via Gemini Vision
- Detección automática de alérgenos (14 alérgenos principales regulados en Europa)
- Verificación de cadena de frío (integración con sensores IoT)
- Trazabilidad farm-to-fork completa registrada en blockchain
- Generación de etiquetas digitales verificables (QR on-chain)
- Alertas de recall automáticas (si un lote tiene incidencia, alerta a toda la cadena)
- Compatibilidad con normativa EU: Reglamento 178/2002, APPCC/HACCP

**Pantallas:**
```
/pure-scan
├── / (Dashboard: lotes activos, alertas de recall, métricas de calidad)
├── /scan (Escaneo de alimento: frescura + alérgenos + composición)
├── /lot/:id (Trazabilidad completa del lote: origen → destino)
├── /cold-chain (Monitor de cadena de frío en tiempo real)
├── /recall (Sistema de alertas de recall → notifica a toda la cadena)
├── /labels (Generador de etiquetas digitales QR verificables)
└── /compliance (Checker APPCC, normativa EU por categoría)
```

**Contratos:** `BeZhasLogisticsNFT` (adaptado salud), `QualityEscrow`  
**MCP Tools:** `verify-compliance`  
**Vision Modes:** `food-safety`, `quality-check`  
**Métrica de éxito:** Distribuidor identifica lote contaminado antes de llegar a lineales.

---

### APP 08 — Authentic (Retail y Lujo) 🟠 P1
**Carpeta:** `Retail y Lujo/`  
**Nombre Comercial:** BeZhas Authentic  
**Descripción:** Sistema anti-falsificación para marcas de lujo, artículos deportivos y electrónica. Usa micro-textura visual (SIFT de alta resolución) para generar una huella única de cada producto que ningún falsificador puede replicar.

**Funcionalidades Core:**
- **Visual Fingerprinting:** SIFT de alta resolución captura micro-texturas únicas (costuras, grano de cuero, circuitos)
- Registro del producto auténtico en BeZhas L2 en fábrica
- App de verificación para consumidores (escanear antes de comprar)
- Dashboard de falsificaciones detectadas por región/modelo
- Integración con marketplaces (Amazon, eBay, Vinted) via API
- Certificado de autenticidad NFT incluido con el producto
- Historial de propietarios (para reventa verificada de lujo)

**Pantallas:**
```
/authentic
├── / (Dashboard: productos registrados, falsificaciones bloqueadas, mapa)
├── /register (Registrar nuevo producto: escaneo + NFC + blockchain)
├── /verify (Verificar autenticidad: cliente escanea → resultado inmediato)
├── /product/:id (Historial completo + cadena de custodia + propietarios)
├── /counterfeit-map (Mapa de calor de falsificaciones detectadas)
├── /integrations (Config APIs: Amazon, eBay, Vinted)
└── /certificates (NFTs de autenticidad por producto)
```

**Contratos:** `BeZhasLogisticsNFT` (certificación), `QualityEscrow`  
**MCP Tools:** `assess-fraud-risk`  
**Vision Modes:** `authenticity` (SIFT alta resolución)  
**Métrica de éxito:** Verificación de autenticidad en < 5 segundos por el consumidor.

---

### APP 09 — BeZhas Bridge 🟡 P2
**Carpeta:** `bezhas-bridge/`  
**Descripción:** Puente multi-cadena simplificado: BeZhas L2 ↔ Polygon ↔ Ethereum L1. Incluye seguimiento en tiempo real y estimación de fees.

**Flujo:**
```
1. Seleccionar: Red Origen → Red Destino
2. Cantidad + token (BEZ / wBEZ / USDT / USDC)
3. Revisar: tiempo estimado + fee (Aegis GasPredictor recomienda momento)
4. Confirmar → Firmar (invisible con Paymaster activo)
5. Seguimiento: Iniciado → Verificado → Enrutado → Completado
```

**Contratos:** `L1Bridge`, `BridgeL2`, `BEZPolygonBridge`, `wBEZ`

---

### APP 10 — DAO Governance 🟡 P2
**Carpeta:** `dao-governance/`  
**Descripción:** Plataforma de gobernanza on-chain. Los holders de BEZ-Coin votan propuestas que definen el futuro de la plataforma (nuevos sectores, parámetros económicos, actualizaciones).

**Funcionalidades Core:**
- Lista de propuestas con estado visual y contador de votos
- Votar con BEZ delegado (ERC20Votes)
- Crear propuesta (con quorum mínimo)
- Delegación de votos
- Timer Timelock para propuestas aprobadas
- Feed de actividad reciente de la DAO

**Contratos:** `GovernanceSystem`, `BEZCoinV2` (ERC20Votes), `TimelockController`

---

### APP 11 — BeZhas Explorer 🟡 P2
**Carpeta:** `bezhas-explorer/`  
**Descripción:** Explorador de bloques adaptado para empresas no-técnicas. Los hashes se traducen a lenguaje de negocio.

**Diferenciación:** En lugar de mostrar `0x7a3...f4b2 | 0 ETH | 21000 gas`, muestra:
> *"Global Logistics S.A. registró el contenedor MSKU1811882 | Aprobado por IA | Coste: $0.005"*

**Funcionalidades Core:**
- Búsqueda por address, tx hash, bloque, nombre de empresa o DID
- Vista de transacción en lenguaje natural (traducción automática de eventos de contratos)
- Métricas de red en tiempo real: TPS, bloques, gas price
- API pública REST para desarrolladores

---

### APP 12 — Developer Sandbox 🟡 P2
**Carpeta:** `developer-sandbox/`  
**Descripción:** Portal donde desarrolladores externos pueden probar el SDK de BeZhas, el ABI de los contratos y las herramientas MCP antes de construir sus propias verticales.

**Funcionalidades Core:**
- Playground interactivo del SDK (@bezhas/sdk)
- ABI Explorer: probar llamadas a contratos con Anvil local
- MCP Tool Tester: invocar las 12 herramientas con datos de prueba
- Vision API Sandbox: subir imágenes y ver el análisis Gemini
- Generador de proyectos (boilerplate de sub-app pre-configurada)
- Documentación viva con ejemplos ejecutables

**Objetivo:** Crear un ecosistema de desarrolladores terceros que construyan sobre BeZhas sin necesidad de soporte directo.

---

### APP 13 — Learn-to-Earn 🟢 P3
**Carpeta:** `learn-to-earn/`  
**Descripción:** Plataforma educativa donde usuarios ganan BEZ-Coin por completar módulos y ejecutar misiones on-chain reales.

**Funcionalidades Core:**
- Módulos de aprendizaje: texto + video + quiz interactivo
- Misiones prácticas on-chain (hacer stake, escanear activo, votar en DAO)
- Recompensas en BEZ por completar módulos
- Leaderboard y NFT badges de logros
- Certificados on-chain verificables (Verifiable Credentials)

---

## 4. Timeline Unificado — 36 Semanas

```
FASE 0: INFRAESTRUCTURA (Sem 1-2)
├── Inicializar monorepo Turborepo + pnpm workspaces
├── Crear packages/platform-sdk (auth, gas, vision, mcp)
├── Configurar variables de entorno compartidas
├── Conectar Gateway v1 SSO + DID generation
└── ENTREGABLE: Template base que todas las apps heredan

FASE 1: APPS CRÍTICAS P0 (Sem 3-10)
├── Sem 3-4:   APP 00 - Bezhas-Hub (portal central)
├── Sem 3-4:   APP 01 - BEZ Wallet (enviar/recibir/NFTs)
├── Sem 4-5:   APP 02 - Gas Tank Manager (Stripe + Aegis)
├── Sem 5-7:   APP 03 - Edge Node Manager (wizard + dashboard)
├── Sem 7-10:  APP 04 - BEZ Vision Scan (Gemini + SIFT + Minting)
└── ENTREGABLE: Red funcional con usuarios generando txs reales

FASE 2: VERTICALES INDUSTRIALES P1 (Sem 11-18)
├── Sem 11-14: APP 05 - BeZhas Customs (Aduana + SIMPLE)
├── Sem 11-16: APP 06 - BZ Capital Hub (DeFi + Trading + RWA Pools)
├── Sem 15-17: APP 07 - BZ PureScan (Food Oracle)
├── Sem 16-18: APP 08 - Retail y Lujo (Authentic)
└── ENTREGABLE: 4 verticales de venta B2B con casos de uso reales

FASE 3: ECOSISTEMA P2 (Sem 19-26)
├── Sem 19-20: APP 09 - BeZhas Bridge
├── Sem 21-22: APP 10 - DAO Governance
├── Sem 21-22: APP 11 - BeZhas Explorer
├── Sem 23-25: APP 12 - Developer Sandbox
└── ENTREGABLE: Ecosistema abierto a desarrolladores externos

FASE 4: EXPANSIÓN P3 (Sem 27+)
├── APP 13 - Learn-to-Earn
├── 11 Sector Apps restantes (template reutilizable)
└── Mobile apps (React Native / PWA)
```

---

## 5. Estructura de Carpetas — Monorepo Completo

```
D:\BeZhas-Blockchain\App-nativas\
│
├── package.json                      # Root (pnpm workspaces)
├── turbo.json                        # Turborepo pipeline config
├── .env.shared                       # Variables compartidas (copiar en cada app)
├── tsconfig.base.json                # TypeScript config base
│
├── packages/                         # Código compartido entre apps
│   ├── platform-sdk/                 # SDK unificado (auth, gas, vision, mcp)
│   ├── ui-components/                # Design system BeZhas (tokens, componentes)
│   └── bez-contracts/                # Wrappers tipados de contratos
│
└── apps/
    │
    ├── Bezhas-Hub/                   # APP 00 — Core Hub (existe en disco)
    ├── bez-wallet/                   # APP 01 — BEZ Wallet
    ├── gas-tank-manager/             # APP 02 — Corporate Gas Tank
    ├── edge-node-manager/            # APP 03 — Edge Node DePIN
    ├── BEZ_Scaner/                   # APP 04 — Vision Scan (existe en disco)
    │
    ├── Aduana y SupplyChain/         # APP 05 — BeZhas Customs (existe en disco)
    ├── BZ Capital/                   # APP 06 — DeFi + Trading Hub (existe en disco)
    ├── BZ PureScan/                  # APP 07 — Food Oracle (existe en disco)
    ├── Retail y Lujo/                # APP 08 — Authentic (existe en disco)
    │
    ├── bezhas-bridge/                # APP 09 — Bridge L2↔Polygon
    ├── dao-governance/               # APP 10 — DAO Governance
    ├── bezhas-explorer/              # APP 11 — Block Explorer
    ├── developer-sandbox/            # APP 12 — Dev Sandbox
    ├── learn-to-earn/                # APP 13 — Learn-to-Earn
    │
    └── sectors/                      # APP 14+ — Sector Apps (template)
        ├── real-estate/
        ├── healthcare/
        ├── energy/
        ├── automotive/
        ├── manufacturing/
        ├── insurance/
        ├── education/
        ├── entertainment/
        ├── legal/
        ├── government/
        └── other/
```

---

## 6. Variables de Entorno Completas

```env
# .env.shared — Base para todas las sub-apps
# Copiar como .env.local en cada app y completar valores

# ─── BeZhas L2 Network ───────────────────────────────────
NEXT_PUBLIC_BEZHAS_L2_RPC=https://rpc.bez.digital
NEXT_PUBLIC_BEZHAS_CHAIN_ID=2708
NEXT_PUBLIC_BEZHAS_EXPLORER_URL=https://explorer.bez.digital

# ─── Contratos Principales ───────────────────────────────
NEXT_PUBLIC_BEZCOIN_ADDRESS=0x...
NEXT_PUBLIC_STAKING_POOL_ADDRESS=0x...
NEXT_PUBLIC_LIQUIDITY_FARMING_ADDRESS=0x...
NEXT_PUBLIC_EDGE_NODE_REWARDS_ADDRESS=0x...
NEXT_PUBLIC_BRIDGE_L1_ADDRESS=0x...
NEXT_PUBLIC_BRIDGE_L2_ADDRESS=0x...
NEXT_PUBLIC_POLYGON_BRIDGE_ADDRESS=0x...
NEXT_PUBLIC_GOVERNANCE_ADDRESS=0x...
NEXT_PUBLIC_TREASURY_ADDRESS=0x...
NEXT_PUBLIC_LOGISTICS_NFT_ADDRESS=0x...
NEXT_PUBLIC_QUALITY_ESCROW_ADDRESS=0x...

# ─── Gateway & Auth ──────────────────────────────────────
NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001/api/gateway/v1
JWT_SECRET=your_jwt_secret_here

# ─── Aegis IA ────────────────────────────────────────────
NEXT_PUBLIC_AEGIS_URL=http://localhost:8001
AEGIS_INTERNAL_API_KEY=your_aegis_key_here

# ─── MCP Tools ───────────────────────────────────────────
NEXT_PUBLIC_MCP_URL=http://localhost:3002

# ─── Gemini Vision API ───────────────────────────────────
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-1.5-pro-vision

# ─── Stripe (Gas Tank) ───────────────────────────────────
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ─── Integraciones Externas ──────────────────────────────
SIMPLE_API_URL=https://api.agenciatributaria.es     # Aduana España
SIMPLE_API_KEY=your_simple_key_here
ASYCUDA_API_URL=https://api.asycuda.org             # Aduana internacional

# ─── Platform Config ─────────────────────────────────────
NEXT_PUBLIC_PLATFORM_NAME=BeZhas
NEXT_PUBLIC_APP_ENV=development                     # development | staging | production
NEXT_PUBLIC_SUPPORTED_CHAINS=2708,137,1,80002,11155111
```

---

## 7. Patrones de Integración SDK

### Patrón 1: Escanear y Registrar Activo (BEZ_Scaner → Blockchain)

```typescript
import { useGeminiVision, useContractCall, useGasTank } from '@bezhas/platform-sdk';

function ScanAndMint() {
  const { analyzeAsset } = useGeminiVision();
  const { write } = useContractCall('BeZhasLogisticsNFT');
  const { estimateCost } = useGasTank();

  const handleScan = async (imageFile: File) => {
    // 1. Análisis Vision IA
    const vision = await analyzeAsset(imageFile, 'quality-check');
    // → { verdict: 'APPROVED', confidence: 0.97, fingerprintHash: '0x...' }

    // 2. Estimar coste de gas
    const cost = await estimateCost('mintLogisticsNFT');
    // → { usd: 0.005, bez: 0.05 }

    // 3. Minting del NFT (gas pagado por Paymaster transparentemente)
    const tx = await write('mintLogisticsNFT', {
      recipient: userAddress,
      metadataHash: vision.fingerprintHash,
      verdict: vision.verdict,
      sector: 'logistics'
    });

    return tx.hash;
  };
}
```

### Patrón 2: Invocar Herramienta MCP desde cualquier App

```typescript
import { useMCPTool } from '@bezhas/platform-sdk';

const { invoke } = useMCPTool();

// Desde Aduana y SupplyChain: optimizar ruta de envío
const route = await invoke('optimize-route', {
  origin: 'Valencia, ES',
  destination: 'Hamburg, DE',
  cargoNFT: '0x...',
  priority: 'customs-fast'
});

// Desde Retail y Lujo: evaluar riesgo de fraude
const fraud = await invoke('assess-fraud-risk', {
  assetFingerprint: siftHash,
  marketplaceSource: 'amazon',
  sellerDid: 'did:bezhas:0x...'
});
```

### Patrón 3: Identidad DID en cualquier App

```typescript
import { useBezhasUID } from '@bezhas/platform-sdk';

function ProfileWidget() {
  const { identity, credentials, isLoading } = useBezhasUID();

  // identity.did → "did:bezhas:0x7a3...f4b2"
  // identity.reputation_score → 847
  // identity.credentials → [{ type: 'LogisticsLicense', issuer: 'BeZhas', ... }]
  // identity.verified_assets → 1240 (activos RWA registrados)
}
```

---

## 8. Sistema de Diseño — Tokens Visuales

Todas las apps siguen este sistema de diseño unificado:

```css
/* packages/ui-components/tokens.css */

:root {
  /* Colores Principales */
  --bezhas-primary:     #00D4FF;    /* Cyan — identidad BeZhas */
  --bezhas-secondary:   #7B2FFF;    /* Violeta */
  --bezhas-accent:      #FF6B35;    /* Naranja — acciones críticas */

  /* Fondos */
  --bezhas-bg:          #0A0E1A;    /* Navy oscuro */
  --bezhas-surface:     #111827;    /* Surface cards */
  --bezhas-surface-2:   #1F2937;    /* Surface elevated */
  --bezhas-border:      #374151;    /* Bordes */

  /* Semánticos */
  --bezhas-success:     #10B981;    /* Aprobado, completado */
  --bezhas-warning:     #F59E0B;    /* Alerta, pendiente */
  --bezhas-error:       #EF4444;    /* Rechazado, error */
  --bezhas-info:        #3B82F6;    /* Información */

  /* Vision States */
  --vision-approved:    #10B981;    /* SIFT match confirmado */
  --vision-rejected:    #EF4444;    /* SIFT no coincide */
  --vision-scanning:    #F59E0B;    /* Análisis en curso */

  /* Tipografía */
  --font-display:       'Syne', sans-serif;        /* Títulos */
  --font-body:          'DM Sans', sans-serif;     /* Cuerpo */
  --font-mono:          'JetBrains Mono', mono;   /* Hashes, código */
}
```

---

## 9. Inicialización del Monorepo (PowerShell)

```powershell
# Ejecutar desde D:\BeZhas-Blockchain\

# 1. Crear directorio si no existe
if (!(Test-Path "App-nativas")) {
  New-Item -ItemType Directory -Name "App-nativas"
}
cd "App-nativas"

# 2. Inicializar pnpm workspaces
pnpm init
pnpm add -D turbo typescript

# 3. Crear turbo.json
@'
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
'@ | Out-File -FilePath "turbo.json" -Encoding utf8

# 4. Crear pnpm-workspace.yaml
@'
packages:
  - "apps/*"
  - "apps/sectors/*"
  - "packages/*"
'@ | Out-File -FilePath "pnpm-workspace.yaml" -Encoding utf8

# 5. Crear estructura de packages compartidos
New-Item -ItemType Directory -Path "packages/platform-sdk", "packages/ui-components", "packages/bez-contracts"

# 6. Crear estructura de apps (las que no existen en disco)
$newApps = @(
  "apps/bez-wallet",
  "apps/gas-tank-manager",
  "apps/edge-node-manager",
  "apps/bezhas-bridge",
  "apps/dao-governance",
  "apps/bezhas-explorer",
  "apps/developer-sandbox",
  "apps/learn-to-earn"
)
foreach ($app in $newApps) {
  New-Item -ItemType Directory -Path $app -Force
}

# 7. Copiar .env.shared a cada app como .env.example
$allApps = Get-ChildItem -Path "apps" -Directory
foreach ($app in $allApps) {
  Copy-Item ".env.shared" "$($app.FullName)/.env.example" -ErrorAction SilentlyContinue
}

# 8. Inicializar primera app (Bezhas-Hub)
cd "apps\Bezhas-Hub"
pnpm create next-app@latest . --typescript --tailwind --app --src-dir --no-git

Write-Host "✅ Monorepo BeZhas Sub-Apps inicializado correctamente" -ForegroundColor Green
Write-Host "📁 Estructura creada en: D:\BeZhas-Blockchain\App-nativas" -ForegroundColor Cyan
Write-Host "🚀 Próximo paso: cd apps\Bezhas-Hub && pnpm dev" -ForegroundColor Yellow
```

---

## 10. Decisiones de Arquitectura — Registro de Cambios vs Planes Anteriores

| Decisión | Plan Anterior | Plan 3.0 | Razón |
|----------|-------------|----------|-------|
| **BZ Capital** | DeFi Hub (v1) + Trading Analytics (v1) como apps separadas | Una sola app: BZ Capital Hub | Evita duplicación de auth/gas/estado. Usuario ve todo su capital en un lugar |
| **Gas Tank** | App standalone con recarga Stripe | Gas Tank + Aegis GasPredictor integrado | El timing inteligente reduce costes reales para el cliente |
| **Identidad** | `bezhas_uid` (objeto JS simple) | `bezhas_uid` → DID W3C compatible | Credenciales BeZhas reconocibles por sistemas externos (aduanas, bancos) |
| **BEZ_Scaner** | Parte de sector/logistics en v1 | App P0 independiente | Es la tecnología diferenciadora. Debe ser el showcase principal |
| **Aduana** | `sectors/logistics` genérico | `Aduana y SupplyChain` específico (nombre real en disco) | Conserva nombre exacto de carpeta existente |
| **MCP** | No documentado en sub-apps | Capa de infraestructura en platform-sdk | Herramientas IA disponibles en todas las apps sin configuración extra |
| **Vision** | No existía | Capa `vision/` en platform-sdk | Gemini Vision es la columna vertebral de los verticales industriales |
| **Developer Sandbox** | No existía | APP 12, P2 | Clave para ecosistema open: devs externos construyen sobre BeZhas |

---

*Documento generado: Mayo 2026 — BeZhas Blockchain Initiative*  
*Reemplaza: BEZHAS_SUBAPPS_PLAN.md (v2.0) + BEZHAS_INTEGRATED_ECOSYSTEM_PLAN.md (v2.0)*  
*Próxima revisión: Al completar Fase 1 — Semana 10*
