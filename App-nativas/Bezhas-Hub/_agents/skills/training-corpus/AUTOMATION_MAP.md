# BeZhas — Mapa de Automatizaciones

> Referencia completa de todas las automatizaciones del sistema.
> La IA debe consultar este mapa para entender el flujo de trabajo.

## 🔄 Automatizaciones Activas

### 1. Sistema de Pagos (BEZ-Pay)
```
Trigger: Cliente envía pago (crypto/fiat/bank)
Flow:    payment.routes.js → bezpay.service.js → token-distribution.service.js
Action:  Dispensar BEZ tokens al comprador via Hot Wallet
Files:
  → backend/routes/payment.routes.js
  → backend/routes/bezpay.routes.js
  → backend/services/bezpay.service.js
  → backend/services/token-distribution.service.js
  → backend/services/fiat-gateway.service.js
```

### 2. VIP Auto-Activation
```
Trigger: Pago de suscripción VIP confirmado
Flow:    bezpay.service.js → _activateVipPlan() → User.updateOne()
Action:  Activar plan VIP + features en el perfil del usuario
Files:
  → backend/services/bezpay.service.js (case 'subscription')
  → backend/models/User.model.js
```

### 3. OpenCLaw Auto-Provisioning ← NUEVO
```
Trigger: Suscripción completada
Flow:    bezpay.service.js → payment-openclaw-bridge.js → OpenClawAgent
Action:  AEGIS valida → OpenCLaw genera API keys + webhook secrets
Files:
  → backend/services/payment-openclaw-bridge.js
  → backend/routes/openclaw.routes.js
```

### 4. Stripe Webhooks
```
Trigger: Stripe envía evento (payment_intent.succeeded, etc.)
Flow:    stripe-webhook.routes.js → stripe.service.js
Action:  Confirmar pago, activar suscripción
Files:
  → backend/routes/stripe-webhook.routes.js
  → backend/services/stripe.service.js
```

### 5. Bridge Sync
```
Trigger: Webhook de plataforma tercera (Vinted, Airbnb, Maersk)
Flow:    webhooks.routes.js → PlatformAdapter → MongoDB
Action:  Sincronizar inventario/pedidos/envíos
Files:
  → backend/bridge/webhooks/webhooks.routes.js
  → backend/bridge/adapters/VintedAdapter.js
  → backend/bridge/adapters/AirbnbAdapter.js
  → backend/bridge/adapters/MaerskAdapter.js
```

### 6. Diagnostic Agent
```
Trigger: Automático (cron) o manual
Flow:    diagnosticAgent.service.js → health checks → alerts
Action:  Monitorear salud del sistema, detectar fallos
Files:
  → backend/services/automation/diagnosticAgent.service.js
```

### 7. Reward System
```
Trigger: Actividad del usuario (compras, referrals, staking)
Flow:    rewardSystem.service.js → calculate rewards → dispense
Action:  Calcular y distribuir recompensas BEZ
Files:
  → backend/services/automation/rewardSystem.service.js
```

### 8. Third Party Analyzer
```
Trigger: Periódico o al conectar nueva plataforma
Flow:    thirdPartyAnalyzer.service.js → analyze → report
Action:  Analizar oportunidades en plataformas terceras
Files:
  → backend/services/automation/thirdPartyAnalyzer.service.js
```

### 9. Quality Escrow (On-Chain)
```
Trigger: Compra con garantía de calidad
Flow:    bezpay.service.js → QualityEscrow contract
Action:  Lock BEZ en escrow → liberar tras inspección
Files:
  → backend/services/bezpay.service.js (case 'quality_escrow')
  → contracts/QualityEscrow.sol
```

### 10. Liquidity Farming (On-Chain)
```
Trigger: Depósito BEZ en farming pool
Flow:    bezpay.service.js → LiquidityFarming contract
Action:  Depositar tokens + registrar multiplicador
Files:
  → backend/services/bezpay.service.js (case 'farming')
  → contracts/LiquidityFarming.sol
```

### 11. BullMQ Token Distribution (Retry)
```
Trigger: Pago completado con retry habilitado
Flow:    payment.routes.js → BullMQ queue → worker → dispenseTokens
Action:  Reintentar distribución de tokens hasta 5 veces
Files:
  → backend/routes/payment.routes.js (tokenDistributionQueue)
```

### 12. Credential Expiry Check ← NUEVO
```
Trigger: Cron job periódico
Flow:    payment-openclaw-bridge.js → checkExpiredCredentials()
Action:  Revocar credenciales expiradas de clientes
Files:
  → backend/services/payment-openclaw-bridge.js
```

---

## 🏗️ Servicios Backend por Categoría (68 total)

### Core Payment (7)
| Servicio | Tamaño | Descripción |
|---|---|---|
| bezpay.service.js | 24.9KB | Core BEZ-Pay engine |
| stripe.service.js | 37.7KB | Stripe integration |
| fiat-gateway.service.js | 14.8KB | Bank/SEPA gateway |
| crypto-payment.service.js | 11.6KB | Native crypto payments |
| token-distribution.service.js | 10.5KB | Token distribution + DLQ |
| subscription.service.js | 23.8KB | Plan management |
| payment-openclaw-bridge.js | ~15KB | OpenCLaw+AEGIS bridge |

### AI / ML (6)
| Servicio | Tamaño | Descripción |
|---|---|---|
| unified-ai.service.js | 21.3KB | Multi-provider LLM gateway |
| ai-provider.service.js | 14.3KB | Provider selection logic |
| aiGateway.service.js | 13.9KB | Rate limiting + routing |
| rag.service.js | 15.3KB | RAG for knowledge retrieval |
| ml.service.js | 7.8KB | Machine learning models |
| orchestrator.service.js | 13.3KB | Task orchestration |

### Automation (3)
| Servicio | Tamaño | Descripción |
|---|---|---|
| diagnosticAgent.service.js | 20.6KB | System health monitoring |
| rewardSystem.service.js | 8.1KB | Reward distribution |
| thirdPartyAnalyzer.service.js | 2.5KB | Platform analysis |

### Infrastructure (5+)
| Servicio | Descripción |
|---|---|
| web3.service.js | Blockchain provider |
| redis.service.js | Cache + queues |
| notification.service.js | Email/push notifications |
| price-oracle.service.js | Token price feeds |
| aegis.service.js | AEGIS connection |
