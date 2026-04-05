# Testing & Deployment - Quick Reference
## Comandos Rápidos para Testing y Deploy

---

## 🧪 Testing

### Backend Tests
```bash
# Test de validaciones
node tests/validation-endpoints.test.js

# Test de VIP
node tests/vip-system.test.js

# Simular webhooks Stripe
node tests/stripe-webhook-simulator.js flow
```

### Verificación del Sistema
```bash
node scripts/verify-critical-systems.js
```

---

## 🔑 Configurar API Keys

### 1. Pinata (IPFS)
- Registrarse: https://app.pinata.cloud/register
- API Keys: https://app.pinata.cloud/keys
- Plan gratuito: 1GB storage

### 2. Stripe (VIP)
- Test Mode: https://dashboard.stripe.com/test/dashboard
- API Keys: https://dashboard.stripe.com/test/apikeys
- Webhooks: https://dashboard.stripe.com/test/webhooks

### 3. Alchemy (RPC)
- Dashboard: https://dashboard.alchemy.com/
- Create App → Polygon Amoy
- Plan gratuito: 300M compute units/mes

### 4. Faucet (MATIC)
- Amoy Faucet: https://faucet.polygon.technology/
- Solicitar 0.5 MATIC para testing

---

## 🚀 Deploy a Amoy

### Preparación
```bash
# 1. Compilar contratos
npx hardhat compile

# 2. Verificar balance
cd scripts && node check-balance.js

# 3. Verificar .env
cat backend/.env | grep -E "POLYGON_RPC_URL|PRIVATE_KEY"
```

### Deploy
```bash
# Deploy todos los contratos a Amoy
npx hardhat run scripts/deploy-to-amoy.js --network amoy
```

### Post-Deploy
```bash
# 1. Copiar addresses del deployment
cat deployments/amoy-latest.json

# 2. Actualizar backend/.env con las addresses

# 3. Reiniciar backend
cd backend && npm run dev

# 4. Ejecutar tests de integración
cd ../tests && node validation-endpoints.test.js
```

---

## 📁 Archivos Creados

### Tests
- `tests/validation-endpoints.test.js` - Test suite para validaciones
- `tests/vip-system.test.js` - Test suite para VIP
- `tests/stripe-webhook-simulator.js` - Simulador de webhooks Stripe

### Config
- `backend/.env.test.example` - Template de configuración de testing

### Deploy
- `scripts/deploy-to-amoy.js` - Script de deploy a testnet
- `deployments/amoy-latest.json` - Últimas addresses desplegadas

### Docs
- `TESTING_AND_DEPLOYMENT_GUIDE.md` - Guía completa

---

## ✅ Checklist

### Pre-Deploy
- [ ] Balance > 0.5 MATIC en wallet
- [ ] PRIVATE_KEY configurada
- [ ] POLYGON_RPC_URL apunta a Amoy
- [ ] Contratos compilados sin errores

### Post-Deploy
- [ ] Contracts verificados en https://amoy.polygonscan.com
- [ ] .env actualizado con nuevas addresses
- [ ] Backend reiniciado
- [ ] Tests de endpoints pasando

### API Keys Configuradas
- [ ] PINATA_API_KEY
- [ ] STRIPE_SECRET_KEY
- [ ] STRIPE_WEBHOOK_SECRET
- [ ] POLYGON_RPC_URL (Alchemy)

---

## 🔗 Links Útiles

- **Amoy Explorer:** https://amoy.polygonscan.com/
- **Amoy Faucet:** https://faucet.polygon.technology/
- **Alchemy Dashboard:** https://dashboard.alchemy.com/
- **Pinata Dashboard:** https://app.pinata.cloud/
- **Stripe Test:** https://dashboard.stripe.com/test/dashboard

---

**Última actualización:** 23 de Enero, 2026
