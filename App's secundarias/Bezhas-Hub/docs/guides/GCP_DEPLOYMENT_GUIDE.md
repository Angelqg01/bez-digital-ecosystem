# 🚀 BeZhas Web3 - Guía Completa de Deployment a Google Cloud Platform

**Fecha de Actualización:** 4 de Febrero de 2026  
**Versión:** 2.0

---

## 📋 Tabla de Contenidos

1. [Pre-requisitos e Instalación](#-pre-requisitos-e-instalación)
2. [Archivos Requeridos para Deployment](#-archivos-requeridos-para-deployment)
3. [Configuración de GCP](#-configuración-de-gcp)
4. [Configuración de GitHub Actions](#-configuración-de-github-actions)
5. [Configuración de Docker](#-configuración-de-docker)
6. [Deployment Manual vs Automático](#-deployment-manual-vs-automático)
7. [Verificación Post-Deployment](#-verificación-post-deployment)
8. [Troubleshooting](#-troubleshooting)

---

## 🛠 Pre-requisitos e Instalación

### Software Requerido en tu Máquina Local

```powershell
# 1. Instalar Google Cloud SDK
# Descargar desde: https://cloud.google.com/sdk/docs/install
# O usando winget (Windows):
winget install Google.CloudSDK

# 2. Instalar Docker Desktop
# Descargar desde: https://www.docker.com/products/docker-desktop
winget install Docker.DockerDesktop

# 3. Instalar Git (si no lo tienes)
winget install Git.Git

# 4. Instalar Node.js 20 LTS
winget install OpenJS.NodeJS.LTS

# 5. Instalar pnpm (gestor de paquetes del proyecto)
npm install -g pnpm@9
```

### Verificar Instalaciones

```powershell
# Verificar que todo está instalado
gcloud version          # Google Cloud SDK
docker --version        # Docker
git --version           # Git
node --version          # Node.js (debe ser v20+)
pnpm --version          # pnpm
```

### Autenticación con Google Cloud

```powershell
# Iniciar sesión en GCP
gcloud auth login

# Configurar el proyecto
gcloud config set project YOUR_GCP_PROJECT_ID

# Autenticar Docker con GCP
gcloud auth configure-docker us-central1-docker.pkg.dev

# Verificar configuración
gcloud config list
```

---

## 📦 Archivos Requeridos para Deployment

### 🔴 Archivos CRÍTICOS (Obligatorios)

| Archivo | Ubicación | Descripción |
|---------|-----------|-------------|
| `cloudbuild.yaml` | `/` | Pipeline de Cloud Build |
| `deploy-gcp.yml` | `/.github/workflows/` | Workflow de GitHub Actions |
| `Dockerfile` | `/backend/` | Dockerfile básico del backend |
| `Dockerfile.optimized` | `/backend/` | Dockerfile optimizado (producción) |
| `Dockerfile` | `/frontend/` | Dockerfile básico del frontend |
| `Dockerfile.optimized` | `/frontend/` | Dockerfile optimizado (producción) |
| `docker-compose.gcp.yml` | `/` | Compose para producción GCP |
| `.env.gcp.example` | `/` | Template de variables de entorno |
| `nginx.conf` | `/frontend/` | Configuración de Nginx |

### 🟡 Archivos de Configuración

| Archivo | Ubicación | Descripción |
|---------|-----------|-------------|
| `ci.yml` | `/.github/workflows/` | CI para tests automáticos |
| `security-audit.yml` | `/.github/workflows/` | Auditoría de seguridad |
| `dependabot.yml` | `/.github/` | Actualizaciones automáticas |
| `docker-compose.prod.yml` | `/` | Compose para producción genérica |
| `docker-compose.production.yml` | `/` | Compose alternativo producción |

### 🟢 Archivos de Código (Subir a GitHub)

```
📁 Estructura Mínima Requerida
├── 📁 .github/
│   ├── copilot-instructions.md
│   ├── dependabot.yml
│   └── 📁 workflows/
│       ├── ci.yml
│       ├── deploy-gcp.yml
│       ├── dependabot-auto-merge.yml
│       └── security-audit.yml
├── 📁 backend/
│   ├── Dockerfile
│   ├── Dockerfile.optimized
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── server.js
│   ├── config.js
│   ├── swagger.config.js
│   ├── websocket-server.js
│   ├── 📁 abis/
│   ├── 📁 automation/
│   ├── 📁 config/
│   ├── 📁 controllers/
│   ├── 📁 lib/
│   ├── 📁 middleware/
│   ├── 📁 models/
│   ├── 📁 routes/
│   ├── 📁 services/
│   └── 📁 utils/
├── 📁 frontend/
│   ├── Dockerfile
│   ├── Dockerfile.optimized
│   ├── nginx.conf
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── 📁 src/
├── 📁 contracts/
│   └── (Smart contracts .sol)
├── 📁 scripts/
│   └── (Deploy scripts)
├── cloudbuild.yaml
├── docker-compose.gcp.yml
├── docker-compose.prod.yml
├── hardhat.config.js
├── package.json
├── pnpm-lock.yaml
└── .gitignore
```

### 🔒 Archivos que NO SUBIR (Agregar a .gitignore)

```gitignore
# Archivos de entorno con secretos
.env
.env.production
.env.local
*.env

# Logs
*.log
backend_startup*.log

# Dependencias
node_modules/

# Cache
cache/
.cache/

# Builds locales
frontend/dist/
backend/build/

# Archivos de IDE
.vscode/settings.json
.idea/

# Archivos sensibles de blockchain
deployments/*.json
*-deployment.json

# Archivos de test output
*_output.txt
coverage/
```

---

## ☁️ Configuración de GCP

### Paso 1: Crear Proyecto en GCP

```bash
# Crear nuevo proyecto (o usar existente)
gcloud projects create bezhas-production --name="BeZhas Production"

# Establecer proyecto activo
gcloud config set project bezhas-production

# Habilitar APIs necesarias
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com \
  redis.googleapis.com \
  cloudresourcemanager.googleapis.com
```

### Paso 2: Crear Artifact Registry (Repositorio de Docker)

```bash
# Crear repositorio para imágenes Docker
gcloud artifacts repositories create bezhas \
  --repository-format=docker \
  --location=us-central1 \
  --description="BeZhas Docker Images"
```

### Paso 3: Configurar Secret Manager

```bash
# Crear secretos (reemplaza con tus valores reales)
echo -n "mongodb+srv://user:pass@cluster.mongodb.net/bezhas" | \
  gcloud secrets create mongodb-uri --data-file=-

echo -n "redis://user:pass@redis-host:6379" | \
  gcloud secrets create redis-url --data-file=-

echo -n "tu_jwt_secret_muy_largo_y_seguro_32_chars" | \
  gcloud secrets create jwt-secret --data-file=-

echo -n "sk_live_stripe_secret_key" | \
  gcloud secrets create stripe-secret-key --data-file=-

# Listar secretos creados
gcloud secrets list
```

### Paso 4: Crear Service Account para GitHub Actions

```bash
# Crear service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions CI/CD"

# Obtener email del service account
SA_EMAIL="github-actions@bezhas-production.iam.gserviceaccount.com"

# Asignar roles necesarios
gcloud projects add-iam-policy-binding bezhas-production \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding bezhas-production \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding bezhas-production \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding bezhas-production \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor"
```

### Paso 5: Configurar Workload Identity Federation

```bash
# Crear pool de identidad
gcloud iam workload-identity-pools create "github-pool" \
  --project="bezhas-production" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Crear provider OIDC
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="bezhas-production" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Permitir GitHub repo usar el service account
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
  --project="bezhas-production" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_GITHUB_USER/bezhas-web3"
```

---

## 🔑 Configuración de GitHub Actions

### Secrets Requeridos en GitHub

Ve a: `Settings > Secrets and variables > Actions` en tu repositorio GitHub

| Secret Name | Valor | Descripción |
|-------------|-------|-------------|
| `GCP_PROJECT_ID` | `bezhas-production` | ID del proyecto GCP |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/123.../providers/github-provider` | Provider completo |
| `GCP_SERVICE_ACCOUNT` | `github-actions@bezhas-production.iam.gserviceaccount.com` | Service account |
| `SLACK_WEBHOOK_URL` | `https://hooks.slack.com/...` | (Opcional) Notificaciones |

### Obtener Workload Identity Provider

```bash
# Obtener el provider path completo
gcloud iam workload-identity-pools providers describe github-provider \
  --project="bezhas-production" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
```

---

## 🐳 Configuración de Docker

### Construir Imágenes Localmente (Testing)

```powershell
# Desde la raíz del proyecto

# Build del backend
docker build -t bezhas-backend -f backend/Dockerfile.optimized backend/

# Build del frontend
docker build -t bezhas-frontend -f frontend/Dockerfile.optimized frontend/ `
  --build-arg VITE_API_URL=https://api.bez.digital `
  --build-arg VITE_WS_URL=wss://api.bez.digital `
  --build-arg VITE_CHAIN_ID=137 `
  --build-arg VITE_NETWORK=polygon

# Verificar imágenes
docker images | Select-String "bezhas"
```

### Ejecutar con Docker Compose (Prueba Local)

```powershell
# Crear archivo .env.production desde template
Copy-Item .env.gcp.example .env.production

# Editar con tus valores
notepad .env.production

# Levantar todos los servicios
docker-compose -f docker-compose.gcp.yml up -d

# Ver logs
docker-compose -f docker-compose.gcp.yml logs -f

# Verificar estado
docker-compose -f docker-compose.gcp.yml ps
```

### Push Manual a GCP Artifact Registry

```powershell
# Tag para GCP
docker tag bezhas-backend us-central1-docker.pkg.dev/bezhas-production/bezhas/bezhas-backend:latest
docker tag bezhas-frontend us-central1-docker.pkg.dev/bezhas-production/bezhas/bezhas-frontend:latest

# Push
docker push us-central1-docker.pkg.dev/bezhas-production/bezhas/bezhas-backend:latest
docker push us-central1-docker.pkg.dev/bezhas-production/bezhas/bezhas-frontend:latest
```

---

## 🚀 Deployment Manual vs Automático

### Opción A: Deployment Automático (Recomendado) ✅

El workflow se ejecuta automáticamente cuando:
- Haces push a `main` o `master`
- Se dispara manualmente desde GitHub Actions

```bash
# Solo necesitas hacer push
git add .
git commit -m "feat: deployment to production"
git push origin main
```

El workflow:
1. ✅ Ejecuta linting y escaneo de seguridad
2. ✅ Corre tests de Solidity (Hardhat)
3. ✅ Corre tests del Backend (Jest)
4. ✅ Construye el Frontend
5. ✅ Construye y sube imágenes Docker
6. ✅ Despliega a Cloud Run
7. ✅ Verifica que los servicios estén healthy

### Opción B: Deployment Manual con Cloud Build

```bash
# Desde la raíz del proyecto
gcloud builds submit --config=cloudbuild.yaml
```

### Opción C: Deploy Directo a Cloud Run

```powershell
# Deploy Backend
gcloud run deploy bezhas-backend `
  --image us-central1-docker.pkg.dev/bezhas-production/bezhas/bezhas-backend:latest `
  --region us-central1 `
  --platform managed `
  --allow-unauthenticated `
  --min-instances 1 `
  --max-instances 100 `
  --memory 1Gi `
  --cpu 2 `
  --set-secrets "MONGODB_URI=mongodb-uri:latest,JWT_SECRET=jwt-secret:latest"

# Deploy Frontend
gcloud run deploy bezhas-frontend `
  --image us-central1-docker.pkg.dev/bezhas-production/bezhas/bezhas-frontend:latest `
  --region us-central1 `
  --platform managed `
  --allow-unauthenticated `
  --min-instances 1 `
  --max-instances 50
```

---

## ✅ Verificación Post-Deployment

### Health Checks

```powershell
# Verificar Backend
Invoke-WebRequest -Uri "https://api.bez.digital/api/health" -Method GET

# Verificar Frontend
Invoke-WebRequest -Uri "https://bez.digital" -Method HEAD

# Ver logs de Cloud Run
gcloud run services logs read bezhas-backend --region us-central1 --limit 50
gcloud run services logs read bezhas-frontend --region us-central1 --limit 50
```

### Ver Estado de Servicios

```bash
# Listar servicios
gcloud run services list --region us-central1

# Detalles de un servicio
gcloud run services describe bezhas-backend --region us-central1
```

---

## 🔧 Troubleshooting

### Error: "Permission denied"

```bash
# Verificar autenticación
gcloud auth list

# Re-autenticar
gcloud auth login
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### Error: "Image not found"

```bash
# Verificar que la imagen existe
gcloud artifacts docker images list us-central1-docker.pkg.dev/bezhas-production/bezhas

# Reconstruir y subir
docker build -t us-central1-docker.pkg.dev/bezhas-production/bezhas/bezhas-backend:latest -f backend/Dockerfile.optimized backend/
docker push us-central1-docker.pkg.dev/bezhas-production/bezhas/bezhas-backend:latest
```

### Error: "Secret not found"

```bash
# Listar secretos
gcloud secrets list

# Verificar que Cloud Run puede acceder
gcloud secrets get-iam-policy mongodb-uri
```

### Error: "Container failed to start"

```bash
# Ver logs detallados
gcloud run services logs read bezhas-backend --region us-central1 --limit 200

# Verificar variables de entorno
gcloud run services describe bezhas-backend --region us-central1 --format="yaml(spec.template.spec.containers[0].env)"
```

---

## 📊 Checklist Pre-Deployment

```markdown
### Antes de hacer Push a Main:

- [ ] Tests locales pasan: `pnpm test`
- [ ] Frontend compila: `cd frontend && pnpm build`
- [ ] Linting sin errores: `cd frontend && pnpm lint`
- [ ] Docker build funciona localmente
- [ ] Variables de entorno configuradas en Secret Manager
- [ ] GitHub Secrets configurados
- [ ] Workload Identity Federation configurado

### Después del Deployment:

- [ ] Health check del backend: /api/health
- [ ] Frontend carga correctamente
- [ ] Conexión a MongoDB funciona
- [ ] Conexión a Redis funciona
- [ ] WebSocket funciona
- [ ] Autenticación funciona
- [ ] Transacciones blockchain funcionan
```

---

## 🔗 Enlaces Útiles

- **GCP Console:** https://console.cloud.google.com
- **Cloud Run:** https://console.cloud.google.com/run
- **Artifact Registry:** https://console.cloud.google.com/artifacts
- **Secret Manager:** https://console.cloud.google.com/security/secret-manager
- **GitHub Actions:** https://github.com/YOUR_USER/bezhas-web3/actions

---

## 📝 Resumen de Comandos Rápidos

```powershell
# === INSTALACIÓN ===
winget install Google.CloudSDK
winget install Docker.DockerDesktop
npm install -g pnpm@9

# === AUTENTICACIÓN ===
gcloud auth login
gcloud config set project bezhas-production
gcloud auth configure-docker us-central1-docker.pkg.dev

# === BUILD LOCAL ===
docker build -t bezhas-backend -f backend/Dockerfile.optimized backend/
docker build -t bezhas-frontend -f frontend/Dockerfile.optimized frontend/

# === DEPLOY ===
git push origin main  # Dispara workflow automático

# === MONITOREO ===
gcloud run services logs read bezhas-backend --region us-central1
```
