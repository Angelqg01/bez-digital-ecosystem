# CLAUDE.md — BeZhas Master Context File
> [!IMPORTANT]
> **ESTÁNDAR DE PROYECTO: PNPM v11+**. NUNCA usar `npm` ni `yarn`.
> Todos los `package-lock.json` han sido eliminados. Usa solo `pnpm`.


# Leer este archivo SIEMPRE al inicio de cada sesión.

> [!TODO]
> **Hecho (2026-10-10):** hub, capital (DeFi en `/defi`), purescan, energy y cargolink ya están en `https://<sub>.bezhas.com` detrás del balanceador (`deploy/gcp/03-load-balancer.sh`, lista `SUBAPPS` en `deploy/gcp/config.env`; se despliegan con `deploy/gcp/deploy-subapps.sh`). **2026-10-16:** pay y wallet también (comparten el certificado `bezhas-cert-pay-wallet`: el proyecto está en su límite de 10 certificados). Siguen sin exponer gas, edge, vision, prestige, sphere y genesis (gas y prestige tienen servicio en Cloud Run con versiones antiguas, sin ruta en el balanceador).
>
> **2026-10-20:** la Landing (`secondaryApps` en `app/(landing)/page.tsx`) apuntaba a URLs `*.run.app` del proyecto antiguo que daban 500; ahora enlaza hub, capital/defi, purescan, energy, cargolink, wallet y pay en `*.bezhas.com`. Gas, edge, vision, prestige, sphere y genesis siguen siendo prototipos con datos de ejemplo (genesis es además un agente de historias clínicas, no el onboarding de socios): no publicarlos hasta que tengan datos reales.
>
> **PENDIENTE (recordatorio):** Subir online la plataforma BeZhas-Blockchain y **todas las SubApps** con sus **enlaces reales** ya en producción. Las tarjetas de la Landing (`/`) y de `/developers` apuntan a los subdominios `*.bezhas.com` (hub, wallet, gas, edge, vision, capital, prestige, cargolink, pay, purescan, sphere, energy, genesis). Confirmar/ajustar cada subdominio cuando la SubApp esté desplegada (editar `secondaryApps` en `app/(landing)/page.tsx` y `SUBAPP_URLS` en `app/(landing)/developers/page.tsx`).

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
- Blockchain L2 propia; BEZ-Coin desplegado sólo en Polygon (ERC-20). BNB Chain será un bridge (pendiente; hoy no hay contrato BEZ en BNB)  
- Token nativo BEZ-Coin con utilidad real (gas fees, staking, DAO, pagos)  
- SDK B2B para sectores: logística, aduanas, RWA, pagos internacionales  
- Capa de IA: OpenClaw (orquestador multi-LLM propio)  
- Gestión empresarial automatizada (12 departamentos via n8n/IA)

### Propuesta de valor clave

"No vendes software, ofreces un ecosistema de socios pre-verificados." El token BEZ-Coin NO es especulación, es combustible de eficiencia operativa.

---

## 📁 ESTRUCTURA DE DIRECTORIOS

> **Entorno de desarrollo: Linux.** El proyecto vive en
> `/home/amaliacr/Documentos/BeZhas-Blockchain` (NVMe, btrfs). Se movió el
> 2026-08-10 desde el disco externo NTFS `/run/media/amaliacr/Nuevo vol`, cuyo
> montaje FUSE corrompía el store de pnpm, impedía los hardlinks y hacía que git
> marcase 3.849 ficheros como modificados por finales de línea y permisos.
> No trabajar sobre el disco externo: se conserva sólo como copia de seguridad.

Monorepo sin workspace raíz: cada módulo tiene su propio `pnpm-workspace.yaml`
y lockfile y se instala por separado (`cd <módulo> && pnpm install`).

