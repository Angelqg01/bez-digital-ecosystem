---
name: bezhas-blockchain-sync
description: >
  Skill para sincronizar y actualizar automáticamente componentes blockchain entre
  bezhas_blockchain (contratos, ABIs, deployments) y bezhas_web3 (frontend React/Web3).
  USAR SIEMPRE que se actualice o desarrolle cualquier función relacionada con:
  pagos BEZ-Coin, staking, farming, DAO, contratos inteligentes (Solidity), ABIs,
  hooks de Web3, rutas API blockchain, providers, integraciones DeFi, o cualquier
  componente que conecte el frontend con la blockchain (BNB Chain / Polygon).
  También activar cuando se añadan nuevas funciones a: BeZhasToken, BeZhasCore,
  BeZhasMarketplace, StakingPoolV2, QualityOracle, o cualquier nuevo contrato.
  Garantiza coherencia total entre capa blockchain y capa frontend sin pérdida
  de transferencia de datos.
---

# BeZhas Blockchain Sync Skill

## Propósito

Mantener sincronizados `bezhas_blockchain` y `bezhas_web3` asegurando que cualquier
cambio en contratos Solidity, ABIs compilados, o direcciones de despliegue se
refleje automáticamente en el frontend Web3 sin romper conexiones.

---

## Estructura de Proyectos

```
D:\Documentos D\Documentos Yoe\BeZhas\
├── BeZhas Blockchain\               ← SOURCE OF TRUTH (contratos)
│   ├── contracts/                   ← Solidity .sol
│   ├── artifacts/contracts/         ← ABIs compilados por Hardhat/Foundry
│   ├── deployments/                 ← Direcciones por red (chainId)
│   ├── scripts/                     ← Deploy scripts
│   ├── typechain-types/             ← TypeScript types (si usa typechain)
│   └── bezhas.sync.config.json      ← Config del sync daemon
│
└── BeZhas Web\bezhas-web3\          ← TARGET (frontend)
    ├── src/
    │   ├── abis/                    ← ABIs sincronizados desde blockchain
    │   ├── contracts/               ← Addresses + config por red
    │   ├── hooks/                   ← useBeZhasPayment, useStaking, etc.
    │   ├── components/payments/     ← UI de pagos
    │   └── config/chains.ts         ← Config de redes
    └── sync.lock                    ← Registro de última sincronización
```

---

## Workflow de Sincronización

### Paso 1 — Detectar cambios en bezhas_blockchain

El daemon `sync-daemon.js` observa estos paths:
- `artifacts/contracts/**/*.json` → ABIs compilados
- `deployments/**/*.json` → Direcciones de despliegue
- `contracts/**/*.sol` → Cambios en contratos fuente

### Paso 2 — Mapear y copiar ABIs

Para cada ABI detectado:
1. Extraer solo el campo `"abi"` del artifact de Hardhat
2. Generar nombre normalizado: `BezhasToken.abi.json`
3. Copiar a `bezhas_web3/src/abis/`
4. Regenerar `bezhas_web3/src/abis/index.js` con exports dinámicos

### Paso 3 — Actualizar addresses

Leer `deployments/{chainId}.json` y actualizar:
- `bezhas_web3/src/contracts/addresses.ts`
- Mantener histórico de deployments por chainId (97=BSC Testnet, 56=BSC, 137=Polygon)

### Paso 4 — Regenerar types (opcional TypeChain)

Si el proyecto usa TypeChain:
```bash
cd bezhas_blockchain && npx hardhat typechain
# Copiar typechain-types/ → bezhas_web3/src/types/contracts/
```

### Paso 5 — Validar conexiones

Verificar que cada ABI tiene su address correspondiente.
Si hay ABI sin address → advertencia en consola con nombre del contrato.

---

## Contratos BeZhas Registrados

| Contrato | Función | Redes |
|---|---|---|
| `BezhasToken` | Token BEZ-Coin (ERC-20/BEP-20) | BSC + Polygon |
| `BeZhasCore` | Lógica central de la plataforma | BSC + Polygon |
| `BeZhasMarketplace` | Marketplace de servicios | BSC + Polygon |
| `StakingPoolV2` | Staking de BEZ con rewards | BSC + Polygon |
| `QualityOracle` | Oracle de calidad/datos | BSC |
| `BeZhasDAO` | Gobernanza DAO | BSC + Polygon |
| `BeZhasPayment` | Procesador de pagos nativo | BSC + Polygon |
| `BeZhasVesting` | Vesting de tokens | BSC |
| `BeZhasLiquidity` | LP Manager DeFi | BSC + Polygon |

