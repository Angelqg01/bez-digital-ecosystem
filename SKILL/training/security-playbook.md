# Security Playbook — BeZhas Blockchain
> Guía completa de seguridad para entrenamiento del sistema

## Principio Fundamental: NON-CUSTODIAL
> BeZhas NUNCA tiene control sobre los fondos de los usuarios.
> Las claves privadas SIEMPRE están bajo control del usuario/empresa.
> La plataforma facilita pero NO custodia.

---

## 1. Seguridad de Smart Contracts

### 1.1 Patrones Obligatorios
- **AccessControl**: Roles granulares (ADMIN, OPERATOR, RELAYER, GUARDIAN)
- **ReentrancyGuard**: `nonReentrant` en toda función que mueva ETH/tokens
- **Pausable**: `whenNotPaused` en funciones críticas
- **SafeERC20**: Siempre `safeTransfer`/`safeTransferFrom`
- **Checks-Effects-Interactions**: Validar → Estado → Transferir

### 1.2 Protección Temporal
| Mecanismo | Delay | Uso |
|-----------|-------|-----|
| Timelock estándar | 48h | Operaciones grandes |
| Emergency timelock | 24h | Emergencias (guardián) |
| Recovery delay | 72h | Recuperación social |
| Min delay (SecurityModule) | 24h | Mínimo configurable |
| Max delay | 30 days | Máximo configurable |
| Grace period | 14 days | Ventana para ejecutar |

### 1.3 Límites
- **Daily Limit (SmartWallet)**: Configurable por wallet, max 1M ETH
- **Daily Limit (MultiSig)**: Por wallet, operaciones > threshold requieren timelock
- **Daily Limit (Paymaster)**: Por empresa, gas sponsorship limitado
- **Circuit Breaker**: Threshold + window, auto-pause si se excede

### 1.4 Auditoría On-Chain
```solidity
// SecurityModule emite eventos inmutables
event AuditLog(
    address indexed actor,
    string action,
    bytes32 indexed target,
    bytes data,
    uint256 timestamp
);
```

## 2. Seguridad de Wallet

### 2.1 SmartWallet (Account Abstraction)
- Owner controla 100% — ni factory ni protocolo pueden intervenir
- Meta-transacciones vía `executeBySignature` (EIP-712)
- Sessions: delegación temporal con expiración y límite de valor
- Social Recovery: 72h delay, requiere guardianes verificados
- Lock: Owner puede congelar wallet instantáneamente

### 2.2 MultiSigWallet
- M-of-N firmas requeridas (configurable)
- Roles: ADMIN (cambios de estructura), OPERATOR (transacciones), VIEWER (solo lectura)
- Auto-timelock para operaciones que excedan threshold
- Solo el propio MultiSig puede cambiar signers/threshold (self-call)

### 2.3 Paymaster
- Empresas depositan fondos → usuarios ejecutan sin gas
- Whitelist de usuarios Y contratos destino
- Límite diario + límite por transacción
- Solo RELAYER_ROLE puede ejecutar sponsorGas
- Emergency pause disponible

## 3. Seguridad de Infraestructura

### 3.1 API
- JWT con expiración
- Rate limiting por IP y por usuario
- Input validation en todos los endpoints
- No exponer claves privadas en responses
- CORS configurado para dominios permitidos

### 3.2 Base de Datos
- Connection pooling (pg pool)
- Queries parametrizadas (nunca interpolación SQL)
- Credenciales vía env vars, nunca en código

### 3.3 Docker
- Imágenes mínimas (alpine donde posible)
- No correr como root
- Secrets vía Docker secrets o env vars
- Network isolation entre servicios

## 4. Modelo de Amenazas

### 4.1 Amenazas Mitigadas
| Amenaza | Mitigación |
|---------|-----------|
| Reentrancy | ReentrancyGuard + CEI pattern |
| Unauthorized access | AccessControl roles |
| Flash loan attack | Timelocks + daily limits |
| Key compromise | Social recovery (72h delay) |
| Rogue admin | Multi-sig governance + timelocks |
| Infinite mint | Fixed supply + role restrictions |
| Oracle manipulation | Multi-source quality oracle |
| DoS via gas | Paymaster limits + circuit breaker |
| Contract upgrade attack | No proxies — immutable contracts |

### 4.2 Amenazas Pendientes de Mitigar
- Front-running (considerar commit-reveal o private mempool)
- MEV extraction (OP Stack inherentemente reduce MEV)
- L1 bridge relay attack (requiere prover verification)

## 5. Checklist de Seguridad Pre-Deploy
- [ ] Todos los tests pasan (931+)
- [ ] No warnings significativos de compilación
- [ ] Roles configurados correctamente
- [ ] Timelocks activos para operaciones críticas
- [ ] Daily limits configurados
- [ ] Emergency pause probado
- [ ] Circuit breakers configurados
- [ ] Guardian registry inicializado
- [ ] Audit log habilitado
- [ ] Revisión por pares del code
- [ ] Auditoría externa (planeada)