| Ruta | Qué es | Cómo se prueba |
| :---- | :---- | :---- |
| `smart-contracts/` | **Fuente de verdad on-chain.** Proyecto Foundry: `src/` (.sol), `script/` (despliegues), `deployments/<chainId>.json` (direcciones), `abi/` | `forge test -vvv` |
| `api/` | Gateway y API principal (Express, Postgres, Redis). Punto de entrada `index.js`; migraciones en `db/migrations/`; tarifas y catálogos en `config/` | `pnpm test` |
| `control-center/frontend/` | Web principal: Landing, panel y `/developers` (Next.js 16, React 19, Tailwind) | `pnpm test` · `pnpm build` |
| `business-ops/` | OPERANT, agentes de gestión empresarial (:4000) | `pnpm test` · `pnpm run evals` |
| `App-nativas/` | SubApps. `Bezhas-Hub/` (frontend Vite + React 18 y backend heredado), `BZ Capital`, `BZ PureScan`, `BZ CargoLink`, `bez-energy`, `bez-wallet`, `bezhas-pay-manager`… | por SubApp |
| `agent-lib/` | Runtime de agentes: herramientas, comandos, permisos | `pnpm test` |
| `sdk/` | `@bezhas/sdk`, SDK Web3 para clientes | `pnpm test` |
| `tx-signer/` | Firmante aislado: verifica intención, política y aprobaciones EIP-712 antes de firmar | — |
| `messaging-mcp/` · `obsidian-mcp/` · `ai-engine/` | Servidores MCP internos (Telegram y avisos, bóveda de notas, herramientas IA del SDK) | — |
| `core/` · `openclaw/` · `aegis/` | Orquestador multi-LLM (OpenClaw), memoria en Redis, HITL y agentes por departamento | — |
| `enterprise-node/` · `bezhas-edge-node/` · `edge-gateway/` | Nodo de la L2, nodo de integración y gateway de campo del VPP (Modbus/SunSpec) | — |
| `deploy/gcp/` · `scripts/` | Despliegue en GCP (`config.env`, `secrets.list`, `deploy-subapps.sh`) y utilidades (`gcp-deploy.sh`, `sync-daemon.cjs`, `security/`) | — |
| `docs/` | Documentación. **Vigente:** `developer/`, `runbooks/`, `security/`, `audit/`, `OPERANT_SUBAPP.md`. `archivo/` es histórico y no vigente (borradores de la L2 con OP Stack, notas de inversores): no citarlo; el RAG interno lo omite. Un documento que contradiga al código se mueve ahí con `git mv` | — |
| `marketing/` · `SKILL/` · `plans/` · `reports/` | Material comercial, skills de agentes e informes; no es código de producto | — |

`AGENTS.md` remite a este fichero: el contexto se mantiene sólo aquí.

---

## 🔑 CONTRATOS DEPLOYADOS (NUNCA CAMBIAR SIN CONFIRMACIÓN)

| Contrato | Red | Address |
| :---- | :---- | :---- |
| BEZ Token | **Polygon** | `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8` |
| BEZ Token | **BNB Chain** | **No desplegado.** `0x8a1e…5b55` no tiene código (comprobado on-chain el 2026-09-18). BEZ-Coin sólo existe en Polygon; BNB Chain será un bridge (pendiente), no un despliegue nativo. |
| Treasury DAO | BSC+Polygon | `0x89c23890c742d710265dD61be789C71dC8999b12` |
| QualityEscrow/Safe | BSC+Polygon | `0x3EfC42095E8503d41Ad8001328FC23388E00e8a3` |
| Hot Wallet | BSC+Polygon | `0x52Df82920CBAE522880dD7657e43d1A754eD044E` |
| RWAFactory · activos | Polygon | `0xa7e6656eFA45EB59ca247aa15F883330692C0d9A` — la que usa la web `/rwa` y el MCP por defecto. Comisión 100 BEZ, owner la Hot Wallet. |
| RWAFactory · industrial | Polygon | `0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0` — mismo bytecode, owner y comisión (comprobado el 2026-10-03); la de `deployments/137.json`, para clientes de Factory industrial. |

