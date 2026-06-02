---
name: bezhas-universal-sync
description: >
  ⚡ REGLA CRÍTICA — LEER SIEMPRE AL INICIO DE CADA SESIÓN ⚡

  SINCRONIZACIÓN UNIVERSAL BEZHAS: Cada vez que se actualice, mejore, 
  optimice o cree cualquier archivo en el ecosistema BeZhas Blockchain 
  (contratos Solidity, ABIs, SDK, API, AI/Aegis, OpenClaw, Edge Nodes, 
  módulos de pago, hooks Web3, o cualquier componente Core), el sync 
  daemon DEBE propagar esos cambios automáticamente a TODOS los proyectos 
  sincronizados: bezhas-web3, futuras apps móviles/web, sub-apps de clientes, 
  SDKs externos, y cualquier sistema conectado al ecosistema.
  
  ACTIVAR SIEMPRE que: se compile un contrato, se genere un ABI, se actualice 
  el SDK, se modifique la API, se cambie una address de despliegue, se añada 
  un nuevo contrato, se actualice Aegis/AI, se modifique OpenClaw, o cualquier 
  cambio que afecte la capa de datos compartida del ecosistema.
priority: CRITICAL
version: "2.0"
created: "2026-03-30"
---

# ⬡ BeZhas Universal Sync — SKILL Maestro

## 🔴 REGLA NÚMERO 1 — LEE ESTO PRIMERO

> **Cualquier modificación en BeZhas Blockchain = Sync automático a TODOS los proyectos conectados.**

Este es el principio de **"Write Once, Propagate Everywhere"** del ecosistema BeZhas.
Nunca actualices un componente en aislamiento. El sync daemon es el sistema nervioso.

---

## 📡 Arquitectura de Sincronización Universal

```
BeZhas Blockchain (SOURCE OF TRUTH)
├── smart-contracts/src/          ← Solidity .sol
├── smart-contracts/out/          ← ABIs compilados por Foundry
├── smart-contracts/deployments/  ← Addresses por red (chainId)
├── sdk/                          ← SDK JavaScript/TypeScript
├── api/                          ← API REST Express
├── ai-engine/                    ← Motor IA
├── aegis/                        ← Aegis AI Security
├── bezhas-edge-node/             ← Edge Nodes
├── openclaw/                     ← OpenClaw Integration
└── modules/                      ← Módulos del sistema
        ↓ sync-daemon (propagación automática)
        ↓
PROYECTOS SINCRONIZADOS (TARGETS)
├── BeZhas Web/bezhas-web3/              ← Frontend/Backend Web3 principal
│   ├── frontend/src/abis/              ← ABIs sincronizados
│   ├── frontend/src/contracts/         ← Addresses sincronizadas
│   ├── frontend/src/hooks/             ← Hooks Web3 generados
│   └── backend/abis/                   ← ABIs para el backend
├── [FUTURO] bezhas-mobile/             ← App móvil (React Native)
├── [FUTURO] bezhas-subapp-**/          ← Sub-apps de clientes
├── [FUTURO] bezhas-sdk-npm/            ← SDK publicado en npm
└── [FUTURO] bezhas-partner-**/        ← Integraciones de socios
```

---

## ⚡ Reglas de Propagación (CUMPLIR SIEMPRE)

### Regla 1 — Contratos Solidity actualizados
```
Trigger: Cambio en smart-contracts/src/**/*.sol
Acción:
  1. forge build → regenera out/**/*.json (ABIs Foundry)
  2. sync-daemon --once → copia ABIs a TODOS los targets
  3. Si hay nuevo deploy → sync addresses.ts en todos los targets
  4. Si hay nuevo contrato → generar hook template en todos los targets
```

### Regla 2 — SDK actualizado
```
Trigger: Cambio en sdk/
Acción:
  1. Actualizar sdk/src/contracts.js con nuevas addresses/ABIs
  2. Propagar sdk/artifacts/ a bezhas-web3/backend/abis/
  3. Notificar: "SDK actualizado — regenerar imports en web3"
```

### Regla 3 — API actualizada
```
Trigger: Cambio en api/routes/** o api/models/**
Acción:
  1. Verificar que los endpoints nuevos tienen su hook en bezhas-web3
  2. Actualizar SKILL/config/contracts.md con nuevas rutas
  3. Regenerar types si aplica TypeScript
```

### Regla 4 — AI/Aegis actualizado
```
Trigger: Cambio en ai-engine/ o aegis/
Acción:
  1. Actualizar SKILL/training/ con nuevas capacidades
  2. Verificar integración con bezhas-web3/backend
  3. Propagar nuevos endpoints al API gateway
```

### Regla 5 — OpenClaw actualizado
```
Trigger: Cambio en openclaw/ o openclaw-skills/
Acción:
  1. Actualizar SKILL maestro con nuevas skills disponibles
  2. Propagar skills a openclaw-skills/ si son nuevas
  3. Verificar compatibilidad con el edge node
```

### Regla 6 — Edge Node actualizado
```
Trigger: Cambio en bezhas-edge-node/
Acción:
  1. Verificar que los endpoints del edge están en SKILL/config/infrastructure.md
  2. Actualizar EcosystemAdapter si hay nuevos endpoints
  3. Propagar configuración a módulos afectados
```

