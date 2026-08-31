# 🚀 Post-Deployment Checklist - BeZhas Web3

## ✅ Completado

### Git & GitHub
- [x] Archivos agregados a Git
- [x] Commit creado con mensaje descriptivo
- [x] Push a GitHub realizado

### Implementación
- [x] Variables de entorno configuradas
- [x] Tests de base de datos creados
- [x] Tests de flujo de pagos creados
- [x] MCP Server con payment tools
- [x] Servicio de pagos crypto
- [x] Documentación completa

---

## 📋 Pendiente - Deployment a GCP

### 1. Configurar Secrets en GCP Secret Manager

```bash
# Autenticar con GCP
gcloud auth login
gcloud config set project bezhas-production

# Crear secrets (reemplazar valores con los reales)
echo -n "mongodb+srv://..." | gcloud secrets create mongodb-uri --data-file=-
echo -n "sk_live_..." | gcloud secrets create stripe-secret-key --data-file=-
echo -n "whsec_..." | gcloud secrets create stripe-webhook-secret --data-file=-
echo -n "your-jwt-secret-here" | gcloud secrets create jwt-secret --data-file=-
echo -n "0x..." | gcloud secrets create private-key --data-file=-
echo -n "0x52Df82920CBAE522880dD7657e43d1A754eD044E" | gcloud secrets create admin-wallet-address --data-file=-
```

### 2. Dar Permisos al App Engine

```bash
PROJECT_ID="bezhas-production"
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

# Dar acceso a cada secret
for secret in mongodb-uri stripe-secret-key stripe-webhook-secret jwt-secret private-key admin-wallet-address; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"
done
```

### 3. Deploy Backend

```bash
cd backend
gcloud app deploy app.yaml --project=bezhas-production
```

### 4. Deploy Frontend

```bash
cd ../frontend
gcloud app deploy app.yaml --project=bezhas-production
```

### 5. Configurar Webhook de Stripe

1. Ir a https://dashboard.stripe.com/webhooks
2. Click en "Add endpoint"
3. URL: `https://api-dot-bezhas-production.uc.r.appspot.com/api/stripe/webhook`
4. Eventos:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. Copiar Webhook Secret
6. Actualizar en GCP:
   ```bash
   echo -n "whsec_..." | gcloud secrets versions add stripe-webhook-secret --data-file=-
   ```

### 6. Verificar Deployment

```bash
# Health check backend
curl https://api-dot-bezhas-production.uc.r.appspot.com/api/health/live

# Health check frontend
curl -I https://bezhas-production.uc.r.appspot.com

# Test API de pagos
curl https://api-dot-bezhas-production.uc.r.appspot.com/api/crypto/quote \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"amount": 10, "currency": "USDT"}'
```

---

## 📊 Estado Actual

| Tarea | Estado |
|-------|--------|
| Código en GitHub | ✅ Completado |
| Secrets en GCP | ⏳ Pendiente |
| Backend en GCP | ⏳ Pendiente |
| Frontend en GCP | ⏳ Pendiente |
| Webhook de Stripe | ⏳ Pendiente |

---

## 📚 Documentación de Referencia

- [DEPLOYMENT_GUIDE_GCP.md](./DEPLOYMENT_GUIDE_GCP.md) - Guía completa de deployment
- [STRIPE_WEBHOOK_SETUP.md](./STRIPE_WEBHOOK_SETUP.md) - Configuración de webhooks
- [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md) - Resumen de cambios

---

**Última actualización:** 9 de Febrero, 2026
