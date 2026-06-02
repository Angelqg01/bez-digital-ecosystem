---
name: Testing
description: How to run tests, create new tests, and maintain test coverage for BeZhas
---

# Testing SKILL

## Inventario de Tests (36 archivos)

### Unit Tests
| Test | Archivo |
|---|---|
| Payment System | `tests/payment-system.test.js` |
| Stripe Service | `tests/stripe.service.test.js` |
| Token Distribution | `tests/token-distribution.test.js` |
| Subscription ROI | `tests/subscription-roi.test.js` |
| Bridge Core | `tests/bridge.core.test.js` |
| Bridge Adapters | `tests/bridge.adapters.test.js` |
| Developer Console | `tests/developerConsole.test.js` |
| Quality Reputation | `tests/qualityReputationSystem.test.js` |
| Security | `tests/security.test.js` |
| 2FA | `tests/2fa.test.js` |
| OAuth | `tests/oauth.test.js` |
| Feed | `tests/feed.test.js` |
| Groups | `tests/groups.test.js` |
| Ads | `tests/ads.test.js` |
| API | `tests/api.test.js` |
| Admin V1 | `tests/admin.v1.test.js` |
| Blockchain Service | `tests/blockchain.service.test.js` |
| Database Connection | `tests/database-connection.test.js` |
| Global Settings | `tests/globalSettings.test.js` |

### Integration Tests
| Test | Archivo |
|---|---|
| Auth Integration | `tests/integration/auth.integration.test.js` |
| DAO Pay-to-Vote | `tests/integration/dao-pay-to-vote.integration.test.js` |
| Fiat-to-BEZ E2E | `tests/integration/fiat-to-bez.e2e.test.js` |
| Full System | `tests/integration/full-system-integration.test.js` |
| Global Settings | `tests/integration/globalSettings.integration.test.js` |
| Health | `tests/integration/health.integration.test.js` |
| Marketplace | `tests/integration/marketplace.integration.test.js` |
| Price Oracle | `tests/integration/price-oracle.test.js` |
| Validation | `tests/integration/validation.integration.test.js` |

### Unit AI Tests
| Test | Archivo |
|---|---|
| AI Gateway | `tests/unit/aiGateway.service.test.js` |
| ML Service | `tests/unit/ml.service.test.js` |
| SDK Admin | `tests/unit/sdkAdmin.service.test.js` |
| Unified AI | `tests/unit/unified-ai.service.test.js` |

### Automation Tests
| Test | Archivo |
|---|---|
| Diagnostic System | `tests/automation/diagnosticSystem.test.js` |
| Reward System | `tests/automation/rewardSystem.test.js` |
| Third Party Analyzer | `tests/automation/thirdPartyAnalyzer.test.js` |

### E2E
| Test | Archivo |
|---|---|
| Payment Flow | `tests/payment-flow-e2e.test.js` |

## Comandos

```bash
# Correr TODOS los tests
cd backend && npx jest --no-cache

# Correr un test específico
npx jest tests/payment-system.test.js --verbose

# Correr tests de integración
npx jest tests/integration/ --verbose

# Con coverage
npx jest --coverage

# Watch mode
npx jest --watch
```

## Cómo Crear un Nuevo Test
1. Crear archivo en `tests/` con sufijo `.test.js`
2. Importar el servicio/ruta a testear
3. Usar `jest.mock()` para dependencias externas (MongoDB, ethers, etc.)
4. Seguir patrón: `describe > it > expect`
5. Correr: `npx jest tests/<nuevo>.test.js --verbose`