### Contratos Solidity registrados

| Contrato | Función |
| :---- | :---- |
| `BezhasToken` | Token BEZ-Coin (ERC-20, sólo Polygon) |
| `BeZhasCore` | Lógica central plataforma |
| `BeZhasMarketplace` | Marketplace de servicios |
| `StakingPoolV2` | Staking BEZ \+ rewards |
| `QualityOracle` | Oracle de datos |
| `BeZhasDAO` | Gobernanza DAO |
| `BeZhasPayment` | Procesador de pagos nativo |
| `BeZhasVesting` | Vesting de tokens |
| `BeZhasLiquidity` | LP Manager DeFi |
| `MarketplaceSettlement` | Cobro en BEZ del API Marketplace sin custodia (pull payment). Sin desplegar ni auditar (2026-11-05). |
| `RWAPrimarySale` | Venta primaria de fracciones del RWAFactory, pagada en BEZ y sin custodia (`api/services/rwaMarket.js`; variable `RWA_PRIMARY_SALE_ADDRESS`). Auditoría y dictamen MiFID II dados por resueltos por Yoel el 2026-11-13. Sin desplegar. |
| `RWARentDistributor` | Reparto de rentas de un activo del RWAFactory a los titulares de fracciones, por árbol de Merkle (cálculo en `api/services/rwaRentTree.js`, lectura de eventos y rutas `/rwa/rent/*` en `api/services/rwaRent.js`; variable `RWA_RENT_DISTRIBUTOR_ADDRESS`; pantallas en BZ Capital `/defi/rwa/rentas` y en el Hub, `/rwa`). Sin owner ni pausa. Mismo estado que la venta: auditoría y dictamen resueltos según Yoel (2026-11-13), sin desplegar. Despliegue de ambos: `smart-contracts/script/DeployRWAFinance.s.sol`. |

---

## 🌐 REDES SOPORTADAS

| Red | chainId | Uso |
| :---- | :---- | :---- |
| Polygon | 137 | Producción: BEZ-Coin y RWAFactory. RPC `https://polygon-bor-rpc.publicnode.com` |
| BeZhas L2 | 2708 | Red propia, **sin uso en producción**. Existen el código (`BEZCoinV2.sol`), la configuración (`bezhas_testnet` en `foundry.toml`) y `deployments/2708.json`, pero BEZ-Coin sólo opera en Polygon (confirmado el 2026-11-10). No presentarla como red principal ni hablar de `wBEZ` |
| Polygon Amoy | 80002 | Testnet de Polygon. Mumbai (80001) está apagada: no usarla |
| BNB Chain | 56 / 97 | Sin contrato BEZ; reservado para el bridge pendiente |
| Anvil | 31337 | Desarrollo local |

Fuente de verdad: `api/config/chain-policy.js` y `smart-contracts/deployments/`. La api usa Polygon (137) en producción, también si falta `BEZHAS_CHAIN_ID`. Resumen citable: `docs/reference/ESTADO_REDES_Y_TOKEN.md`.

---

## 🖥️ INFRAESTRUCTURA Y ENDPOINTS