---

## Hooks Web3 Requeridos

Cada vez que se sincronice, verificar que existen estos hooks en `bezhas_web3/src/hooks/`:

- `useBeZhasPayment.js` → Pagos con BEZ-Coin
- `useStaking.js` → Staking/Unstaking/Rewards
- `useFarming.js` → Liquidity farming
- `useDAO.js` → Votaciones y propuestas
- `useTokenBalance.js` → Balance BEZ en wallet
- `useApproval.js` → Approve ERC-20 genérico
- `useContractEvent.js` → Escucha eventos onchain
- `useMultiChain.js` → Soporte BSC + Polygon

Si alguno no existe → crearlo usando el ABI sincronizado.

---

## Configuración de Redes

```javascript
// bezhas_web3/src/config/chains.js
export const BEZHAS_CHAINS = {
  BSC_MAINNET:    { chainId: 56,   name: 'BNB Chain',       rpc: 'https://bsc-dataseed.binance.org' },
  BSC_TESTNET:    { chainId: 97,   name: 'BSC Testnet',     rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545' },
  POLYGON:        { chainId: 137,  name: 'Polygon Mainnet', rpc: 'https://polygon-rpc.com' },
  POLYGON_MUMBAI: { chainId: 80001,name: 'Mumbai Testnet',  rpc: 'https://rpc-mumbai.maticvigil.com' },
}
```

---

## Comandos del Sync Daemon

```bash
# Instalar dependencias del daemon
npm install chokidar chalk fs-extra glob

# Sincronización manual única
node sync-daemon.js --once

# Modo watch (desarrollo)
node sync-daemon.js --watch

# Forzar resync completo
node sync-daemon.js --force --watch

# Validar sin copiar
node sync-daemon.js --dry-run

# Ver estado actual de sync
node sync-daemon.js --status
```

---

## Integración en package.json (bezhas_blockchain)

```json
{
  "scripts": {
    "compile": "hardhat compile && npm run sync",
    "deploy:bsc": "hardhat run scripts/deploy.js --network bsc && npm run sync",
    "deploy:polygon": "hardhat run scripts/deploy.js --network polygon && npm run sync",
    "sync": "node sync-daemon.js --once",
    "sync:watch": "node sync-daemon.js --watch",
    "sync:validate": "node sync-daemon.js --dry-run"
  }
}
```

---

## Integración en package.json (bezhas_web3)

```json
{
  "scripts": {
    "dev": "concurrently \"npm run sync:watch\" \"vite\"",
    "build": "npm run sync && vite build"
  }
}
```

---

## Reglas de Sincronización

1. **Nunca sobreescribir** un ABI si el hash MD5 no cambió (evitar rebuilds innecesarios)
2. **Siempre mantener** versión anterior como `.bak` antes de sobreescribir
3. **Loggear** cada operación en `bezhas_web3/sync.log`
4. **Notificar** via VS Code terminal cuando hay cambios críticos (nueva address)
5. **Pausar** el hot-reload de Vite solo si cambia una address (requiere reinicio)

---

## Checklist por Nueva Función Blockchain

Cuando se crea una nueva función/contrato:

- [ ] Contrato `.sol` creado en `bezhas_blockchain/contracts/`
- [ ] Compilado: `npx hardhat compile`
- [ ] ABI sincronizado a `bezhas_web3/src/abis/`
- [ ] Address añadida a `bezhas_web3/src/contracts/addresses.ts`
- [ ] Hook correspondiente creado en `bezhas_web3/src/hooks/`
- [ ] Componente UI actualizado o creado
- [ ] Tests de integración actualizados
- [ ] `sync.log` refleja los cambios

---

## Referencias

- Leer `sync/sync-daemon.js` para el daemon de sincronización completo
- Leer `hooks/useBeZhasPayment.js` para el hook principal de pagos
- Leer `components/BeZhasPaymentGateway.jsx` para la UI de pagos
- Leer `config/contracts.config.js` para la configuración de contratos
