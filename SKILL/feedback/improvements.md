# Improvements Backlog — BeZhas Blockchain
> Lista de mejoras propuestas para el sistema

## Prioridad Alta

### 1. ERC-4337 Completo
**Estado**: Pendiente
**Descripción**: Implementar EntryPoint.sol y UserOperation completo para Account Abstraction estándar
**Beneficio**: Compatibilidad con wallets AA ecosistema (Pimlico, Stackup)
**Bloqueado por**: Nada — prioridad de implementación

### 2. BEZCoinV2 + ERC20Votes
**Estado**: Bloqueado
**Descripción**: Extender BEZCoinV2 con ERC20Votes para habilitar GovernanceSystem
**Beneficio**: Gobernanza on-chain funcional
**Bloqueado por**: Modificación de contrato core existente

### 3. Frontend Wallet UI
**Estado**: Pendiente
**Descripción**: Dashboard para SmartWallet, MultiSig, y Paymaster
**Páginas**: /wallets, /wallets/create, /wallets/[address], /multisig, /paymaster
**Tech**: Next.js 14 + shadcn/ui

### 4. Proxy Upgrade Pattern
**Estado**: Evaluación
**Descripción**: Implementar UUPS proxy para contratos que necesiten upgrades
**Riesgo**: Complejidad adicional, superficie de ataque mayor
**Decisión**: Postponed — contratos actuales son immutables por diseño

## Prioridad Media

### 5. Gas Optimization
- Usar `bytes32` en lugar de `string` donde posible
- Batch operations para reducir gas en loops
- Custom errors en vez de `require` strings (ya usado parcialmente)

### 6. Event Indexing Service
- Subgraph o servicio de indexación para eventos on-chain
- Mejoraría performance de queries históricos
- Blockscout cubre parcialmente

### 7. Rate Limiting por Wallet
- Actual: rate limit por IP
- Propuesto: rate limit adicional por wallet address
- Previene abuse a nivel de cuenta

### 8. Multi-Chain Bridge
- Extender bridge para soportar múltiples L1/L2
- Documentación existente: MultiChain_Bridges_Architecture.md

## Prioridad Baja

### 9. Mobile SDK
- React Native wrapper del SDK existente
- O SDK nativo para iOS/Android

### 10. Formal Verification
- Verificación formal de SmartWallet y MultiSigWallet
- Herramientas: Certora, Halmos

### 11. ZK Proof Integration
- ZK proofs para privacy en transacciones empresariales
- Largo plazo — requiere investigación significativa
