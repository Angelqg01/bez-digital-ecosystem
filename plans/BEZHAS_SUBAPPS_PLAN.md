# BeZhas — Plan de Desarrollo de Sub-Aplicaciones (Integrado)
**Ruta base:** `D:\BeZhas-Blockchain\App-nativas`  
**Fecha:** Mayo 2026  
**Versión:** 2.0  
**Estado:** Evolución de Blueprint a Ecosistema Inteligente

---

## 0. Contexto Estratégico: La Blockchain con "Ojos"

Las Sub-Apps de BeZhas han evolucionado de ser simples herramientas Web3 a ser **Verticales de Inteligencia Industrial**. Su propósito es doble:

1. **Onboarding por Utilidad Real:** El cliente no usa "blockchain", usa una IA que valida sus productos y usa la blockchain para certificar esa verdad de forma inmutable.
2. **Tokenización RWA (Real World Assets):** Cada escaneo volumétrico o verificación de calidad (SIFT) crea un "Gemelo Digital" en la L2 de BeZhas, activando la economía del token $BEZ.
3. **Ecosistema de Confianza Zero-Knowledge:** Todas las apps comparten una **Identidad Descentralizada (DID)** y un **Corporate Gas Tank**, eliminando la fricción técnica para las empresas.

---

## 1. Arquitectura Compartida (BeZhas Platform ID)

### 1.1 El `bezhas_uid` — Identidad Unificada

Cada usuario/empresa tiene un único identificador que atraviesa todas las sub-apps:

```
bezhas_uid = {
  wallet_address: "0x...",        // Dirección en BeZhas L2
  platform_id: "BZH-2026-XXXXX", // ID legible para humanos
  tier: "enterprise" | "pro" | "free",
  gas_tank_balance: 425.50,       // En USD (Corporate Gas Tank)
  bez_balance: 2450,              // BEZ-Coin
  reputation_score: 847,          // Score de reputación cross-app
  sectors: ["logistics", "defi"], // Sectores activos
  edge_nodes: 2                   // Nodos DePIN activos
}
```

### 1.2 Stack Compartido por Todas las Apps

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| **Framework** | Next.js 14+ (App Router) | Ya usado en Control Center |
| **Auth** | SIWE + JWT (Gateway v1) | SSO unificado del ecosistema |
| **Web3** | Ethers.js v6 + SDK BeZhas v3 | SDK interno con 66+ contratos |
| **Estado** | Zustand + React Query | Ligero, compatible con SSR |
| **UI Base** | TailwindCSS + Shadcn/ui | Consistencia visual cross-app |
| **Notificaciones** | SSE desde Agent Runtime | Alertas en tiempo real |
| **Gas** | Paymaster / Corporate Gas Tank | Usuario nunca ve gas crudo |

### 1.3 Módulo Compartido: `@bezhas/platform-sdk`

```
packages/platform-sdk/
├── auth/
│   ├── useBezhasAuth.ts        # Hook: login SIWE + JWT
│   └── PlatformGuard.tsx       # HOC de protección de rutas
├── identity/
│   ├── useBezhasUID.ts         # Hook: obtener/persistir bezhas_uid
│   └── ReputationBadge.tsx     # Componente de reputación cross-app
├── gas/
│   ├── useGasTank.ts           # Hook: saldo, alertas, recarga
│   └── GasIndicator.tsx        # Barra de gas en todas las apps
├── wallet/
│   ├── useBEZBalance.ts        # Hook: balance BEZ en tiempo real
│   └── QuickTransfer.tsx       # Componente de transferencia rápida
└── navigation/
    ├── AppSwitcher.tsx          # Navegador entre sub-apps
    └── routes.ts               # Rutas centralizadas del ecosistema
```

---

## 2. Inventario de Sub-Apps — Priorización

### Matriz de Prioridad

