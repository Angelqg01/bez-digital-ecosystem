#!/bin/bash
# ============================================================================
# BeZhas GCP Secret Manager Setup
# ============================================================================
# Ejecutar este script para:
#   1. Verificar que los secrets existen
#   2. Otorgar permisos IAM al service account de Cloud Run
#   3. Actualizar ONEINCH_API_KEY con tu clave real
#
# Uso: bash scripts/setup-gcp-secrets.sh
#
# Prerrequisito: gcloud auth login && gcloud config set project totemic-bonus-479312-c6
# ============================================================================

PROJECT_ID="totemic-bonus-479312-c6"
PROJECT_NUMBER="371791663100"
SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

echo "============================================================"
echo "  BeZhas GCP Secret Manager Setup"
echo "  Project: $PROJECT_ID"
echo "  Service Account: $SA"
echo "============================================================"

# ── 1. Verificar que los secrets existen ─────────────────────────────────────
echo ""
echo "── Step 1: Verifying secrets ────────────────────────────────"
for SECRET in QUALITY_ORACLE_ADDRESS ONEINCH_API_KEY; do
    if gcloud secrets describe "$SECRET" --project="$PROJECT_ID" &>/dev/null; then
        echo "  ✓ $SECRET exists"
    else
        echo "  ✗ $SECRET NOT FOUND. Creating it..."
        if [ "$SECRET" = "QUALITY_ORACLE_ADDRESS" ]; then
            echo -n "0x514cc3ea7492cFdeAbD4A5648c356de3234aAF71" | \
                gcloud secrets create "$SECRET" --project="$PROJECT_ID" \
                --data-file=- --replication-policy=automatic
        else
            echo -n "PLACEHOLDER_CONFIGURE_WITH_REAL_KEY" | \
                gcloud secrets create "$SECRET" --project="$PROJECT_ID" \
                --data-file=- --replication-policy=automatic
        fi
        echo "  ✓ $SECRET created"
    fi
done

# ── 2. Otorgar permisos IAM al compute service account ───────────────────────
echo ""
echo "── Step 2: Granting IAM permissions ────────────────────────"
for SECRET in QUALITY_ORACLE_ADDRESS ONEINCH_API_KEY; do
    echo "  Binding secretAccessor to $SECRET..."
    gcloud secrets add-iam-policy-binding "$SECRET" \
        --project="$PROJECT_ID" \
        --member="serviceAccount:$SA" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet 2>&1 | grep -E "(bindings|etag|Updated)" || echo "  Done (check output above)"
done

# También dar permisos a la cuenta de Cloud Build
BUILD_SA="$PROJECT_NUMBER@cloudbuild.gserviceaccount.com"
echo ""
echo "  Binding secretAccessor to Cloud Build SA: $BUILD_SA"
for SECRET in QUALITY_ORACLE_ADDRESS ONEINCH_API_KEY; do
    gcloud secrets add-iam-policy-binding "$SECRET" \
        --project="$PROJECT_ID" \
        --member="serviceAccount:$BUILD_SA" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet 2>&1 | tail -3
done

echo ""
echo "── Step 3: Current IAM policy summary ──────────────────────"
for SECRET in QUALITY_ORACLE_ADDRESS ONEINCH_API_KEY; do
    echo ""
    echo "  Secret: $SECRET"
    gcloud secrets get-iam-policy "$SECRET" --project="$PROJECT_ID" \
        --format="table(bindings.role,bindings.members)" 2>&1 | head -20
done

# ── 4. Instrucciones para actualizar ONEINCH_API_KEY con la clave real ────────
echo ""
echo "============================================================"
echo "  ✅ Setup complete!"
echo "============================================================"
echo ""
echo "  📌 Next: Update ONEINCH_API_KEY with your real API key:"
echo "  Get your key at: https://portal.1inch.dev/"
echo ""
echo "  # Update the secret:"
echo "  echo -n 'YOUR_REAL_1INCH_KEY' | gcloud secrets versions add ONEINCH_API_KEY --data-file=-"
echo ""
echo "  # After updating, redeploy:"
echo "  gcloud builds submit --config=cloudbuild.yaml"
echo ""
echo "  # Or with npm:"
echo "  npm run gcp:deploy"
echo ""
