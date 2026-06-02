# CLAUDE.md — BeZhas Master Context File
> [!IMPORTANT]
> **ESTÁNDAR DE PROYECTO: PNPM v11+**. NUNCA usar `npm` ni `yarn`.
> Todos los `package-lock.json` han sido eliminados. Usa solo `pnpm`.


# Leer este archivo SIEMPRE al inicio de cada sesión.

# Válido para: Claude Code (terminal) \+ Cowork (desktop) \+ Claude.ai (MCPs)

---

## 🏢 EMPRESA Y PROYECTO

**Empresa:** BeZhas  
**Fundador/Dev principal:** Yoel  
**Ubicación:** Algeciras, España  
**Marco regulatorio:** AEAT · MiCA (UE) · SEPA · DAC8  
**Tipo de proyecto:** Plataforma SaaS \+ Blockchain L2 propia \+ Token nativo BEZ-Coin

### Qué es BeZhas

BeZhas es un ecosistema blockchain empresarial B2B con:

- Plataforma SaaS de trading (bots IA, análisis técnico/fundamental, carteras)  
- Blockchain L2 propia desplegada en BNB Chain (BEP-20) y Polygon (ERC-20)  
- Token nativo BEZ-Coin con utilidad real (gas fees, staking, DAO, pagos)  
- SDK B2B para sectores: logística, aduanas, RWA, pagos internacionales  
- Capa de IA: OpenClaw (orquestador multi-LLM propio)  
- Gestión empresarial automatizada (12 departamentos via n8n/IA)

### Propuesta de valor clave

"No vendes software, ofreces un ecosistema de socios pre-verificados." El token BEZ-Coin NO es especulación, es combustible de eficiencia operativa.

---

## 📁 ESTRUCTURA DE DIRECTORIOS

D:\\Documentos D\\Documentos Yoe\\BeZhas\\

│

├── BeZhas Blockchain\\              ← SOURCE OF TRUTH (contratos Solidity)

│   ├── smart-contracts/src/        ← .sol files (Foundry project)

│   ├── smart-contracts/abi/        ← ABIs compilados (forge build)

│   ├── smart-contracts/deployments/← Addresses por chainId

│   ├── smart-contracts/script/     ← Deploy scripts (Solidity)

│   ├── core/                       ← Runtime JS modules (orchestrator, memory, etc.)

│   └── index.js                    ← Bootstrap entry point

│

├── BeZhas Web\\bezhas-web3\\         ← Frontend React/Vite/Web3

│   ├── src/

│   │   ├── abis/                   ← ABIs sincronizados (NO editar manualmente)

│   │   ├── contracts/              ← addresses.ts por red

│   │   ├── hooks/                  ← Hooks Web3 (useBeZhasPayment, etc.)

│   │   ├── components/             ← UI componentes

│   │   └── config/chains.ts        ← Config redes

│   └── sync.lock

│

├── OpenClaw\\                       ← Orquestador IA multi-LLM

│   ├── src/

│   │   ├── ConfigManager.js        ← Singleton 4-layer config \+ SHA-256

│   │   ├── TokenManager.js         ← JWT auto-refresh in-memory

│   │   ├── SkillRegistry.js        ← Hot-reload de skills

│   │   └── providers/             ← Claude, Gemini, GPT-4o, DeepSeek, LLaMA

│   └── docker-compose.yml

│

└── \[otros proyectos BeZhas\]

---

## 🔑 CONTRATOS DEPLOYADOS (NUNCA CAMBIAR SIN CONFIRMACIÓN)

| Contrato | Red | Address |
| :---- | :---- | :---- |
| BEZ Token | **Polygon** | `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8` |
| BEZ Token | **BNB Chain** | `0x8a1e3930fde1f151471c368fdbb39f3f63a65b55` |
| Treasury DAO | BSC+Polygon | `0x89c23890c742d710265dD61be789C71dC8999b12` |
| QualityEscrow/Safe | BSC+Polygon | `0x3EfC42095E8503d41Ad8001328FC23388E00e8a3` |
| Hot Wallet | BSC+Polygon | `0x52Df82920CBAE522880dD7657e43d1A754eD044E` |

### Contratos Solidity registrados

| Contrato | Función |
| :---- | :---- |
| `BezhasToken` | Token BEZ-Coin (ERC-20/BEP-20) |
| `BeZhasCore` | Lógica central plataforma |
| `BeZhasMarketplace` | Marketplace de servicios |
| `StakingPoolV2` | Staking BEZ \+ rewards |
| `QualityOracle` | Oracle de datos |
| `BeZhasDAO` | Gobernanza DAO |
| `BeZhasPayment` | Procesador de pagos nativo |
| `BeZhasVesting` | Vesting de tokens |
| `BeZhasLiquidity` | LP Manager DeFi |

---

## 🌐 REDES SOPORTADAS

