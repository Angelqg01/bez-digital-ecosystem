#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  scripts/gcp-seed-secrets.sh
#  Seed APPLICATION / provider secrets from a local .env into GCP Secret Manager.
#
#  Complements scripts/gcp-deploy.sh, which already creates the INFRA secrets
#  (JWT, Postgres URL, Redis URL, internal API key, Stripe). This script pushes
#  the provider/app secrets the app reads via process.env (AI keys, Telegram,
#  HubSpot, LinkedIn, OAuth) plus the chain signer keys.
#
#  - Idempotent: creates the secret or adds a new version if it already exists.
#  - Never prints secret values.
#  - Skips empty values and obvious placeholders (<...>, changeme, your_, etc.).
#
#  Usage:
#    GCP_PROJECT_ID=bezhas-prod ./scripts/gcp-seed-secrets.sh [path/to/.env]
#    (defaults to ./.env)
#
#  Prereqs: gcloud auth login && gcloud config set project <id>, Secret Manager API enabled.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ENV_FILE="${1:-.env}"
GCP_PROJECT_ID="${GCP_PROJECT_ID:-}"

if [[ -z "${GCP_PROJECT_ID}" ]]; then
  echo "ERROR: set GCP_PROJECT_ID (e.g. GCP_PROJECT_ID=bezhas-prod $0)" >&2
  exit 1
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: env file not found: ${ENV_FILE}" >&2
  exit 1
fi

log() { echo -e "\033[1;34m[SEED]\033[0m $*"; }

# Map of ENV_VAR -> secret-manager-name. Keep names aligned with gcp-deploy.sh
# where the deploy script consumes them.
declare -A SECRET_MAP=(
  [DEEPSEEK_API_KEY]="bezhas-deepseek-api-key"
  [GEMINI_API_KEY]="bezhas-gemini-api-key"
  [GEMINI_API_KEY_ALT]="bezhas-gemini-api-key-alt"
  [OPENAI_API_KEY]="bezhas-openai-api-key"
  [TELEGRAM_BOT_TOKEN]="bezhas-telegram-bot-token"
  [TELEGRAM_TOKEN_DIRECTOR]="bezhas-telegram-token-director"
  [TELEGRAM_TOKEN_FINANCE]="bezhas-telegram-token-finance"
  [TELEGRAM_TOKEN_MARKETING]="bezhas-telegram-token-marketing"
  [TELEGRAM_TOKEN_DEVOPS]="bezhas-telegram-token-devops"
  [TELEGRAM_TOKEN_LEGAL]="bezhas-telegram-token-legal"
  [HUBSPOT_ACCESS_TOKEN]="bezhas-hubspot-access-token"
  [LINKEDIN_CLIENT_ID]="bezhas-linkedin-client-id"
  [LINKEDIN_CLIENT_SECRET]="bezhas-linkedin-client-secret"
  [LINKEDIN_ACCESS_TOKEN]="bezhas-linkedin-access-token"
  [GOOGLE_CLIENT_ID]="bezhas-google-client-id"
  [GOOGLE_CLIENT_SECRET]="bezhas-google-client-secret"
  [GITHUB_CLIENT_ID]="bezhas-github-client-id"
  [GITHUB_CLIENT_SECRET]="bezhas-github-client-secret"
  [STRIPE_SECRET_KEY]="STRIPE_SECRET_KEY"
  [STRIPE_PUBLISHABLE_KEY]="bezhas-stripe-publishable-key"
  # Chain signer keys — strongly prefer a KMS/HSM signer in production.
  [DEPLOYER_PRIVATE_KEY]="bezhas-deployer-private-key"
  [BATCHER_PRIVATE_KEY]="bezhas-batcher-private-key"
  [EDGE_NODE_PRIVATE_KEY]="bezhas-edge-node-private-key"
)

is_placeholder() {
  local v="${1,,}"
  [[ -z "$v" ]] && return 0
  case "$v" in
    *"<"*|*"changeme"*|*"your_"*|*"your-"*|*"example"*|*"placeholder"*|*"xxxx"*) return 0 ;;
  esac
  return 1
}

# Read a KEY=value from the env file without sourcing it (avoids code execution).
read_env_value() {
  local key="$1"
  # last matching assignment wins; strip surrounding quotes and trailing CR
  sed -n -E "s/^${key}=(.*)$/\1/p" "${ENV_FILE}" | tail -n1 | tr -d '\r' | sed -E 's/^"(.*)"$/\1/; s/^'\''(.*)'\''$/\1/'
}

create_or_update_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "${name}" --project="${GCP_PROJECT_ID}" --quiet >/dev/null 2>&1; then
    printf '%s' "${value}" | gcloud secrets versions add "${name}" --project="${GCP_PROJECT_ID}" --data-file=- --quiet
    log "updated ${name}"
  else
    printf '%s' "${value}" | gcloud secrets create "${name}" --project="${GCP_PROJECT_ID}" --replication-policy=automatic --data-file=- --quiet
    log "created ${name}"
  fi
}

seeded=0; skipped=0
for env_key in "${!SECRET_MAP[@]}"; do
  value="$(read_env_value "${env_key}")"
  if is_placeholder "${value}"; then
    skipped=$((skipped+1)); continue
  fi
  create_or_update_secret "${SECRET_MAP[$env_key]}" "${value}"
  seeded=$((seeded+1))
done

log "done. seeded=${seeded} skipped(empty/placeholder)=${skipped}"
log "Next: run scripts/gcp-deploy.sh to deploy Cloud Run services that reference these secrets."
