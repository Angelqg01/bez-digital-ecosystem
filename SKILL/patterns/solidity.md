# Solidity Patterns — BeZhas Blockchain
> Patrones establecidos para contratos inteligentes

## Versiones
- **Solidity**: 0.8.20 (contratos core), 0.8.24 (staking/DePIN), 0.8.34 (wallet)
- **OpenZeppelin**: v5 (lib/)
- **Foundry**: Nightly (via_ir=true, optimizer_runs=200)
- **License**: MIT

## Import Pattern
```solidity
import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20, IERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
```

## Role-Based Access (Standard)
```solidity
bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
```

## Security Stack (todas las capas que apliquen)
1. **AccessControl** — Roles granulares
2. **ReentrancyGuard** — nonReentrant en funciones con ETH/tokens
3. **Pausable** — whenNotPaused en funciones críticas
4. **SafeERC20** — safeTransfer/safeTransferFrom siempre
5. **Checks-Effects-Interactions** — Validar → Actualizar estado → Transferir

## Struct Pattern (evitar Stack Too Deep)
```solidity
// Si struct > 12 campos:
mapping(bytes32 => StructType) internal _storage; // internal, no public

function getInfo(bytes32 id) external view returns (StructType memory) {
    return _storage[id];
}
```

## Event Pattern
```solidity
event ActionPerformed(
    address indexed actor,
    bytes32 indexed id,
    uint256 amount,
    uint256 timestamp
);
// Siempre usar indexed para campos de búsqueda (max 3)
// Siempre incluir timestamp (block.timestamp)
```

## Time Constants Pattern
```solidity
uint256 public constant TIMELOCK_DELAY = 48 hours;
uint256 public constant RECOVERY_DELAY = 72 hours;
uint256 public constant EMERGENCY_TIMELOCK = 24 hours;
uint256 public constant MIN_DELAY = 24 hours;
uint256 public constant MAX_DELAY = 30 days;
uint256 public constant GRACE_PERIOD = 14 days;
```

## Error Messages — Prefix Convention
| Module | Prefix | Example |
|--------|--------|---------|
| SmartWallet | `SW:` | `"SW: limit exceeded"` |
| MultiSig | `MS:` | `"MS: not signer"` |
| Paymaster | `PM:` | `"PM: insufficient"` |
| SecurityModule | `SEC:` | `"SEC: paused"` |
| WalletGuardian | `WG:` | `"WG: not guardian"` |
| General | none | `"Not authorized"` |

## Deployment Pattern
```solidity
// Proxy pattern NOT used — direct deployment
// Factory pattern for wallets (CREATE2)
SmartWalletFactory factory = new SmartWalletFactory();
address wallet = factory.createWallet(owner, guardians, dailyLimit, salt);
```

## Test Pattern (ver testing.md)