| # | App | Impacto Red | Tiempo Dev | Prioridad |
|---|-----|------------|------------|-----------|
| 1 | **BEZ Wallet** | Crítico | 2 sem | 🔴 P0 |
| 2 | **Edge Node Manager** | Crítico (DePIN) | 3 sem | 🔴 P0 |
| 3 | **Gas Tank Manager** | Crítico (B2B) | 2 sem | 🔴 P0 |
| 4 | **DeFi Hub** (Staking/Farming) | Alto | 3 sem | 🟠 P1 |
| 5 | **BeZhas Bridge** | Alto | 2 sem | 🟠 P1 |
| 6 | **DAO Governance** | Medio | 3 sem | 🟡 P2 |
| 7 | **BeZhas Explorer** | Medio | 2 sem | 🟡 P2 |
| 8 | **Trading & Analytics** | Alto (usuarios) | 4 sem | 🟠 P1 |
| 9 | **Sector Onboarding Apps** (16) | Alto (B2B) | 2 sem c/u | 🟡 P2 |
| 10 | **Learn-to-Earn** | Bajo-Medio | 3 sem | 🟢 P3 |

---

## 3. Detalle por Sub-App

---

### APP 01 — BEZ Wallet 🔴 P0

**Ruta:** `App-nativas/bez-wallet/`  
**Descripción:** Wallet no-custodial con UX Web2.5 — el usuario nunca ve claves privadas ni frases semilla.

**Funcionalidades Core:**
- Saldo BEZ + historial de transacciones en BeZhas L2
- Enviar/Recibir BEZ con dirección o QR
- Ver saldo en USD (oráculo de precio integrado)
- Historial de gas consumido (con equivalente en USD)
- Notificaciones push de transacciones entrantes (SSE)
- Recuperación de wallet vía WalletGuardian (social recovery)

**Pantallas:**
```
/bez-wallet
├── / (Overview: saldo, últimas txs, acciones rápidas)
├── /send (Envío con validación de address y confirmación)
├── /receive (QR + address copiable)
├── /history (Lista filtrable de transacciones)
├── /settings (Seguridad, sesiones, Guardian)
└── /onboarding (Tour de 4 pasos para usuarios nuevos)
```

**Contratos que usa:** `BEZCoinV2`, `SmartWallet`, `WalletGuardian`, `Paymaster`

**Métrica de éxito:** Tiempo de primera transacción < 3 minutos para un usuario nuevo.

---

### APP 02 — Edge Node Manager 🔴 P0

**Ruta:** `App-nativas/edge-node-manager/`  
**Descripción:** Panel de configuración, monitorización y gestión de nodos DePIN para empresas.

**Funcionalidades Core:**
- Onboarding wizard (5 pasos): registro → generación de API Key → comando Docker → verificación → activación
- Dashboard de estado del nodo (online/offline, latencia, uptime)
- Métricas de contribución: webhooks procesados, puntos acumulados, BEZ ganados
- Historial de recompensas con gráfico temporal
- Gestión de múltiples nodos por empresa
- Alertas cuando el nodo se desconecta (SSE + email)
- Botón "Reclamar BEZ" (llama a `EdgeNodeRewards`)

**Pantallas:**
```
/edge-node-manager
├── / (Dashboard: estado de todos los nodos)
├── /setup (Wizard de instalación paso a paso)
├── /node/:id (Detalle de un nodo: métricas, logs, config)
├── /rewards (Historial de recompensas + reclamación)
├── /keys (Gestión de API Keys)
└── /logs (Logs en tiempo real vía SSE)
```

**Contratos que usa:** `EdgeNodeRewards`, `ValidatorRegistry`

**Comando generado dinámicamente:**
```bash
docker run -d --name bezhas-edge \
  -e API_KEY="${apiKey}" \
  -e BEZHAS_L2_RPC_URL="https://rpc.bez.digital" \
  -e REWARDS_CONTRACT_ADDRESS="${contractAddress}" \
  bezhas/edge-node:latest
```

