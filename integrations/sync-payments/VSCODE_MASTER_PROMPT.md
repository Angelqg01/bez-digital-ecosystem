# BEZHAS PLATFORM — MASTER DEVELOPMENT PROMPT FOR VSCODE / CLAUDE / CURSOR

> Pega este prompt completo en: GitHub Copilot Chat · Continue · Cursor Composer · Claude Code

---

## CONTEXTO DEL PROYECTO

Eres el arquitecto principal de **BeZhas** — una plataforma SaaS de trading e inversión Web3
con token nativo **BEZ-Coin** desplegado en BNB Chain (BEP-20, chainId 56/97) y Polygon (ERC-20,
chainId 137/80001).

### Estructura del repositorio

```
BeZhas/
├── BeZhas Blockchain/          ← SOURCE OF TRUTH para contratos
│   ├── contracts/              ← Solidity .sol (Hardhat + Foundry)
│   ├── artifacts/contracts/    ← ABIs compilados (NO editar)
│   ├── deployments/            ← Addresses por red
│   ├── scripts/                ← Deploy, upgrade, verify
│   ├── sync/sync-daemon.js     ← Sync daemon (ver instrucciones)
│   └── test/                   ← Tests Hardhat + Chai
│
└── BeZhas Web/bezhas-web3/     ← React + Vite frontend
    └── src/
        ├── abis/               ← ABIs sincronizados (NO editar, auto-generados)
        ├── contracts/          ← addresses.ts (auto-generado)
        ├── hooks/              ← Hooks Web3 (wagmi + viem)
        ├── components/
        │   └── payments/       ← UI de pagos
        └── config/             ← chains.js, contracts.config.js
```

---

## STACK TECNOLÓGICO

### Blockchain
- **Solidity** 0.8.24+ con OpenZeppelin 5.x
- **Hardhat** para compilación, tests y deployment
- **Foundry** (Forge) para tests avanzados y fuzzing
- **ethers.js v6** y **viem v2** para interacción Web3
- **wagmi v2** para React hooks
- **RainbowKit** para wallet connection UI

### Frontend
- **React 18** + **Vite**
- **wagmi v2** + **viem v2**
- **TanStack Query** para gestión de estado async
- **Tailwind CSS** con tema BeZhas dark luxury

### Sincronización
- **sync-daemon.js** (chokidar) — watch de cambios en `artifacts/` y `deployments/`

---

## CONTRATOS REGISTRADOS

| Contrato | Descripción | Estado |
|---|---|---|
| `BezhasToken` | Token BEZ-Coin ERC-20/BEP-20 | ✅ Desplegado |
| `BeZhasCore` | Lógica central plataforma | ✅ Desplegado |
| `BeZhasMarketplace` | Marketplace de servicios | ✅ Desplegado |
| `StakingPoolV2` | Staking con lock periods | ✅ Desplegado |
| `QualityOracle` | Oracle de datos/calidad | ✅ Desplegado |
| `BeZhasPayment` | Procesador de pagos nativo | 🔄 En desarrollo |
| `BeZhasDAO` | Gobernanza descentralizada | 🔄 En desarrollo |
| `BeZhasVesting` | Vesting de tokens | 📋 Planificado |
| `BeZhasLiquidity` | LP Manager DeFi | 📋 Planificado |

---

## REGLAS DE DESARROLLO OBLIGATORIAS

### 1. SINCRONIZACIÓN (CRÍTICO)

**DESPUÉS DE CADA `npx hardhat compile`:**
```bash
node sync/sync-daemon.js --once
```

**DURANTE DESARROLLO ACTIVO:**
```bash
node sync/sync-daemon.js --watch
```

**NUNCA:**
- Editar manualmente archivos en `bezhas-web3/src/abis/`
- Editar manualmente `bezhas-web3/src/contracts/addresses.ts`
- Copiar ABIs manualmente sin usar el sync daemon

### 2. SOLIDITY — CONVENCIONES

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @title NombreContrato
/// @notice Descripción breve
/// @dev Notas técnicas
contract NombreContrato is UUPSUpgradeable, OwnableUpgradeable {
    // ── Eventos ─────────────────────────────────────────────────────────────
    event NombreEvento(address indexed user, uint256 amount, bytes32 orderId);

    // ── Errores custom (gas-efficient) ───────────────────────────────────────
    error InsufficientBalance(uint256 required, uint256 available);
    error InvalidAddress();
    error PaymentFailed();

    // ── Modificadores ────────────────────────────────────────────────────────
    modifier nonZeroAddress(address addr) {
        if (addr == address(0)) revert InvalidAddress();
        _;
    }

    // ── Función pública ──────────────────────────────────────────────────────
    function functionName(
        address recipient,
        uint256 amount,
        bytes32 orderId
    ) external nonReentrant nonZeroAddress(recipient) {
        // 1. Checks
        // 2. Effects
        // 3. Interactions
        emit NombreEvento(msg.sender, amount, orderId);
    }
}
```

**REGLAS SOLIDITY:**
- Siempre usar contratos upgradeables (UUPS pattern) con OpenZeppelin
- Siempre añadir `nonReentrant` a funciones que manejan fondos
- Siempre emitir eventos para cada operación importante
- Usar errores custom en lugar de `require(condition, "string")`
- Incluir `bytes32 orderId` en funciones de pago para trazabilidad
- Los contratos deben soportar pausa (`Pausable`) para emergencias

### 3. HOOKS WEB3 — CONVENCIONES

```javascript
// useNombreFuncion.js
import { useState, useCallback } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi';
import { getContract } from 'viem';
import { bezhasTokenABI } from '../abis';   // ← SIEMPRE desde /abis (auto-sync)
import { getContractAddress } from '../contracts/addresses';  // ← SIEMPRE addresses auto-sync