> [!IMPORTANT]
> **Hosting de producción (2026-09-26): vuelta a GCP.** La facturación de GCP
> que causó la suspensión de Cloud SQL está resuelta, así que la plataforma
> vuelve a desplegarse en GCP (Cloud Run + Cloud SQL + Memorystore + Secret
> Manager) según [`docs/developer/GCP_DEPLOYMENT_GUIDE.md`](../docs/developer/GCP_DEPLOYMENT_GUIDE.md)
> — es de nuevo la guía vigente — usando `scripts/gcp-deploy.sh`. Las
> migraciones 049-051, pendientes desde la suspensión, se aplican contra el
> Cloud SQL de producción (el propio script las ejecuta vía el Cloud Run Job
> `bezhas-db-migrate`; nadie las ha lanzado todavía, hacerlo es una acción
> deliberada, no automática de este cambio de documentación).
>
> El VPS Hostinger KVM 4 (4 vCPU/16GB, Frankfurt) que se aprovisionó como
> alternativa mientras GCP estaba descartado **se mantiene documentado como
> plan B** de bajo coste — ver
> [`docs/developer/HOSTINGER_DEPLOYMENT_GUIDE.md`](../docs/developer/HOSTINGER_DEPLOYMENT_GUIDE.md) —
> pero deja de ser el destino por defecto.

| Servicio | Endpoint |
| :---- | :---- |
| API Backend | `api.bezhas.com:3001` |
| WebSocket | `ws.bezhas.com:3002` |
| MCP Server | `mcp.bezhas.com:4001` |
| Ollama (dev) | `localhost:11434` |

### Hardware del servidor principal

- CPU: Threadripper  
- GPU: **RTX 4090** (GPU passthrough para Ollama/Docker)  
- RAM: 128 GB  
- OS: Windows 11 \+ WSL2 / Ubuntu

> **Nota (2026-11-02):** la máquina de desarrollo (Fedora 44) tiene una RTX 5050
> Laptop con el driver NVIDIA 615 cargado (`nvidia-smi` responde). Usarla para
> render de vídeo y todo lo acelerable: `h264_nvenc` (el ffmpeg de Fedora no trae
> libx264) y Chromium headless con ANGLE sobre EGL — ver
> `marketing/video-como-funciona/pipeline/`. Si el servidor de la RTX 4090 pasa a Linux, usar
> Ubuntu LTS: en Fedora el driver propietario y `nvidia-container-toolkit` con
> Secure Boot dan bastante más guerra.

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

El motor es Python (`openclaw/orchestrator.py`, `router.py`, `openclaw_engine.py`); la
librería de configuración JS vive en `integrations/sync-openclaw/lib/`:

- `ConfigManager.js` — Singleton, 4-layer config, SHA-256 checksums  
- `TokenManager.js` — JWT auto-refresh, **in-memory only** (nunca a disco)  
- `SkillRegistry.js` — Hot-reload de skills sin reinicio  
- Test suite: 9 tests pasando, zero dependencias pnpm externas

---

## 🔄 SINCRONIZACIÓN DE ABIs (`scripts/sync-daemon.cjs`)

Lee los artefactos de Foundry (`smart-contracts/out/`) y las direcciones de
`smart-contracts/deployments/` y los propaga a:

- `api/services/contractService.js`
- `sdk/src/abi/`
- `control-center/frontend/lib/abi/`
- `agent-lib/config/contracts.json`

Ejecutarlo SIEMPRE después de compilar contratos, cambiar un ABI, desplegar o
cambiar una dirección:

```bash
cd smart-contracts && forge build
cd .. && pnpm sync:abi          # una pasada
pnpm sync:abi:watch             # modo vigilancia
```

Los ABIs de destino NO se editan a mano. El script sólo reescribe un fichero si
su hash cambia y deja el anterior como `.bak`; el registro queda en
`scripts/status/sync.log`.

---

## 💎 FRONTEND

Hay dos frontends, no uno:

- **`control-center/frontend/`** — web principal (Next.js 16, React 19, Tailwind, ethers 6 + viem). Hooks en `hooks/`, ABIs en `lib/abi/`.
- **`App-nativas/Bezhas-Hub/frontend/`** — Hub (Vite, React 18, wagmi + viem, Tailwind).

### Stack común

- Tailwind CSS · ethers.js / viem  
- Fuentes: **Syne** (headings) \+ **Space Mono** (monospace/código)

### Design system

