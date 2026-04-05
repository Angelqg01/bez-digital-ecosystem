# 🚀 UNIFIED SUBSCRIPTION & STAKING SYSTEM

## Implementation Summary

**Fecha:** 2026-01-27  
**Versión:** 2.0.0  
**Estado:** Implementado

---

## 📦 Archivos Creados

### Backend

| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `backend/config/tier.config.js` | Configuración central de tiers | ~180 |
| `backend/services/tokenomics.service.js` | AI costs, gas oracle, caching | ~250 |
| `backend/services/subscription.service.js` | Stripe + Token Lock management | ~220 |
| `backend/middleware/subscription.middleware.js` | Access guards & rate limiting | ~180 |
| `backend/bezhas-sdk.js` | SDK wrapper unificado | ~300 |

### Frontend

| Archivo | Propósito | Líneas |
|---------|-----------|--------|
| `frontend/src/config/tier.config.js` | Configuración frontend de tiers | ~280 |
| `frontend/src/components/vip/ROICalculator.jsx` | Calculadora visual de ROI | ~450 |
| `frontend/src/hooks/useSubscription.js` | Hook de suscripción | ~280 |

### Configuración

| Archivo | Cambios |
|---------|---------|
| `backend/.env.example` | +70 líneas nuevas variables |

---

## 🎯 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER INTERFACE                              │
├─────────────────────────────────────────────────────────────────┤
│  ROICalculator.jsx  │  BeVIP.jsx  │  StakingPage.jsx            │
│  useSubscription.js │  tier.config.js (frontend)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API LAYER                                   │
├─────────────────────────────────────────────────────────────────┤
│  subscription.middleware.js                                      │
│  ├── requireTier()     → Access control                         │
│  ├── checkAIAccess()   → AI rate limiting                       │
│  └── calculateGasSubsidy() → Gas calculations                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVICES LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  bezhas-sdk.js (Unified Entry Point)                            │
│  ├── subscription.service.js → Stripe + Token Lock              │
│  └── tokenomics.service.js   → AI costs + Gas Oracle            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
├─────────────────────────────────────────────────────────────────┤
│  tier.config.js (Single Source of Truth)                        │
│  ├── SUBSCRIPTION_TIERS                                         │
│  ├── APY_MULTIPLIERS                                            │
│  └── COST_MATRIX                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💰 Matriz de Tiers

### Pricing

| Tier | Monthly | Yearly | Token Lock Alt |
|------|---------|--------|----------------|
| **STARTER** | $0 | $0 | - |
| **CREATOR** | $14.99 | $149.99 | 5,000 BEZ × 90d |
| **BUSINESS** | $99.99 | $999.99 | 50,000 BEZ × 180d |

### Staking Multipliers

| Tier | Multiplier | Effective APY |
|------|------------|---------------|
| **STARTER** | 1.0× | 12.50% |
| **CREATOR** | 1.5× | 18.75% |
| **BUSINESS** | 2.5× | 31.25% |

### Gas Subsidies

| Tier | Subsidy | Effect |
|------|---------|--------|
| **STARTER** | 0% | User pays all gas |
| **CREATOR** | 25% | 75% gas cost |
| **BUSINESS** | 100% | Free gas |

### AI Access

| Tier | Daily Queries | Models |
|------|---------------|--------|
| **STARTER** | 5 | GPT-3.5 |
| **CREATOR** | 50 | GPT-3.5, GPT-4, Gemini |
| **BUSINESS** | ∞ | All models |

---

## 🔧 Uso del SDK

### Backend

```javascript
const BeZhasSDK = require('./bezhas-sdk');

// Initialize
const sdk = new BeZhasSDK({ userId: 'user123' });

// Get user subscription
const sub = await sdk.subscription.getStatus();
console.log(sub.tier); // 'CREATOR'
console.log(sub.effectiveAPY); // 18.75

// Calculate ROI
const roi = sdk.staking.calculateROI(10000, 12);
console.log(roi.netProfitBEZ); // 1875

// Check AI access
const canUseGPT4 = await sdk.ai.canUseModel('gpt-4');
const cost = sdk.ai.estimateCost('gpt-4', 1000);

// Get gas subsidy
const subsidized = sdk.gas.calculateSubsidy(0.50); // $0.50 gas
console.log(subsidized.userPays); // 0.375 for CREATOR
```

### Frontend