**Métrica de éxito:** Empresa activa primer nodo en < 10 minutos desde el registro.

---

### APP 03 — Corporate Gas Tank Manager 🔴 P0

**Ruta:** `App-nativas/gas-tank-manager/`  
**Descripción:** Sistema de gestión de gas empresarial con recarga en Fiat (Stripe). El equipo contable nunca compra crypto directamente.

**Funcionalidades Core:**
- Saldo actual en USD con equivalencia en BEZ
- Estimación de transacciones restantes (a $0.005/tx)
- Recarga manual con tarjeta (Stripe Checkout)
- Configuración de Auto-Recarga (umbral + importe)
- Historial de recargas y consumo
- Alertas de saldo bajo (configurable)
- Facturación descargable (PDF) para contabilidad
- Resumen de consumo por departamento/sector

**Pantallas:**
```
/gas-tank
├── / (Overview: saldo, consumo últimos 30d, alertas)
├── /recharge (Modal Stripe: monto → pago → confirmación)
├── /auto-recharge (Configurar recarga automática)
├── /history (Historial: recargas + consumo por fecha)
├── /billing (Facturas descargables)
└── /settings (Umbral de alerta, método de pago default)
```

**Integraciones:** Stripe SDK, `gasMonitor.js` (backend BeZhas)

**Métrica de éxito:** Directora financiera puede recargar gas en < 2 minutos sin saber qué es una blockchain.

---

### APP 04 — DeFi Hub 🟠 P1

**Ruta:** `App-nativas/defi-hub/`  
**Descripción:** Interfaz unificada de DeFi — Staking, Yield Farming, historial de rendimientos y gestión de posiciones.

**Funcionalidades Core:**

**Staking:**
- Ver pools disponibles (con APY, lockup, tier boost)
- Hacer stake con slider de cantidad
- Ver posiciones activas y recompensas acumuladas
- Unstake (respetando períodos de bloqueo)
- Gráfico histórico de rendimientos

**Yield Farming:**
- Ver pares de liquidez disponibles
- Añadir/retirar liquidez
- Cosechar rewards (harvest)
- Ver APY actual vs histórico

**Portfolio:**
- Vista consolidada: staking + farming + wallet
- Valor total en USD en tiempo real
- Proyección de rendimientos a 30/90/365 días

**Pantallas:**
```
/defi-hub
├── / (Overview: portfolio total, resumen de posiciones)
├── /staking
│   ├── / (Lista de pools con APY)
│   ├── /pool/:id (Detalle + acción stake/unstake)
│   └── /positions (Mis posiciones activas)
├── /farming
│   ├── / (Lista de pares de liquidez)
│   ├── /pair/:id (Añadir/retirar liquidez)
│   └── /positions (Mis posiciones LP)
└── /history (Historial completo de operaciones DeFi)
```

**Contratos que usa:** `StakingPool`, `LiquidityFarming`, `BEZCoinV2`, `Treasury`

---

### APP 05 — BeZhas Bridge 🟠 P1

**Ruta:** `App-nativas/bezhas-bridge/`  
**Descripción:** Puente multi-cadena simplificado: BeZhas L2 ↔ Polygon ↔ Ethereum L1.

**Funcionalidades Core:**
- Selector de red origen/destino (BeZhas L2, Polygon, Ethereum)
- Input de cantidad con equivalente USD en tiempo real
- Estimación de tiempo y fee de bridge
- Estado de transferencias en curso (progreso en tiempo real)
- Historial de bridges realizados
- Alertas cuando el bridge completa

**Flujo:**
```
1. Seleccionar: Red Origen → Red Destino
2. Cantidad + token (BEZ / wBEZ / USDT / USDC)
3. Revisar: tiempo estimado + fee
4. Confirmar → Firmar (invisible si hay Paymaster activo)
5. Seguimiento en tiempo real (4 pasos: Iniciado → Verificado → Enrutado → Completado)
```

