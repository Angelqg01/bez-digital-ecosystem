---
name: Deployment
description: How to deploy BeZhas to GCP Cloud Run and manage production environments
---

# Deployment SKILL

## Proceso de Deployment a GCP

### Pre-requisitos
- `gcloud` CLI instalado y configurado
- Proyecto GCP con Cloud Run habilitado
- Imagen Docker lista

### Comandos de Deploy
```bash
# 1. Build image
cd backend
docker build -t gcr.io/<PROJECT_ID>/bezhas-backend .

# 2. Push to Container Registry
docker push gcr.io/<PROJECT_ID>/bezhas-backend

# 3. Deploy to Cloud Run
gcloud run deploy bezhas-backend \
  --image gcr.io/<PROJECT_ID>/bezhas-backend \
  --region europe-west1 \
  --port 3001 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "NODE_ENV=production,DISABLE_BULLMQ=true"

# Alternativa: submit directo (sin Docker local)
gcloud builds submit --tag gcr.io/<PROJECT_ID>/bezhas-backend
```

### Variables de Entorno en Producción
Configurar via GCP Console o CLI:
```bash
gcloud run services update bezhas-backend --set-env-vars \
  "MONGODB_URI=mongodb+srv://...,\
   STRIPE_SECRET_KEY=sk_live_...,\
   HOT_WALLET_PRIVATE_KEY=0x...,\
   POLYGON_RPC_URL=https://polygon-rpc.com"
```

### Health Check
Cloud Run verifica: `GET /api/health` → debe responder < 10s

### Rollback
```bash
# Listar revisiones
gcloud run revisions list --service bezhas-backend

# Rollback a revisión anterior
gcloud run services update-traffic bezhas-backend \
  --to-revisions=bezhas-backend-00042-abc=100
```

## Problemas de Deployment Conocidos

### DEADLINE_EXCEEDED
**Causa**: Server tarda > 10s en arrancar
**Solución**: Lazy-load rutas pesadas después de `server.listen()`
**Status**: ✅ Resuelto — ver conversación `61bb351c`

### BullMQ Redis unavailable
**Causa**: Upstash free tier limits
**Solución**: `DISABLE_BULLMQ=true`
**Status**: ✅ Resuelto — ver conversación `c3347188`

## Logs
```bash
# Ver logs recientes
gcloud run logs read --service bezhas-backend --limit 50

# Streaming
gcloud run logs tail --service bezhas-backend
```
