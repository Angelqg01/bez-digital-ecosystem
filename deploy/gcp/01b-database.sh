#!/usr/bin/env bash
# ============================================================================
# 01b — PostgreSQL gestionado (Cloud SQL) con IP PRIVADA (idempotente)
# ============================================================================
#   - Conecta la VPC con los servicios de Google (Private Service Access).
#   - Crea la instancia PostgreSQL 16 SIN IP pública: solo se llega desde la
#     VPC. Cloud Run entra por Direct VPC egress (ver cloudbuild.yaml).
#   - Copias diarias (14 días) + recuperación a un punto en el tiempo (7 días),
#     protección contra borrado y crecimiento automático del disco.
#   - Crea la base de datos y un usuario de aplicación con contraseña aleatoria
#     que va DIRECTA a Secret Manager (DATABASE_URL): no se imprime nunca.
#
# Las migraciones las aplica cada despliegue (Cloud Run Job `bezhas-migrate`),
# porque desde fuera de la VPC la base de datos no es accesible.
#
# Uso:  ./deploy/gcp/01b-database.sh          (HA=1 para alta disponibilidad)
set -euo pipefail
cd "$(dirname "$0")"
source ./config.env
gcloud config set project "$PROJECT_ID" >/dev/null
TIER="${DB_TIER:-$SQL_TIER}"
command -v jq >/dev/null || { echo "Falta jq" >&2; exit 1; }
existe() { "$@" >/dev/null 2>&1; }

echo "→ Activando APIs"
gcloud services enable sqladmin.googleapis.com servicenetworking.googleapis.com compute.googleapis.com

echo "→ Red VPC: $VPC_NETWORK"
if ! existe gcloud compute networks describe "$VPC_NETWORK"; then
  gcloud compute networks create "$VPC_NETWORK" --subnet-mode=custom
fi
if ! existe gcloud compute networks subnets describe "$VPC_SUBNET" --region="$REGION"; then
  gcloud compute networks subnets create "$VPC_SUBNET" --network="$VPC_NETWORK" \
    --region="$REGION" --range=10.128.0.0/20 --enable-private-ip-google-access
fi

echo "→ Private Service Access (peering con los servicios de Google)"
existe gcloud compute addresses describe google-managed-services-"$VPC_NETWORK" --global || \
  gcloud compute addresses create google-managed-services-"$VPC_NETWORK" --global \
    --purpose=VPC_PEERING --prefix-length=16 --network="$VPC_NETWORK"
if ! gcloud services vpc-peerings list --network="$VPC_NETWORK" --format='value(service)' \
     | grep -q servicenetworking.googleapis.com; then
  gcloud services vpc-peerings connect --service=servicenetworking.googleapis.com \
    --ranges=google-managed-services-"$VPC_NETWORK" --network="$VPC_NETWORK"
fi

echo "→ Instancia Cloud SQL: $SQL_INSTANCE ($TIER) — la creación tarda 5-10 min"
if ! existe gcloud sql instances describe "$SQL_INSTANCE"; then
  DISPONIBILIDAD=ZONAL; [[ "${HA:-0}" == 1 ]] && DISPONIBILIDAD=REGIONAL
  gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 --edition=ENTERPRISE \
    --tier="$TIER" --region="$REGION" --availability-type="$DISPONIBILIDAD" \
    --network="projects/${PROJECT_ID}/global/networks/${VPC_NETWORK}" --no-assign-ip \
    --storage-type=SSD --storage-size=10GB --storage-auto-increase \
    --backup-start-time=03:00 --retained-backups-count=14 \
    --enable-point-in-time-recovery --retained-transaction-log-days=7 \
    --maintenance-window-day=SUN --maintenance-window-hour=4 \
    --deletion-protection \
    --database-flags=log_min_duration_statement=1000,log_connections=on,log_disconnections=on \
    --insights-config-query-insights-enabled \
    --labels=app=bezhas
fi
IP_PRIVADA=$(gcloud sql instances describe "$SQL_INSTANCE" --format=json \
  | jq -r '.ipAddresses[] | select(.type == "PRIVATE") | .ipAddress' | head -n1)
[[ -n "$IP_PRIVADA" ]] || { echo "La instancia no tiene IP privada" >&2; exit 1; }
echo "   IP privada: $IP_PRIVADA"

echo "→ Base de datos: $SQL_DATABASE"
existe gcloud sql databases describe "$SQL_DATABASE" --instance="$SQL_INSTANCE" || \
  gcloud sql databases create "$SQL_DATABASE" --instance="$SQL_INSTANCE"

echo "→ Usuario de aplicación y secreto DATABASE_URL"
existe gcloud secrets describe DATABASE_URL || \
  gcloud secrets create DATABASE_URL --replication-policy=automatic --labels=app=bezhas >/dev/null
TIENE_VERSION=$(gcloud secrets versions list DATABASE_URL --filter=state=ENABLED --limit=1 --format='value(name)')
if [[ -z "$TIENE_VERSION" || "${ROTATE_DB_PASSWORD:-0}" == 1 ]]; then
  # Hex: sin caracteres que haya que escapar en la URL.
  # (gcloud solo acepta la contraseña como argumento; en Cloud Shell la máquina
  # es tuya y el proceso dura un segundo.)
  CLAVE=$(openssl rand -hex 32)
  if existe gcloud sql users describe "$SQL_USER" --instance="$SQL_INSTANCE"; then
    gcloud sql users set-password "$SQL_USER" --instance="$SQL_INSTANCE" --password="$CLAVE" >/dev/null
  else
    gcloud sql users create "$SQL_USER" --instance="$SQL_INSTANCE" --password="$CLAVE" >/dev/null
  fi
  printf 'postgresql://%s:%s@%s:5432/%s' "$SQL_USER" "$CLAVE" "$IP_PRIVADA" "$SQL_DATABASE" \
    | gcloud secrets versions add DATABASE_URL --data-file=- >/dev/null
  unset CLAVE
  echo "   Contraseña generada y guardada en Secret Manager (no se muestra)."
else
  echo "   DATABASE_URL ya existe; no se toca (ROTATE_DB_PASSWORD=1 para rotarla)."
fi
gcloud secrets add-iam-policy-binding DATABASE_URL --quiet \
  --member="serviceAccount:${SA_BACKEND}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor >/dev/null

echo "→ Permiso para desplegar en la subred (Direct VPC egress)"
gcloud compute networks subnets add-iam-policy-binding "$VPC_SUBNET" --region="$REGION" --quiet \
  --member="serviceAccount:${SA_DEPLOYER}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role=roles/compute.networkUser >/dev/null
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud compute networks subnets add-iam-policy-binding "$VPC_SUBNET" --region="$REGION" --quiet \
  --member="serviceAccount:service-${PROJECT_NUMBER}@serverless-robot-prod.iam.gserviceaccount.com" \
  --role=roles/compute.networkUser >/dev/null

cat <<MSG

✅ PostgreSQL listo: ${SQL_INSTANCE} (${IP_PRIVADA}, solo red privada).
   DATABASE_URL está en Secret Manager; NO lo pongas en tu .env.
   Las migraciones se aplican solas en cada ./deploy/gcp/deploy.sh.

Siguiente paso: ./deploy/gcp/02-secrets.sh ~/bezhas.env.production
MSG
