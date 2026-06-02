# Security Configuration & Policies
> Políticas de seguridad del ecosistema BeZhas

## Principios Arquitecturales

### 1. No Custodial por Defecto
- El usuario SIEMPRE controla su clave privada
- SmartWallet: owner es el usuario, no BeZhas
- Factory NO retiene control sobre wallets creadas
- BeZhas no tiene acceso a fondos de usuarios

### 2. Aislamiento de Riesgo
- Contratos de staking/farming/DAO separados del módulo wallet
- Cada contrato tiene su propio estado independiente
- Circuit breakers por contrato individual
- Pausas granulares (por contrato o global)

### 3. Defensa en Profundidad
```
Capa 1: Autenticación → Firma de wallet (ECDSA)
Capa 2: Autorización → Roles (AccessControl / onlyOwner)
Capa 3: Límites      → Daily limits, max per tx
Capa 4: Timelock      → 48h para operaciones grandes
Capa 5: Circuit Break  → Automático por volumen anómalo
Capa 6: Pausa Global  → Emergency stop por guardianes
Capa 7: Recovery      → Social recovery con delay 72h
```

## Controles de Seguridad por Contrato

### SmartWallet
- Límite diario configurable (máx 1M ETH)
- Timelock 48h para operaciones queued
- Sesiones temporales con spend limit
- Bloqueo por owner O guardian
- Desbloqueo SOLO por owner
- Recovery social con 72h de espera (cancelable por owner)
- Nonce para replay protection en meta-tx
- ReentrancyGuard en todas las funciones de ejecución

### MultiSigWallet
- Mínimo 2 firmantes, máximo 20
- Requiere M-de-N confirmaciones (mínimo 2)
- Timelock automático para operaciones > threshold
- Roles: ADMIN (pause/unpause), OPERATOR (submit/confirm), VIEWER
- Cambios de gobernanza solo via multisig (self-referential)
- Cualquier firmante puede pausar, solo ADMIN despausa

### Paymaster
- Empresas depositan/retiran libremente (no custodial)
- Whitelist de contratos permitidos por empresa
- Whitelist de usuarios autorizados por empresa
- Límite diario y máx gas por transacción
- Solo relayers autorizados pueden ejecutar sponsorGas
- Pausa de emergencia por admin

### SecurityModule
- Timelock mínimo 24h, máximo 30 días
- Grace period de 14 días (operaciones expiran)
- Circuit breaker por contrato con ventana configurable
- Guardianes con threshold M-de-N para pausas
- Audit log inmutable on-chain
- Admin = MultiSig DAO (nunca EOA individual)

### WalletGuardian
- Guardianes verificados por protocolo
- Trust score 0-100 (mínimo 50 para verificación)
- Tracking de recoveries por guardián
- No se puede ser guardián de uno mismo
- Labels para identificación institucional

## Claves y Secretos
- **NUNCA** commitear claves privadas
- Usar variables de entorno para secretos
- Deployer key de desarrollo ≠ producción
- JWT_SECRET debe ser generado aleatoriamente (mínimo 256 bits)
- Rotación de claves cada 90 días en producción

## Auditoría
- Contratos deben auditarse antes de mainnet
- Bug bounty program recomendado
- Audit log on-chain en SecurityModule
- Logs centralizados en PostgreSQL (tabla ai_logs)
- Redis pub/sub para alertas en tiempo real

## Checklist Pre-Producción
- [ ] Auditoría externa de contratos wallet
- [ ] Pen testing de API endpoints
- [ ] Rate limiting configurado
- [ ] CORS restringido a dominios conocidos
- [ ] Helmet headers configurados
- [ ] Input validation en todos los endpoints
- [ ] Circuit breakers configurados
- [ ] Guardian threshold establecido
- [ ] Timelock delay configurado (≥48h producción)
- [ ] Admin transferido a MultiSig DAO