**Contratos que usa:** `L1Bridge`, `BridgeL2`, `BEZPolygonBridge`, `wBEZ`

---

### APP 06 — DAO Governance 🟡 P2

**Ruta:** `App-nativas/dao-governance/`  
**Descripción:** Plataforma de gobernanza on-chain para holders de BEZ-Coin.

**Funcionalidades Core:**
- Lista de propuestas activas con estado visual (Activa / Aprobada / Rechazada / En Ejecución)
- Detalle de propuesta: descripción, código de ejecución, votos a favor/contra
- Votar (requiere BEZ delegado)
- Crear propuesta (requiere quorum mínimo)
- Delegación de votos a otro address
- Historial de votaciones del usuario
- Timer de Timelock para propuestas aprobadas

**Contratos que usa:** `GovernanceSystem`, `BEZCoinV2` (ERC20Votes), `TimelockController`

---

### APP 07 — BeZhas Explorer 🟡 P2

**Ruta:** `App-nativas/bezhas-explorer/`  
**Descripción:** Explorador de bloques adaptado para usuarios no-técnicos. Sin hashes intimidantes — todo traducido a lenguaje de negocio.

**Funcionalidades Core:**
- Búsqueda por: address, tx hash, bloque, nombre de empresa
- Vista de transacción en lenguaje natural: "Global Logistics S.A. registró el contenedor MSKU1811882 — Aprobado por IA"
- Métricas de red en tiempo real: TPS, bloques, gas price
- Tabla de validadores activos
- Eventos recientes de contratos sectoriales (traducidos)
- API pública para desarrolladores

---

### APP 08 — Trading & Analytics Platform 🟠 P1

**Ruta:** `App-nativas/trading-analytics/`  
**Descripción:** Plataforma SaaS de análisis de mercado y estrategias de trading para BEZ-Coin y activos tokenizados. Multi-asset (crypto + RWA).

**Módulos:**

**Análisis Técnico:**
- Gráficos TradingView integrados (OHLCV BEZ/USD, BEZ/BNB, BEZ/MATIC)
- Indicadores: RSI, MACD, Bollinger Bands, EMA/SMA, Fibonacci
- Señales automáticas (basadas en cruce de indicadores)
- Alertas de precio (push + email)

**Análisis Fundamental:**
- Métricas on-chain: supply circulante, volumen staking, TVL DeFi, nodos activos
- Actividad de wallets: top holders, movimientos grandes
- Correlación con mercado cripto general
- Dashboard de tokenomics en tiempo real (emisión diaria, daily caps)

**Bot de Trading:**
- Configuración de estrategias (DCA, grid trading, RSI-based)
- Paper trading (simulación sin capital real)
- Live trading (conectado a DEX / liquidity pools de BeZhas)
- P&L en tiempo real
- Historial de operaciones

**Carteras de Inversión:**
- Crear carteras con BEZ + activos RWA tokenizados
- Rebalanceo automático según reglas
- Análisis de riesgo (volatilidad, correlación)
- Proyección de rendimientos (staking + farming + precio)

**Pantallas:**
```
/trading-analytics
├── / (Market Overview: precio BEZ, métricas clave)
├── /charts (Gráficos técnicos interactivos)
├── /fundamentals (Métricas on-chain + tokenomics)
├── /bot
│   ├── / (Mis bots: estado, P&L)
│   ├── /create (Wizard de configuración)
│   └── /backtest (Simulación histórica)
├── /portfolio
│   ├── / (Resumen de carteras)
│   ├── /create (Nueva cartera)
│   └── /:id (Detalle + rebalanceo)
└── /alerts (Gestión de alertas de precio)
```

**Nota de integración:** Conecta con `GasPredictor` de Aegis para optimizar el timing de operaciones.

---