- Paleta: teal `#00D4AA` · gold `#FFD700` · pink `#FF6B9D` · dark bg  
- Estética: dark luxury (inspirado en Solana.com)  
- Logo BEZ: SVG yin-yang teal/pink

### Componentes clave existentes

- `App-nativas/Bezhas-Hub/bezhas-pay-system.jsx` — Procesador de pagos principal  
- `integrations/sync-payments/BeZhasPaymentGateway.jsx` — UI de pagos  
- `integrations/sync-payments/useBeZhasPayment.js` — Hook principal  
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

## 🏢 OPERANT — SubApp de gestión empresarial autónoma

OPERANT (`business-ops/`, servicio en :4000) se sirve **por el Gateway** y es una
SubApp contratable más de la suscripción. Detalle completo, tarifas y decisiones
de dimensionado: [`docs/OPERANT_SUBAPP.md`](docs/OPERANT_SUBAPP.md).

Reparto: BeZhas pone identidad, entitlements, cuota, facturación y anclaje de la
auditoría; OPERANT ejecuta los agentes. El cliente nunca llama a OPERANT — usa su
api-key del Gateway y BeZhas llama al puente interno `/bridge`.

| Plan | Módulo | Departamentos | Tareas/mes | Autonomía | Anclaje |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Starter | — (por uso) | 2 (Ventas, Soporte) | pago por uso | borrador | — |
| Creator Pro | +39 €/mes | 4 | 300 | asistida | semanal |
| Business | +249 €/mes | 8 | 2.000 | autónoma | diario |
| Enterprise VIP | +1.199 €/mes | 10 | 9.000 | gobernada por DAO | continuo |

Precio por tarea = (coste Claude + cómputo BeZhas) × 1,25 → 0,1969 € las
*frontier* (Opus 4.8) y 0,0923 € las *mid* (Sonnet 5, $2/$10 por millón de tokens).
1 crédito = 0,001 €.
Al agotar la cuota se factura por créditos; sin customer de Stripe, 402.

El precio del módulo va POR PLAN porque la cuota va por plan, y lleva
`alwaysBilled`: nunca se comp con los slots gratis del bundle. Es el único
módulo del catálogo con coste marginal grande — regalarlo en un plan con slots
libres es servir hasta 1.019 €/mes de cómputo gratis.

**Archivos clave:** `api/config/operant-services.js` (fuente de verdad del
catálogo y la economía) · `api/routes/operant.js` · `api/services/operantUsage.js`
· `api/services/operantAnchor.js` · `business-ops/src/bridge/router.js`.

⚠️ Si cambian los precios de Anthropic, tocar SOLO `api/config/usage-pricing.js`:
los tests de `operant-services.test.js` fallan si el margen de un plan baja del 50%.

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

forge build --sizes

\# Test contratos

forge test -vvv

\# Propagar ABIs y direcciones tras compilar o desplegar

pnpm sync:abi

\# Deploy local (Anvil)

forge script script/DeployAll.s.sol --rpc-url http://localhost:8545 --broadcast

\# API tests

cd api && pnpm test

\# Agent Runtime tests

cd agent-lib && pnpm test

\# Levantar stack completo (Docker)

docker compose up -d

\# Levantar frontend dev

cd control-center/frontend && pnpm install && pnpm dev

---

## ✅ CHECKLIST — Nueva función blockchain

Cuando se crea un nuevo contrato o función:

- [ ] Contrato `.sol` en `smart-contracts/src/` con su test en `smart-contracts/test/`  
- [ ] `forge build --sizes` y `forge test -vvv` en verde  
- [ ] Dirección añadida a `smart-contracts/deployments/<chainId>.json`  
- [ ] `pnpm sync:abi` ejecutado (ABI en `api`, `sdk`, `control-center/frontend/lib/abi`)  
- [ ] Hook o cliente actualizado en el frontend que lo use  
- [ ] Componente UI actualizado/creado  
- [ ] Tests de integración actualizados  
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
