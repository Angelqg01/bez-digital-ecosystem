# ============================================
# BeZhas Web3 - GCP Setup Script
# ============================================
# Ejecutar este script para configurar Google Cloud Platform
# Uso: .\setup-gcp.ps1 -ProjectId "bezhas-web3"
# ============================================

param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectId,
    
    [string]$Region = "us-central1"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        BeZhas Web3 - GCP Setup Script                     ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ============================================
# 1. Verificar gcloud instalado
# ============================================
Write-Host "[1/8] Verificando gcloud CLI..." -ForegroundColor Yellow

try {
    $gcloudVersion = gcloud version --format="value(version)" 2>$null
    Write-Host "  ✅ gcloud instalado: $gcloudVersion" -ForegroundColor Green
}
catch {
    Write-Host "  ❌ gcloud no está instalado" -ForegroundColor Red
    Write-Host "  Instala con: winget install Google.CloudSDK" -ForegroundColor White
    exit 1
}

# ============================================
# 2. Configurar proyecto
# ============================================
Write-Host ""
Write-Host "[2/8] Configurando proyecto: $ProjectId" -ForegroundColor Yellow

gcloud config set project $ProjectId
Write-Host "  ✅ Proyecto configurado" -ForegroundColor Green

# ============================================
# 3. Habilitar APIs
# ============================================
Write-Host ""
Write-Host "[3/8] Habilitando APIs necesarias..." -ForegroundColor Yellow

$apis = @(
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "containerregistry.googleapis.com"
)

foreach ($api in $apis) {
    Write-Host "  Habilitando $api..." -ForegroundColor Gray
    gcloud services enable $api --quiet
}
Write-Host "  ✅ APIs habilitadas" -ForegroundColor Green

# ============================================
# 4. Crear Artifact Registry
# ============================================
Write-Host ""
Write-Host "[4/8] Creando Artifact Registry..." -ForegroundColor Yellow

$repoExists = gcloud artifacts repositories list --location=$Region --filter="name:bezhas" --format="value(name)" 2>$null

if (-not $repoExists) {
    gcloud artifacts repositories create bezhas `
        --repository-format=docker `
        --location=$Region `
        --description="BeZhas Docker images"
    Write-Host "  ✅ Artifact Registry 'bezhas' creado" -ForegroundColor Green
}
else {
    Write-Host "  ℹ️  Artifact Registry 'bezhas' ya existe" -ForegroundColor Cyan
}

# ============================================
# 5. Configurar autenticación Docker
# ============================================
Write-Host ""
Write-Host "[5/8] Configurando autenticación Docker..." -ForegroundColor Yellow

gcloud auth configure-docker "$Region-docker.pkg.dev" --quiet
Write-Host "  ✅ Docker configurado para Artifact Registry" -ForegroundColor Green

# ============================================
# 6. Crear Secretos en Secret Manager
# ============================================
Write-Host ""
Write-Host "[6/8] Configurando Secret Manager..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  ⚠️  IMPORTANTE: Necesitas configurar los secretos manualmente" -ForegroundColor Yellow
Write-Host ""

$secrets = @(
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "JWT_SECRET",
    "MONGODB_URI",
    "REDIS_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "RELAYER_PRIVATE_KEY",
    "POLYGON_RPC_URL",
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "PINATA_API_KEY",
    "PINATA_SECRET_KEY"
)

Write-Host "  Secretos a configurar:" -ForegroundColor White
foreach ($secret in $secrets) {
    $exists = gcloud secrets list --filter="name:$secret" --format="value(name)" 2>$null
    if ($exists) {
        Write-Host "    ✅ $secret (existe)" -ForegroundColor Green
    }
    else {
        Write-Host "    ❌ $secret (falta)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "  Para crear un secreto:" -ForegroundColor Cyan
Write-Host '  gcloud secrets create NOMBRE_SECRETO --replication-policy="automatic"' -ForegroundColor White
Write-Host '  echo "valor" | gcloud secrets versions add NOMBRE_SECRETO --data-file=-' -ForegroundColor White

# ============================================
# 7. Configurar permisos de Cloud Build
# ============================================
Write-Host ""
Write-Host "[7/8] Configurando permisos de Cloud Build..." -ForegroundColor Yellow

$projectNumber = gcloud projects describe $ProjectId --format="value(projectNumber)"
$serviceAccount = "$projectNumber@cloudbuild.gserviceaccount.com"

Write-Host "  Service Account: $serviceAccount" -ForegroundColor Gray

# Secret Manager access
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$serviceAccount" `
    --role="roles/secretmanager.secretAccessor" `
    --quiet 2>$null

# Cloud Run admin
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$serviceAccount" `
    --role="roles/run.admin" `
    --quiet 2>$null

# Service Account User
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$serviceAccount" `
    --role="roles/iam.serviceAccountUser" `
    --quiet 2>$null

Write-Host "  ✅ Permisos configurados" -ForegroundColor Green

# ============================================
# 8. Resumen
# ============================================
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              CONFIGURACIÓN COMPLETADA                      ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Configura los secretos faltantes:" -ForegroundColor White
Write-Host '   gcloud secrets create JWT_SECRET --replication-policy="automatic"' -ForegroundColor Gray
Write-Host '   echo "tu-jwt-secret-aqui" | gcloud secrets versions add JWT_SECRET --data-file=-' -ForegroundColor Gray
Write-Host ""
Write-Host "2. Despliega la aplicación:" -ForegroundColor White
Write-Host "   gcloud builds submit --config=cloudbuild.yaml" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Verifica el deployment:" -ForegroundColor White
Write-Host "   gcloud run services list" -ForegroundColor Gray
Write-Host ""
