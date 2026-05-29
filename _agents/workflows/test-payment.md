---
description: How to test the payment flow end-to-end
---

# Test Payment Flow

## Pasos

1. Correr tests unitarios del sistema de pagos:
```bash
cd "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\BeZhas-Hub\backend"
npx jest tests/payment-system.test.js --verbose --no-cache
```

2. Correr test E2E de flujo de pago:
```bash
cd "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\BeZhas-Hub\backend"
npx jest tests/payment-flow-e2e.test.js --verbose --no-cache
```

3. Correr test de fiat-to-BEZ:
```bash
cd "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\BeZhas-Hub\backend"
npx jest tests/integration/fiat-to-bez.e2e.test.js --verbose --no-cache
```

4. Correr test de Stripe:
```bash
cd "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\BeZhas-Hub\backend"
npx jest tests/stripe.service.test.js --verbose --no-cache
```

5. Correr test de token distribution:
```bash
cd "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\BeZhas-Hub\backend"
npx jest tests/token-distribution.test.js --verbose --no-cache
```

6. Si todos pasaron, marcar como ✅ en `_agents/skills/feedback-loop/optimization-log.md`
