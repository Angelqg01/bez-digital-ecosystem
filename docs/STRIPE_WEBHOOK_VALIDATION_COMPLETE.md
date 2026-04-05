# ✅ Validación Completada - Stripe Webhook en GCP

**Fecha:** 10 de Febrero, 2026  
**Estado:** 🔧 CORREGIDO Y LISTO PARA TESTING

---

## 📋 Resumen Ejecutivo

Se ha identificado y corregido un **problema crítico con la configuración del webhook de Stripe en GCP Cloud Run**. El webhook estaba implementado en el código pero NO estaba configurado en el pipeline de deployment.

### Cambios Realizados:
✅ Agregado `STRIPE_WEBHOOK_SECRET` a `.env.example`  
✅ Actualizado `deploy-gcp.yml` (staging) con secrets de Stripe  
✅ Actualizado `deploy-gcp.yml` (production) con secrets de Stripe  

---

## 🔴 Problema Identificado

### Estado Anterior:
```yaml
# GitHub Workflow - deploy-gcp.yml (ANTES)
Deploy Backend to Cloud Run (Staging):
  --set-env-vars=NODE_ENV=staging  # ⚠️ Solo NODE_ENV, sin secrets!

Deploy Backend to Cloud Run (Production):
  --set-secrets=MONGODB_URI,REDIS_URL,JWT_SECRET,STRIPE_SECRET_KEY
  # ⚠️ Falta STRIPE_WEBHOOK_SECRET!
```

**Impacto:**
- El webhook en `backend/routes/payment.routes.js:191` usa `process.env.STRIPE_WEBHOOK_SECRET`
- En GCP, esta variable era `undefined` 
- Las firmas de Stripe no se validaban correctamente
- Los webhooks fallaban silenciosamente en producción

---

## ✅ Soluciones Implementadas

### 1. **Actualización de .env.example**
```bash
# Agregado:
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_signing_secret_here"  # ← CRÍTICO
STRIPE_WEBHOOK_URL="https://api.bezhas.com/api/payment/webhook"
```

