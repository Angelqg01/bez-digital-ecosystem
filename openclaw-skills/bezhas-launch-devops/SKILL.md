---
name: bezhas-launch-devops
description: "Use when preparing BeZhas for online launch, GCP deployment, Docker Compose production checks, OpenClaw upgrades, secret rotation, smoke tests, monitoring, rollback, or release readiness."
---

# BeZhas Launch DevOps

Prepare and verify production launch.

## Release Gates

- Secrets are not stored in tracked files.
- OpenClaw is patched to a non-vulnerable version.
- Backend, frontend, AEGIS, OpenClaw, Redis, DB, and Ollama health checks pass.
- Admin routes are protected and not listed in public sidebars.
- Campaign sending requires approval in production.

## GCP Checklist

1. Build images from clean working tree or approved release branch.
2. Load secrets from GCP Secret Manager or runtime env vars.
3. Deploy backend and frontend using existing `cloudbuild.yaml`/GCP config.
4. Verify HTTPS, CORS, auth cookies, API base URLs, and webhook URLs.
5. Run smoke tests and keep rollback target ready.

## Smoke Tests

```text
GET /api/health
GET /api/openclaw/health
GET /api/agents/status
GET /api/aegis/status
GET frontend /
GET control-center /dashboard
ollama /api/version
redis ping
db connection
```
