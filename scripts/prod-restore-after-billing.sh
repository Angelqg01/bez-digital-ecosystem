#!/usr/bin/env bash
#
# prod-restore-after-billing.sh — Poner producción al día cuando Cloud SQL
# vuelva de la suspensión por facturación.
#
# El 2026-09-01 la instancia bezhas-postgres estaba SUSPENDED con
# suspensionReason=BILLING_ISSUE, y con ella el proyecto entero: hasta la API de
# Secret Manager rechazaba las llamadas. Con la base caída no se pueden aplicar
# migraciones, así que las 049, 050 y 051 quedaron pendientes en producción.
#
# Esto importa más de lo que parece por el orden: la 051 revoca las claves de
# desarrollo que la migración 005 publicaba en claro —'core-internal-key' entre
# ellas, con scope admin—. Mientras no se aplique, producción arranca con esas
# claves ACTIVAS en cuanto vuelva el servicio.
#
# Por eso este guion va antes de devolver el tráfico, no después.
#
# Uso:
#   bash scripts/prod-restore-after-billing.sh            # comprueba y aplica
#   bash scripts/prod-restore-after-billing.sh --check    # solo comprueba
#
set -euo pipefail

PROYECTO="${GCP_PROJECT_ID:-totemic-bonus-479312-c6}"
REGION="${GCP_REGION:-europe-west1}"
INSTANCIA="${CLOUDSQL_INSTANCE:-bezhas-postgres}"
JOB="${MIGRATE_JOB:-bezhas-db-migrate}"
SERVICIO="${API_SERVICE:-bezhas-api}"

SOLO_COMPROBAR=false
[[ "${1:-}" == "--check" ]] && SOLO_COMPROBAR=true

azul()  { printf '\n\033[1;36m▸ %s\033[0m\n' "$1"; }
ok()    { printf '  \033[0;32m✓\033[0m %s\n' "$1"; }
aviso() { printf '  \033[0;33m!\033[0m %s\n' "$1"; }
fatal() { printf '  \033[0;31m✗\033[0m %s\n' "$1" >&2; exit 1; }

# ── 1. La base tiene que estar viva ──────────────────────────────────────────
azul "Estado de Cloud SQL"

ESTADO=$(gcloud sql instances describe "$INSTANCIA" --project="$PROYECTO" \
           --format='value(state)' 2>/dev/null || echo 'INACCESIBLE')

if [[ "$ESTADO" != "RUNNABLE" ]]; then
    MOTIVO=$(gcloud sql instances describe "$INSTANCIA" --project="$PROYECTO" \
               --format='value(suspensionReason)' 2>/dev/null || true)
    aviso "La instancia está en estado: $ESTADO ${MOTIVO:+(motivo: $MOTIVO)}"
    # Se para aquí a propósito. Migrar contra una base que no acepta conexiones
    # deja el registro de migraciones a medias, y eso es peor que no empezar.
    fatal "Resuelve la facturación en la consola de GCP y vuelve a lanzar esto."
fi
ok "Instancia RUNNABLE"

# ── 2. El job tiene que llevar una imagen con las migraciones nuevas ────────
azul "Job de migración"

IMAGEN_JOB=$(gcloud run jobs describe "$JOB" --region="$REGION" --project="$PROYECTO" \
    --format='value(spec.template.spec.template.spec.containers[0].image)' 2>/dev/null || echo '')
[[ -z "$IMAGEN_JOB" ]] && fatal "No existe el job '$JOB' en $REGION."

IMAGEN_SERVICIO=$(gcloud run services describe "$SERVICIO" --region="$REGION" --project="$PROYECTO" \
    --format='value(spec.template.spec.containers[0].image)' 2>/dev/null || echo '')

echo "  job:      $IMAGEN_JOB"
echo "  servicio: $IMAGEN_SERVICIO"

if [[ "$IMAGEN_JOB" != "$IMAGEN_SERVICIO" ]]; then
    # El job apuntaba a bezhas-services/bezhas-api:1780217227, un repositorio y
    # una etiqueta distintos de los del servicio. Una imagen vieja NO CONTIENE
    # las migraciones nuevas: el job diría "todo al día" sin haber aplicado nada.
    aviso "El job usa una imagen distinta de la que sirve el servicio."
    if $SOLO_COMPROBAR; then
        aviso "Con --check no se modifica. Ejecuta sin --check para alinearlas."
    else
        echo "  Alineando el job con la imagen del servicio…"
        gcloud run jobs update "$JOB" --region="$REGION" --project="$PROYECTO" \
            --image="$IMAGEN_SERVICIO" --quiet >/dev/null
        ok "Job actualizado a la imagen del servicio"
    fi
else
    ok "El job ya usa la misma imagen que el servicio"
fi

# ── 3. Qué migraciones faltan ───────────────────────────────────────────────
azul "Migraciones pendientes"
echo "  Las que este repositorio espera y que producción no tenía:"
for m in 049_app_registry_address_scope 050_link_first_party_apps 051_revoke_seeded_dev_keys; do
    echo "    · $m"
done
aviso "La 051 REVOCA las claves sembradas. Tras ella ninguna app autentica"
aviso "hasta que se le dé una nueva (paso 5). Cuéntalo como ventana de corte."

if $SOLO_COMPROBAR; then
    azul "Solo comprobación: no se ha ejecutado nada"
    exit 0
fi

# ── 4. Aplicar ───────────────────────────────────────────────────────────────
azul "Ejecutando migraciones"
gcloud run jobs execute "$JOB" --region="$REGION" --project="$PROYECTO" --wait \
    || fatal "El job de migración falló. Revisa: gcloud run jobs executions list --job=$JOB --region=$REGION"
ok "Migraciones aplicadas"

# ── 5. Claves nuevas ─────────────────────────────────────────────────────────
azul "Claves del Gateway"
cat <<'INSTRUCCIONES'
  Este paso NO se automatiza aquí a propósito.

  Las claves solo existen una vez —se guarda su SHA-256, no ellas—, así que hay
  que enseñarlas. Si esto corriera como job de Cloud Run, su stdout iría a
  Cloud Logging y quedarían archivadas en claro, con retención y con quien
  tenga permiso de lectura.

  Lánzalo TÚ, en local, contra el Cloud SQL Proxy:

    cloud-sql-proxy totemic-bonus-479312-c6:europe-west1:bezhas-postgres &
    cd api
    DATABASE_URL='postgresql://<usuario>:<clave>@127.0.0.1:5432/bezhas' \
      node scripts/provision-gateway-keys.js --all --force --out claves-prod.txt

  Después:
    · Sube cada clave a Secret Manager.
    · Pon CORE_API_KEY en el Cloud Run de bezhas-capital (es bezhas-defi), o
      seguirá cayendo al 'defi-dev-key' revocado que trae en su server.js.
    · Borra claves-prod.txt.
INSTRUCCIONES

azul "Comprobación final"
echo "  Cuando termines, verifica que la clave vieja ya no vale:"
echo "    curl -o /dev/null -w '%{http_code}\\n' -H 'x-api-key: core-internal-key' \\"
echo "      https://api.bez.digital/api/gateway/v1/token/price     # debe dar 401"