**Ubicación:** [.env.example](.env.example#L55-L68)

---

### 2. **Actualización de deploy-gcp.yml - Staging**

```yaml
Deploy Backend to Cloud Run (Staging):
  flags: |
    --set-env-vars=NODE_ENV=staging
    --set-secrets=STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest,STRIPE_SECRET_KEY=stripe-secret-key:latest
    # ↑ NUEVO: Ahora pasa los secrets de Stripe a Cloud Run
```

**Ubicación:** [deploy-gcp.yml#L308-L312](.github/workflows/deploy-gcp.yml#L308-L312)

---

### 3. **Actualización de deploy-gcp.yml - Production**

```yaml
Deploy Backend to Cloud Run (Production):
  --set-secrets=MONGODB_URI=mongodb-uri:latest,
               REDIS_URL=redis-url:latest,
               JWT_SECRET=jwt-secret:latest,
               STRIPE_SECRET_KEY=stripe-secret-key:latest,
               STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest  # ← NUEVO
```

**Ubicación:** [deploy-gcp.yml#L366](.github/workflows/deploy-gcp.yml#L366)

---

## 🧪 Tests de Validación

### Test 1: Verificar Configuración Local
```bash
# Asegúrate de tener STRIPE_WEBHOOK_SECRET en tu .env local
grep STRIPE_WEBHOOK_SECRET .env

# Output esperado:
# STRIPE_WEBHOOK_SECRET="whsec_test_..."
```

### Test 2: Simular Webhook Localmente
```bash
# Instalar Stripe CLI
stripe login

# Forward webhooks a localhost
stripe listen --forward-to localhost:3001/api/payment/webhook

# En otra terminal, simular un evento
stripe trigger checkout.session.completed --add metadata.walletAddress:0xtest
stripe trigger payment_intent.succeeded
```

### Test 3: Ejecutar Suite de Tests del Webhook
```bash
node test-webhook.js
```

**Tests Incluidos:**
1. ✅ Backend Health Check
2. ✅ Webhook Signature Validation
3. ✅ Payment Record Creation
4. ✅ Statistics Retrieval
5. ✅ Hot Wallet Status

### Test 4: Verificar Deployment en GCP
```bash
# Después de deployar:
gcloud run services describe bezhas-backend --region us-central1

# Verificar que las variables están configuradas:
curl https://api.bezhas.com/api/payment/health
```

---

## 📊 Checklist de Implementación

### Código:
- ✅ Webhook handler implementado: `backend/routes/payment.routes.js:191`
- ✅ Payment model creado: `backend/models/Payment.model.js`
- ✅ Distribution service: `backend/services/token-distribution.service.js`
- ✅ Test scripts disponibles: `test-webhook.js`, `tests/stripe-webhook-simulator.js`

### Configuración:
- ✅ `.env.example` documentado
- ✅ `deploy-gcp.yml` actualizado (staging)
- ✅ `deploy-gcp.yml` actualizado (production)
- ⏳ **PENDIENTE:** Crear secretos en GCP Secret Manager

### Deployment:
- ⏳ **PENDIENTE:** Ejecutar pipeline CI/CD
- ⏳ **PENDIENTE:** Verificar secrets en GCP Console

---

## 🚀 PRÓXIMOS PASOS CRÍTICOS

### 1. Crear Secrets en GCP Secret Manager
```bash
# Obtén los valores de Stripe Dashboard
# https://dashboard.stripe.com/apikeys
# https://dashboard.stripe.com/webhooks

# Crear secret en GCP
gcloud secrets create stripe-webhook-secret --replication-policy="automatic" \
  --data-file=- < <(echo -n "whsec_live_...")

gcloud secrets create stripe-secret-key --replication-policy="automatic" \
  --data-file=- < <(echo -n "sk_live_...")

# Verificar creación
gcloud secrets list | grep stripe
```

### 2. Asignar Permisos a Cloud Run
```bash
# El service account de Cloud Run necesita acceso a los secrets
gcloud secrets add-iam-policy-binding stripe-webhook-secret \
  --member=serviceAccount:YOUR_SERVICE_ACCOUNT@iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

gcloud secrets add-iam-policy-binding stripe-secret-key \
  --member=serviceAccount:YOUR_SERVICE_ACCOUNT@iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

### 3. Trigger Deployment
```bash
# Push a main o master para activar el workflow
git add .
git commit -m "fix: Add STRIPE_WEBHOOK_SECRET to GCP deployment"
git push origin main
```

### 4. Verificar en GCP Console
```
Google Cloud Console → Cloud Run → bezhas-backend
→ Revisions → [latest] → Variables de ambiente
Buscar: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY
```

### 5. Testing en Producción
```bash
# Usar Stripe CLI en modo production
stripe trigger checkout.session.completed --live

# Verificar logs en Cloud Run
gcloud run services describe bezhas-backend --region us-central1 --format='value(status.latestReadyRevision)' | xargs -I {} \
  gcloud run revisions describe {} --region us-central1 --format='value(status.conditions[0].message)'

# O desde Cloud Logging
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bezhas-backend" --limit 50 --format json | grep -i stripe
```

---

## 📚 Documentación de Referencia

| Componente | Archivo | Líneas | Estado |
|-----------|---------|--------|--------|
| Webhook Handler | `backend/routes/payment.routes.js` | 191-250 | ✅ Implementado |
| Payment Model | `backend/models/Payment.model.js` | 1-176 | ✅ Completo |
| Distribution Logic | `backend/routes/payment.routes.js` | 251-365 | ✅ Con reintentos |
| Test Script | `test-webhook.js` | 1-300 | ✅ Listo |
| Simulator | `tests/stripe-webhook-simulator.js` | 1-400+ | ✅ Funcional |
| Config Staging | `.github/workflows/deploy-gcp.yml` | 308-312 | ✅ Corregido |
| Config Prod | `.github/workflows/deploy-gcp.yml` | 366 | ✅ Corregido |
| Env Example | `.env.example` | 55-68 | ✅ Documentado |

---

## ⚠️ Notas Importantes

### Seguridad:
1. **NUNCA** commits webhooks secrets en GitHub
2. **NUNCA** logs de eventos de Stripe contienen datos sensibles
3. Usar `stripe.webhooks.constructEvent()` para validar firmas
4. Webhook secret debe estar en GCP Secret Manager, NO en código

### Testing:
1. Usar `whsec_test_` para local testing
2. Usar `whsec_live_` para producción
3. Diferentes webhooks pueden tener diferentes secrets
4. Revisar Stripe logs para debugging

### Reintentos:
- Sistema implementado con BullMQ
- Máximo 3 intentos con backoff exponencial
- Dead Letter Queue para pagos fallidos definitivamente
- Ver `backend/routes/payment.routes.js:31-60`

---

## 🎯 Métricas de Éxito

✅ **Completado:**
- [x] Identificación del problema
- [x] Corrección de código
- [x] Actualización de configuración
- [x] Documentación completa

⏳ **Pendiente (después de merge):**
- [ ] GCP Secrets creados
- [ ] Deployment exitoso a staging
- [ ] Webhook testing en staging funcionando
- [ ] Deployment a production
- [ ] Webhook testing en production funcionando
- [ ] Pago de prueba exitoso end-to-end

---

**Última actualización:** 10 de Febrero, 2026  
**Estado actual:** LISTO PARA GCP DEPLOYMENT  
**Próximas acciones:** Crear secrets y ejecutar pipeline
