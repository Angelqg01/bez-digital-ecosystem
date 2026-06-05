# GCP Service-to-Service Auth Hardening (private backends)

Goal: stop `bezhas-aegis`, `bezhas-ai-gateway` and `bezhas-agent-runtime` from
being publicly invokable, while keeping `ingress=all` (so existing public
service-to-service calls over `run.app` keep working). Access is gated by **IAM
auth**: callers present a Google-signed OIDC ID token; only the runtime service
account `bezhas-run@<project>.iam.gserviceaccount.com` may invoke them.

This is the approach chosen over flipping `ingress=internal`, because the
services call each other by their public `run.app` URLs with
`--vpc-egress private-ranges-only` (i.e. over the public internet, not the VPC),
so `internal` ingress would break them.

## What already ships in code / IaC

- **Callers attach ID tokens** automatically via a global axios interceptor:
  - `api/services/gcpServiceAuth.js` (+ wired in `api/index.js`)
  - `ai-engine/gcpServiceAuth.js` (+ `server.js`)
  - `agent-runtime/gcpServiceAuth.js` (+ `index.js`)
  - `bezhas-edge-node/gcpServiceAuth.js` (+ `server.js`)
  It is a **no-op in local dev** (localhost targets) and **fails open** (a token
  mint failure never blocks the call). Audience = the target service origin from
  `AEGIS_URL` / `AEGIS_API_URL` / `AI_ENGINE_URL` / `AI_GATEWAY_URL` / `MCP_URL` /
  `AGENT_RUNTIME_URL`.
- **IAM grants** for the runtime SA on the 3 private services:
  - Terraform: `infrastructure/gcp/main.tf` (`*_invoker` resources)
  - Deploy script: `scripts/gcp-deploy.sh` (loop after agent-runtime deploy)

## Correct ordering (avoid downtime)

The token-sending code MUST be live **before** public access is removed.

1. Deploy the updated images for `api`, `ai-engine`, `agent-runtime`,
   `bezhas-edge-node` (they now send ID tokens).
2. Grant the runtime SA `run.invoker` on the 3 private services.
3. Only then remove `allUsers` from the 3 private services.

`scripts/gcp-deploy.sh` already does (1) and (2). Step (3) is below.

## Manual commands (run when gcloud is healthy)

```bash
PROJECT=totemic-bonus-479312-c6
REGION=europe-west1
SA="bezhas-run@${PROJECT}.iam.gserviceaccount.com"

# (2) Grant the SA invoker on each private backend (idempotent)
for SVC in bezhas-aegis bezhas-ai-gateway bezhas-agent-runtime; do
  gcloud run services add-iam-policy-binding "$SVC" \
    --region "$REGION" \
    --member "serviceAccount:${SA}" \
    --role roles/run.invoker
done

# (3) Remove public (unauthenticated) access from each private backend
for SVC in bezhas-aegis bezhas-ai-gateway bezhas-agent-runtime; do
  gcloud run services remove-iam-policy-binding "$SVC" \
    --region "$REGION" \
    --member allUsers \
    --role roles/run.invoker || true
done

# Verify: allUsers should be gone, the SA should remain
for SVC in bezhas-aegis bezhas-ai-gateway bezhas-agent-runtime; do
  echo "== $SVC =="
  gcloud run services get-iam-policy "$SVC" --region "$REGION" \
    --format="value(bindings.role,bindings.members)"
done
```

## Rollback

Re-allow public invocation (reverts to pre-hardening state):

```bash
for SVC in bezhas-aegis bezhas-ai-gateway bezhas-agent-runtime; do
  gcloud run services add-iam-policy-binding "$SVC" \
    --region europe-west1 --member allUsers --role roles/run.invoker
done
```

## Notes

- `gcloud` on the current dev box was intermittently failing to load
  (`ModuleNotFoundError: googlecloudsdk.core.cache`). Run these from a healthy
  Cloud SDK / Cloud Shell. A partial run is safe to re-run (idempotent).
- `bezhas-api`, `bezhas-edge-node`, `bezhas-control-center` and the 13 SubApps
  stay public (`allUsers`) — they are browser-facing.
