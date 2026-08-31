# ============================================
# BeZhas Web3 - Create GCP Secrets (PowerShell)
# ============================================
# Ejecutar: .\create-secrets.ps1
# ============================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     BeZhas Web3 - Crear Secretos en GCP                   ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

function Create-Secret {
    param(
        [string]$Name,
        [string]$Description
    )
    
    # Verificar si existe
    $exists = gcloud secrets list --filter="name:$Name" --format="value(name)" 2>$null
    
    if ($exists) {
        Write-Host "  ⏭️  $Name ya existe" -ForegroundColor Yellow
        return
    }
    
    Write-Host ""
    Write-Host "  📝 $Name" -ForegroundColor Cyan
    Write-Host "     $Description" -ForegroundColor Gray
    
    $value = Read-Host "     Ingresa el valor (o Enter para saltar)"
    
    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Host "     ⚠️  Saltando..." -ForegroundColor Yellow
        return
    }
    
    # Crear secreto
    gcloud secrets create $Name --replication-policy="automatic" 2>$null
    
    # Agregar valor
    $value | gcloud secrets versions add $Name --data-file=-
    
    Write-Host "     ✅ Creado" -ForegroundColor Green
}

Write-Host "Este script te guiará para crear los secretos en Secret Manager." -ForegroundColor White
Write-Host "Presiona Enter para continuar..." -ForegroundColor Gray
Read-Host

# ============================================
# Stripe
# ============================================
Write-Host ""
Write-Host "═══ STRIPE ═══" -ForegroundColor Magenta

Create-Secret -Name "STRIPE_SECRET_KEY" -Description "Tu clave secreta de Stripe (sk_live_...)"
Create-Secret -Name "STRIPE_PUBLISHABLE_KEY" -Description "Tu clave pública de Stripe (pk_live_...)"
Create-Secret -Name "STRIPE_WEBHOOK_SECRET" -Description "Secreto del webhook (whsec_...)"

# ============================================
# Auth
# ============================================
Write-Host ""
Write-Host "═══ AUTENTICACIÓN ═══" -ForegroundColor Magenta

Create-Secret -Name "JWT_SECRET" -Description "Secreto para JWT (mínimo 32 caracteres aleatorios)"
Create-Secret -Name "SESSION_SECRET" -Description "Secreto para sesiones (mínimo 32 caracteres)"

# ============================================
# Database
# ============================================
Write-Host ""
Write-Host "═══ BASE DE DATOS ═══" -ForegroundColor Magenta

Create-Secret -Name "MONGODB_URI" -Description "URI de MongoDB Atlas (mongodb+srv://user:pass@cluster...)"
Create-Secret -Name "REDIS_URL" -Description "URL de Redis (redis://user:pass@host:6379)"

# ============================================
# OAuth
# ============================================
Write-Host ""
Write-Host "═══ GOOGLE OAUTH ═══" -ForegroundColor Magenta

Create-Secret -Name "GOOGLE_CLIENT_ID" -Description "Google OAuth Client ID"
Create-Secret -Name "GOOGLE_CLIENT_SECRET" -Description "Google OAuth Client Secret (GOCSPX-...)"

Write-Host ""
Write-Host "═══ GITHUB OAUTH ═══" -ForegroundColor Magenta

Create-Secret -Name "GITHUB_CLIENT_ID" -Description "GitHub OAuth Client ID"
Create-Secret -Name "GITHUB_CLIENT_SECRET" -Description "GitHub OAuth Client Secret"

# ============================================
# Blockchain
# ============================================
Write-Host ""
Write-Host "═══ BLOCKCHAIN ═══" -ForegroundColor Magenta

Create-Secret -Name "RELAYER_PRIVATE_KEY" -Description "Clave privada del relayer (0x...)"
Create-Secret -Name "POLYGON_RPC_URL" -Description "URL del RPC de Polygon (Alchemy/Infura)"

# ============================================
# AI
# ============================================
Write-Host ""
Write-Host "═══ SERVICIOS AI ═══" -ForegroundColor Magenta

Create-Secret -Name "GEMINI_API_KEY" -Description "API Key de Google Gemini (AIzaSy...)"
Create-Secret -Name "OPENAI_API_KEY" -Description "API Key de OpenAI (sk-...)"

# ============================================
# IPFS
# ============================================
Write-Host ""
Write-Host "═══ IPFS (PINATA) ═══" -ForegroundColor Magenta

Create-Secret -Name "PINATA_API_KEY" -Description "Pinata API Key"
Create-Secret -Name "PINATA_SECRET_KEY" -Description "Pinata Secret Key"

# ============================================
# Resumen
# ============================================
Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              CONFIGURACIÓN COMPLETADA                      ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Secretos configurados:" -ForegroundColor White
gcloud secrets list --format="table(name,createTime.date())"
Write-Host ""