### APP 09 — Sector Onboarding Apps (×16) 🟡 P2

**Ruta:** `App-nativas/sectors/[sector-name]/`  
**Descripción:** Una mini-app por sector que guía a la empresa a automatizar su primer proceso en BeZhas.

**Estructura común (template reusable):**
```
sectors/[sector]/
├── / (Landing: problema → solución → beneficio)
├── /demo (Simulación interactiva del flujo)
├── /setup (Wizard de configuración de contratos)
├── /monitor (Dashboard de operaciones del sector)
└── /docs (Documentación específica del sector)
```

**Sectores prioritarios para desarrollo:**
1. `logistics` — Registro de manifiestos, trazabilidad contenedores
2. `real-estate` — Tokenización de propiedades, contratos de alquiler
3. `finance` — Préstamos, factoring, scoring crediticio
4. `healthcare` — Historial médico, reclamaciones de seguro
5. `supply-chain` — Cadena de suministro completa

---

### APP 10 — Learn-to-Earn 🟢 P3

**Ruta:** `App-nativas/learn-to-earn/`  
**Descripción:** Plataforma educativa donde los usuarios aprenden a usar BeZhas y ganan BEZ-Coin por completar lecciones y misiones.

**Funcionalidades Core:**
- Módulos de aprendizaje (texto + video + quiz)
- Misiones prácticas on-chain (hacer stake, registrar un activo, etc.)
- Recompensas en BEZ por completar módulos
- Leaderboard y logros (NFT badges)
- Certificados on-chain verificables

---

## 4. Plan de Desarrollo — Timeline

### Fase 0: Infraestructura Base (Semana 1-2)
**Objetivo:** Monorepo de sub-apps operativo con autenticación unificada.

```
[ ] Inicializar monorepo en D:\BeZhas-Blockchain\App-nativas\
[ ] Configurar Turborepo / pnpm workspaces
[ ] Crear packages/platform-sdk con auth, gas, wallet hooks
[ ] Implementar AppSwitcher (navegación cross-apps)
[ ] Setup de variables de entorno compartidas
[ ] Conectar Gateway v1 SSO
```

**Entregable:** Template base funcional con auth SIWE que todas las apps heredan.

---

### Fase 1: Apps Críticas — P0 (Semana 3-8)

| Semana | App | Entregable |
|--------|-----|-----------|
| 3-4 | BEZ Wallet | Enviar/Recibir BEZ + historial |
| 4-5 | Gas Tank Manager | Recarga Stripe + auto-recarga |
| 5-7 | Edge Node Manager | Wizard + dashboard de nodo |
| 7-8 | Integración & QA P0 | Las 3 apps conectadas con SSO |

---

### Fase 2: Apps de Valor — P1 (Semana 9-16)

| Semana | App | Entregable |
|--------|-----|-----------|
| 9-11 | DeFi Hub | Staking + Farming completo |
| 11-12 | BeZhas Bridge | Bridge L2↔Polygon funcional |
| 12-16 | Trading & Analytics | Gráficos + Bot + Portfolio |

---

### Fase 3: Ecosistema — P2 (Semana 17-24)

| Semana | App | Entregable |
|--------|-----|-----------|
| 17-18 | DAO Governance | Votación on-chain |
| 18-19 | BeZhas Explorer | Explorador amigable |
| 19-24 | Sector Apps (×5) | Logistics, Real Estate, Finance, Healthcare, Supply Chain |

---

### Fase 4: Expansión — P3 (Semana 25+)

- Learn-to-Earn platform
- 11 Sector Apps restantes
- Mobile apps (React Native / PWA)

---

## 5. Estructura de Carpetas — Monorepo

