---
description: How to deploy the BeZhas backend to GCP Cloud Run
---

# Deploy BeZhas Backend

## Pre-requisitos
- gcloud CLI instalado y autenticado
- Proyecto GCP configurado con Cloud Run

## Pasos

// turbo-all

1. Verificar que el backend compila sin errores:
```bash
cd "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\BeZhas-Hub\backend"
node -e "try { require('./server.js'); console.log('OK'); process.exit(0); } catch(e) { console.error(e.message); process.exit(1); }"
```

2. Correr tests críticos antes de deploy:
```bash
cd "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\BeZhas-Hub\backend"
npx jest tests/payment-system.test.js tests/bridge.core.test.js --no-cache --bail
```

3. Build Docker image:
```bash
cd "d:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\BeZhas-Hub\backend"
gcloud builds submit --tag gcr.io/$PROJECT_ID/bezhas-backend
```

4. Asegurar dependencias críticas (Fix path-to-regexp):
```bash
# Pin path-to-regexp to 0.1.7 to avoid "pathRegexp is not a function" error
npm install path-to-regexp@0.1.7 --save-exact
```

5. Deploy to Cloud Run (Configuración Optimizada):
```bash
gcloud run deploy bezhas-backend \
  --image gcr.io/$PROJECT_ID/bezhas-backend \
  --region europe-west1 \
  --port 8080 \
  --memory 2GiB \
  --cpu 2 \
  --set-env-vars "NODE_ENV=production,DISABLE_BULLMQ=true"
```

6. Verificar health:
```bash
curl https://bezhas-backend-<hash>.run.app/api/health
```
