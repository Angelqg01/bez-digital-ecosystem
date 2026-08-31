#!/bin/bash
# ============================================
# BeZhas Web3 - GCP Secrets Setup Script
# ============================================
# Ejecutar este script para crear todos los secretos en GCP
# Uso: ./create-secrets.sh
# ============================================

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     BeZhas Web3 - Create GCP Secrets                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Función para crear secreto
create_secret() {
    local name=$1
    local prompt=$2
    
    # Verificar si ya existe
    if gcloud secrets describe "$name" &>/dev/null; then
        echo "  ⏭️  $name ya existe, saltando..."
        return
    fi
    
    echo ""
    echo "  Creando secreto: $name"
    read -sp "  Ingresa el valor para $name: " value
    echo ""
    
    if [ -z "$value" ]; then
        echo "  ⚠️  Valor vacío, saltando $name"
        return
    fi
    
    gcloud secrets create "$name" --replication-policy="automatic"
    echo "$value" | gcloud secrets versions add "$name" --data-file=-
    echo "  ✅ $name creado"
}

echo "Este script te guiará para crear los secretos necesarios."
echo "Presiona Enter para continuar o Ctrl+C para cancelar..."
read

echo ""
echo "[Stripe]"
create_secret "STRIPE_SECRET_KEY" "Stripe Secret Key (sk_live_...)"
create_secret "STRIPE_PUBLISHABLE_KEY" "Stripe Publishable Key (pk_live_...)"
create_secret "STRIPE_WEBHOOK_SECRET" "Stripe Webhook Secret (whsec_...)"

echo ""
echo "[Auth]"
create_secret "JWT_SECRET" "JWT Secret (mínimo 32 caracteres)"

echo ""
echo "[Database]"
create_secret "MONGODB_URI" "MongoDB URI (mongodb+srv://...)"
create_secret "REDIS_URL" "Redis URL (redis://...)"

echo ""
echo "[Google OAuth]"
create_secret "GOOGLE_CLIENT_ID" "Google Client ID"
create_secret "GOOGLE_CLIENT_SECRET" "Google Client Secret (GOCSPX-...)"

echo ""
echo "[GitHub OAuth]"
create_secret "GITHUB_CLIENT_ID" "GitHub Client ID"
create_secret "GITHUB_CLIENT_SECRET" "GitHub Client Secret"

echo ""
echo "[Blockchain]"
create_secret "RELAYER_PRIVATE_KEY" "Relayer Private Key (0x...)"
create_secret "POLYGON_RPC_URL" "Polygon RPC URL"

echo ""
echo "[AI Services]"
create_secret "GEMINI_API_KEY" "Gemini API Key (AIzaSy...)"
create_secret "OPENAI_API_KEY" "OpenAI API Key (sk-...)"

echo ""
echo "[IPFS - Pinata]"
create_secret "PINATA_API_KEY" "Pinata API Key"
create_secret "PINATA_SECRET_KEY" "Pinata Secret Key"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              SECRETOS CONFIGURADOS                         ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Verifica los secretos creados:"
echo "  gcloud secrets list"
echo ""