```jsx
import { useSubscription } from '@/hooks/useSubscription';
import ROICalculator from '@/components/vip/ROICalculator';

function MyComponent() {
  const { 
    tier, 
    effectiveAPY, 
    hasFeature,
    createCheckout 
  } = useSubscription();

  return (
    <div>
      <p>Tu tier: {tier}</p>
      <p>Tu APY: {effectiveAPY}%</p>
      
      <ROICalculator 
        initialStakeAmount={10000}
        onSelectTier={(tier, roi) => {
          console.log('Selected:', tier, roi);
        }}
      />
      
      {!hasFeature('advancedAIModels') && (
        <button onClick={() => createCheckout('CREATOR')}>
          Upgrade para GPT-4
        </button>
      )}
    </div>
  );
}
```

---

## 📊 ROI Calculator Features

El componente `ROICalculator.jsx` incluye:

1. **Slider de Stake Amount** - 100 a 100,000 BEZ
2. **Selector de Duración** - 3, 6, 12, 24 meses
3. **Comparativa Visual** - Barras de progreso por tier
4. **Tarjetas de Tier** - Desglose detallado
5. **Token Lock Alternative** - Info sobre lock alternativo
6. **Breakdown Detallado** - Cálculos paso a paso
7. **Recomendación Automática** - Tier óptimo según stake

---

## 🔐 Environment Variables

Variables nuevas en `.env`:

```env
# Stripe Price IDs
STRIPE_PRICE_CREATOR_MONTHLY=price_xxx
STRIPE_PRICE_CREATOR_YEARLY=price_xxx
STRIPE_PRICE_BUSINESS_MONTHLY=price_xxx
STRIPE_PRICE_BUSINESS_YEARLY=price_xxx

# Staking
BASE_STAKING_APY=12.5
BEZ_TO_USD_RATE=0.05

# Token Lock
TOKEN_LOCK_CONTRACT_ADDRESS=0x...
TOKEN_LOCK_CREATOR=5000
TOKEN_LOCK_BUSINESS=50000

# Signature
SUBSCRIPTION_SIGNATURE_SECRET=xxx

# AI Limits
AI_DAILY_LIMIT_STARTER=5
AI_DAILY_LIMIT_CREATOR=50
AI_DAILY_LIMIT_BUSINESS=9999

# Gas Subsidy
GAS_SUBSIDY_ENABLED=true
GAS_SUBSIDY_TREASURY_WALLET=0x...
```

---

## 🚀 Próximos Pasos

### Pendiente de Implementar

1. **Smart Contract Updates**
   - [ ] Modificar `Staking.sol` para verificar signatures
   - [ ] Añadir función `stakeWithTierBonus(amount, signature)`
   - [ ] Implementar `TokenLock.sol` para subscripciones on-chain

2. **API Endpoints**
   - [ ] POST `/api/subscription/checkout`
   - [ ] POST `/api/subscription/token-lock`
   - [ ] GET `/api/subscription/staking-signature`
   - [ ] GET `/api/subscription/status`

3. **Frontend Updates**
   - [ ] Integrar ROICalculator en BeVIP.jsx
   - [ ] Actualizar StakingPage con tier multipliers
   - [ ] Añadir badge de tier en navbar

4. **Testing**
   - [ ] Unit tests para tier.config.js
   - [ ] Integration tests para subscription.service.js
   - [ ] E2E tests para checkout flow

---

## 📚 Documentación Relacionada

- [SUBSCRIPTION_SYSTEM_BLUEPRINT.md](./SUBSCRIPTION_SYSTEM_BLUEPRINT.md)
- [STAKING_FARMING_UNIFIED.md](./STAKING_FARMING_UNIFIED.md)
- [BEZHAS_SDK_AUDIT.md](./BEZHAS_SDK_AUDIT.md)

---

## ⚡ Quick Start

```bash
# 1. Actualizar variables de entorno
cp backend/.env.example backend/.env
# Editar backend/.env con tus Stripe Price IDs

# 2. Crear productos en Stripe Dashboard
# Creator Pro: $14.99/mo, $149.99/yr
# Business: $99.99/mo, $999.99/yr

# 3. Iniciar desarrollo
pnpm run dev:up

# 4. Probar ROI Calculator
# Navegar a http://localhost:5173/vip
```

---

**Implementado por:** GitHub Copilot  
**Revisión:** Pendiente