BSC\_MAINNET:    { chainId: 56,    rpc: 'https://bsc-dataseed.binance.org' }

BSC\_TESTNET:    { chainId: 97,    rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545' }

POLYGON:        { chainId: 137,   rpc: 'https://polygon-rpc.com' }

POLYGON\_MUMBAI: { chainId: 80001, rpc: 'https://rpc-mumbai.maticvigil.com' }

---

## 🖥️ INFRAESTRUCTURA Y ENDPOINTS

| Servicio | Endpoint |
| :---- | :---- |
| API Backend | `api.bez.digital:3001` |
| WebSocket | `ws.bez.digital:3002` |
| MCP Server | `mcp.bez.digital:4001` |
| Ollama (dev) | `localhost:11434` |

### Hardware del servidor principal

- CPU: Threadripper  
- GPU: **RTX 4090** (GPU passthrough para Ollama/Docker)  
- RAM: 128 GB  
- OS: Windows 11 \+ WSL2 / Ubuntu

### Ollama — Modo actual

**OPCIÓN 1 activa (desarrollo):** Daemon manual en `localhost:11434`  
→ Cambiar a **Opción 3** (Docker Compose \+ GPU passthrough) cuando la plataforma esté lista para producción.

---

## 🤖 OPENCLAW — ORQUESTADOR IA

### Cadena de fallback LLM (en orden)

1\. Claude (Anthropic API)        ← Primario

2\. Gemini 2.0 Flash              ← ⚠️ USAR gemini-2.0-flash (NO gemini-1.5-flash — DEPRECATED)

3\. GPT-4o (OpenAI)

4\. DeepSeek

5\. LLaMA local (Q3\_K\_M via Ollama)  ← Último recurso

### Regla crítica para providers

Siempre especificar campos explícitos:

{ "provider": "google", "modelId": "gemini-2.0-flash" }

### Componentes clave

- `ConfigManager.js` — Singleton, 4-layer config, SHA-256 checksums  
- `TokenManager.js` — JWT auto-refresh, **in-memory only** (nunca a disco)  
- `SkillRegistry.js` — Hot-reload de skills sin reinicio  
- Test suite: 9 tests pasando, zero dependencias pnpm externas

---

## 🔄 SYNC DAEMON (bezhas\_blockchain ↔ bezhas\_web3)

### Cuándo ejecutar sync

SIEMPRE después de: compilar contratos, modificar ABIs, nuevo deploy, cambio de address.

\# Sync manual único

node sync-daemon.js \--once

\# Modo desarrollo (watch)

node sync-daemon.js \--watch

\# Validar sin copiar

node sync-daemon.js \--dry-run

\# Estado actual

node sync-daemon.js \--status

### Reglas de sync (NUNCA violar)

1. Nunca sobreescribir ABI si hash MD5 no cambió  
2. Mantener `.bak` del archivo anterior antes de sobreescribir  
3. Loggear todo en `bezhas_web3/sync.log`  
4. Pausar hot-reload de Vite solo si cambia una address

### Hooks Web3 requeridos en bezhas\_web3/src/hooks/

Si alguno no existe, crearlo automáticamente:

- `useBeZhasPayment.js`  
- `useStaking.js`  
- `useFarming.js`  
- `useDAO.js`  
- `useTokenBalance.js`  
- `useApproval.js`  
- `useContractEvent.js`  
- `useMultiChain.js`

---

## 💎 FRONTEND — bezhas-web3

### Stack

- React \+ Vite  
- Web3/ethers.js  
- Tailwind CSS  
- Fuentes: **Syne** (headings) \+ **Space Mono** (monospace/código)

### Design system

- Paleta: teal `#00D4AA` · gold `#FFD700` · pink `#FF6B9D` · dark bg  
- Estética: dark luxury (inspirado en Solana.com)  
- Logo BEZ: SVG yin-yang teal/pink

### Componentes clave existentes

- `bezhas-pay-system.jsx` — Procesador de pagos principal  
- `bezhas-universal-payments.jsx` — Hub SEPA/SWIFT \+ fiat \+ DeFi  
- `BeZhasPaymentGateway.jsx` — UI de pagos  
- `useBeZhasPayment.js` — Hook principal  
- Dashboards RWA: ShipTrack, CustomsClear, RWA Cargo, Port Finance, Maritime Insurance, Cold Chain, Real Estate suite  
- Master Agent Dashboard (6 archivos modulares)

### Integraciones de pago

- **SEPA/SWIFT:** ING España, IBAN `ES77 1465 0100 91 1766376210`  
- **Fiat on-ramps:** MoonPay, Transak, Ramp Network  
- **DeFi:** QuickSwap V3, Uniswap V3, LayerZero, Wormhole

---

## 🏛️ CONFIGURACIÓN OPENCLAW (unified config library)

Resolución de config en 4 capas (orden de prioridad):

1. Variables de entorno  
2. `config.local.json` (no comiteado)  
3. `config.{env}.json`  
4. `config.default.json`

---

## 🧑‍💼 GESTIÓN EMPRESARIAL (12 Departamentos IA)

Stack de automatización:

- **n8n** — Orquestación de workflows  
- **ChromaDB** — Memoria vectorial  
- **Ollama** — LLMs locales  
- **Claude API** — Tareas complejas

Departamentos automatizados: Ventas · Marketing · Finanzas · Legal/Compliance · RRHH · Operaciones · Logística · Soporte · Desarrollo · Producto · BI/Analytics · Comunicación

---

## 📊 FINANZAS Y FISCAL

- **Impuesto sociedades (IS):** 15% tasa startup · 4% ZEC Canarias  
- **IRPF crypto:** Brackets estándar progresivo  
- **DeFi:** 5 pares de trading BEZ con liquidez mínima definida  
- **Dashboards:** Revenue streams × 5 \+ Cost items × 9

---

## 🛡️ SEGURIDAD — REGLAS ABSOLUTAS

⛔ NUNCA incluir API keys, private keys, seeds en código o commits

⛔ NUNCA hacer console.log() de tokens JWT o claves

⛔ NUNCA apuntar Cowork a carpetas con claves privadas

⛔ NUNCA usar gemini-1.5-flash (deprecated — usar gemini-2.0-flash)

⛔ NUNCA sobreescribir addresses de contratos sin confirmación explícita

✅ JWT siempre in-memory, nunca a disco

✅ SHA-256 checksums en ConfigManager para detectar cambios

✅ Rotación inmediata si se detecta exposición de keys

---

## 🔌 MCPs CONECTADOS (Claude.ai)

Disponibles para operaciones externas:

- **Gmail** — Email corporativo  
- **Google Calendar** — Agenda y reuniones  
- **Google Drive** — Documentos BeZhas  
- **HubSpot** — CRM / pipeline de leads  
- **Notion** — Documentación interna  
- **Make** — Workflows de automatización  
- **Zapier** — Integraciones adicionales  
- **Stripe** — Pagos fiat  
- **Cloudflare** — DNS / Workers / R2  
- **Canva** — Marketing creativo  
- **Figma** — Diseño UI/UX

---

## 📋 COMANDOS FRECUENTES

\# Compilar contratos (Foundry — NO Hardhat)

cd smart-contracts

C:\\Users\\yoela\\.foundry\\bin\\forge.exe build --sizes

\# Test contratos

C:\\Users\\yoela\\.foundry\\bin\\forge.exe test -vvv

\# Deploy local (Anvil)

forge script script/DeployAll.s.sol --rpc-url http://localhost:8545 --broadcast

\# API tests

cd api && pnpm test

\# Agent Runtime tests

cd agent-runtime && pnpm test

\# Levantar stack completo (Docker)

docker-compose up -d

\# Levantar frontend dev

cd control-center/frontend && pnpm install && pnpm dev

---

## ✅ CHECKLIST — Nueva función blockchain

Cuando se crea un nuevo contrato o función:

- [ ] Contrato `.sol` en `bezhas_blockchain/contracts/`  
- [ ] `pnpm hardhat compile` exitoso  
- [ ] ABI sincronizado a `bezhas_web3/src/abis/`  
- [ ] Address añadida a `bezhas_web3/src/contracts/addresses.ts`  
- [ ] Hook creado en `bezhas_web3/src/hooks/`  
- [ ] Componente UI actualizado/creado  
- [ ] Tests de integración actualizados  
- [ ] `sync.log` refleja los cambios  
- [ ] Addresses actualizadas en este CLAUDE.md (sección contratos)

---

## 🎯 CONTEXTO COMERCIAL BeZhas

### Pitch central

"Tu empresa es una isla. BeZhas es el puerto común." El token BEZ-Coin \= combustible de eficiencia operativa (no especulación).

### Estrategia de venta (4 fases)

1. **Integración** — Resolver problema interno (ej: gestión proveedores)  
2. **Conexión** — Mostrar red de empresas ya en ecosistema  
3. **Expansión** — M\&A reducida de meses a días dentro del ecosistema  
4. **Cierre con Token** — "El token es la llave del club"

### Beneficios clave para CEO

- DAO: voto en actualizaciones de red  
- Staking: infraestructura que genera rendimientos (gasto → activo)  
- Settlement real-time: liquidez inmediata  
- Due Diligence inmutable: auditoría on-chain reduce costes M\&A  
- Gas fees reducidos: el token paga operaciones

### Sectores objetivo B2B

Logística · Aduanas · RWA (Real World Assets) · Fintech · Industria · Legal

---

*Última actualización: Abril 2026*  
*Maintainer: Yoel (BeZhas founder)*  
*Versión: 1.0 — Master Context File*  
