---
name: Payment System
description: Complete reference for the BEZ-Pay payment system including BezPay, Stripe, SEPA, crypto, and OpenCLaw integration
---

# Payment System SKILL

## Arquitectura de Pagos

```
                    ┌─────────────────────┐
                    │  bezhas-pay-system   │  ← Frontend (React JSX)
                    │  .jsx (1406 líneas) │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌──────────┐   ┌──────────┐   ┌──────────────┐
       │ BEZ-Pay  │   │ Stripe   │   │ Bank/SEPA    │
       │ (crypto) │   │ (cards)  │   │ (fiat)       │
       └────┬─────┘   └────┬─────┘   └──────┬───────┘
            │              │                 │
            ▼              ▼                 ▼
       ┌──────────────────────────────────────────┐
       │  payment.routes.js (1013 líneas)          │
       │  bezpay.routes.js                         │
       │  crypto-payment.routes.js                 │
       └─────────────────┬────────────────────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
     ┌──────────┐ ┌───────────┐ ┌───────────────┐
     │bezpay    │ │stripe     │ │fiat-gateway   │
     │.service  │ │.service   │ │.service       │
     │(541 lín) │ │(37.7KB)   │ │(322 líneas)   │
     └────┬─────┘ └───────────┘ └───────────────┘
          │
          ▼
     ┌───────────────────────┐
     │payment-openclaw-bridge│  ← NUEVO: conecta con OpenCLaw/AEGIS
     │.js                    │
     └───────────┬───────────┘
          ┌──────┼──────┐
          ▼             ▼
     ┌─────────┐  ┌─────────┐
     │ OpenCLaw│  │ AEGIS   │
     │ Agent   │  │ Monitor │
     └─────────┘  └─────────┘
```

## Archivos Clave
| Archivo | Tamaño | Función |
|---|---|---|
| `bezpay.service.js` | 541 líneas | Core: Hot Wallet, dispenseBEZ(), VIP, Farming, Escrow |
| `fiat-gateway.service.js` | 322 líneas | Safe Wallet → transferFrom(), SEPA bank details |
| `stripe.service.js` | 37.7KB | Checkout sessions, payment intents, refunds |
| `payment.routes.js` | 1013 líneas | Hybrid router: Stripe+BEZ+Bank + BullMQ retries |
| `crypto-payment.service.js` | 11.6KB | Native crypto transfers verification |
| `subscription.service.js` | 23.8KB | Plan management, auto-renewal |
| `token-distribution.service.js` | 10.5KB | Burn + Treasury split distribution |
| `payment-openclaw-bridge.js` | ~400 lín | Bridge to OpenCLaw/AEGIS |
| `openclaw.routes.js` | ~250 lín | OpenCLaw API endpoints |

## Flujo de Pago Completo

### 1. Compra BEZ (crypto)
```
Frontend → POST /api/bezpay/create
  → bezpay.service.js → calculatePaymentAmounts()
  → Returns: { paymentAddress, amountToSend, bezAmount }
User sends crypto on-chain →
Frontend → POST /api/bezpay/webhook { txHash, walletAddress }
  → bezpay.service.js → handleWebhook()
  → Verify on-chain TX
  → dispenseBEZ(walletAddress, bezAmount)  ← Hot Wallet sends BEZ
  → _updatePaymentStatus('completed')
  → openclawBridge.onPaymentCompleted()   ← NUEVO
```

### 2. Suscripción VIP
```
Frontend → POST /api/payment/crypto/vip-subscription { bezAmount, wallet, tier }
  → Creates pending payment
User pays on-chain →
Frontend → POST /api/payment/crypto/confirm { paymentId, txHash }
  → Activates VIP tier in user model
  → openclawBridge.onPaymentCompleted({ type: 'subscription', planId })
    → AEGIS validates
    → OpenCLaw provisions API keys for platforms
    → Client gets credentials via chat
```

### 3. Bank Transfer (SEPA)
```
Frontend → POST /api/payment/bank-transfer/create-order { amountBez, wallet }
  → Returns bank details + reference code
Admin confirms transfer →
Admin → triggers dispenseTokens() manually or via webhook
```

## Contratos de Pago
| Contrato | Dirección | Red |
|---|---|---|
| BEZ Token | `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8` | Polygon Amoy |
| BEZ BNB | `0x8a1e3930fde1f151471c368fdbb39f3f63a65b55` | BNB Chain |
| QualityEscrow | `0x3EfC42095E8503d41Ad8001328FC23388E00e8a3` | Polygon |
| StakingPool | `0x5c9bd3136fBAA3861DeAE71e689AD8792202c7Df` | Polygon |
| Treasury | env.TREASURY_WALLET | Polygon |

## Planes VIP (en BEZ)
| Plan | BEZ | USD | Duración |
|---|---|---|---|
| Basic | 500 | $49 | 30 días |
| Creator | 1,000 | $99 | 30 días |
| Pro | 2,500 | $199 | 30 días |
| Business | 5,000 | $399 | 30 días |
| Enterprise | 15,000 | $999 | 30 días |

## Tests de Pagos
```bash
npx jest tests/payment-system.test.js --verbose
npx jest tests/payment-flow-e2e.test.js --verbose
npx jest tests/integration/fiat-to-bez.e2e.test.js --verbose
npx jest tests/stripe.service.test.js --verbose
npx jest tests/token-distribution.test.js --verbose
```

## Problemas Conocidos y Soluciones

### Hot Wallet sin MATIC para gas
**Síntoma**: `Hot Wallet needs MATIC for gas fees`
**Solución**: Enviar al menos 0.01 MATIC al Hot Wallet

### BullMQ deshabilitado
**Síntoma**: `REDIS_URL not set — BullMQ disabled`
**Impacto**: Pagos funcionan pero sin retries automáticos
**Solución**: Configurar `REDIS_URL` o aceptar el fallback

### Stripe legacy routes returning 501
**Es intencional**: Las rutas legacy devuelven error indicando migración al nuevo sistema