---

## 🗺️ Mapa de Contratos → Proyectos (ACTUALIZADO 2026-03-30)

| Contrato Solidity | Nombre Real | ChainId Testnet | Target Web3 | Hook |
|---|---|---|---|---|
| `BEZCoinV2.sol` | BEZCoinV2 | 0xd8a5...cd43 | frontend/src/abis/BEZCoinV2.abi.json | useTokenBalance |
| `StakingPool.sol` | StakingPool | 0x8198...bb7 | frontend/src/abis/StakingPool.abi.json | useStaking |
| `LiquidityFarming.sol` | LiquidityFarming | 0x0355...726 | frontend/src/abis/LiquidityFarming.abi.json | useFarming |
| `GovernanceSystem.sol` | GovernanceSystem | — | frontend/src/abis/GovernanceSystem.abi.json | useDAO |
| `BeZhasBridgeL2.sol` | BeZhasBridgeL2 | 0x36b5...ab | frontend/src/abis/BeZhasBridgeL2.abi.json | useBridge |
| `BeZhasPayment.sol` | BeZhasPayment | ⚠️ PENDIENTE | frontend/src/abis/BeZhasPayment.abi.json | useBeZhasPayment |
| `QualityEscrow.sol` | QualityEscrow | 0x51a1...02 | frontend/src/abis/QualityEscrow.abi.json | useEscrow |
| `BeZhasLogisticsNFT.sol` | BeZhasLogisticsNFT | 0xdc11...dd | frontend/src/abis/BeZhasLogisticsNFT.abi.json | useLogisticsNFT |

> ⚠️ `BeZhasPayment.sol` — Pendiente de creación y deploy. Ver: `smart-contracts/src/core/BeZhasPayment.sol`

---

## 🔧 Comandos del Sync Daemon

```bash
# Ubicación del daemon
cd "D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Blockchain\sync-daemon"

# Sincronización única (tras cualquier cambio)
node sync-daemon.js --once

# Modo watch (desarrollo activo)
node sync-daemon.js --watch

# Forzar resync completo (tras un deploy nuevo)
node sync-daemon.js --force --once

# Validar sin copiar (verificar rutas)
node sync-daemon.js --dry-run

# Ver estado del último sync
node sync-daemon.js --status

# Tras compilar con Foundry
forge build && node sync-daemon.js --once
```

---

## 📋 Checklist de Sincronización (Usar en cada sesión)

### Al actualizar un contrato existente:
- [ ] `forge build` ejecutado correctamente
- [ ] `node sync-daemon.js --once` ejecutado
- [ ] ABIs actualizados en `bezhas-web3/frontend/src/abis/`
- [ ] Hook correspondiente actualizado si cambió la interfaz
- [ ] `SKILL/MASTER_INDEX.md` actualizado si es cambio mayor

### Al crear un contrato nuevo:
- [ ] Contrato `.sol` en `smart-contracts/src/{sector}/`
- [ ] Test `.t.sol` en `smart-contracts/test/`
- [ ] `forge build && forge test` exitosos
- [ ] Deploy en testnet: `forge script scripts/Deploy*.s.sol --broadcast`
- [ ] Address añadida a `smart-contracts/deployments/{chainId}.json`
- [ ] `node sync-daemon.js --force --once`
- [ ] Hook Web3 creado en `bezhas-web3/frontend/src/hooks/`
- [ ] Este SKILL actualizado con el nuevo contrato en la tabla de arriba
- [ ] `SKILL/MASTER_INDEX.md` actualizado

### Al añadir un nuevo proyecto sincronizado (futuras apps):
- [ ] Añadir ruta del proyecto a `CONFIG.targets[]` en sync-daemon.js
- [ ] Definir estructura de carpetas del target (abis/, contracts/, hooks/)
- [ ] Ejecutar `node sync-daemon.js --force --once` para poblar el target
- [ ] Actualizar el mapa de arquitectura de este documento

---

## 🚀 Estado del Sistema (2026-03-30)

| Componente | Estado | Prioridad |
|---|---|---|
| sync-daemon.js | ⚠️ Rutas corregidas, npm pendiente | ALTA |
| BeZhasPayment.sol | ❌ Pendiente creación | CRÍTICA |
| ABIs → bezhas-web3 | ❌ Carpetas target no existen | ALTA |
| useBeZhasPayment.js | 🟡 Lógica OK, falta ABI real | MEDIA |
| BeZhasPaymentGateway.jsx | 🟡 UI OK, typo CSS pendiente | BAJA |
| npm install | ❌ lru-cache corrompido | CRÍTICA |

---

## 📚 Referencias Cruzadas

- [`Sincronizar forma de pago/sync-daemon.js`](../Sincronizar%20forma%20de%20pago/sync-daemon.js) — Motor del sync
- [`Sincronizar forma de pago/SKILL.md`](../Sincronizar%20forma%20de%20pago/SKILL.md) — Skill blockchain-sync
- [`SKILL/config/contracts.md`](config/contracts.md) — Addresses actuales
- [`SKILL/config/infrastructure.md`](config/infrastructure.md) — Infraestructura
- [`SKILL/MASTER_INDEX.md`](MASTER_INDEX.md) — Índice maestro del sistema
