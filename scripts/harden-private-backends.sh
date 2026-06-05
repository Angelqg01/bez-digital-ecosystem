#!/usr/bin/env bash
#
# harden-private-backends.sh
# ---------------------------------------------------------------------------
# Applies the IAM "ingress hardening" for the private Cloud Run backends
# (bezhas-aegis, bezhas-ai-gateway, bezhas-agent-runtime):
#
#   1. Grant the runtime service account roles/run.invoker on each.
#   2. Remove public (allUsers) invoker access from each.
#   3. Verify the resulting IAM policy.
#
# Safe to re-run (idempotent). Run this ONLY AFTER deploying the caller images
# that attach OIDC ID tokens (api / ai-engine / agent-runtime / bezhas-edge-node)
# — otherwise service-to-service calls will start returning 403.
# See infrastructure/gcp/INGRESS-HARDENING.md for the full rationale.
#
# Usage:
#   scripts/harden-private-backends.sh --dry-run     # show what would change
#   scripts/harden-private-backends.sh               # apply (asks to confirm)
#   scripts/harden-private-backends.sh --yes         # apply without prompting
#   scripts/harden-private-backends.sh --rollback    # re-allow public access
#
# Env overrides: PROJECT, REGION, SA
# ---------------------------------------------------------------------------
set -euo pipefail

PROJECT="${PROJECT:-totemic-bonus-479312-c6}"
REGION="${REGION:-europe-west1}"
SA="${SA:-bezhas-run@${PROJECT}.iam.gserviceaccount.com}"
PRIVATE_SERVICES=(bezhas-aegis bezhas-ai-gateway bezhas-agent-runtime)

DRY_RUN=false
ASSUME_YES=false
ROLLBACK=false
for arg in "$@"; do
  case "$arg" in
    --dry-run)  DRY_RUN=true ;;
    --yes|-y)   ASSUME_YES=true ;;
    --rollback) ROLLBACK=true ;;
    -h|--help)  grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

c_red=$'\e[31m'; c_grn=$'\e[32m'; c_ylw=$'\e[33m'; c_rst=$'\e[0m'
log()  { echo "${c_ylw}▶${c_rst} $*"; }
ok()   { echo "${c_grn}✔${c_rst} $*"; }
die()  { echo "${c_red}[x]${c_rst} $*" >&2; exit 1; }

run() {
  if $DRY_RUN; then
    echo "   ${c_ylw}[dry-run]${c_rst} $*"
  else
    "$@"
  fi
}

# ── Preflight ──────────────────────────────────────────────────────────────
command -v gcloud >/dev/null 2>&1 || die "gcloud not found on PATH."
# Fail fast if the Cloud SDK install is broken (the known core.cache issue).
gcloud --version >/dev/null 2>&1 || die "gcloud failed to load (corrupt SDK?). Run from a healthy Cloud SDK / Cloud Shell."
gcloud config set project "$PROJECT" >/dev/null 2>&1 || die "Could not select project $PROJECT."
log "Project: $PROJECT   Region: $REGION   SA: $SA"

show_policy() {
  local svc="$1"
  echo "   ── $svc ──"
  gcloud run services get-iam-policy "$svc" --region "$REGION" \
    --flatten="bindings[].members" \
    --format="value(bindings.role, bindings.members)" 2>/dev/null \
    | sed 's/^/     /' || echo "     (could not read policy)"
}

if $ROLLBACK; then
  log "ROLLBACK: re-allowing public (allUsers) invocation."
  for svc in "${PRIVATE_SERVICES[@]}"; do
    run gcloud run services add-iam-policy-binding "$svc" \
      --region "$REGION" --member allUsers --role roles/run.invoker --quiet
  done
  ok "Rollback complete. Services are public again."
  exit 0
fi

# ── Confirm ────────────────────────────────────────────────────────────────
if ! $DRY_RUN && ! $ASSUME_YES; then
  echo "About to make ${PRIVATE_SERVICES[*]} PRIVATE (IAM-authenticated only)."
  echo "Ensure the caller images that send OIDC tokens are already deployed."
  read -r -p "Proceed? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || die "Aborted by user."
fi

# ── Step 1: grant SA invoker (idempotent) ──────────────────────────────────
log "Granting roles/run.invoker to $SA on private backends..."
for svc in "${PRIVATE_SERVICES[@]}"; do
  run gcloud run services add-iam-policy-binding "$svc" \
    --region "$REGION" \
    --member "serviceAccount:${SA}" \
    --role roles/run.invoker --quiet
done
ok "Service-account invoker grants ensured."

# ── Step 2: remove public access ───────────────────────────────────────────
log "Removing public (allUsers) invoker from private backends..."
for svc in "${PRIVATE_SERVICES[@]}"; do
  # '|| true' keeps it idempotent: no-op if the binding is already gone.
  run gcloud run services remove-iam-policy-binding "$svc" \
    --region "$REGION" --member allUsers --role roles/run.invoker --quiet 2>/dev/null || true
done
ok "Public access removed."

# ── Step 3: verify ─────────────────────────────────────────────────────────
log "Final IAM policies:"
for svc in "${PRIVATE_SERVICES[@]}"; do
  show_policy "$svc"
done

if $DRY_RUN; then
  echo
  ok "Dry-run only — no changes were made."
else
  echo
  ok "Done. allUsers should be absent and ${SA} should hold roles/run.invoker."
  echo "  Smoke-test a caller (e.g. api -> aegis) and watch logs for 403s."
  echo "  Rollback if needed: scripts/harden-private-backends.sh --rollback"
fi
