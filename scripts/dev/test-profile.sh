#!/usr/bin/env bash
# ============================================================================
# Perfil temporal de prueba con el plan que se pida — SOLO contra una API LOCAL.
# ============================================================================
# Crea un usuario desechable (@example.test), una organización, una app y una suscripción activa del plan elegido,
# y deja su sesión en un JSON (modo 600) para inyectarla en el navegador. Así se prueba cada nivel de suscripción
# (y las funciones de pago: GPS, cámara, chat…) sin usar cuentas reales ni tocar producción.
#
#   scripts/dev/test-profile.sh create <plan> [--operator] [--admin]
#       plan: none | starter | creator_pro | business | enterprise_vip
#   scripts/dev/test-profile.sh all            # un perfil de cada plan
#   scripts/dev/test-profile.sh inject <plan>  # JavaScript para pegar en la consola del navegador (origen de la SubApp)
#   scripts/dev/test-profile.sh cleanup        # borra TODOS los perfiles de prueba (usuarios, orgs, apps, suscripciones)
#
# Variables: API_URL (por defecto http://localhost:3001), API_CONTAINER (por defecto bezhas-api), OUT_DIR.
# Rechaza cualquier API que no sea localhost / 127.0.0.1: nunca crea cuentas de prueba en producción.
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
API_CONTAINER="${API_CONTAINER:-bezhas-api}"
OUT_DIR="${OUT_DIR:-${TMPDIR:-/tmp}/bz-test-profiles}"
PLANS=(none starter creator_pro business enterprise_vip)

case "$API_URL" in
  http://localhost:*|http://127.0.0.1:*|http://localhost|http://127.0.0.1) ;;
  *) echo "❌ API_URL debe ser local (localhost/127.0.0.1). Recibido: $API_URL" >&2; exit 2 ;;
esac

en_contenedor() { docker exec -i "$API_CONTAINER" node -; }

crear() {
  local plan="$1"; shift
  local rol=user
  for a in "$@"; do [[ "$a" == --operator ]] && rol=operator; [[ "$a" == --admin ]] && rol=admin; done
  [[ " ${PLANS[*]} " == *" $plan "* ]] || { echo "❌ Plan desconocido: $plan (${PLANS[*]})" >&2; exit 2; }

  local sufijo email pass resp
  sufijo="$(date +%s)-$RANDOM"
  email="test-profile-${plan}-${sufijo}@example.test"
  pass="Tp-$(head -c9 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')9!"
  resp="$(curl -s -m 20 -X POST "$API_URL/api/auth/fiat/register" -H 'Content-Type: application/json' \
          -d "{\"email\":\"$email\",\"password\":\"$pass\",\"name\":\"Perfil de prueba ${plan}\"}")"
  mkdir -p "$OUT_DIR"; chmod 700 "$OUT_DIR"
  local out="$OUT_DIR/${plan}.json"
  printf '%s' "$resp" > "$out.raw"
  python3 - "$out.raw" "$out" "$plan" "$rol" "$email" <<'PY'
import json,sys
raw,out,plan,rol,email=sys.argv[1:6]
d=json.load(open(raw))
if not d.get('token'): sys.exit('❌ No se pudo registrar: '+json.dumps(d)[:200])
json.dump({'plan':plan,'role':rol,'email':email,'token':d['token'],'user':d['user']},open(out,'w'))
PY
  rm -f "$out.raw"; chmod 600 "$out"
  local uid; uid="$(python3 -c "import json;print(json.load(open('$out'))['user']['id'])")"

  en_contenedor <<JS
const { query } = require('./db/pool');
(async () => {
  const uid = '${uid}', plan = '${plan}', rol = '${rol}';
  if (rol !== 'user') await query('UPDATE users SET role = \$1 WHERE id::text = \$2', [rol, uid]);
  if (plan !== 'none') {
    const org = (await query("INSERT INTO organizations (name) VALUES ('TEST-PROFILE ${plan}') RETURNING id")).rows[0];
    const ent = (await query("INSERT INTO enterprises (name, sector) VALUES ('TEST-PROFILE ${plan}', 'test') RETURNING id")).rows[0].id;
    await query('UPDATE organizations SET legacy_enterprise_id = \$1 WHERE id = \$2', [ent, org.id]);
    await query("INSERT INTO organization_members (organization_id, user_id, role) VALUES (\$1, \$2, 'owner')", [org.id, uid]);
    const app = (await query("INSERT INTO app_registry (app_name, api_key_hash, enterprise_id, is_active) VALUES ('test-profile-${plan}-${sufijo}', 'testprofile' || floor(random()*1e9), \$1, true) RETURNING id", [ent])).rows[0];
    await query("INSERT INTO gateway_subscriptions (app_id, plan_id, status) VALUES (\$1, '${plan}', 'active')", [app.id]);
  }
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
JS
  echo "✅ perfil ${plan} (rol ${rol}) → ${out}"
}

inyectar() {
  local f="$OUT_DIR/${1}.json"; [[ -f "$f" ]] || { echo "❌ Falta $f: ejecuta create $1" >&2; exit 2; }
  python3 - "$f" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
print("localStorage.clear();localStorage.setItem('bezhas-jwt','%s');localStorage.setItem('bezhas_access_token','%s');localStorage.setItem('bezhas-user',JSON.stringify(%s));location.href='/';" % (d['token'],d['token'],json.dumps(d['user'])))
PY
}

limpiar() {
  en_contenedor <<'JS'
const { query } = require('./db/pool');
(async () => {
  const like = "test-profile-%@example.test";
  await query("DELETE FROM gateway_subscriptions WHERE app_id IN (SELECT id FROM app_registry WHERE app_name LIKE 'test-profile-%')");
  await query("DELETE FROM app_registry WHERE app_name LIKE 'test-profile-%'");
  await query("DELETE FROM organization_members WHERE user_id::text IN (SELECT id::text FROM users WHERE email LIKE $1)", [like]);
  await query("DELETE FROM organizations WHERE name LIKE 'TEST-PROFILE %'");
  await query("DELETE FROM enterprises WHERE name LIKE 'TEST-PROFILE %'");
  const r = await query("DELETE FROM users WHERE email LIKE $1", [like]).catch(() => ({ rowCount: 'sin permiso para borrar usuarios (se dejan, son @example.test)' }));
  console.log('limpieza hecha; usuarios borrados:', r.rowCount);
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
JS
  rm -rf "$OUT_DIR"
}

case "${1:-}" in
  create) shift; crear "${1:?plan}" "${@:2}" ;;
  all) for p in "${PLANS[@]}"; do crear "$p"; done ;;
  inject) inyectar "${2:?plan}" ;;
  cleanup) limpiar ;;
  *) sed -n 2,19p "$0"; exit 1 ;;
esac
