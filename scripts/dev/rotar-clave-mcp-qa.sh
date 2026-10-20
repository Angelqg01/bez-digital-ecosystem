#!/usr/bin/env bash
# ============================================================================
# Rota la api-key de pruebas del MCP (app `mcp-qa-chatgpt`) en producción.
# ============================================================================
# La clave se genera AQUÍ y sólo se guarda en ~/.bezhas-mcp-qa.key (0600). A la base
# de datos viaja únicamente su SHA-256, por un Cloud Run Job de un solo uso con la
# imagen de la API (Cloud SQL no tiene IP pública). El job se borra al terminar, y ni
# la clave ni el hash se imprimen.
#
# Si la app no existe la crea (scopes token, contracts, wallet; tier standard) con
# plan creator_pro en gateway_subscriptions, como la original del 2026-10-19.
#
# Uso:  ./scripts/dev/rotar-clave-mcp-qa.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
source deploy/gcp/config.env

APP="mcp-qa-chatgpt"
FICHERO="$HOME/.bezhas-mcp-qa.key"
REGION="${REGION:-us-central1}"
TAG=$(gcloud run services describe "$BACKEND_SERVICE" --region="$REGION" --format='value(metadata.labels.commit)')
IMAGEN="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/bezhas-api:${TAG}"
JOB="bezhas-mcp-qa-key-$(date +%s)"

CLAVE="bez_mcpqa_$(openssl rand -hex 24)"
HASH=$(printf %s "$CLAVE" | sha256sum | cut -d' ' -f1)

SQL_NODE=$(cat <<'JS'
const { pool } = require('./db/pool');
(async () => {
  const hash = process.env.QA_KEY_HASH, app = process.env.QA_APP;
  const up = await pool.query(
    `UPDATE app_registry SET api_key_hash = $1, is_active = TRUE, updated_at = NOW() WHERE app_name = $2 RETURNING id`,
    [hash, app]);
  let id = up.rows[0]?.id, accion = 'rotada';
  if (!id) {
    const ins = await pool.query(
      `INSERT INTO app_registry (app_name, api_key_hash, scopes, tier, is_active)
       VALUES ($1, $2, ARRAY['token','contracts','wallet'], 'standard', TRUE) RETURNING id`, [app, hash]);
    id = ins.rows[0].id; accion = 'creada';
  }
  await pool.query(
    `INSERT INTO gateway_subscriptions (app_id, plan_id, status) VALUES ($1, 'creator_pro', 'active')
     ON CONFLICT (app_id) DO UPDATE SET status = 'active', updated_at = NOW()`, [id]);
  console.log(`QA_KEY ${accion}`);
  await pool.end();
})().catch((e) => { console.error('QA_KEY_ERR', e.message); process.exit(1); });
JS
)

echo "→ Job de un solo uso con la imagen bezhas-api:${TAG}"
gcloud run jobs deploy "$JOB" \
  --image="$IMAGEN" --region="$REGION" \
  --service-account="${SA_BACKEND}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --network="$VPC_NETWORK" --subnet="$VPC_SUBNET" --vpc-egress=private-ranges-only \
  --set-env-vars="^~^NODE_ENV=production~QA_APP=${APP}~QA_KEY_HASH=${HASH}" \
  --set-secrets="DATABASE_URL=${SECRET_PREFIX}DATABASE_URL:latest" \
  --command=node --args="^@@^-e@@${SQL_NODE}" \
  --max-retries=0 --task-timeout=300s --execute-now --wait --quiet >/dev/null || FALLO=1
EJEC=$(gcloud run jobs executions list --job="$JOB" --region="$REGION" --limit=1 --format='value(metadata.name)')
gcloud run jobs delete "$JOB" --region="$REGION" --quiet >/dev/null
if [[ -n "${FALLO:-}" ]]; then
  echo "❌ El job falló; la clave anterior no se ha tocado. Registros:" >&2
  gcloud logging read "labels.\"run.googleapis.com/execution_name\"=\"${EJEC}\"" --freshness=30m --limit 15 --format='value(textPayload)' >&2
  exit 1
fi

umask 077
printf '%s=%s\n' "$APP" "$CLAVE" > "$FICHERO"
chmod 600 "$FICHERO"
unset CLAVE HASH

# Comprobación: tools/list con la clave nueva (no se imprime).
sleep 3
N=$(curl -s -m 30 "https://${MCP_HOST}/mcp" \
  -H "x-api-key: $(cut -d= -f2- "$FICHERO")" -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | sed 's/^data: //' \
  | python3 -c "import sys,json
for l in sys.stdin:
  l=l.strip()
  if l.startswith('{'):
    d=json.loads(l); print(len(d.get('result',{}).get('tools',[])) if 'result' in d else 'ERR '+str(d.get('error')))" || true)
echo "✅ Clave nueva en $FICHERO (ejecución $EJEC). Herramientas visibles con ella: ${N:-sin respuesta}"