export function useNombreFuncion() {
  const { address }        = useAccount();
  const chainId            = useChainId();
  const publicClient       = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const contractAddress = getContractAddress(chainId, 'BezhasToken');

  const execute = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      // lógica...
    } catch (err) {
      setError(err.shortMessage || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [/* deps */]);

  return { execute, loading, error, contractAddress };
}
```

### 4. COMPONENTES UI — CONVENCIONES

```jsx
// BeZhasNombreComponente.jsx
// Tema: dark luxury · colores: #00d4aa (teal) · #c9a84c (gold) · #ff6b9d (pink)
// Fuentes: Syne (headings) · Space Mono (monospace/datos)
// Background: #060810 · Surface: #0d1117 · Border: #1a2332

// CSS Variables disponibles:
// --bez-bg, --bez-surface, --bez-border
// --bez-gold, --bez-teal, --bez-pink
// --bez-text, --bez-muted, --bez-success, --bez-error
```

### 5. GESTIÓN DE ERRORES

```javascript
// Siempre manejar estos errores específicos de Web3:
const WEB3_ERRORS = {
  'User rejected the request':      'Transacción cancelada por el usuario',
  'insufficient funds':             'Saldo insuficiente para gas',
  'execution reverted':             'Contrato rechazó la transacción',
  'nonce too low':                  'Error de nonce — reintentar',
  'replacement fee too low':        'Fee de gas insuficiente',
  'CALL_EXCEPTION':                 'Error al llamar al contrato',
};

