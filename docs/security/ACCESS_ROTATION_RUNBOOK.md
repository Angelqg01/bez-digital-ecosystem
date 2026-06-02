# BeZhas Access Rotation Runbook

Last updated: 2026-05-08

## Access model

- Core BeZhas is private: `SUPER_ADMIN`, `ADMIN`, `DEVELOPER`, `DEVOPS`, and `SECURITY` only.
- Clients, external developers, and companies must use SubApps, scoped API keys, SDKs, or tenant dashboards.
- Admin entry point: `http://127.0.0.1:3000/admin/login`.
- Do not store real passwords, API keys, wallet private keys, or webhook secrets in this document.

## Bootstrap admin

Use this only to recover or initialize the admin dashboard. Disable it after the first successful setup.

Required environment variables:

```bash
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD_HASH=<bcrypt-hash-only>
BOOTSTRAP_ADMIN_EXPIRES_AT=2026-05-09T00:00:00Z
BOOTSTRAP_ADMIN_FORCE_PASSWORD_CHANGE=true
BOOTSTRAP_ADMIN_REQUIRE_2FA=true
```

Generate a temporary password and bcrypt hash locally:

```bash
node -e "const crypto=require('crypto'); console.log(crypto.randomBytes(24).toString('base64url'))"
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(process.argv[1], 12).then(console.log)" "<temporary-password>"
```

After login:

1. Change the admin password in the dashboard.
2. Configure 2FA.
3. The bootstrap completion flow stores the permanent local admin hash in `.runtime/core-admin.json`.
4. Set `BOOTSTRAP_ADMIN_DISABLED=true` or remove the bootstrap variables.
5. Restart the service.

Runtime local admin store:

```bash
LOCAL_ADMIN_STORE_PATH=./.runtime/core-admin.json
```

The runtime store must never be committed. It contains a bcrypt hash, not the raw password.

## Quick SuperAdmin credentials

Local Core also supports a fast username/password login for one authorized SuperAdmin wallet. This is intended for local/internal operations only and must still be rotated like any other privileged secret.

```bash
QUICK_SUPER_ADMIN_WALLET=0x52df82920cbae522880dd7657e43d1a754ed044e
QUICK_SUPER_ADMIN_USERNAME=superadmin
QUICK_SUPER_ADMIN_PASSWORD_HASH=<bcrypt-hash-only>
QUICK_SUPER_ADMIN_REQUIRE_2FA=false
```

Rotate the quick password:

```bash
node -e "const crypto=require('crypto'); console.log(crypto.randomBytes(24).toString('base64url'))"
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(process.argv[1], 12).then(console.log)" "<new-temporary-password>"
```

Replace only `QUICK_SUPER_ADMIN_PASSWORD_HASH`, restart the backend, login at `http://127.0.0.1:3000/admin/login`, and move to a permanent 2FA-backed admin method when ready. Do not store the raw password in this document.

## Rotation inventory

| Secret family | Env names | Where used | Rotation status | New storage location |
| --- | --- | --- | --- | --- |
| Admin bootstrap | `BOOTSTRAP_ADMIN_*` | BeZhas Hub admin auth | ROTATE_NOW | Secret manager |
| JWT signing | `JWT_SECRET`, refresh/access secrets | Hub backend, API gateway, auth middleware | ROTATE_NOW | Secret manager |
| Core internal auth | `INTERNAL_API_KEY`, `AGENT_RUNTIME_API_KEY`, `BEZHAS_AGENT_API_KEY` | Agent runtime, ai-engine, AI agent server | ROTATE_NOW | Secret manager |
| Gateway/node heartbeat | `NODE_HEARTBEAT_API_KEY`, node API keys | API Gateway node metrics | ROTATE_NOW | Secret manager |
| Enterprise B2B | `API_KEY`, `CONTROL_JWT`, `BEZHAS_PLATFORM_API_KEY` | enterprise-node | ROTATE_NOW | Secret manager |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, chat IDs | messaging-mcp | ROTATE_NOW | Secret manager |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | payment/webhook routes | ROTATE_NOW | Stripe dashboard + secret manager |
| OAuth | `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_SECRET`, `LINKEDIN_CLIENT_SECRET` | OAuth/social login | ROTATE_NOW | Provider console + secret manager |
| AI providers | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` | AI/agent services | ROTATE_NOW | Provider console + secret manager |
| Wallets/relayers | `PRIVATE_KEY`, `HOT_WALLET_PRIVATE_KEY`, `RELAYER_PRIVATE_KEY`, `DEPLOYER_PRIVATE_KEY`, `BATCHER_PRIVATE_KEY` | contracts, relayers, automation | ROTATE_NOW | Hardware wallet/KMS/multisig |
| Webhooks | `EDGE_NODE_WEBHOOK_SECRET`, provider webhook secrets | inbound webhook routes | ROTATE_NOW | Secret manager |

## Rotation procedure

1. Revoke exposed provider keys first: AI, Stripe, OAuth, Telegram.
2. Move blockchain authority to fresh keys. Prefer multisig/hardware/KMS for hot wallet and relayer roles.
3. Generate new JWT and internal service keys with at least 32 random bytes.
4. Deploy secrets through the secret manager or environment injection, not repo files.
5. Restart services and verify health.
6. Invalidate existing sessions and old JWTs.
7. Remove real `.env` files from tracked/source-distributed folders and keep only `.env.example`.
8. Add secret scanning to CI before merges.

## Verification checklist

- `/admin/*` and `/dashboard/*` redirect without session.
- Agent Runtime rejects unauthenticated `/api/tasks`, `/api/events`, `/api/hitl/*`.
- API Gateway rejects unauthenticated mutating SubApp endpoints.
- Enterprise hooks reject private, loopback, link-local, and metadata URLs.
- Telegram webhook rejects requests without `X-Telegram-Bot-Api-Secret-Token`.
- Production refuses default or missing critical secrets.
- Local/CI secret scan runs before deployment:

```bash
npm run security:scan-secrets
```

Current findings must be treated as exposed material: rotate them first, then replace committed copies with placeholders or move them to the secret manager.
