# BeZhas Web3 - Deployment Guide

## Pre-Deployment Checklist

### ✅ Completado
- [x] Variables de entorno configuradas
- [x] Tests de base de datos creados
- [x] Tests de flujo de pagos creados
- [x] MCP Server con payment tools
- [x] Servicio de pagos crypto
- [x] Documentación de webhook de Stripe
- [x] Configuración de GCP Secret Manager

### 📋 Pendiente antes de Deploy
- [ ] Ejecutar tests localmente
- [ ] Verificar conexión a MongoDB
- [ ] Configurar secrets en GCP Secret Manager
- [ ] Actualizar variables de entorno en GCP
- [ ] Configurar webhook de Stripe en producción

---

## 1. Testing Local

### Prerequisitos
```bash
# Iniciar MongoDB (Docker)
docker run -d -p 27017:27017 --name mongodb mongo:latest

# O usar MongoDB Atlas (actualizar DATABASE_URL en .env)
```

### Ejecutar Tests
```powershell
# Test de conexión a base de datos
cd backend
npm run test:db

# Test de flujo de pagos
npm run test:payments

# Todos los tests
npm run test:all
```

---

## 2. Configurar GCP Secrets

### Crear Secrets en Secret Manager

```bash
# Autenticar con GCP
gcloud auth login
gcloud config set project bezhas-production

# Crear secrets
echo -n "mongodb+srv://..." | gcloud secrets create mongodb-uri --data-file=-
echo -n "sk_live_..." | gcloud secrets create stripe-secret-key --data-file=-
echo -n "whsec_..." | gcloud secrets create stripe-webhook-secret --data-file=-
echo -n "your-jwt-secret" | gcloud secrets create jwt-secret --data-file=-
echo -n "0x..." | gcloud secrets create private-key --data-file=-
echo -n "0x..." | gcloud secrets create admin-wallet-address --data-file=-

# Verificar secrets creados
gcloud secrets list
```

### Dar permisos al App Engine

```bash
# Obtener service account de App Engine
PROJECT_ID="bezhas-production"
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

# Dar acceso a secrets
gcloud secrets add-iam-policy-binding mongodb-uri \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding stripe-secret-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding stripe-webhook-secret \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding private-key \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding admin-wallet-address \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Deploy Backend a GCP

```bash
# Desde la raíz del proyecto
cd backend

# Deploy a App Engine
gcloud app deploy app.yaml --project=bezhas-production

# Verificar deployment
gcloud app browse
```

### Verificar Health Checks

```bash
# Health check
curl https://api-dot-bezhas-production.uc.r.appspot.com/api/health/live

# Debería retornar:
# {"status":"ok","timestamp":"..."}
```

---

## 4. Deploy Frontend a GCP

```bash
# Desde la raíz del proyecto
cd frontend

# Build de producción
npm run build

# Deploy a App Engine
gcloud app deploy app.yaml --project=bezhas-production

# Verificar deployment
gcloud app browse
```

---

## 5. Configurar Webhook de Stripe

### En Stripe Dashboard

1. Ir a [https://dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Click en "Add endpoint"
3. URL: `https://api-dot-bezhas-production.uc.r.appspot.com/api/stripe/webhook`
4. Eventos a escuchar:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. Copiar el Webhook Secret
6. Actualizar secret en GCP:
   ```bash
   echo -n "whsec_..." | gcloud secrets versions add stripe-webhook-secret --data-file=-
   ```

---

## 6. Push a GitHub

### Preparar Commit

```bash
# Ver archivos modificados
git status

# Agregar archivos nuevos
git add .env.example
git add backend/app-secrets.yaml
git add backend/tests/database-connection.test.js
git add backend/tests/payment-flow-e2e.test.js
git add backend/services/crypto-payment.service.js
git add backend/routes/crypto-payment.routes.js
git add packages/mcp-server/src/tools/payment-tools.ts
git add packages/mcp-server/src/index.ts
git add packages/mcp-server/src/tools/index.ts
git add STRIPE_WEBHOOK_SETUP.md
git add frontend/app.yaml

# Commit
git commit -m "feat: Complete infrastructure fixes and payment integration

- Added missing environment variables (DATABASE_URL, ADMIN_WALLET_ADDRESS, FRONTEND_URL)
- Created comprehensive test suites for database and payment flows
- Implemented MCP payment tools (5 new tools)
- Created crypto payment service for USDT, USDC, MATIC
- Added GCP Secret Manager configuration
- Updated frontend app.yaml with correct project ID
- Created Stripe webhook setup documentation"

# Push a GitHub
git push origin main
```

---

## 7. Verificación Post-Deployment

### Backend

```bash
# Health check
curl https://api-dot-bezhas-production.uc.r.appspot.com/api/health/live

# Test de endpoint de pagos
curl https://api-dot-bezhas-production.uc.r.appspot.com/api/crypto/quote \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"amount": 10, "currency": "USDT"}'
```

### Frontend

```bash
# Verificar que carga
curl -I https://bezhas-production.uc.r.appspot.com
```

### Webhook de Stripe

```bash
# Hacer un pago de prueba en Stripe
# Verificar logs en GCP
gcloud app logs tail -s default
```

---

## 8. Monitoreo

### Ver Logs en GCP

```bash
# Logs del backend
gcloud app logs tail -s default

# Logs con filtro
gcloud app logs tail -s default --level=error

# Logs de un servicio específico
gcloud logging read "resource.type=gae_app" --limit 50
```

### Configurar Alertas

```bash
# Crear alerta para errores 5xx
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Backend 5xx Errors" \
  --condition-display-name="High error rate" \
  --condition-threshold-value=10 \
  --condition-threshold-duration=60s
```

---

## 9. Rollback (Si es necesario)

```bash
# Ver versiones desplegadas
gcloud app versions list

# Rollback a versión anterior
gcloud app versions migrate VERSION_ID

# Eliminar versión problemática
gcloud app versions delete VERSION_ID
```

---

## 🚨 Troubleshooting

### Error: "DATABASE_URL not found"
- Verificar que el secret existe: `gcloud secrets describe mongodb-uri`
- Verificar permisos del service account
- Revisar `backend/app-secrets.yaml`

### Error: "Stripe webhook signature verification failed"
- Verificar que `STRIPE_WEBHOOK_SECRET` está actualizado
- Verificar que la URL del webhook en Stripe es correcta
- Revisar logs: `gcloud app logs tail -s default | grep stripe`

### Error: "Hot wallet has insufficient BEZ"
- Transferir más BEZ al hot wallet
- Verificar balance: `npm run check-wallet-balance`

---

## 📊 Métricas de Éxito

- ✅ Backend responde en `/api/health/live`
- ✅ Frontend carga correctamente
- ✅ Webhook de Stripe recibe eventos
- ✅ Pagos crypto funcionan
- ✅ Tests pasan localmente
- ✅ Logs no muestran errores críticos

---

**Última actualización:** 9 de Febrero, 2026