function parseWeb3Error(error) {
  const msg = error.shortMessage || error.message || '';
  for (const [key, val] of Object.entries(WEB3_ERRORS)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return `Error blockchain: ${msg.slice(0, 100)}`;
}
```

---

## WORKFLOW DE DESARROLLO DE NUEVA FUNCIÓN

### Caso: Nueva función en contrato existente

```
1. Editar contracts/BeZhasPayment.sol — añadir la función
2. Añadir test en test/BeZhasPayment.test.js
3. npx hardhat compile
4. npx hardhat test (verificar que pasa)
5. node sync/sync-daemon.js --once  ← OBLIGATORIO
6. Actualizar/crear hook en bezhas-web3/src/hooks/
7. Actualizar/crear componente UI en bezhas-web3/src/components/
8. Probar en localhost (npx hardhat node + deploy local)
```

### Caso: Nuevo contrato

```
1. Crear contracts/BeZhasNuevo.sol
2. Crear test/BeZhasNuevo.test.js
3. Crear scripts/deployBeZhasNuevo.js
4. Registrar en sync/sync-daemon.js → REGISTERED_CONTRACTS array
5. npx hardhat compile && npx hardhat test
6. npx hardhat run scripts/deployBeZhasNuevo.js --network bscTestnet
7. node sync/sync-daemon.js --once
8. Verificar: node sync/sync-daemon.js --status
9. Crear hook: bezhas-web3/src/hooks/useNuevoContrato.js
10. Crear componente UI si aplica
```

---

## COMANDOS RÁPIDOS

```bash
# ── Blockchain ───────────────────────────────────────────────────────
npx hardhat compile                              # Compilar contratos
npx hardhat test                                 # Tests
npx hardhat test --grep "BeZhasPayment"          # Tests específicos
npx hardhat node                                 # Red local
npx hardhat run scripts/deploy.js --network bscTestnet
npx hardhat verify --network bsc CONTRACT_ADDR   # Verificar en BSCScan
npx hardhat flatten contracts/BeZhasPayment.sol  # Flatten para verificación

# ── Sync ─────────────────────────────────────────────────────────────
node sync/sync-daemon.js --once                  # Sync manual
node sync/sync-daemon.js --watch                 # Watch modo dev
node sync/sync-daemon.js --force                 # Forzar resync completo
node sync/sync-daemon.js --dry-run               # Validar sin cambios
node sync/sync-daemon.js --status                # Ver estado

# ── Frontend ──────────────────────────────────────────────────────────
cd bezhas-web3 && npm run dev                    # Dev server
cd bezhas-web3 && npm run build                  # Build prod

# ── Full dev (blockchain + web3 en paralelo) ──────────────────────────
# Terminal 1:
npx hardhat node
# Terminal 2:
node sync/sync-daemon.js --watch
# Terminal 3:
cd bezhas-web3 && npm run dev
```

---

## VARIABLES DE ENTORNO REQUERIDAS

### BeZhas Blockchain (.env)
```env
# Wallets
PRIVATE_KEY=0x...                        # Wallet de deploy
DEPLOYER_ADDRESS=0x...

# RPCs
BSC_RPC_URL=https://bsc-dataseed.binance.org
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
POLYGON_RPC_URL=https://polygon-rpc.com
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com

# Explorers (para verificación automática)
BSCSCAN_API_KEY=...
POLYGONSCAN_API_KEY=...

# Sync daemon
WEB3_PROJECT_PATH=../BeZhas Web/bezhas-web3
```

### BeZhas Web3 (.env.local)
```env
VITE_WALLETCONNECT_PROJECT_ID=...        # WalletConnect Cloud
VITE_ALCHEMY_API_KEY=...                 # Alchemy (opcional)
VITE_INFURA_API_KEY=...                  # Infura (opcional)
VITE_MOONPAY_API_KEY=...                 # MoonPay fiat on-ramp
VITE_TRANSAK_API_KEY=...                 # Transak fiat on-ramp
VITE_RAMP_API_KEY=...                    # Ramp Network
VITE_DEFAULT_CHAIN_ID=97                 # 97=testnet, 56=mainnet, 137=polygon
VITE_ENABLE_TESTNETS=true
```

---

## MÓDULOS PENDIENTES DE DESARROLLO

### 🔴 PRIORIDAD ALTA
- [ ] `BeZhasPayment.sol` — Completar funciones: `processPayment`, `bridgePayment`, `refund`
- [ ] `useBeZhasPayment.js` — Hook completo con gestión de estado
- [ ] `BeZhasPaymentGateway.jsx` — UI completa de pagos
- [ ] Integración SEPA/SWIFT con ING España

### 🟡 PRIORIDAD MEDIA
- [ ] `BeZhasDAO.sol` — Gobernanza completa con timelock
- [ ] `useDAO.js` — Propuestas, votación, ejecución
- [ ] `BeZhasVesting.sol` — Vesting con cliff y linear unlock
- [ ] Dashboard de staking con APY dinámico

### 🟢 PRIORIDAD BAJA
- [ ] `BeZhasLiquidity.sol` — LP Manager para Uniswap V3 concentrated liquidity
- [ ] Integración LayerZero cross-chain completa
- [ ] Notificaciones push de transacciones (Firebase FCM)
- [ ] Sistema de referidos onchain

---

## TESTS MÍNIMOS REQUERIDOS

```javascript
// Estructura de test requerida para cada contrato
describe("BeZhasNombreContrato", () => {
  // ── Setup ────────────────────────────────────────────────────────────────
  it("Should deploy correctly");
  it("Should initialize with correct parameters");

  // ── Funcionalidad core ───────────────────────────────────────────────────
  it("Should perform main function correctly");
  it("Should emit correct events");
  it("Should update state correctly");

  // ── Seguridad ────────────────────────────────────────────────────────────
  it("Should revert on invalid inputs");
  it("Should revert on unauthorized access");
  it("Should prevent reentrancy");
  it("Should respect pause mechanism");

  // ── Edge cases ───────────────────────────────────────────────────────────
  it("Should handle zero amounts correctly");
  it("Should handle max amounts correctly");
  it("Should handle multiple users concurrently");
});
```

---

## INSTRUCCIONES PARA EL ASISTENTE IA

Cuando generes código para BeZhas:

1. **SIEMPRE** importar ABIs desde `'../abis'` (nunca rutas hardcodeadas a artifacts)
2. **SIEMPRE** usar `getContractAddress(chainId, 'ContractName')` para addresses
3. **SIEMPRE** soportar múltiples redes (56, 97, 137, 80001)
4. **SIEMPRE** añadir manejo de errores Web3 con mensajes en español
5. **SIEMPRE** incluir estados de loading/error/success en hooks
6. **NUNCA** hardcodear addresses de contratos
7. **NUNCA** editar archivos en `src/abis/` o `src/contracts/addresses.ts` manualmente
8. **RECORDAR** ejecutar sync daemon después de cambios en contratos
9. El tema visual es **dark luxury**: fondo negro azulado, acentos teal/gold/pink
10. Los textos en la UI deben estar en **español**
11. Añadir `// AUTO-SYNC: BeZhasPayment` en comentario cuando el archivo depende del sync

---

*BeZhas Platform · BEZ-Coin · Building the future of Web3 Trading*