```
D:\BeZhas-Blockchain\App-nativas\
│
├── package.json                    # Root package (pnpm workspaces)
├── turbo.json                      # Turborepo config
├── .env.shared                     # Variables compartidas
│
├── packages/
│   ├── platform-sdk/               # SDK compartido (auth, gas, wallet)
│   ├── ui-components/              # Componentes visuales BeZhas
│   └── bez-contracts/              # Wrappers de contratos para frontend
│
└── apps/
    ├── bez-wallet/                 # APP 01
    ├── edge-node-manager/          # APP 02
    ├── gas-tank-manager/           # APP 03
    ├── defi-hub/                   # APP 04
    ├── bezhas-bridge/              # APP 05
    ├── dao-governance/             # APP 06
    ├── bezhas-explorer/            # APP 07
    ├── trading-analytics/          # APP 08
    ├── sectors/
    │   ├── logistics/              # APP 09a
    │   ├── real-estate/            # APP 09b
    │   ├── finance/                # APP 09c
    │   ├── healthcare/             # APP 09d
    │   ├── supply-chain/           # APP 09e
    │   └── [11 más...]
    └── learn-to-earn/              # APP 10
```

---

## 6. Variables de Entorno Compartidas

```env
# .env.shared — Copiar a cada app como .env.local

# BeZhas L2
NEXT_PUBLIC_BEZHAS_L2_RPC=https://rpc.bez.digital
NEXT_PUBLIC_BEZHAS_CHAIN_ID=2708
NEXT_PUBLIC_BEZCOIN_ADDRESS=0x...
NEXT_PUBLIC_STAKING_POOL_ADDRESS=0x...
NEXT_PUBLIC_EDGE_NODE_REWARDS_ADDRESS=0x...
NEXT_PUBLIC_BRIDGE_ADDRESS=0x...

# Gateway & Auth
NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001/api/gateway/v1
NEXT_PUBLIC_AEGIS_URL=http://localhost:8001
JWT_SECRET=...

# Stripe (Gas Tank)
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_SECRET_KEY=sk_...

# Platform
NEXT_PUBLIC_PLATFORM_NAME=BeZhas
NEXT_PUBLIC_APP_ENV=development
```

---

## 7. Primer Paso Recomendado

**¿Por qué empezar por BEZ Wallet + Gas Tank juntos?**

- Sin wallet, el usuario no puede interactuar con ninguna app.
- Sin Gas Tank, las empresas no pueden pagar transacciones.
- Son los únicos dos módulos que desbloquean todo lo demás.
- Tiempo total de desarrollo: ~4 semanas para tener un MVP funcional de ambos.

### Comando de inicialización del monorepo (PowerShell):

```powershell
# Desde D:\BeZhas-Blockchain\
New-Item -ItemType Directory -Name "App-nativas"
cd "App-nativas"

# Inicializar con pnpm
pnpm init
pnpm add -D turbo

# Crear estructura base
New-Item -ItemType Directory -Path "apps/bez-wallet", "apps/gas-tank-manager", "packages/platform-sdk"

# Crear turbo.json
@'
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {}
  }
}
'@ | Out-File -FilePath "turbo.json" -Encoding utf8

# Inicializar primera app
cd apps/bez-wallet
pnpm create next-app@latest . --typescript --tailwind --app --src-dir
```

---

## 8. Decisión de Diseño — Identidad Visual

Todas las apps deben seguir el mismo sistema de diseño:

| Token | Valor |
|-------|-------|
| Primary | `#00D4FF` (Cyan BeZhas) |
| Secondary | `#7B2FFF` (Violeta) |
| Background | `#0A0E1A` (Navy oscuro) |
| Surface | `#111827` |
| Success | `#10B981` |
| Warning | `#F59E0B` |
| Error | `#EF4444` |
| Font Display | `Syne` (títulos) |
| Font Body | `DM Sans` (cuerpo) |
| Font Mono | `JetBrains Mono` (código/hashes) |

---

*Documento generado: Mayo 2026 — BeZhas Blockchain Initiative*  
*Próxima revisión: Al completar Fase 1 (Semana 8)*
